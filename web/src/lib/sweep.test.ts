import { describe, expect, it } from 'vitest'
import { AFTER_TARGET, analyzeSweeps, exitKind, reentryIds, sweepSettings } from './sweep'
import type { Position } from './types'

let seq = 0
function pos(over: Partial<Position>): Position {
  seq++
  return {
    positionId: `p${seq}`,
    accountName: 'A',
    contractName: 'MNQZ6',
    side: 'Long',
    tradeDay: '2026-11-13',
    openedAt: '2026-11-13T15:00:00+08:00',
    closedAt: '2026-11-13T15:01:00+08:00',
    session: 'London',
    tradeCount: 1,
    maxSize: 1,
    avgEntry: 0,
    avgExit: 0,
    grossPnl: 0,
    costs: 0,
    netPnl: 0,
    stopPrice: null,
    targetPrice: null,
    autoRisk: null,
    ...over,
  }
}

describe('exitKind', () => {
  it('reads a stop on the losing side as a stop sweep, allowing slippage', () => {
    expect(exitKind(pos({ avgEntry: 28341.75, avgExit: 28330.25, stopPrice: 28330.25, targetPrice: 28441.75 }))).toBe('stop')
    // 3 ticks of slippage
    expect(exitKind(pos({ avgEntry: 28327, avgExit: 28315.75, stopPrice: 28315 }))).toBe('stop')
    expect(exitKind(pos({ side: 'Short', avgEntry: 29425, avgExit: 29435.5, stopPrice: 29435 }))).toBe('stop')
  })

  it('reads a stop at entry or in profit as a breakeven sweep', () => {
    expect(exitKind(pos({ avgEntry: 28328.5, avgExit: 28328.25, stopPrice: 28328.75 }))).toBe('breakeven')
    expect(exitKind(pos({ side: 'Short', avgEntry: 100, avgExit: 90, stopPrice: 90 }))).toBe('breakeven')
  })

  it('ignores exits away from the stop', () => {
    expect(exitKind(pos({ avgEntry: 28214, avgExit: 28314, stopPrice: 28215, targetPrice: 28314 }))).toBeNull()
    expect(exitKind(pos({ avgEntry: 100, avgExit: 95, stopPrice: 90 }))).toBeNull()
    expect(exitKind(pos({ avgEntry: 100, avgExit: 90, stopPrice: null }))).toBeNull()
  })
})

describe('reentryIds', () => {
  // 11/13: stopped out, 8 min later the planned second level, stopped out, 2 min later again.
  const first = pos({ openedAt: '2026-11-13T15:36:22+08:00', closedAt: '2026-11-13T15:36:58+08:00', netPnl: -24 })
  const second = pos({ openedAt: '2026-11-13T15:45:19+08:00', closedAt: '2026-11-13T15:46:48+08:00', netPnl: -24 })
  const third = pos({ openedAt: '2026-11-13T15:48:33+08:00', closedAt: '2026-11-13T16:00:03+08:00', netPnl: -2 })

  it('flags entries within the window after a losing exit', () => {
    expect([...reentryIds([third, first, second], 5)]).toEqual([third.positionId])
    expect([...reentryIds([first, second, third], 10)].sort()).toEqual([second.positionId, third.positionId].sort())
  })

  it('needs a loss, the same direction and the same day', () => {
    const win = pos({ openedAt: '2026-11-13T10:00:00+08:00', closedAt: '2026-11-13T10:05:00+08:00', netPnl: 50 })
    const after = pos({ openedAt: '2026-11-13T10:06:00+08:00', closedAt: '2026-11-13T10:07:00+08:00' })
    const short = pos({ side: 'Short', openedAt: '2026-11-13T15:37:30+08:00', closedAt: '2026-11-13T15:38:00+08:00' })
    expect(reentryIds([win, after, first, short], 5).size).toBe(0)
  })
})

describe('sweepSettings', () => {
  it('falls back to defaults for missing or bad values', () => {
    expect(sweepSettings(undefined)).toEqual({ beMovePoints: 30, reentryMinutes: 5 })
    expect(sweepSettings({ beMovePoints: '40', reentryMinutes: 'x' })).toEqual({ beMovePoints: 40, reentryMinutes: 5 })
  })
})

describe('analyzeSweeps', () => {
  // MNQ $2/pt, $20 risk on 1 contract = 10 pt stop.
  const swept = pos({ avgEntry: 100, avgExit: 90, stopPrice: 90, targetPrice: 200, netPnl: -20, autoRisk: 20, sweepDepth: 3, afterSweep: AFTER_TARGET })
  const unfilled = pos({ avgEntry: 100, avgExit: 90, stopPrice: 90, netPnl: -20, autoRisk: 20 })
  const winner = pos({ avgEntry: 100, avgExit: 150, stopPrice: 90, targetPrice: 150, netPnl: 100, autoRisk: 20 })

  it('re-prices the sample for each wider stop at constant dollar risk', () => {
    const a = analyzeSweeps([swept, unfilled, winner], [3, 5])
    expect(a.stopSweeps).toBe(2)
    expect(a.stopSweepsFilled).toBe(1)
    expect(a.actualR).toBeCloseTo(3)
    // 3 pt buffer: the 3 pt sweep still hits.
    expect(a.buffers[0].saved).toBe(0)
    expect(a.buffers[0].totalR).toBeCloseTo(-2 + (5 * 10) / 13)
    // 5 pt buffer: the sweep survives and runs 100 pt on a 15 pt stop.
    expect(a.buffers[1]).toMatchObject({ saved: 1, savedToTarget: 1 })
    expect(a.buffers[1].totalR).toBeCloseTo(100 / 15 - 1 + (5 * 10) / 15)
  })

  it('groups breakeven sweeps by trigger', () => {
    const be = pos({ avgEntry: 100, avgExit: 100, stopPrice: 100, beTrigger: '點數', afterSweep: AFTER_TARGET })
    const be2 = pos({ avgEntry: 100, avgExit: 100, stopPrice: 100 })
    expect(analyzeSweeps([be, be2], []).breakeven).toEqual([
      { trigger: '點數', count: 1, filled: 1, toTarget: 1 },
      { trigger: '未填', count: 1, filled: 0, toTarget: 0 },
    ])
  })
})
