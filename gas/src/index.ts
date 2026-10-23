import { getToken, isAuthorized, rotateToken } from './auth'
import { ensureSheets, readRows, spreadsheet, upsertRows, type Row } from './sheets'

const VERSION = '0.2.0'

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

export function showToken() {
  Logger.log('API_TOKEN = ' + (getToken() ?? '(not set, run initToken)'))
}

// ---- Helpers ----

function json(body: unknown) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON,
  )
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
