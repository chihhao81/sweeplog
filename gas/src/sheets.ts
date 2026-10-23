import { RETIRED_SHEETS, SHEETS, type ColumnType, type SheetName } from './schema'

type Sheet = GoogleAppsScript.Spreadsheet.Sheet
type Cell = string | number | boolean
export type Row = Record<string, Cell | null>

export function spreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet()
}

function columnsOf(name: SheetName): Record<string, ColumnType> {
  return SHEETS[name].columns as Record<string, ColumnType>
}

function getSheet(name: SheetName): Sheet {
  const sheet = spreadsheet().getSheetByName(name)
  if (!sheet) throw new Error(`找不到工作表「${name}」，請先在設定頁初始化`)
  return sheet
}

// ---- Setup ----

/** Creates missing sheets and columns. Never deletes data. */
export function ensureSheets(): { created: string[]; existing: string[] } {
  const ss = spreadsheet()
  const created: string[] = []
  const existing: string[] = []

  for (const name of Object.keys(SHEETS) as SheetName[]) {
    const headers = Object.keys(columnsOf(name))
    let sheet = ss.getSheetByName(name)
    if (!sheet) {
      sheet = ss.insertSheet(name)
      writeHeaders(sheet, headers)
      created.push(name)
    } else if (sheet.getLastRow() <= 1) {
      // No data yet: safe to reset the header to the current schema.
      sheet.clear()
      writeHeaders(sheet, headers)
      existing.push(name)
    } else {
      appendMissingHeaders(sheet, headers)
      existing.push(name)
    }
  }

  // Drop the default blank sheet and empty sheets from older schema versions.
  for (const name of ['Sheet1', '工作表1', ...RETIRED_SHEETS]) {
    const sheet = ss.getSheetByName(name)
    if (sheet && sheet.getLastRow() <= 1 && ss.getSheets().length > 1) ss.deleteSheet(sheet)
  }

  return { created, existing }
}

function writeHeaders(sheet: Sheet, headers: string[]) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold')
  sheet.setFrozenRows(1)
}

function appendMissingHeaders(sheet: Sheet, headers: string[]) {
  const current = readHeaders(sheet)
  const missing = headers.filter((h) => !current.includes(h))
  if (missing.length === 0) return
  sheet
    .getRange(1, current.length + 1, 1, missing.length)
    .setValues([missing])
    .setFontWeight('bold')
}

function readHeaders(sheet: Sheet): string[] {
  const lastCol = sheet.getLastColumn()
  return lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : []
}

// ---- Read ----

export function readRows(name: SheetName): Row[] {
  const sheet = getSheet(name)
  const values = sheet.getDataRange().getValues()
  const [headers, ...data] = values
  if (!headers) return []
  return data.map((r) => {
    const row: Row = {}
    headers.forEach((h, i) => {
      if (h !== '') row[String(h)] = r[i] === '' ? null : (r[i] as Cell)
    })
    return row
  })
}

// ---- Upsert ----

export interface UpsertResult {
  inserted: number
  updated: number
  unchanged: number
}

/**
 * Inserts or updates rows by the sheet's key column. Only the fields present
 * on an incoming row are written, so imports never clobber manual columns.
 */
export function upsertRows(name: SheetName, rows: Row[], opts: { insert?: boolean } = {}): UpsertResult {
  const allowInsert = opts.insert ?? true
  const result: UpsertResult = { inserted: 0, updated: 0, unchanged: 0 }
  if (rows.length === 0) return result

  const sheet = getSheet(name)
  const columns = columnsOf(name)
  const keyField = SHEETS[name].key
  const headers = readHeaders(sheet)
  const width = headers.length
  const colIndex = new Map(headers.map((h, i) => [h, i]))

  const lastRow = sheet.getLastRow()
  const existing = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, width).getValues() : []
  const keyCol = colIndex.get(keyField)
  if (keyCol === undefined) throw new Error(`${name} 缺少主鍵欄位 ${keyField}`)
  const rowByKey = new Map(existing.map((r, i) => [String(r[keyCol]), i]))

  const appended: Cell[][] = []
  let dirty = false

  for (const row of rows) {
    const key = row[keyField]
    if (key === null || key === undefined || key === '') continue
    const idx = rowByKey.get(String(key))
    if (idx === undefined && !allowInsert) throw new Error(`${name} 找不到 ${keyField}=${key}`)
    const target = idx === undefined ? new Array<Cell>(width).fill('') : existing[idx]
    let changed = false

    for (const [field, raw] of Object.entries(row)) {
      const col = colIndex.get(field)
      const type = columns[field]
      if (col === undefined || !type) continue
      const value = toCell(raw, type)
      if (!sameCell(target[col], value)) {
        target[col] = value
        changed = true
      }
    }

    if (idx === undefined) {
      appended.push(target)
      rowByKey.set(String(key), existing.length + appended.length - 1)
      result.inserted++
    } else if (changed) {
      dirty = true
      result.updated++
    } else {
      result.unchanged++
    }
  }

  const formats = headers.map((h) => (columns[h] === 'text' ? '@' : 'General'))
  if (dirty) writeBlock(sheet, 2, existing, formats)
  if (appended.length > 0) writeBlock(sheet, lastRow + 1, appended, formats)
  return result
}

function writeBlock(sheet: Sheet, startRow: number, values: Cell[][], formats: string[]) {
  const range = sheet.getRange(startRow, 1, values.length, formats.length)
  range.setNumberFormats(values.map(() => formats))
  range.setValues(values)
}

function toCell(raw: unknown, type: ColumnType): Cell {
  if (raw === null || raw === undefined || raw === '') return ''
  if (type === 'number') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : ''
  }
  if (type === 'bool') return raw === true || raw === 'true' || raw === 'TRUE'
  return String(raw)
}

function sameCell(a: unknown, b: Cell): boolean {
  if (typeof b === 'number' && a !== '') return Number(a) === b
  return String(a) === String(b)
}
