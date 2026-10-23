// Domain types. Field names match the GAS sheet columns (gas/src/schema.ts).

export type Side = 'Long' | 'Short'

/** One Topstep trade: a single contract, FIFO-matched entry and exit. */
export interface Trade {
  id: string
  accountName: string
  positionId: string
  contractName: string
  side: Side
  size: number
  enteredAt: string // ISO 8601 with the export's offset
  exitedAt: string
  entryPrice: number
  exitPrice: number
  pnl: number
  fees: number
  commissions: number
  tradeDay: string // YYYY-MM-DD, Topstep's CT session date
  durationSec: number
}

export interface Order {
  id: string
  accountName: string
  contractName: string
  status: string // Filled | Cancelled | Rejected | Open
  type: string // Market | Limit | Stop
  side: string // Bid = buy, Ask = sell
  size: number
  createdAt: string
  filledAt: string | null
  cancelledAt: string | null
  triggeredAt: string | null
  stopPrice: number | null
  limitPrice: number | null
  executePrice: number | null
  triggeredPrice: number | null
  positionDisposition: string // Opening | Closing | Undetermined
  creationDisposition: string // Trader | StopLoss | TakeProfit | ClosePosition
  rejectionReason: string
  tradeDay: string
}

export type Session = 'Asia' | 'London' | 'NY AM' | 'NY Lunch' | 'NY PM' | 'Other'

/** Fields computed from trades and orders on every import. */
export interface PositionDerived {
  positionId: string
  accountName: string
  contractName: string
  side: Side
  tradeDay: string
  openedAt: string
  closedAt: string
  session: Session
  tradeCount: number
  maxSize: number
  avgEntry: number
  avgExit: number
  grossPnl: number
  costs: number
  netPnl: number
  /** Stop/target come from the bracket orders' final prices, so a moved stop shows where it ended. */
  stopPrice: number | null
  targetPrice: number | null
  /** Dollars at risk from entries to stopPrice; null when the stop is not on the losing side. */
  autoRisk: number | null
}

/** Fields the trader fills in. Phase 3 adds the form. */
export interface PositionManual {
  riskOverride: number | null
  setup: string | null
  liquiditySwept: string | null
  htfBias: string | null
  entryTimeframe: string | null
  entryTrigger: string | null
  followedPlan: boolean | null
  mistakes: string | null
  emotionBefore: number | null
  emotionAfter: number | null
  grade: string | null
  notes: string | null
  lesson: string | null
}

export type Position = PositionDerived & Partial<PositionManual> & { updatedAt?: string }

export interface Screenshot {
  id: string
  date: string
  driveFileId: string
  fileName: string
  caption: string | null
  takenAt: string | null
  createdAt: string
  positionIds: string[]
}

export interface JournalEntry {
  id?: string
  date: string
  accountName: string
  bias: string | null
  keyLevels: string | null
  newsEvents: string | null
  plan: string | null
  sleep: number | null
  energy: number | null
  followedDailyRules: boolean | null
  wentWell: string | null
  wentWrong: string | null
  tomorrow: string | null
  updatedAt?: string
}

export function positionRisk(p: Position): number | null {
  return p.riskOverride ?? p.autoRisk ?? null
}

export function positionR(p: Position): number | null {
  const risk = positionRisk(p)
  return risk && risk > 0 ? p.netPnl / risk : null
}
