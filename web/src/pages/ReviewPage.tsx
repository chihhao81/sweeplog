import { ChevronLeft, ChevronRight, Eye, EyeOff, Shuffle, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ChipSelect, FormRow } from '@/components/form'
import { SideBadge } from '@/components/PositionRow'
import { Button, Card, EmptyState, ErrorBox, PageHeader, Spinner } from '@/components/ui'
import { cn } from '@/lib/cn'
import { dayLabel, money, pnlClass, rMultiple, timeOf } from '@/lib/format'
import { driveImageUrl } from '@/lib/image'
import { splitMulti } from '@/lib/options'
import { useAllScreenshots, useOptions, usePositions } from '@/lib/queries'
import { SESSION_ORDER, sessionLabelAcross } from '@/lib/sessions'
import { loadConnection } from '@/lib/settings'
import { positionR, type Position, type Screenshot } from '@/lib/types'
import { NeedsSetup } from './TradesPage'

const RESULTS = ['賺', '賠']

interface Filters {
  setup: string | null
  result: string | null
  grade: string | null
  mistake: string | null
  session: string | null
}

const NO_FILTERS: Filters = { setup: null, result: null, grade: null, mistake: null, session: null }

interface ReviewCard {
  shot: Screenshot
  positions: Position[]
  net: number
}

function matches(p: Position, f: Filters): boolean {
  return (
    (!f.setup || p.setup === f.setup) &&
    (!f.result || (f.result === '賺' ? p.netPnl > 0 : p.netPnl < 0)) &&
    (!f.grade || p.grade === f.grade) &&
    (!f.mistake || splitMulti(p.mistakes).includes(f.mistake)) &&
    (!f.session || p.session === f.session)
  )
}

/**
 * Screenshot wall for reviewing setups side by side. Blind mode hides the
 * outcome until you flip a card, to practise judging the chart on its own.
 */
export function ReviewPage() {
  const shots = useAllScreenshots()
  const positions = usePositions()
  const options = useOptions()
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [blind, setBlind] = useState(false)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [order, setOrder] = useState<Map<string, number> | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)

  const cards = useMemo(() => {
    const byId = new Map((positions.data ?? []).map((p) => [p.positionId, p]))
    const active = Object.values(filters).some(Boolean)
    const list: ReviewCard[] = []
    for (const shot of shots.data ?? []) {
      const linked = shot.positionIds.map((id) => byId.get(id)).filter((p): p is Position => !!p)
      // Unlinked screenshots have nothing to filter on, so they only show unfiltered.
      if (active && !linked.some((p) => matches(p, filters))) continue
      list.push({ shot, positions: linked, net: linked.reduce((s, p) => s + p.netPnl, 0) })
    }
    return order
      ? list.sort((a, b) => (order.get(a.shot.id) ?? 0) - (order.get(b.shot.id) ?? 0))
      : list.sort((a, b) => b.shot.date.localeCompare(a.shot.date) || b.shot.createdAt.localeCompare(a.shot.createdAt))
  }, [shots.data, positions.data, filters, order])

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => {
    setFilters((f) => ({ ...f, [k]: v }))
    setViewing(null)
  }
  const sessionChip = (s: string) =>
    sessionLabelAcross(
      s,
      (positions.data ?? []).filter((p) => p.session === s).map((p) => new Date(p.openedAt)),
    )
  const isHidden = (id: string) => blind && !revealed.has(id)
  const reveal = (id: string) => setRevealed((s) => new Set(s).add(id))

  function shuffle() {
    setOrder(new Map((shots.data ?? []).map((s) => [s.id, Math.random()])))
    setRevealed(new Set())
  }

  if (!loadConnection()) return <NeedsSetup />

  const revealedCards = cards.filter((c) => revealed.has(c.shot.id))
  const wins = revealedCards.filter((c) => c.net > 0).length

  return (
    <>
      <PageHeader title="覆盤" description="把截圖排在一起比較；盲測模式會先遮住結果" />

      <Card className="mb-4 space-y-3">
        {options.data && (
          <div className="grid gap-3 md:grid-cols-2">
            <FormRow label="Setup">
              <ChipSelect options={options.data.setups} value={filters.setup} onChange={(v) => set('setup', v)} />
            </FormRow>
            <FormRow label="結果">
              <ChipSelect options={RESULTS} value={filters.result} onChange={(v) => set('result', v)} />
            </FormRow>
            <FormRow label="時段">
              <ChipSelect
                options={SESSION_ORDER.filter((s) => s !== 'Other')}
                value={filters.session}
                onChange={(v) => set('session', v)}
                format={sessionChip}
              />
            </FormRow>
            <FormRow label="評級">
              <ChipSelect options={options.data.grades} value={filters.grade} onChange={(v) => set('grade', v)} />
            </FormRow>
            <div className="md:col-span-2">
              <FormRow label="錯誤標籤">
                <ChipSelect options={options.data.mistakes} value={filters.mistake} onChange={(v) => set('mistake', v)} />
              </FormRow>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button
            type="button"
            variant={blind ? 'primary' : 'secondary'}
            onClick={() => {
              setBlind(!blind)
              setRevealed(new Set())
            }}
          >
            {blind ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            盲測模式{blind ? '：開' : ''}
          </Button>
          <Button type="button" variant="secondary" onClick={shuffle}>
            <Shuffle className="size-4" /> 隨機排序
          </Button>
          {Object.values(filters).some(Boolean) && (
            <Button type="button" variant="ghost" onClick={() => setFilters(NO_FILTERS)}>
              清除篩選
            </Button>
          )}
          <span className="tabular ml-auto text-sm text-muted">
            {cards.length} 張
            {blind && revealedCards.length > 0 && ` · 已翻 ${revealedCards.length}，其中 ${wins} 張賺`}
          </span>
        </div>
      </Card>

      {(shots.isPending || positions.isPending) && <Spinner />}
      {shots.isError && <ErrorBox message={shots.error.message} />}
      {shots.isSuccess && cards.length === 0 && (
        <EmptyState
          title={shots.data.length ? '沒有符合條件的截圖' : '還沒有截圖'}
          hint={shots.data.length ? '換個篩選條件試試' : '到單日頁上傳截圖並關聯部位'}
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c, i) => (
          <Card key={c.shot.id} className="overflow-hidden p-0 md:p-0">
            <button type="button" className="block w-full" onClick={() => setViewing(i)}>
              <img
                src={driveImageUrl(c.shot.driveFileId, 800)}
                alt={c.shot.caption ?? c.shot.fileName}
                loading="lazy"
                className="aspect-video w-full bg-bg object-cover"
              />
            </button>
            <CardMeta card={c} hidden={isHidden(c.shot.id)} onReveal={() => reveal(c.shot.id)} />
          </Card>
        ))}
      </div>

      {viewing !== null && cards[viewing] && (
        <Viewer
          card={cards[viewing]}
          hidden={isHidden(cards[viewing].shot.id)}
          onReveal={() => reveal(cards[viewing].shot.id)}
          onPrev={viewing > 0 ? () => setViewing(viewing - 1) : null}
          onNext={viewing < cards.length - 1 ? () => setViewing(viewing + 1) : null}
          onClose={() => setViewing(null)}
          position={`${viewing + 1} / ${cards.length}`}
        />
      )}
    </>
  )
}

function CardMeta({ card, hidden, onReveal }: { card: ReviewCard; hidden: boolean; onReveal: () => void }) {
  const { shot, positions } = card
  return (
    <div className="space-y-2 p-3 text-sm">
      <div className="flex items-center gap-2">
        <Link to={`/day/${shot.date}`} className="font-medium hover:text-accent">
          {shot.date.slice(0, 4)}/{dayLabel(shot.date)}
        </Link>
        {shot.caption && <span className="truncate text-xs text-muted">{shot.caption}</span>}
      </div>
      {positions.length === 0 && <p className="text-xs text-warn">未關聯部位</p>}
      {positions.map((p) => (
        <div key={p.positionId} className="flex items-center gap-2">
          <span className="tabular w-11 text-xs text-muted">{timeOf(p.openedAt)}</span>
          <SideBadge side={p.side} />
          <span className="truncate text-xs text-accent">{p.setup ?? '—'}</span>
          {!hidden && (
            <span className={cn('tabular ml-auto text-xs font-medium', pnlClass(p.netPnl))}>
              {money(p.netPnl)} · {rMultiple(positionR(p))}
            </span>
          )}
        </div>
      ))}
      {hidden && positions.length > 0 && (
        <button type="button" onClick={onReveal} className="w-full rounded-md border border-dashed border-border py-1.5 text-xs text-muted hover:text-fg">
          翻牌看結果
        </button>
      )}
    </div>
  )
}

function Viewer({
  card,
  hidden,
  onReveal,
  onPrev,
  onNext,
  onClose,
  position,
}: {
  card: ReviewCard
  hidden: boolean
  onReveal: () => void
  onPrev: (() => void) | null
  onNext: (() => void) | null
  onClose: () => void
  position: string
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') onPrev?.()
      else if (e.key === 'ArrowRight') onNext?.()
      else if (e.key === ' ' && hidden) {
        e.preventDefault()
        onReveal()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext, onReveal, hidden])

  const nav = 'rounded-full bg-surface/80 p-2 text-fg hover:bg-surface disabled:opacity-20'
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex flex-col bg-black/90 md:flex-row">
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-2 md:p-6">
        <img
          src={driveImageUrl(card.shot.driveFileId, 2400)}
          alt={card.shot.caption ?? card.shot.fileName}
          className="max-h-full max-w-full object-contain"
        />
        <button type="button" aria-label="上一張" disabled={!onPrev} onClick={() => onPrev?.()} className={cn(nav, 'absolute left-2 top-1/2 -translate-y-1/2')}>
          <ChevronLeft className="size-5" />
        </button>
        <button type="button" aria-label="下一張" disabled={!onNext} onClick={() => onNext?.()} className={cn(nav, 'absolute right-2 top-1/2 -translate-y-1/2')}>
          <ChevronRight className="size-5" />
        </button>
      </div>
      <aside className="max-h-[40dvh] shrink-0 overflow-y-auto border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:max-h-none md:w-80 md:border-t-0 md:border-l">
        <div className="flex items-center justify-between px-3 pt-3">
          <span className="tabular text-xs text-muted">{position}</span>
          <button type="button" onClick={onClose} aria-label="關閉" className="text-muted hover:text-fg">
            <X className="size-5" />
          </button>
        </div>
        <CardMeta card={card} hidden={hidden} onReveal={onReveal} />
        {!hidden &&
          card.positions.map(
            (p) =>
              (p.notes || p.lesson || p.mistakes) && (
                <div key={p.positionId} className="space-y-1 border-t border-border/50 px-3 py-2 text-xs">
                  {p.mistakes && <p className="text-loss">錯誤：{p.mistakes}</p>}
                  {p.notes && <p className="text-muted">{p.notes}</p>}
                  {p.lesson && <p>學到：{p.lesson}</p>}
                </div>
              ),
          )}
        <p className="hidden px-3 pb-3 text-[11px] text-muted md:block">← → 切換、空白鍵翻牌、Esc 關閉</p>
      </aside>
    </div>
  )
}
