import { getToken, isAuthorized, rotateToken } from './auth'
import { ensureSheets, spreadsheet } from './sheets'

const VERSION = '0.1.0'

type Handler = (payload: unknown) => unknown

// Every action requires the API token. Add new actions here.
const ACTIONS: Record<string, Handler> = {
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

function withLock<T>(fn: () => T): T {
  const lock = LockService.getScriptLock()
  lock.waitLock(30_000)
  try {
    return fn()
  } finally {
    lock.releaseLock()
  }
}
