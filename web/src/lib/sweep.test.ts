import { describe, expect, it } from 'vitest'
import { AFTER_TARGET, analyzeSweeps, exitCategory, reentryIds, sweepSettings } from './sweep'
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

describe('exitCategory', () => {
  it('sorts by P&L and prices, whatever order closed the position', () => {
    // Stop with slippage, and a daily-limit flatten before the stop: both just losses.
    expect(exitCategory(pos({ avgEntry: 28341.75, avgExit: 28330.25, stopPrice: 28330.25, netPnl: -24 }))).toBe('loss')
    expect(exitCategory(pos({ side: 'Short', avgEntry: 27283.25, avgExit: 27290.75, stopPrice: 27293.25, netPnl: -16 }))).toBe('loss')
  })

  it('treats exits within 4 ticks of the entry as breakeven, fees included', () => {
    expect(exitCategory(pos({ avgEntry: 28328.5, avgExit: 28328.25, netPnl: -1.72 }))).toBe('breakeven')
    expect(exitCategory(pos({ avgEntry: 27973.75, avgExit: 27974.5, netPnl: 0.28 }))).toBe('breakeven')
  })

  it('splits wins into target hits and exits short of the target', () => {
    expect(exitCategory(pos({ avgEntry: 28214, avgExit: 28314, targetPrice: 28314, netPnl: 198 }))).toBe('target')
    expect(exitCategory(pos({ side: 'Short', avgEntry: 100, avgExit: 50, targetPrice: 50.5, netPnl: 99 }))).toBe('target')
    expect(exitCategory(pos({ avgEntry: 100, avgExit: 130, targetPrice: 200, netPnl: 59 }))).toBe('profit')
    expect(exitCategory(pos({ avgEntry: 100, avgExit: 130, targetPrice: null, netPnl: 59 }))).toBe('profit')
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
    expect(a.losses).toBe(2)
    expect(a.lossesFilled).toBe(1)
    expect(a.actualR).toBeCloseTo(3)
    // 3 pt buffer: the 3 pt sweep still hits.
    expect(a.buffers[0].saved).toBe(0)
    expect(a.buffers[0].totalR).toBeCloseTo(-2 + (5 * 10) / 13)
    // 5 pt buffer: the sweep survives and runs 100 pt on a 15 pt stop.
    expect(a.buffers[1]).toMatchObject({ saved: 1, savedToTarget: 1 })
    expect(a.buffers[1].totalR).toBeCloseTo(100 / 15 - 1 + (5 * 10) / 15)
  })

  it('prices what early profit exits left before the target', () => {
    const trailed = pos({ avgEntry: 100, avgExit: 130, targetPrice: 200, netPnl: 60, autoRisk: 20, beTrigger: '移動停利', afterSweep: AFTER_TARGET })
    const kept = pos({ avgEntry: 100, avgExit: 130, targetPrice: 200, netPnl: 60, autoRisk: 20, afterSweep: '沒到目標' })
    const p = analyzeSweeps([trailed, kept], []).profit
    expect(p).toMatchObject({ count: 2, filled: 2, toTarget: 1 })
    // target 10R − actual 3R
    expect(p.avgMissedR).toBeCloseTo(7)
  })

  it('groups breakeven exits by trigger', () => {
    const be = pos({ avgEntry: 100, avgExit: 100, stopPrice: 100, beTrigger: '點數', afterSweep: AFTER_TARGET })
    const be2 = pos({ avgEntry: 100, avgExit: 100, stopPrice: 100 })
    expect(analyzeSweeps([be, be2], []).breakeven).toEqual([
      { trigger: '點數', count: 1, filled: 1, toTarget: 1 },
      { trigger: '未填', count: 1, filled: 0, toTarget: 0 },
    ])
  })
})
