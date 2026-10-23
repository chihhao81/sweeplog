// Connection settings live only in this browser. The repo is public,
// so the GAS URL and token must never be committed.

const KEY = 'sweeplog.connection'

export interface Connection {
  apiUrl: string
  token: string
}

export function loadConnection(): Connection | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Connection>
    if (!parsed.apiUrl || !parsed.token) return null
    return { apiUrl: parsed.apiUrl, token: parsed.token }
  } catch {
    return null
  }
}

export function saveConnection(conn: Connection) {
  localStorage.setItem(KEY, JSON.stringify(conn))
}

export function clearConnection() {
  localStorage.removeItem(KEY)
}

const ACCOUNT_KEY = 'sweeplog.lastAccount'

/** The account used by the most recent import. */
export function lastAccount(): string {
  try {
    return localStorage.getItem(ACCOUNT_KEY) ?? ''
  } catch {
    return ''
  }
}

export function rememberAccount(accountName: string) {
  try {
    localStorage.setItem(ACCOUNT_KEY, accountName)
  } catch {
    // Storage unavailable; the field just won't be prefilled next time.
  }
}
