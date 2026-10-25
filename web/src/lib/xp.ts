// Experience points, levels and achievements.
//
// XP rewards process only: following the plan, trade quality, emotional state
// and mistakes. P&L never counts, since the outcome of a planned trade is out
// of our hands. Everything is derived by replaying positions in time order, so
// editing an old journal entry simply changes the result.

import { splitMulti } from './options'
import type { JournalEntry, Position } from './types'

// ---- Rules (also rendered as the help dialog, so keep labels readable) ----

export const POSITION_XP = {
  journaled: 10,
  followedPlan: 30,
  brokePlan: -150,
  calmBefore: 10, // emotionBefore >= 4
  agitatedBefore: -30, // emotionBefore <= 2
  emotionCrash: -30, // emotionAfter at least 2 below emotionBefore
  mistake: -40,
  severeMistake: -100,
} as const

export const GRADE_XP: Record<string, number> = { 'A+': 30, A: 20, B: 0, C: -100 }

export const SEVERE_MISTAKES = ['報復單', '加大部位', '移動停損']

export const DAY_XP = {
  wroteJournal: 20,
  followedDailyRules: 30,
  brokeDailyRules: -150,
  overtradePer: -50, // for each position beyond OVERTRADE_LIMIT
  cleanDayPer: 20, // × clean-day streak
  cleanDayMax: 200,
} as const

export const OVERTRADE_LIMIT = 6

/** Combo on positive XP: +10% per consecutive clean position, capped. */
export const COMBO_STEP = 0.1
export const COMBO_MAX = 2
/** Multiplier on penalties for the 1st, 2nd, 3rd, 4th+ plan break in a row. */
export const BREAK_STREAK_FACTORS = [1, 1.5, 2, 3]
/** Consecutive non-clean positions that put you on tilt. */
export const TILT_AFTER = 2
export const TILT_FACTOR = 0.5

export const MAX_LEVEL = 50

/** XP needed to go from `level` to `level + 1`. */
export function xpForNext(level: number): number {
  return 100 + 50 * (level - 1)
}

/** Total XP at which `level` starts (level 1 starts at 0). */
export function levelStart(level: number): number {
  const n = level - 1
  return 100 * n + 25 * n * (n - 1)
}

/** Level for a total; 0 means the total is negative. */
export function levelOf(total: number): number {
  if (total < 0) return 0
  let level = 1
  while (level < MAX_LEVEL && total >= levelStart(level + 1)) level++
  return level
}

export const RANKS: { from: number; icon: string; name: string }[] = [
  { from: 0, icon: '💥', name: '爆倉' },
  { from: 1, icon: '🥬', name: '韭菜' },
  { from: 5, icon: '📖', name: '學徒交易員' },
  { from: 10, icon: '🪖', name: '紀律新兵' },
  { from: 15, icon: '🛡️', name: '停損守門員' },
  { from: 20, icon: '🎯', name: '流動性獵人' },
  { from: 30, icon: '🗡️', name: '掃單狙擊手' },
  { from: 40, icon: '⏳', name: '時間與價格大師' },
  { from: 50, icon: '🤖', name: '傳說：冷血交易機器' },
]

export function rankOf(level: number) {
  return RANKS.findLast((r) => level >= r.from) ?? RANKS[0]
}

export interface AchievementDef {
  id: string
  kind: 'honor' | 'shame'
  icon: string
  name: string
  description: string
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first', kind: 'honor', icon: '🌱', name: '初心', description: '完成第一筆覆盤' },
  { id: 'hundred', kind: 'honor', icon: '📚', name: '百戰覆盤', description: '覆盤 100 個部位' },
  { id: 'iron', kind: 'honor', icon: '⛓️', name: '鐵律', description: '連續 20 筆乾淨交易' },
  { id: 'flawless', kind: 'honor', icon: '💎', name: '無瑕', description: '連續 50 筆乾淨交易' },
  { id: 'perfectDay', kind: 'honor', icon: '🌟', name: '完美一天', description: '一天至少 3 筆，全部乾淨而且評級 A 以上' },
  { id: 'fullWeek', kind: 'honor', icon: '🗓️', name: '全勤週', description: '連續 5 個交易日都寫了每日日誌' },
  { id: 'calm', kind: 'honor', icon: '🧘', name: '冷靜如水', description: '連續 20 筆進場前情緒 4 以上' },
  { id: 'disciplineWeek', kind: 'honor', icon: '🏯', name: '紀律週', description: '連續 5 個紀律日' },
  { id: 'nyAm', kind: 'honor', icon: '🗽', name: '紐約晨間專家', description: '在 NY AM 累積 20 筆乾淨交易' },
  { id: 'comeback', kind: 'honor', icon: '🕊️', name: '浪子回頭', description: '拿到恥辱勳章後，連續 10 筆乾淨交易洗白它' },
  { id: 'revenge', kind: 'shame', icon: '😤', name: '復仇者', description: '累積 3 次報復單' },
  { id: 'gambler', kind: 'shame', icon: '🎰', name: '賭徒', description: '累積 3 次加大部位' },
  { id: 'stopMover', kind: 'shame', icon: '🪄', name: '乾坤大挪移', description: '累積 3 次移動停損' },
  { id: 'cRegular', kind: 'shame', icon: '🗑️', name: 'C 級常客', description: '累積 3 筆 C 級交易' },
  { id: 'runaway', kind: 'shame', icon: '🐎', name: '脫韁', description: '連續 3 筆沒照計畫' },
  { id: 'rampage', kind: 'shame', icon: '🌪️', name: '暴走', description: '一天交易 10 個部位以上' },
]

/** Clean comeback streak that redeems a shame badge. */
export const REDEEM_STREAK = 10

// ---- Replay ----

export interface XpItem {
  label: string
  xp: number
}

export interface LedgerEntry {
  key: string
  day: string
  position: Position | null // null for the end-of-day settlement
  items: XpItem[]
  /** Multipliers applied on top of the items, e.g. "連擊 ×1.3". */
  modifiers: string[]
  total: number
  balance: number
}

export interface Unlock {
  id: string
  day: string
  /** Shame badges only: day it was washed out by a clean streak. */
  redeemedOn?: string
}

export interface Progress {
  total: number
  level: number
  /** XP into the current level and the size of the level; null at max level or below zero. */
  inLevel: { have: number; need: number } | null
  cleanStreak: number
  breakStreak: number
  cleanDayStreak: number
  tilt: boolean
  pending: number
  journaled: number
  ledger: LedgerEntry[] // oldest first
  unlocks: Unlock[]
}

/** A position counts once its grade and plan answer are filled in. */
export function isJournaled(p: Position): boolean {
  return p.grade != null && p.grade !== '' && p.followedPlan != null
}

/** Followed the plan, no mistake tags and not a C. */
export function isClean(p: Position): boolean {
  return p.followedPlan === true && splitMulti(p.mistakes).length === 0 && p.grade !== 'C'
}

function scorePosition(p: Position): XpItem[] {
  const items: XpItem[] = [{ label: '完成覆盤', xp: POSITION_XP.journaled }]
  items.push(p.followedPlan ? { label: '照計畫', xp: POSITION_XP.followedPlan } : { label: '沒照計畫', xp: POSITION_XP.brokePlan })
  const g = GRADE_XP[p.grade ?? ''] ?? 0
  if (g !== 0) items.push({ label: `評級 ${p.grade}`, xp: g })
  const before = p.emotionBefore ?? null
  const after = p.emotionAfter ?? null
  if (before != null && before >= 4) items.push({ label: '進場前平靜', xp: POSITION_XP.calmBefore })
  if (before != null && before <= 2) items.push({ label: '進場前焦躁', xp: POSITION_XP.agitatedBefore })
  if (before != null && after != null && after - before <= -2) items.push({ label: '情緒崩跌', xp: POSITION_XP.emotionCrash })
  for (const m of splitMulti(p.mistakes)) {
    items.push(SEVERE_MISTAKES.includes(m) ? { label: `嚴重錯誤：${m}`, xp: POSITION_XP.severeMistake } : { label: `錯誤：${m}`, xp: POSITION_XP.mistake })
  }
  return items
}

function hasJournalContent(e: JournalEntry): boolean {
  return [e.bias, e.keyLevels, e.newsEvents, e.plan, e.wentWell, e.wentWrong, e.tomorrow].some((v) => v != null && v.trim() !== '') ||
    e.sleep != null || e.energy != null || e.followedDailyRules != null
}

const fmtFactor = (f: number) => `×${Number(f.toFixed(2))}`

/**
 * Replays everything into a score. With `startDate` (YYYY-MM-DD), trade days
 * before it are left out entirely: a fresh start without journaling the past.
 */
export function computeProgress(positions: Position[], journal: JournalEntry[], startDate?: string | null): Progress {
  const sorted = positions
    .filter((p) => !startDate || p.tradeDay >= startDate)
    .sort((a, b) => a.openedAt.localeCompare(b.openedAt))
  const byDay = new Map<string, Position[]>()
  for (const p of sorted) byDay.set(p.tradeDay, [...(byDay.get(p.tradeDay) ?? []), p])
  const journalByDay = new Map<string, JournalEntry[]>()
  for (const e of journal) journalByDay.set(e.date, [...(journalByDay.get(e.date) ?? []), e])

  const ledger: LedgerEntry[] = []
  const unlocks = new Map<string, Unlock>()
  let balance = 0
  let cleanStreak = 0
  let breakStreak = 0
  let dirtyStreak = 0
  let cleanDayStreak = 0
  let calmStreak = 0
  let journalDayStreak = 0
  let tilt = false
  let journaled = 0
  let pending = 0
  let nyAmClean = 0
  const counts = { revenge: 0, gambler: 0, stopMover: 0, c: 0 }

  const unlock = (id: string, day: string) => {
    if (!unlocks.has(id)) unlocks.set(id, { id, day })
  }
  // Unredeemed shame badge -> clean positions in a row since it was earned
  const redeemRuns = new Map<string, number>()

  for (const [day, list] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    let dayDirty = false
    let dayPending = false
    let dayAllTop = true

    for (const p of list) {
      if (!isJournaled(p)) {
        pending++
        dayPending = true
        continue
      }
      journaled++
      const clean = isClean(p)
      const modifiers: string[] = []

      if (clean) {
        cleanStreak++
        dirtyStreak = 0
      } else {
        cleanStreak = 0
        dirtyStreak++
        dayDirty = true
      }
      breakStreak = p.followedPlan ? 0 : breakStreak + 1
      if (!(p.grade === 'A' || p.grade === 'A+') || !clean) dayAllTop = false

      const items = scorePosition(p)
      let plus = items.filter((i) => i.xp > 0).reduce((s, i) => s + i.xp, 0)
      let minus = items.filter((i) => i.xp < 0).reduce((s, i) => s + i.xp, 0)
      if (clean && cleanStreak > 1) {
        const f = Math.min(COMBO_MAX, 1 + COMBO_STEP * (cleanStreak - 1))
        plus *= f
        modifiers.push(`🔥 ${cleanStreak} 連擊 ${fmtFactor(f)}`)
      }
      if (tilt && plus > 0) {
        plus *= TILT_FACTOR
        modifiers.push(`😵 Tilt 加分 ${fmtFactor(TILT_FACTOR)}`)
      }
      if (breakStreak > 1) {
        const f = BREAK_STREAK_FACTORS[Math.min(breakStreak, BREAK_STREAK_FACTORS.length) - 1]
        minus *= f
        modifiers.push(`💀 連續 ${breakStreak} 筆沒照計畫，扣分 ${fmtFactor(f)}`)
      }
      const total = Math.round(plus + minus)
      balance += total
      ledger.push({ key: p.positionId, day, position: p, items, modifiers, total, balance })

      // Tilt takes effect from the next position on.
      if (dirtyStreak >= TILT_AFTER) tilt = true

      // Achievement counters
      const mistakes = splitMulti(p.mistakes)
      if (mistakes.includes('報復單')) counts.revenge++
      if (mistakes.includes('加大部位')) counts.gambler++
      if (mistakes.includes('移動停損')) counts.stopMover++
      if (p.grade === 'C') counts.c++
      calmStreak = (p.emotionBefore ?? 0) >= 4 ? calmStreak + 1 : 0
      if (clean && p.session === 'NY AM') nyAmClean++

      if (journaled >= 1) unlock('first', day)
      if (journaled >= 100) unlock('hundred', day)
      if (cleanStreak >= 20) unlock('iron', day)
      if (cleanStreak >= 50) unlock('flawless', day)
      if (calmStreak >= 20) unlock('calm', day)
      if (nyAmClean >= 20) unlock('nyAm', day)
      const shame: [string, boolean][] = [
        ['revenge', counts.revenge >= 3],
        ['gambler', counts.gambler >= 3],
        ['stopMover', counts.stopMover >= 3],
        ['cRegular', counts.c >= 3],
        ['runaway', breakStreak >= 3],
      ]
      for (const [id, hit] of shame) {
        if (hit && !unlocks.has(id)) {
          unlock(id, day)
          redeemRuns.set(id, 0)
        }
      }
      // Redemption: REDEEM_STREAK clean positions in a row after the badge was earned.
      for (const [id, n] of redeemRuns) {
        const run = clean ? n + 1 : 0
        redeemRuns.set(id, run)
        if (run >= REDEEM_STREAK) {
          unlocks.get(id)!.redeemedOn = day
          redeemRuns.delete(id)
          unlock('comeback', day)
        }
      }
    }

    // End-of-day settlement
    const items: XpItem[] = []
    const entries = journalByDay.get(day) ?? []
    const wrote = entries.some(hasJournalContent)
    if (wrote) items.push({ label: '寫了每日日誌', xp: DAY_XP.wroteJournal })
    if (entries.some((e) => e.followedDailyRules === true)) items.push({ label: '遵守每日規則', xp: DAY_XP.followedDailyRules })
    if (entries.some((e) => e.followedDailyRules === false)) items.push({ label: '違反每日規則', xp: DAY_XP.brokeDailyRules })
    if (list.length > OVERTRADE_LIMIT) {
      const extra = list.length - OVERTRADE_LIMIT
      items.push({ label: `過度交易（多 ${extra} 筆）`, xp: DAY_XP.overtradePer * extra })
    }
    const cleanDay = !dayDirty && !dayPending
    if (dayDirty) cleanDayStreak = 0
    else if (cleanDay) {
      cleanDayStreak++
      items.push({ label: `紀律日 ${cleanDayStreak} 連勝`, xp: Math.min(DAY_XP.cleanDayMax, DAY_XP.cleanDayPer * cleanDayStreak) })
    }
    const modifiers: string[] = []
    let plus = items.filter((i) => i.xp > 0).reduce((s, i) => s + i.xp, 0)
    const minus = items.filter((i) => i.xp < 0).reduce((s, i) => s + i.xp, 0)
    if (tilt && plus > 0) {
      plus *= TILT_FACTOR
      modifiers.push(`😵 Tilt 加分 ${fmtFactor(TILT_FACTOR)}`)
    }
    if (cleanDay && tilt) {
      tilt = false
      modifiers.push('Tilt 解除')
    }
    if (items.length > 0) {
      const total = Math.round(plus + minus)
      balance += total
      ledger.push({ key: `day:${day}`, day, position: null, items, modifiers, total, balance })
    }

    journalDayStreak = wrote ? journalDayStreak + 1 : 0
    if (journalDayStreak >= 5) unlock('fullWeek', day)
    if (cleanDayStreak >= 5) unlock('disciplineWeek', day)
    if (cleanDay && list.length >= 3 && dayAllTop) unlock('perfectDay', day)
    if (list.length >= 10 && !unlocks.has('rampage')) {
      unlock('rampage', day)
      redeemRuns.set('rampage', 0)
    }
  }

  const level = levelOf(balance)
  const inLevel =
    level === 0 || level >= MAX_LEVEL ? null : { have: balance - levelStart(level), need: xpForNext(level) }

  return {
    total: balance,
    level,
    inLevel,
    cleanStreak,
    breakStreak,
    cleanDayStreak,
    tilt,
    pending,
    journaled,
    ledger,
    unlocks: [...unlocks.values()],
  }
}
