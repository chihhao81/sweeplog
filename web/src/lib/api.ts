import { loadConnection, type Connection } from './settings'
import type { JournalOptions } from './options'
import type { JournalEntry, Order, Position, PositionDerived, PositionManual, Trade } from './types'

// Mirrors gas/src/types.ts. Keep the two in sync.
export interface ApiOk<T> {
  ok: true
  data: T
}
export interface ApiErr {
  ok: false
  error: string
}
export type ApiResponse<T> = ApiOk<T> | ApiErr

export interface PingResult {
  version: string
  spreadsheetName: string
  sheets: string[]
  serverTime: string
}

export interface SetupResult {
  created: string[]
  existing: string[]
}

export interface UpsertResult {
  inserted: number
  updated: number
  unchanged: number
}

export interface ImportResult {
  trades: UpsertResult
  orders: UpsertResult
  positions: UpsertResult
}

export interface ImportPayload {
  trades: Trade[]
  orders: Order[]
  positions: Partial<PositionDerived>[]
}

export class ApiError extends Error {}

/**
 * Calls the GAS web app. Uses text/plain so the browser sends a "simple"
 * request with no CORS preflight, which Apps Script cannot answer.
 */
export async function callApi<T>(
  action: string,
  payload: unknown = {},
  conn: Connection | null = loadConnection(),
): Promise<T> {
  if (!conn) throw new ApiError('尚未設定 GAS 連線，請到「設定」頁填寫')

  const res = await fetch(conn.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token: conn.token, payload }),
    redirect: 'follow',
  })
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`)

  const body = (await res.json()) as ApiResponse<T>
  if (!body.ok) throw new ApiError(body.error)
  return body.data
}

export const api = {
  ping: (conn?: Connection) => callApi<PingResult>('ping', {}, conn),
  setup: () => callApi<SetupResult>('setup'),
  existingIds: () => callApi<{ trades: string[]; orders: string[] }>('existingIds'),
  importData: (payload: ImportPayload) => callApi<ImportResult>('importData', payload),
  listPositions: (range: { from?: string; to?: string } = {}) =>
    callApi<Position[]>('listPositions', range),
  listTrades: (filter: { tradeDay?: string; positionIds?: string[] }) =>
    callApi<Trade[]>('listTrades', filter),
  updatePosition: (positionId: string, fields: Partial<PositionManual>) =>
    callApi<Partial<Position>>('updatePosition', { positionId, fields }),
  listJournal: (range: { from?: string; to?: string } = {}) =>
    callApi<JournalEntry[]>('listJournal', range),
  saveJournal: (entry: JournalEntry) => callApi<JournalEntry>('saveJournal', { entry }),
  getOptions: () => callApi<Partial<JournalOptions> | null>('getOptions'),
  saveOptions: (options: JournalOptions) => callApi<JournalOptions>('saveOptions', { options }),
}
