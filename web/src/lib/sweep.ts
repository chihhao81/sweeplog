// Stop sweeps and re-entries. Nothing here touches XP: what price did after the
// exit is outcome, not process.

import type { Settings } from './api'
import { pointValue, tickSize } from './topstep/contracts'
import { positionR, positionRisk, type Position } from './types'

/** How a position ended at its stop: the original stop, or one already moved to breakeven or better. */
export type ExitKind = 'stop' | 'breakeven'

export const EXIT_KIND_LABEL: Record<ExitKind, string> = { stop: '被掃停損', breakeven: '被掃保本' }

// Stored values of the manual fields (kept readable in the sheet).
export const AFTER_TARGET = '到目標'
export const AFTER_BE_LEVEL = '到移保本條件'
export const AFTER_NO_RETURN = '沒回來'
export const AFTER_MISSED_TARGET = '沒到目標'
export const BE_BY_POINTS = '點數'
export const BE_BY_N = 'N字結構'

export const AFTER_SWEEP_OPTIONS: Record<ExitKind, string[]> = {
  stop: [AFTER_TARGET, AFTER_BE_LEVEL, AFTER_NO_RETURN],
  breakeven: [AFTER_TARGET, AFTER_MISSED_TARGET],
}
export const BE_TRIGGER_OPTIONS = [BE_BY_POINTS, BE_BY_N]

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

/** Label for a stored option, e.g. "到移保本條件" → "到 +30 點或 N 字". */
export function sweepOptionLabel(option: string, s: SweepSettings): string {
  if (option === AFTER_BE_LEVEL) return `到 +${s.beMovePoints} 點或 N 字，沒到目標`
  if (option === BE_BY_POINTS) return `+${s.beMovePoints} 點`
  if (option === BE_BY_N) return 'N 字結構'
  return option
}

/** Stop fills slip; an exit within this many ticks of the stop counts as stopped out. */
const STOP_SLIPPAGE_TICKS = 4

/**
 * Whether the position was closed by its stop, and which kind. Topstep reports the stop's
 * last price, so a stop moved to entry or beyond reads as a breakeven sweep.
 */
export function exitKind(p: Position): ExitKind | null {
  if (p.stopPrice === null) return null
  const tol = (tickSize(p.contractName) ?? 0.25) * STOP_SLIPPAGE_TICKS
  const near = (price: number | null) => price !== null && Math.abs(p.avgExit - price) <= tol + 1e-9
  if (!near(p.stopPrice)) return null
  // A stop sitting on the target (rare) is a take-profit, not a sweep.
  if (p.targetPrice !== null && near(p.targetPrice) && Math.abs(p.targetPrice - p.stopPrice) <= tol) return null
  const losingSide = p.side === 'Long' ? p.stopPrice < p.avgEntry : p.stopPrice > p.avgEntry
  return losingSide ? 'stop' : 'breakeven'
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

/** Stop distance in points, from the dollar risk. */
function stopPoints(p: Position): number | null {
  const risk = positionRisk(p)
  const pv = pointValue(p.contractName)
  if (risk === null || risk <= 0 || pv === null || p.maxSize <= 0) return null
  return risk / (pv * p.maxSize)
}

export interface BufferResult {
  buffer: number
  /** Stop sweeps a stop this much wider would have survived and that then reached the target or the breakeven level. */
  saved: number
  savedToTarget: number
  /** Sum of R over the sample with the wider stop, sizing down to keep 1R the same in dollars. */
  totalR: number
}

export interface SweepAnalysis {
  stopSweeps: number
  /** Stop sweeps with sweepDepth and afterSweep filled in. */
  stopSweepsFilled: number
  /** Sample for the buffer test: positions with an R and a stop distance. */
  sampleCount: number
  actualR: number
  buffers: BufferResult[]
  breakeven: { trigger: string; count: number; filled: number; toTarget: number }[]
}

/**
 * What a wider stop would have done, and how often breakeven stops get swept before the target.
 * The buffer test assumes 1R stays the same in dollars: a stop b points wider means a smaller
 * position, so every R shrinks by d / (d + b) except stop-outs, which still lose 1R. Stop sweeps
 * without sweepDepth / afterSweep count as not saved.
 */
export function analyzeSweeps(positions: Position[], buffers: number[]): SweepAnalysis {
  const kinds = new Map(positions.map((p) => [p.positionId, exitKind(p)]))
  const stops = positions.filter((p) => kinds.get(p.positionId) === 'stop')
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
      const scale = d / (d + b)
      const kind = kinds.get(p.positionId)
      const survives = kind === 'stop' && filled(p) && p.sweepDepth! < b
      if (survives && p.afterSweep === AFTER_TARGET && p.targetPrice !== null) {
        saved++
        savedToTarget++
        total += Math.abs(p.targetPrice - p.avgEntry) / (d + b)
      } else if (survives && p.afterSweep === AFTER_BE_LEVEL) {
        saved++ // scratched at breakeven: 0R
      } else if (kind === 'stop') {
        total += r
      } else {
        total += r * scale
      }
    }
    return { buffer: b, saved, savedToTarget, totalR: total }
  })

  const be = positions.filter((p) => kinds.get(p.positionId) === 'breakeven')
  const triggers = [...BE_TRIGGER_OPTIONS, null]
  const breakeven = triggers
    .map((t) => {
      const group = be.filter((p) => (t === null ? !p.beTrigger : p.beTrigger === t))
      return {
        trigger: t ?? '未填',
        count: group.length,
        filled: group.filter((p) => !!p.afterSweep).length,
        toTarget: group.filter((p) => p.afterSweep === AFTER_TARGET).length,
      }
    })
    .filter((g) => g.count > 0)

  return {
    stopSweeps: stops.length,
    stopSweepsFilled: stops.filter(filled).length,
    sampleCount: sample.length,
    actualR: sample.reduce((s, x) => s + x.r, 0),
    buffers: results,
    breakeven,
  }
}
