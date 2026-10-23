import { describe, expect, it } from 'vitest'
import { breakdown, DIMENSIONS, equityByDay, summarize, UNSET } from './stats'
import type { Position } from './types'

function pos(over: Partial<Position>): Position {
  return {
    positionId: Math.random().toString(36),
    accountName: 'A',
    contractName: 'MNQZ6',
    side: 'Long',
    tradeDay: '2026-10-20',
    openedAt: '2026-10-20T21:30:00+08:00',
    closedAt: '2026-10-20T21:40:00+08:00',
    session: 'NY AM',
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

const sample = [
  pos({ netPnl: 100, autoRisk: 50, closedAt: '2026-10-20T21:40:00+08:00', setup: '互換' }),
  pos({ netPnl: -50, autoRisk: 50, closedAt: '2026-10-20T22:00:00+08:00', setup: '互換', mistakes: 'FOMO、追價' }),
  pos({ netPnl: -80, tradeDay: '2026-10-21', closedAt: '2026-10-21T21:00:00+08:00', mistakes: 'FOMO' }),
  pos({ netPnl: 0, tradeDay: '2026-10-21', closedAt: '2026-10-21T22:00:00+08:00' }),
]

describe('summarize', () => {
  const s = summarize(sample)
  it('counts wins, losses and breakevens', () => {
    expect([s.count, s.wins, s.losses]).toEqual([4, 1, 2])
    expect(s.winRate).toBeCloseTo(1 / 3)
  })
  it('computes P&L ratios', () => {
    expect(s.net).toBe(-30)
    expect(s.profitFactor).toBeCloseTo(100 / 130)
    expect(s.expectancy).toBe(-7.5)
    expect(s.avgR).toBeCloseTo((2 + -1) / 2)
    expect(s.rCount).toBe(2)
  })
  it('measures drawdown from the equity peak', () => {
    expect(s.maxDrawdown).toBe(-130)
    expect([s.tradingDays, s.greenDays]).toEqual([2, 1])
  })
  it('handles no data', () => {
    expect(summarize([])).toMatchObject({ count: 0, winRate: null, profitFactor: null, maxDrawdown: 0 })
  })
})

describe('equityByDay', () => {
  it('accumulates daily net', () => {
    expect(equityByDay(sample).map((p) => [p.day, p.dayNet, p.equity])).toEqual([
      ['2026-10-20', 50, 50],
      ['2026-10-21', -80, -30],
    ])
  })
})

describe('breakdown', () => {
  it('groups by single values with unset last', () => {
    const rows = breakdown(sample, DIMENSIONS.setup.keys)
    expect(rows.map((r) => [r.key, r.count, r.net])).toEqual([
      ['互換', 2, 50],
      [UNSET, 2, -80],
    ])
  })
  it('counts multi-value tags once per tag', () => {
    const rows = breakdown(sample, DIMENSIONS.mistakes.keys)
    expect(rows.find((r) => r.key === 'FOMO')).toMatchObject({ count: 2, net: -130 })
    expect(rows.find((r) => r.key === '追價')).toMatchObject({ count: 1 })
  })
  it('derives weekday from the trade day', () => {
    expect(DIMENSIONS.weekday.keys(sample[0])).toEqual(['週二'])
  })
})
