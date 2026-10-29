import { getToken, isAuthorized, rotateToken } from './auth'
import { SHEETS, type SheetName } from './schema'
import { ensureSheets, readRows, spreadsheet, upsertRows, type Row } from './sheets'
import {
  checkDriveAccess,
  deleteScreenshot,
  listScreenshots,
  updateScreenshot,
  uploadScreenshot,
  type UploadInput,
} from './screenshots'

const VERSION = '0.6.0'

type Handler = (payload: any) => unknown

// Every action requires the API token. Add new actions here.
const ACTIONS: Record<string, Handler> = {
  /** IDs already stored, so the import preview can flag duplicates. */
  existingIds: () => ({
    trades: readRows('Trades').map((r) => String(r.id)),
    orders: readRows('Orders').map((r) => String(r.id)),
  }),

  importData: (p: { trades?: Row[]; orders?: Row[]; positions?: Row[] }) =>
    withLock(() => {
      const importedAt = new Date().toISOString()
      const stamp = (rows: Row[] = []) => rows.map((r) => ({ ...r, importedAt }))
      return {
        trades: upsertRows('Trades', stamp(p.trades)),
        orders: upsertRows('Orders', stamp(p.orders)),
        positions: upsertRows('Positions', stamp(p.positions)),
      }
    }),

  listPositions: (p: { from?: string; to?: string }) =>
    readRows('Positions').filter((r) => inRange(String(r.tradeDay), p.from, p.to)),

  uploadScreenshot: (p: UploadInput) => withLock(() => uploadScreenshot(p)),
  listScreenshots: (p: { date?: string }) => listScreenshots(p.date),
  updateScreenshot: (p: { id: string; caption?: string | null; positionIds?: string[] }) =>
    withLock(() => updateScreenshot(p)),
  deleteScreenshot: (p: { id: string }) => withLock(() => deleteScreenshot(p.id)),

  /** Saves the journal fields of one position. Import-derived columns are not writable here. */
  updatePosition: (p: { positionId: string; fields: Row }) =>
    withLock(() => {
      const fields = pick(p.fields, MANUAL_POSITION_FIELDS)
      const row: Row = { ...fields, positionId: p.positionId, updatedAt: new Date().toISOString() }
      upsertRows('Positions', [row], { insert: false })
      return row
    }),

  listJournal: (p: { from?: string; to?: string }) =>
    readRows('DailyJournal').filter((r) => inRange(String(r.date), p.from, p.to)),

  saveJournal: (p: { entry: Row }) =>
    withLock(() => {
      const date = String(p.entry.date ?? '')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('日誌缺少日期')
      const accountName = String(p.entry.accountName ?? '')
      const row: Row = { ...p.entry, id: `${date}|${accountName}`, updatedAt: new Date().toISOString() }
      upsertRows('DailyJournal', [row])
      return row
    }),

  /** Every sheet's rows, for a JSON backup. Read-only. */
  exportAll: () => {
    const data: Record<string, Row[]> = {}
    for (const name of Object.keys(SHEETS) as SheetName[]) data[name] = readRows(name)
    return { version: VERSION, exportedAt: new Date().toISOString(), sheets: data }
  },

  /** Dropdown options, stored as JSON under Settings key "options". Null until first saved. */
  getOptions: () => {
    const row = readRows('Settings').find((r) => r.key === 'options')
    return row?.value ? JSON.parse(String(row.value)) : null
  },

  saveOptions: (p: { options: unknown }) =>
    withLock(() => {
      upsertRows('Settings', [{ key: 'options', value: JSON.stringify(p.options) }])
      return p.options
    }),

  /** Single-value settings (see SETTING_KEYS), as { key: value }. */
  getSettings: () => {
    const out: Record<string, string | null> = {}
    for (const r of readRows('Settings')) {
      const key = String(r.key)
      if (SETTING_KEYS.includes(key)) out[key] = r.value === '' || r.value == null ? null : String(r.value)
    }
    return out
  },

  saveSetting: (p: { key: string; value: string | null }) =>
    withLock(() => {
      if (!SETTING_KEYS.includes(p.key)) throw new Error(`不支援的設定：${p.key}`)
      upsertRows('Settings', [{ key: p.key, value: p.value ?? '' }])
      return { key: p.key, value: p.value }
    }),

  listTrades: (p: { tradeDay?: string; positionIds?: string[] }) => {
    const ids = p.positionIds ? new Set(p.positionIds) : null
    return readRows('Trades').filter(
      (r) =>
        (!p.tradeDay || r.tradeDay === p.tradeDay) && (!ids || ids.has(String(r.positionId))),
    )
  },

  ping: () => ({
    version: VERSION,
    spreadsheetName: spreadsheet().getName(),
    sheets: spreadsheet()
      .getSheets()
      .map((s) => s.getName()),
    serverTime: new Date().toISOString(),
  }),
  setup: () => withLock(ensureSheets),
}

// ---- Web app entry points ----

export function doGet() {
  return json({ ok: true, data: { name: 'sweeplog', version: VERSION } })
}

export function doPost(e: GoogleAppsScript.Events.DoPost) {
  try {
    const req = JSON.parse(e.postData?.contents ?? '{}') as {
      action?: string
      token?: string
      payload?: unknown
    }
    if (!isAuthorized(req.token)) return json({ ok: false, error: 'Token 無效' })

    const handler = req.action ? ACTIONS[req.action] : undefined
    if (!handler) return json({ ok: false, error: `未知的 action：${req.action}` })

    return json({ ok: true, data: handler(req.payload ?? {}) })
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}

// ---- Run manually from the Apps Script editor ----

export function setupSheets() {
  Logger.log(JSON.stringify(ensureSheets()))
}

/** Generates a new API token (invalidates the old one) and logs it. */
export function initToken() {
  Logger.log('API_TOKEN = ' + rotateToken())
}

/** Grants the Drive permission screenshots need; run from the editor after upgrading. */
export function authorizeDrive() {
  Logger.log('Drive OK (read + write), screenshot folder: ' + checkDriveAccess())
}

export function showToken() {
  Logger.log('API_TOKEN = ' + (getToken() ?? '(not set, run initToken)'))
}

// ---- Helpers ----

function json(body: unknown) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON,
  )
}

/** Keys writable through saveSetting. `xpStartDate`: XP only counts trade days from this date on. */
const SETTING_KEYS = ['xpStartDate']

const MANUAL_POSITION_FIELDS = [
  'riskOverride',
  'setup',
  'htfBias',
  'entryTimeframe',
  'entryTrigger',
  'followedPlan',
  'mistakes',
  'emotionBefore',
  'emotionAfter',
  'grade',
  'notes',
  'lesson',
]

function pick(row: Row, keys: string[]): Row {
  const out: Row = {}
  for (const k of keys) if (k in row) out[k] = row[k]
  return out
}

function inRange(day: string, from?: string, to?: string) {
  return (!from || day >= from) && (!to || day <= to)
}

function withLock<T>(fn: () => T): T {
  const lock = LockService.getScriptLock()
  lock.waitLock(30_000)
  try {
    return fn()
  } finally {
    lock.releaseLock()
  }
}
