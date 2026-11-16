import { describe, expect, it } from 'vitest'
import type { JournalEntry, Position } from './types'
import { computeProgress, levelOf, levelStart, missingJournalFields, rankOf, reentryPenalty } from './xp'

let seq = 0
function pos(over: Partial<Position>): Position {
  seq++
  const t = String(seq).padStart(4, '0')
  return {
    positionId: `p${t}`,
    accountName: 'A',
    contractName: 'MNQZ6',
    side: 'Long',
    tradeDay: '2026-10-20',
    openedAt: `2026-10-20T21:${t.slice(2)}:00+08:00`,
    closedAt: `2026-10-20T21:${t.slice(2)}:30+08:00`,
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

const good = (over: Partial<Position> = {}) => pos({ grade: 'A', followedPlan: true, emotionBefore: 3, ...over })
const entry = (over: Partial<JournalEntry>): JournalEntry => ({
  date: '2026-10-20', accountName: 'A', bias: null, newsEvents: null,
  sleep: null, energy: null, followedDailyRules: null, wentWell: null, wentWrong: null, tomorrow: null, ...over,
})
const positionTotals = (r: ReturnType<typeof computeProgress>) => r.ledger.filter((e) => e.position).map((e) => e.total)

describe('levels', () => {
  it('grows the step by 50 XP per level', () => {
    expect([levelStart(1), levelStart(2), levelStart(3), levelStart(4)]).toEqual([0, 100, 250, 450])
    expect([levelOf(-1), levelOf(0), levelOf(99), levelOf(100), levelOf(449), levelOf(450)]).toEqual([0, 1, 1, 2, 3, 4])
    expect(rankOf(0).name).toBe('爆倉')
    expect(rankOf(12).name).toBe('紀律新兵')
  })
})

describe('missingJournalFields', () => {
  it('names the empty fields that keep a position pending', () => {
    expect(missingJournalFields(pos({ grade: null, followedPlan: null }))).toEqual(['評級', '照計畫'])
    expect(missingJournalFields(pos({ grade: 'A', followedPlan: null }))).toEqual(['照計畫'])
    expect(missingJournalFields(pos({ grade: '', followedPlan: true }))).toEqual(['評級'])
    expect(missingJournalFields(pos({ grade: 'B', followedPlan: false }))).toEqual([])
  })
})

describe('computeProgress', () => {
  it('ignores P&L entirely', () => {
    const win = computeProgress([good({ netPnl: 5000 })], [])
    const loss = computeProgress([good({ netPnl: -5000 })], [])
    expect(win.total).toBe(loss.total)
  })

  it('skips unjournaled positions without breaking streaks', () => {
    const r = computeProgress([good(), pos({}), good()], [])
    expect(r.pending).toBe(1)
    expect(r.cleanStreak).toBe(2)
  })

  it('punishes a broken plan and a C grade hard', () => {
    const r = computeProgress([pos({ grade: 'C', followedPlan: false })], [])
    // 10 journaled − 150 broke plan − 100 C
    expect(positionTotals(r)).toEqual([-240])
    expect(r.level).toBe(0)
  })

  it('separates severe mistakes from ordinary ones', () => {
    const r = computeProgress([pos({ grade: 'B', followedPlan: true, mistakes: 'FOMO、報復單' })], [])
    // 10 + 30 − 40 − 100
    expect(positionTotals(r)).toEqual([-100])
  })

  it('stacks a combo on clean positions, capped at 2x', () => {
    const list = Array.from({ length: 13 }, () => good())
    const totals = positionTotals(computeProgress(list, []))
    // base 10 + 30 + 20 = 60
    expect(totals.slice(0, 3)).toEqual([60, 66, 72])
    expect(totals.at(-1)).toBe(120)
  })

  it('escalates penalties for consecutive plan breaks', () => {
    const broke = () => pos({ grade: 'B', followedPlan: false })
    const totals = positionTotals(computeProgress([broke(), broke(), broke(), broke(), broke()], []))
    // −150 scaled ×1, ×1.5, ×2, ×3, ×3; the +10 is halved once on tilt (from the 3rd)
    expect(totals).toEqual([-140, -215, -295, -445, -445])
  })

  it('halves gains on tilt until a clean day', () => {
    const r = computeProgress(
      [
        pos({ grade: 'B', followedPlan: true, mistakes: 'FOMO' }),
        pos({ grade: 'B', followedPlan: true, mistakes: 'FOMO' }),
        good(),
        good({ tradeDay: '2026-10-21', openedAt: '2026-10-21T21:00:00+08:00' }),
      ],
      [],
    )
    const totals = positionTotals(r)
    expect(totals[2]).toBe(30) // 60 halved
    expect(totals[3]).toBe(33) // still on tilt (day 1 was dirty): 60 × 1.1 combo × 0.5
    expect(r.tilt).toBe(false) // cleared by the clean day 2
  })

  it('settles the day: journal, rules, overtrading and clean-day streak', () => {
    const day = Array.from({ length: 8 }, () => good())
    const r = computeProgress(day, [entry({ wentWell: '等到亞盤低才進場', followedDailyRules: false })])
    const settle = r.ledger.at(-1)!
    expect(settle.position).toBeNull()
    expect(settle.items.map((i) => i.xp)).toEqual([20, -150, -100, 20])
  })

  it('unlocks and redeems shame badges', () => {
    const revenge = () => pos({ grade: 'B', followedPlan: true, mistakes: '報復單' })
    const list = [revenge(), revenge(), revenge(), ...Array.from({ length: 10 }, () => good())]
    const r = computeProgress(list, [])
    const badge = r.unlocks.find((u) => u.id === 'revenge')
    expect(badge?.redeemedOn).toBe('2026-10-20')
    expect(r.unlocks.some((u) => u.id === 'comeback')).toBe(true)
    expect(r.unlocks.some((u) => u.id === 'first')).toBe(true)
  })

  it('ignores trade days before the start date', () => {
    const old = pos({ tradeDay: '2026-10-19', openedAt: '2026-10-19T21:00:00+08:00', grade: 'C', followedPlan: false })
    const unjournaled = pos({ tradeDay: '2026-10-19', openedAt: '2026-10-19T22:00:00+08:00' })
    const fresh = good({ tradeDay: '2026-10-20' })
    const oldDay = entry({ date: '2026-10-19', followedDailyRules: false })
    const r = computeProgress([old, unjournaled, fresh], [oldDay], '2026-10-20')
    expect(r.pending).toBe(0)
    expect(r.ledger.map((e) => e.day)).toEqual(['2026-10-20', '2026-10-20'])
    expect(r.total).toBeGreaterThan(0)
  })

  describe('re-entry after an agitated exit', () => {
    const at = (open: string, close: string, over: Partial<Position> = {}) =>
      good({ openedAt: `2026-10-20T21:${open}+08:00`, closedAt: `2026-10-20T21:${close}+08:00`, ...over })
    const agitated = { emotionAfter: 2 }
    const reentryItems = (r: ReturnType<typeof computeProgress>) =>
      r.ledger.flatMap((e) => e.items).filter((i) => i.label.startsWith('焦躁出場後'))

    it('tiers the penalty by the gap', () => {
      expect([0, 0.99, 1, 4.9, 5, 14.9, 15, 60].map(reentryPenalty)).toEqual([-100, -100, -50, -50, -20, -20, null, null])
    })

    it('punishes the next position, not the agitated exit itself', () => {
      const r = computeProgress([at('00:00', '10:00', agitated), at('10:30', '20:00')], [])
      const items = reentryItems(r)
      expect(items).toEqual([{ label: '焦躁出場後 30 秒就再進場', xp: -100 }])
      expect(r.ledger[1].items).toContainEqual(items[0])
    })

    it('uses the latest exit on the same account, in any contract', () => {
      const r = computeProgress(
        [
          at('00:00', '10:00', agitated),
          at('01:00', '12:00', { contractName: 'MGCZ6' }), // calm exit closes later
          at('13:00', '14:00'),
          at('20:00', '30:00', { ...agitated, contractName: 'MGCZ6' }),
          at('33:00', '40:00', { accountName: 'B' }), // other account: no penalty
          at('33:30', '35:00'),
        ],
        [],
      )
      expect(reentryItems(r)).toEqual([{ label: '焦躁出場後 3.5 分鐘就再進場', xp: -50 }])
    })

    it('ignores calm or blank exits and long breaks, and counts unjournaled exits', () => {
      const calm = computeProgress([at('00:00', '01:00', { emotionAfter: 3 }), at('01:10', '02:00')], [])
      const blank = computeProgress([at('00:00', '01:00'), at('01:10', '02:00')], [])
      const rested = computeProgress([at('00:00', '01:00', agitated), at('16:00', '17:00')], [])
      const unjournaled = computeProgress([at('00:00', '01:00', { ...agitated, grade: null }), at('08:00', '09:00')], [])
      expect([calm, blank, rested].map((r) => reentryItems(r).length)).toEqual([0, 0, 0])
      expect(reentryItems(unjournaled)).toEqual([{ label: '焦躁出場後 7 分鐘就再進場', xp: -20 }])
    })
  })
})
