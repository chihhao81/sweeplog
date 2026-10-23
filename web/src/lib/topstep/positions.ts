import type { Order, PositionDerived, Session, Trade } from '@/lib/types'
import { pointValue } from './contracts'

type ParsedTrade = Omit<Trade, 'accountName' | 'positionId'>

const time = (iso: string) => Date.parse(iso)
const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp

/**
 * Groups Topstep trades into positions. Topstep reports every contract as its
 * own trade, so a scale-in or partial exit shows up as several overlapping
 * trades; those belong to one position. A trade joins the open position on the
 * same contract and side when it enters before that position's last exit.
 */
export function buildPositions(
  parsed: ParsedTrade[],
  orders: Order[],
  accountName: string,
): { trades: Trade[]; positions: PositionDerived[] } {
  const sorted = [...parsed].sort((a, b) => time(a.enteredAt) - time(b.enteredAt) || a.id.localeCompare(b.id))
  const groups: ParsedTrade[][] = []
  const open = new Map<string, { trades: ParsedTrade[]; end: number }>()

  for (const t of sorted) {
    const key = `${t.contractName}|${t.side}`
    const g = open.get(key)
    if (g && time(t.enteredAt) < g.end) {
      g.trades.push(t)
      g.end = Math.max(g.end, time(t.exitedAt))
    } else {
      const next = { trades: [t], end: time(t.exitedAt) }
      open.set(key, next)
      groups.push(next.trades)
    }
  }

  const trades: Trade[] = []
  const positions = groups.map((g) => {
    const p = summarize(g, orders, accountName)
    for (const t of g) trades.push({ ...t, accountName, positionId: p.positionId })
    return p
  })
  return { trades, positions }
}

function summarize(g: ParsedTrade[], orders: Order[], accountName: string): PositionDerived {
  const first = g[0]
  const size = g.reduce((s, t) => s + t.size, 0)
  const grossPnl = g.reduce((s, t) => s + t.pnl, 0)
  const costs = g.reduce((s, t) => s + t.fees + t.commissions, 0)
  const openedAt = first.enteredAt
  const closedAt = g.reduce((a, t) => (time(t.exitedAt) > time(a) ? t.exitedAt : a), first.exitedAt)

  const bracket = findBracket(first.contractName, time(openedAt), time(closedAt), orders)

  return {
    positionId: first.id,
    accountName,
    contractName: first.contractName,
    side: first.side,
    tradeDay: first.tradeDay,
    openedAt,
    closedAt,
    session: sessionOf(openedAt),
    tradeCount: g.length,
    maxSize: maxConcurrent(g),
    avgEntry: round(g.reduce((s, t) => s + t.entryPrice * t.size, 0) / size, 4),
    avgExit: round(g.reduce((s, t) => s + t.exitPrice * t.size, 0) / size, 4),
    grossPnl: round(grossPnl),
    costs: round(costs),
    netPnl: round(grossPnl - costs),
    stopPrice: bracket.stop,
    targetPrice: bracket.target,
    autoRisk: riskFromStop(g, bracket.stop),
  }
}

/** The earliest stop-loss / take-profit orders placed during the position. */
function findBracket(contract: string, start: number, end: number, orders: Order[]) {
  const during = (o: Order) =>
    o.contractName === contract && time(o.createdAt) >= start - 2000 && time(o.createdAt) <= end
  const earliest = (list: Order[]) => list.sort((a, b) => time(a.createdAt) - time(b.createdAt))[0]

  const stop = earliest(orders.filter((o) => during(o) && o.creationDisposition === 'StopLoss'))
  const target = earliest(orders.filter((o) => during(o) && o.creationDisposition === 'TakeProfit'))
  return { stop: stop?.stopPrice ?? null, target: target?.limitPrice ?? null }
}

/** Dollars lost if every contract had been stopped at `stop`. Null if the stop was moved into profit. */
function riskFromStop(g: ParsedTrade[], stop: number | null): number | null {
  const pv = pointValue(g[0].contractName)
  if (stop === null || pv === null) return null
  let risk = 0
  for (const t of g) {
    const pts = t.side === 'Long' ? t.entryPrice - stop : stop - t.entryPrice
    if (pts <= 0) return null
    risk += pts * pv * t.size
  }
  return round(risk)
}

function maxConcurrent(g: ParsedTrade[]): number {
  // Exits sort before entries at the same instant.
  const events = g.flatMap((t) => [
    { at: time(t.enteredAt), d: t.size },
    { at: time(t.exitedAt), d: -t.size },
  ])
  events.sort((a, b) => a.at - b.at || a.d - b.d)
  let cur = 0
  let max = 0
  for (const e of events) max = Math.max(max, (cur += e.d))
  return max
}

const nyClock = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Trading session of a timestamp, by New York local time. */
export function sessionOf(iso: string): Session {
  const [h, m] = nyClock.format(new Date(iso)).split(':').map(Number)
  const t = h + m / 60
  if (t >= 18 || t < 2) return 'Asia'
  if (t < 7) return 'London'
  if (t < 12) return 'NY AM'
  if (t < 13.5) return 'NY Lunch'
  if (t < 17) return 'NY PM'
  return 'Other'
}
