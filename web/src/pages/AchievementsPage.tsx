import { CircleHelp, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Button, Card, EmptyState, ErrorBox, Spinner } from '@/components/ui'
import { cn } from '@/lib/cn'
import { dayLabel, timeOf } from '@/lib/format'
import { useJournal, usePositions, useSaveSetting, useSettings } from '@/lib/queries'
import { loadConnection } from '@/lib/settings'
import {
  ACHIEVEMENTS,
  BREAK_STREAK_FACTORS,
  COMBO_MAX,
  COMBO_STEP,
  computeProgress,
  DAY_XP,
  GRADE_XP,
  levelStart,
  MAX_LEVEL,
  OVERTRADE_LIMIT,
  POSITION_XP,
  RANKS,
  rankOf,
  REDEEM_STREAK,
  SEVERE_MISTAKES,
  TILT_AFTER,
  TILT_FACTOR,
  xpForNext,
  type LedgerEntry,
  type Progress,
} from '@/lib/xp'
import { NeedsSetup } from './TradesPage'

const TITLE_KEY = 'sweeplog.title'
const PAGE = 30

/** Signed XP so gains and losses read without color. */
function xp(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0'
}

const xpClass = (n: number) => (n > 0 ? 'text-profit' : n < 0 ? 'text-loss' : 'text-muted')

function loadTitle(): string | null {
  try {
    return localStorage.getItem(TITLE_KEY)
  } catch {
    return null
  }
}

function saveTitle(id: string | null) {
  try {
    if (id) localStorage.setItem(TITLE_KEY, id)
    else localStorage.removeItem(TITLE_KEY)
  } catch {
    // Not persisted; the choice still holds for this visit.
  }
}

export function AchievementsPage() {
  const positions = usePositions()
  const journal = useJournal()
  const settings = useSettings()
  const startDate = settings.data?.xpStartDate ?? null
  const [showRules, setShowRules] = useState(false)
  const [title, setTitle] = useState(loadTitle)

  const progress = useMemo(
    () => (positions.data ? computeProgress(positions.data, journal.data ?? [], startDate) : null),
    [positions.data, journal.data, startDate],
  )

  if (!loadConnection()) return <NeedsSetup />

  function equip(id: string | null) {
    setTitle(id)
    saveTitle(id)
  }

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">成就</h1>
          <p className="mt-1 text-sm text-muted">只看執行紀律，損益不影響經驗值</p>
        </div>
        <Button variant="secondary" onClick={() => setShowRules(true)} aria-label="計分規則">
          <CircleHelp className="size-4" />
          <span className="hidden sm:inline">計分規則</span>
        </Button>
      </div>

      {(positions.isPending || journal.isPending || settings.isPending) && <Spinner />}
      {positions.isError && <ErrorBox message={positions.error.message} />}
      {journal.isError && <ErrorBox message={journal.error.message} />}
      {progress && journal.isSuccess && !settings.isPending && (
        positions.data?.length === 0 ? (
          <EmptyState title="還沒有交易資料" hint="先到「匯入」上傳 Topstep 報表" />
        ) : (
          <div className="space-y-4">
            <LevelCard progress={progress} titleId={title} />
            <StartDateCard key={startDate ?? ''} startDate={startDate} loadError={settings.error?.message ?? null} />
            <Badges progress={progress} titleId={title} onEquip={equip} />
            <Ledger entries={progress.ledger} />
          </div>
        )
      )}

      {showRules && <RulesDialog onClose={() => setShowRules(false)} />}
    </>
  )
}

function LevelCard({ progress, titleId }: { progress: Progress; titleId: string | null }) {
  const rank = rankOf(progress.level)
  const title = ACHIEVEMENTS.find((a) => a.id === titleId && progress.unlocks.some((u) => u.id === a.id))
  const pct = progress.inLevel ? Math.max(0, Math.min(100, (progress.inLevel.have / progress.inLevel.need) * 100)) : 100

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-3xl">
          {rank.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="tabular text-2xl font-semibold">Lv.{progress.level}</span>
            <span className="text-lg font-medium">{rank.name}</span>
            {title && (
              <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs text-accent">
                {title.icon} {title.name}
              </span>
            )}
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className={cn('h-full rounded-full', progress.total < 0 ? 'bg-loss' : 'bg-accent')}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="tabular mt-1 flex justify-between text-xs text-muted">
            <span>
              總經驗 <span className={xpClass(progress.total)}>{xp(progress.total)}</span>
            </span>
            {progress.inLevel ? (
              <span>
                {progress.inLevel.have} / {progress.inLevel.need}，升級還差 {progress.inLevel.need - progress.inLevel.have}
              </span>
            ) : progress.level === 0 ? (
              <span>回到 0 才能重回 Lv.1</span>
            ) : (
              <span>已達最高等級</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <Status active={progress.cleanStreak > 0}>🔥 連擊 {progress.cleanStreak}</Status>
        <Status active={progress.cleanDayStreak > 0}>🏯 紀律日 {progress.cleanDayStreak} 連勝</Status>
        {progress.breakStreak > 0 && <Status bad>💀 連續 {progress.breakStreak} 筆沒照計畫</Status>}
        {progress.tilt && <Status bad>😵 Tilt：加分減半，打出一個紀律日才解除</Status>}
        {progress.pending > 0 && (
          <Link
            to="/trades"
            className="rounded-full border border-warn/40 bg-warn/10 px-3 py-1 text-warn hover:bg-warn/20"
          >
            ⏳ {progress.pending} 筆待覆盤，覆盤後才會計分
          </Link>
        )}
        {progress.pending > 0 && (
          // A button, not an #anchor: the hash router would read the anchor as a route.
          <button
            type="button"
            onClick={() => document.getElementById('xp-start')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            className="rounded-full px-1 py-1 text-xs text-muted underline-offset-2 hover:text-fg hover:underline"
          >
            太多了？設定計分起點
          </button>
        )}
      </div>
    </Card>
  )
}

/** Today as YYYY-MM-DD in the browser's time zone. */
function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function StartDateCard({ startDate, loadError }: { startDate: string | null; loadError: string | null }) {
  const save = useSaveSetting()
  const [draft, setDraft] = useState(startDate ?? today())
  const set = (value: string | null) => save.mutate({ key: 'xpStartDate', value })

  return (
    <Card>
      <div id="xp-start" className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-medium">計分起點（既往不究）</h2>
          <p className="mt-0.5 text-sm text-muted">
            {startDate
              ? `從 ${startDate.slice(0, 4)}/${dayLabel(startDate)} 起開始計分，之前的交易不加分、不扣分，也不用補覆盤`
              : '目前計算全部交易。設定起點後，之前的交易不加分、不扣分，也不用補覆盤'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            aria-label="計分起點"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-9 rounded-md border border-border bg-bg px-3 text-sm outline-none focus:border-accent"
          />
          <Button disabled={!draft || draft === startDate || save.isPending} onClick={() => set(draft)}>
            {save.isPending ? '儲存中…' : '從這天開始'}
          </Button>
          {startDate && (
            <Button variant="ghost" disabled={save.isPending} onClick={() => set(null)}>
              改回全部計算
            </Button>
          )}
        </div>
      </div>
      {loadError && <ErrorBox message={`讀不到計分起點：${loadError}`} />}
      {save.isError && <ErrorBox message={save.error.message} />}
    </Card>
  )
}

function Status({ children, active = true, bad = false }: { children: ReactNode; active?: boolean; bad?: boolean }) {
  return (
    <span
      className={cn(
        'rounded-full border px-3 py-1',
        bad ? 'border-loss/40 bg-loss/10 text-loss' : active ? 'border-border bg-surface-2' : 'border-border text-muted',
      )}
    >
      {children}
    </span>
  )
}

function Badges({
  progress,
  titleId,
  onEquip,
}: {
  progress: Progress
  titleId: string | null
  onEquip: (id: string | null) => void
}) {
  const unlocked = new Map(progress.unlocks.map((u) => [u.id, u]))
  const honor = ACHIEVEMENTS.filter((a) => a.kind === 'honor')
  const shame = ACHIEVEMENTS.filter((a) => a.kind === 'shame')
  const honorCount = honor.filter((a) => unlocked.has(a.id)).length

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h2 className="font-medium">榮譽勳章</h2>
        <span className="tabular text-xs text-muted">
          {honorCount} / {honor.length}・點已解鎖的勳章可裝備成封號
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {honor.map((a) => {
          const u = unlocked.get(a.id)
          const equipped = titleId === a.id
          return (
            <button
              key={a.id}
              type="button"
              disabled={!u}
              onClick={() => onEquip(equipped ? null : a.id)}
              aria-pressed={equipped}
              className={cn(
                'rounded-md border p-3 text-left transition-colors',
                u ? 'border-border bg-surface-2 hover:border-accent/60' : 'border-dashed border-border opacity-45',
                equipped && 'border-accent bg-accent/10',
              )}
            >
              <div className="text-2xl">{u ? a.icon : '🔒'}</div>
              <div className="mt-1 text-sm font-medium">{a.name}</div>
              <div className="mt-0.5 text-xs text-muted">{a.description}</div>
              {u && <div className="mt-1 text-xs text-muted">{equipped ? '✓ 已裝備' : dayLabel(u.day)}</div>}
            </button>
          )
        })}
      </div>

      <h2 className="mt-6 font-medium">恥辱勳章</h2>
      <p className="mt-0.5 text-xs text-muted">拿到後連續 {REDEEM_STREAK} 筆乾淨交易就能洗白</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {shame.map((a) => {
          const u = unlocked.get(a.id)
          const active = u && !u.redeemedOn
          return (
            <div
              key={a.id}
              className={cn(
                'rounded-md border p-3',
                active ? 'border-loss/50 bg-loss/10' : u ? 'border-border bg-surface-2 opacity-60' : 'border-dashed border-border opacity-45',
              )}
            >
              <div className={cn('text-2xl', u?.redeemedOn && 'grayscale')}>{u ? a.icon : '❔'}</div>
              <div className={cn('mt-1 text-sm font-medium', active && 'text-loss', u?.redeemedOn && 'line-through')}>
                {a.name}
              </div>
              <div className="mt-0.5 text-xs text-muted">{a.description}</div>
              {u && (
                <div className="mt-1 text-xs text-muted">
                  {u.redeemedOn ? `已洗白 ${dayLabel(u.redeemedOn)}` : `${dayLabel(u.day)} 獲得`}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function Ledger({ entries }: { entries: LedgerEntry[] }) {
  const [shown, setShown] = useState(PAGE)
  const newest = useMemo(() => [...entries].reverse(), [entries])

  return (
    <Card className="p-0 md:p-0">
      <div className="border-b border-border px-4 py-3 text-sm font-medium">經驗值紀錄</div>
      {newest.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">覆盤後的交易會出現在這裡</p>
      ) : (
        <ul>
          {newest.slice(0, shown).map((e) => (
            <li key={e.key} className="border-b border-border/60 px-4 py-3 last:border-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm">
                    <span className="text-muted">{dayLabel(e.day)}</span>{' '}
                    {e.position ? (
                      <Link to={`/day/${e.day}?open=${e.position.positionId}`} className="hover:text-accent">
                        {e.position.contractName} {e.position.side === 'Long' ? '多' : '空'}{' '}
                        <span className="tabular text-muted">{timeOf(e.position.openedAt)}</span>
                      </Link>
                    ) : (
                      <span className="font-medium">每日結算</span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {e.items.map((i) => (
                      <span key={i.label} className="tabular rounded bg-surface-2 px-1.5 py-0.5 text-xs">
                        {i.label} <span className={xpClass(i.xp)}>{xp(i.xp)}</span>
                      </span>
                    ))}
                    {e.modifiers.map((m) => (
                      <span key={m} className="rounded border border-border px-1.5 py-0.5 text-xs text-muted">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={cn('tabular font-semibold', xpClass(e.total))}>{xp(e.total)}</div>
                  <div className="tabular text-xs text-muted">累計 {xp(e.balance)}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {newest.length > shown && (
        <div className="border-t border-border p-3 text-center">
          <Button variant="ghost" onClick={() => setShown((n) => n + PAGE)}>
            顯示更多
          </Button>
        </div>
      )}
    </Card>
  )
}

function RulesDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const grades = Object.entries(GRADE_XP).map(([g, v]) => `${g} ${xp(v)}`).join('、')
  const breaks = BREAK_STREAK_FACTORS.map((f, i) => `第 ${i + 1}${i === BREAK_STREAK_FACTORS.length - 1 ? '+' : ''} 筆 ×${f}`).join('、')

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="計分規則"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-t-lg border border-border bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:rounded-lg md:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">計分規則</h2>
          <button type="button" aria-label="關閉" onClick={onClose} className="text-muted hover:text-fg">
            <X className="size-5" />
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">
          照計畫之後是輸是贏不是我們能決定的，所以<strong className="text-fg">損益完全不影響經驗值</strong>。
          只有填了評級和「照計畫」的部位才會計分；沒照計畫、C 級交易這類根本不該發生的事，扣分會非常重。
        </p>

        <RuleSection title="每個部位">
          <Rule label="完成覆盤（評級和照計畫都填了）" value={POSITION_XP.journaled} />
          <Rule label="照計畫" value={POSITION_XP.followedPlan} />
          <Rule label="沒照計畫" value={POSITION_XP.brokePlan} />
          <Rule label="評級" text={grades} />
          <Rule label="進場前情緒 4–5（平靜）" value={POSITION_XP.calmBefore} />
          <Rule label="進場前情緒 1–2（焦躁）" value={POSITION_XP.agitatedBefore} />
          <Rule label="出場後情緒比進場前掉 2 級以上" value={POSITION_XP.emotionCrash} />
          <Rule label="每個錯誤標籤" value={POSITION_XP.mistake} />
          <Rule label={`嚴重錯誤（${SEVERE_MISTAKES.join('、')}）`} value={POSITION_XP.severeMistake} />
        </RuleSection>

        <RuleSection title="每日結算">
          <Rule label="寫了每日日誌" value={DAY_XP.wroteJournal} />
          <Rule label="遵守每日規則" value={DAY_XP.followedDailyRules} />
          <Rule label="違反每日規則" value={DAY_XP.brokeDailyRules} />
          <Rule label={`過度交易：超過 ${OVERTRADE_LIMIT} 個部位，每多一筆`} value={DAY_XP.overtradePer} />
          <Rule
            label="紀律日：當天每筆都覆盤而且都乾淨"
            text={`+${DAY_XP.cleanDayPer} × 連勝天數（最多 +${DAY_XP.cleanDayMax}）`}
          />
        </RuleSection>

        <RuleSection title="連續加成">
          <Rule
            label="🔥 連擊：連續乾淨交易（照計畫、沒有錯誤標籤、不是 C）"
            text={`加分 +${Math.round(COMBO_STEP * 100)}% / 筆，最多 ×${COMBO_MAX}`}
          />
          <Rule label="💀 連續沒照計畫，扣分加重" text={breaks} />
          <Rule
            label={`😵 Tilt：連續 ${TILT_AFTER} 筆不乾淨`}
            text={`之後所有加分 ×${TILT_FACTOR}，打出一個紀律日才解除`}
          />
        </RuleSection>

        <RuleSection title="等級">
          <p className="text-sm text-muted">
            升到下一級需要 {xpForNext(1)} + 50 ×（目前等級 − 1）XP，最高 Lv.{MAX_LEVEL}（累計 {levelStart(MAX_LEVEL)} XP）。
            經驗值會被扣到負的，等級也會跟著掉；低於 0 就是 Lv.0。
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1 text-sm sm:grid-cols-3">
            {RANKS.map((r) => (
              <span key={r.from} className="rounded bg-surface-2 px-2 py-1">
                <span className="tabular text-muted">{r.from === 0 ? '< 0' : `Lv.${r.from}`}</span> {r.icon} {r.name}
              </span>
            ))}
          </div>
        </RuleSection>

        <RuleSection title="勳章">
          <ul className="space-y-1 text-sm">
            {ACHIEVEMENTS.map((a) => (
              <li key={a.id}>
                {a.icon} <span className={cn('font-medium', a.kind === 'shame' && 'text-loss')}>{a.name}</span>
                <span className="text-muted">：{a.description}</span>
              </li>
            ))}
          </ul>
        </RuleSection>
      </div>
    </div>
  )
}

function RuleSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 text-sm font-medium text-accent">{title}</h3>
      <div className="space-y-1">{children}</div>
    </section>
  )
}

function Rule({ label, value, text }: { label: string; value?: number; text?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-1 text-sm last:border-0">
      <span>{label}</span>
      {value != null ? (
        <span className={cn('tabular shrink-0 font-medium', xpClass(value))}>{xp(value)}</span>
      ) : (
        <span className="shrink-0 text-right text-muted">{text}</span>
      )}
    </div>
  )
}
