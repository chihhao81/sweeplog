// After-exit review (sweeps, moved stops) and re-entries. Nothing here touches XP:
// what price did after the exit is outcome, not process.
//
// The form fields are always available and optional; positions are only sorted into
// categories for the stats, from prices and P&L, never by guessing which order closed them.

import type { Settings } from './api'
import { pointValue, tickSize } from './topstep/contracts'
import { positionR, positionRisk, type Position } from './types'

/** How a position ended, for the stats: at a loss, at breakeven, at the target, or in profit short of it. */
export type ExitCategory = 'loss' | 'breakeven' | 'target' | 'profit'

// Stored values of the manual fields (kept readable in the sheet).
export const AFTER_TARGET = '到目標'
export const AFTER_BE_LEVEL = '到移保本條件'
export const AFTER_MISSED_TARGET = '沒到目標'
export const BE_BY_POINTS = '點數'
export const BE_BY_N = 'N字結構'
export const BE_BY_TRAILING = '移動停利'

export const AFTER_SWEEP_OPTIONS = [AFTER_TARGET, AFTER_BE_LEVEL, AFTER_MISSED_TARGET]
export const BE_TRIGGER_OPTIONS = [BE_BY_POINTS, BE_BY_N, BE_BY_TRAILING]

export interface SweepSettings {
  beMovePoints: number
  reentryMinutes: number
}

export const SWEEP_DEFAULTS: SweepSettings = { beMovePoints: 30, reentryMinutes: 5 }

export function sweepSettings(s: Settings | undefined): SweepSettings {
  const num = (v: string | null | undefined, fallback: number) => {
    const n = Number(v)
    return v != null && v !== '' && Number.isFinite(n) && n > 0 ? n : fallback
  }
  return {
    beMovePoints: num(s?.beMovePoints, SWEEP_DEFAULTS.beMovePoints),
    reentryMinutes: num(s?.reentryMinutes, SWEEP_DEFAULTS.reentryMinutes),
  }
}

/** Label for a stored option, e.g. "點數" → "+30 點". */
export function sweepOptionLabel(option: string, s: SweepSettings): string {
  if (option === AFTER_BE_LEVEL) return `到 +${s.beMovePoints} 點或 N 字，沒到目標`
  if (option === BE_BY_POINTS) return `+${s.beMovePoints} 點`
  if (option === BE_BY_N) return 'N 字結構'
  return option
}

/** Exits this close to the entry (or the target) count as at it; covers fees and rounding. */
const NEAR_TICKS = 4

export function exitCategory(p: Position): ExitCategory {
  const tol = (tickSize(p.contractName) ?? 0.25) * NEAR_TICKS + 1e-9
  if (Math.abs(p.avgExit - p.avgEntry) <= tol) return 'breakeven'
  if (p.netPnl < 0) return 'loss'
  if (p.targetPrice !== null) {
    const reached = p.side === 'Long' ? p.avgExit >= p.targetPrice - tol : p.avgExit <= p.targetPrice + tol
    if (reached) return 'target'
  }
  return 'profit'
}

/** Whether any after-exit field is filled, so the form section opens by itself. */
export function hasAfterExit(p: Pick<Position, 'sweepDepth' | 'afterSweep' | 'beTrigger'>): boolean {
  return p.sweepDepth != null || !!p.afterSweep || !!p.beTrigger
}

/**
 * Positions opened within `minutes` of a losing exit in the same contract and direction
 * on the same trade day.
 */
export function reentryIds(positions: Position[], minutes: number): Set<string> {
  const out = new Set<string>()
  const sorted = [...positions].sort((a, b) => a.openedAt.localeCompare(b.openedAt))
  const last = new Map<string, Position>()
  for (const p of sorted) {
    const key = `${p.accountName}|${p.tradeDay}|${p.contractName}|${p.side}`
    const prev = last.get(key)
    if (prev && prev.netPnl < 0) {
      const gap = (Date.parse(p.openedAt) - Date.parse(prev.closedAt)) / 60_000
      if (gap >= 0 && gap <= minutes) out.add(p.positionId)
    }
    last.set(key, p)
  }
  return out
}

/** Stop distance in points, from the dollar risk (so a stop moved later does not matter). */
function stopPoints(p: Position): number | null {
  const risk = positionRisk(p)
  const pv = pointValue(p.contractName)
  if (risk === null || risk <= 0 || pv === null || p.maxSize <= 0) return null
  return risk / (pv * p.maxSize)
}

/** R the position would have made at its target, before costs. */
function targetR(p: Position): number | null {
  const d = stopPoints(p)
  return d === null || p.targetPrice === null ? null : Math.abs(p.targetPrice - p.avgEntry) / d
}

export interface BufferResult {
  buffer: number
  /** Losing exits a stop this much wider would have survived and that then reached the target or the breakeven level. */
  saved: number
  savedToTarget: number
  /** Sum of R over the sample with the wider stop, sizing down to keep 1R the same in dollars. */
  totalR: number
}

export interface TriggerGroup {
  trigger: string
  count: number
  filled: number
  toTarget: number
}

export interface SweepAnalysis {
  losses: number
  /** Losing exits with sweepDepth and afterSweep filled in. */
  lossesFilled: number
  /** Sample for the buffer test: positions with an R and a stop distance. */
  sampleCount: number
  actualR: number
  buffers: BufferResult[]
  breakeven: TriggerGroup[]
  /** Exits in profit short of the target (trailed stop, manual exit). */
  profit: TriggerGroup & {
    /** Average R left on the table by the ones that went on to the target. */
    avgMissedR: number | null
  }
}

function byTrigger(group: Position[]): TriggerGroup[] {
  return [...BE_TRIGGER_OPTIONS, null]
    .map((t) => {
      const g = group.filter((p) => (t === null ? !p.beTrigger : p.beTrigger === t))
      return {
        trigger: t ?? '未填',
        count: g.length,
        filled: g.filter((p) => !!p.afterSweep).length,
        toTarget: g.filter((p) => p.afterSweep === AFTER_TARGET).length,
      }
    })
    .filter((g) => g.count > 0)
}

/**
 * What a wider stop would have done, how breakeven stops fare, and what early profit exits cost.
 * The buffer test assumes 1R stays the same in dollars: a stop b points wider means a smaller
 * position, so every R shrinks by d / (d + b) except losing exits, which still lose their R.
 * Losing exits without sweepDepth / afterSweep count as not saved.
 */
export function analyzeSweeps(positions: Position[], buffers: number[]): SweepAnalysis {
  const cat = new Map(positions.map((p) => [p.positionId, exitCategory(p)]))
  const of = (c: ExitCategory) => positions.filter((p) => cat.get(p.positionId) === c)
  const losses = of('loss')
  const filled = (p: Position) => p.sweepDepth != null && !!p.afterSweep

  const sample = positions.flatMap((p) => {
    const r = positionR(p)
    const d = stopPoints(p)
    return r === null || d === null ? [] : [{ p, r, d }]
  })

  const results = buffers.map((b): BufferResult => {
    let total = 0
    let saved = 0
    let savedToTarget = 0
    for (const { p, r, d } of sample) {
      const loss = cat.get(p.positionId) === 'loss'
      const survives = loss && filled(p) && p.sweepDepth! < b
      if (survives && p.afterSweep === AFTER_TARGET && p.targetPrice !== null) {
        saved++
        savedToTarget++
        total += Math.abs(p.targetPrice - p.avgEntry) / (d + b)
      } else if (survives && p.afterSweep === AFTER_BE_LEVEL) {
        saved++ // scratched at breakeven: 0R
      } else if (loss) {
        total += r
      } else {
        total += r * (d / (d + b))
      }
    }
    return { buffer: b, saved, savedToTarget, totalR: total }
  })

  const profit = of('profit')
  const missed = profit.flatMap((p) => {
    const t = targetR(p)
    const r = positionR(p)
    return p.afterSweep === AFTER_TARGET && t !== null && r !== null ? [t - r] : []
  })

  return {
    losses: losses.length,
    lossesFilled: losses.filter(filled).length,
    sampleCount: sample.length,
    actualR: sample.reduce((s, x) => s + x.r, 0),
    buffers: results,
    breakeven: byTrigger(of('breakeven')),
    profit: {
      trigger: '獲利出場',
      count: profit.length,
      filled: profit.filter((p) => !!p.afterSweep).length,
      toTarget: profit.filter((p) => p.afterSweep === AFTER_TARGET).length,
      avgMissedR: missed.length ? missed.reduce((s, x) => s + x, 0) / missed.length : null,
    },
  }
}
