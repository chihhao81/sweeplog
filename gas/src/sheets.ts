import { SHEETS, type SheetName } from './schema'

export function spreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet()
}

/** Creates any missing sheets with a frozen, bold header row. Never touches existing data. */
export function ensureSheets(): { created: string[]; existing: string[] } {
  const ss = spreadsheet()
  const created: string[] = []
  const existing: string[] = []

  for (const name of Object.keys(SHEETS) as SheetName[]) {
    const headers = SHEETS[name] as readonly string[]
    let sheet = ss.getSheetByName(name)
    if (sheet) {
      existing.push(name)
      addMissingHeaders(sheet, headers)
      continue
    }
    sheet = ss.insertSheet(name)
    sheet.getRange(1, 1, 1, headers.length).setValues([[...headers]]).setFontWeight('bold')
    sheet.setFrozenRows(1)
    created.push(name)
  }

  // A fresh spreadsheet starts with an empty default sheet; drop it once ours exist.
  for (const name of ['Sheet1', '工作表1']) {
    const blank = ss.getSheetByName(name)
    if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank)
  }

  return { created, existing }
}

/** Appends columns added to the schema after the sheet was created. */
function addMissingHeaders(sheet: GoogleAppsScript.Spreadsheet.Sheet, headers: readonly string[]) {
  const lastCol = sheet.getLastColumn()
  const current = lastCol > 0 ? (sheet.getRange(1, 1, 1, lastCol).getValues()[0] as string[]) : []
  const missing = headers.filter((h) => !current.includes(h))
  if (missing.length === 0) return
  sheet
    .getRange(1, current.length + 1, 1, missing.length)
    .setValues([missing])
    .setFontWeight('bold')
  if (sheet.getFrozenRows() === 0) sheet.setFrozenRows(1)
}
