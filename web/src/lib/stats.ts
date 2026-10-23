import { splitMulti } from './options'
import { sessionLabelAcross } from './sessions'
import { contractRoot } from './topstep/contracts'
import { positionR, type Position } from './types'

export interface Summary {
  count: number
  wins: number
  losses: number
  winRate: number | null
  net: number
  grossProfit: number
  grossLoss: number // negative
  profitFactor: number | null
  avgWin: number | null
  avgLoss: number | null // negative
  expectancy: number | null
  avgR: number | null
  rCount: number
  maxDrawdown: number // negative or 0, measured on closed-position equity
  tradingDays: number
  greenDays: number
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export function summarize(positions: Position[]): Summary {
  const nets = positions.map((p) => p.netPnl)
  const winsArr = nets.filter((n) => n > 0)
  const lossArr = nets.filter((n) => n < 0)
  const grossProfit = winsArr.reduce((a, b) => a + b, 0)
  const grossLoss = lossArr.reduce((a, b) => a + b, 0)
  const rs = positions.map(positionR).filter((r): r is number => r !== null)

  const byDay = new Map<string, number>()
  for (const p of positions) byDay.set(p.tradeDay, (byDay.get(p.tradeDay) ?? 0) + p.netPnl)

  let peak = 0
  let equity = 0
  let maxDrawdown = 0
  for (const p of [...positions].sort((a, b) => a.closedAt.localeCompare(b.closedAt))) {
    equity += p.netPnl
    peak = Math.max(peak, equity)
    maxDrawdown = Math.min(maxDrawdown, equity - peak)
  }

  const decided = winsArr.length + lossArr.length
  return {
    count: positions.length,
    wins: winsArr.length,
    losses: lossArr.length,
    winRate: decided ? winsArr.length / decided : null,
    net: grossProfit + grossLoss,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss < 0 ? grossProfit / -grossLoss : null,
    avgWin: mean(winsArr),
    avgLoss: mean(lossArr),
    expectancy: mean(nets),
    avgR: mean(rs),
    rCount: rs.length,
    maxDrawdown,
    tradingDays: byDay.size,
    greenDays: [...byDay.values()].filter((n) => n > 0).length,
  }
}

export interface EquityPoint {
  day: string
  dayNet: number
  equity: number
}

/** Cumulative net P&L at the end of each trading day, oldest first. */
export function equityByDay(positions: Position[]): EquityPoint[] {
  const byDay = new Map<string, number>()
  for (const p of positions) byDay.set(p.tradeDay, (byDay.get(p.tradeDay) ?? 0) + p.netPnl)
  let equity = 0
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, dayNet]) => ({ day, dayNet, equity: (equity += dayNet) }))
}

export function dailyNet(positions: Position[]): Map<string, { net: number; count: number }> {
  const map = new Map<string, { net: number; count: number }>()
  for (const p of positions) {
    const d = map.get(p.tradeDay) ?? { net: 0, count: 0 }
    d.net += p.netPnl
    d.count++
    map.set(p.tradeDay, d)
  }
  return map
}

export interface BreakdownRow {
  key: string
  count: number
  winRate: number | null
  net: number
  avgR: number | null
}

export const UNSET = '未填'

/** Groups positions by one or more keys each (multi-value fields count once per value). */
export function breakdown(positions: Position[], keysOf: (p: Position) => string[], order?: string[]): BreakdownRow[] {
  const groups = new Map<string, Position[]>()
  for (const p of positions) {
    const keys = keysOf(p)
    for (const k of keys.length ? keys : [UNSET]) groups.set(k, [...(groups.get(k) ?? []), p])
  }
  const rows = [...groups.entries()].map(([key, list]) => {
    const s = summarize(list)
    return { key, count: s.count, winRate: s.winRate, net: s.net, avgR: s.avgR }
  })
  if (order) {
    const rank = (k: string) => (order.includes(k) ? order.indexOf(k) : k === UNSET ? order.length + 1 : order.length)
    return rows.sort((a, b) => rank(a.key) - rank(b.key) || b.count - a.count)
  }
  return rows.sort((a, b) => (a.key === UNSET ? 1 : b.key === UNSET ? -1 : b.count - a.count))
}

const WEEKDAYS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
export const WEEKDAY_ORDER = WEEKDAYS.slice(1).concat(WEEKDAYS[0])

const hourFmt = new Intl.DateTimeFormat('en-US', { hour: '2-digit', hourCycle: 'h23' })

export interface DimensionDef {
  label: string
  keys: (p: Position) => string[]
  /** Display text for a group key, given the positions being grouped. */
  format?: (key: string, positions: Position[]) => string
}

export const DIMENSIONS = {
  setup: { label: 'Setup', keys: (p: Position) => (p.setup ? [p.setup] : []) },
  session: { label: '時段', keys: (p: Position) => [p.session], format: (k: string, ps: Position[]) =>
      sessionLabelAcross(
        k,
        ps.filter((p) => p.session === k).map((p) => new Date(p.openedAt)),
      ),
  },
  weekday: {
    label: '星期',
    keys: (p: Position) => {
      const [y, m, d] = p.tradeDay.split('-').map(Number)
      return [WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]]
    },
  },
  hour: {
    label: '進場時間',
    keys: (p: Position) => [`${hourFmt.format(new Date(p.openedAt)).padStart(2, '0')}:00`],
  },
  grade: { label: '評級', keys: (p: Position) => (p.grade ? [p.grade] : []) },
  mistakes: { label: '錯誤標籤', keys: (p: Position) => splitMulti(p.mistakes) },
  followedPlan: {
    label: '照計畫',
    keys: (p: Position) => (p.followedPlan === true ? ['有照計畫'] : p.followedPlan === false ? ['沒照計畫'] : []),
  },
  contract: { label: '商品', keys: (p: Position) => [contractRoot(p.contractName)] },
} satisfies Record<string, DimensionDef>

export type Dimension = keyof typeof DIMENSIONS
