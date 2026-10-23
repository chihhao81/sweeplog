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
