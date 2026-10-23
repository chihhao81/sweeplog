import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { DailyJournalCard } from '@/components/DailyJournalCard'
import { PositionJournal } from '@/components/PositionJournal'
import { PositionRow } from '@/components/PositionRow'
import { PositionShots, ScreenshotPanel, type UploadRequest } from '@/components/screenshots'
import { Card, EmptyState, ErrorBox, Spinner } from '@/components/ui'
import { cn } from '@/lib/cn'
import { dayLabel, duration, money, pnlClass, price, timeOf } from '@/lib/format'
import { groupByDay, useDayTrades, useOptions, usePositions, useScreenshots } from '@/lib/queries'
import { lastAccount, loadConnection } from '@/lib/settings'
import type { Screenshot, Trade } from '@/lib/types'
import { NeedsSetup } from './TradesPage'

export function DayPage() {
  const { date = '' } = useParams()
  // Fresh state (open position, pending upload) for each day.
  return <DayView key={date} date={date} />
}

function DayView({ date }: { date: string }) {
  const positions = usePositions()
  const trades = useDayTrades(date)
  const options = useOptions()
  const screenshots = useScreenshots(date)
  const [open, setOpen] = useState<string | null>(null)
  const [request, setRequest] = useState<UploadRequest | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)

  const days = useMemo(() => groupByDay(positions.data ?? []), [positions.data])
  const idx = days.findIndex((d) => d.day === date)
  const day = days[idx]
  // days is newest first
  const newer = idx > 0 ? days[idx - 1].day : null
  const older = idx >= 0 && idx < days.length - 1 ? days[idx + 1].day : null

  const fillsByPosition = useMemo(() => {
    const map = new Map<string, Trade[]>()
    for (const t of trades.data ?? []) map.set(t.positionId, [...(map.get(t.positionId) ?? []), t])
    return map
  }, [trades.data])

  const shots = useMemo(() => screenshots.data ?? [], [screenshots.data])
  const shotsByPosition = useMemo(() => {
    const map = new Map<string, Screenshot[]>()
    for (const s of shots) for (const id of s.positionIds) map.set(id, [...(map.get(id) ?? []), s])
    return map
  }, [shots])

  if (!loadConnection()) return <NeedsSetup />

  const gross = day?.positions.reduce((s, p) => s + p.grossPnl, 0) ?? 0
  const costs = day?.positions.reduce((s, p) => s + p.costs, 0) ?? 0

  return (
    <>
      <div className="mb-6 flex items-center gap-2">
        <NavButton to={older && `/day/${older}`} label="前一個交易日">
          <ChevronLeft className="size-5" />
        </NavButton>
        <div className="flex-1 text-center md:flex-none md:text-left">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            <span className="text-muted">{date.slice(0, 4)}/</span>
            {date ? dayLabel(date) : ''}
          </h1>
        </div>
        <NavButton to={newer && `/day/${newer}`} label="下一個交易日">
          <ChevronRight className="size-5" />
        </NavButton>
      </div>

      {positions.isPending && <Spinner />}
      {positions.isError && <ErrorBox message={positions.error.message} />}

      <div className="space-y-4">
        {positions.isSuccess && !day && <EmptyState title="這天沒有交易" hint="仍然可以寫當日日誌" />}

        {day && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile label="淨損益" value={money(day.net)} className={pnlClass(day.net)} />
              <Tile label="毛損益" value={money(gross)} />
              <Tile label="手續費" value={money(-costs)} />
              <Tile label="勝 / 負" value={`${day.wins} / ${day.losses}`} />
            </div>

            <Card className="overflow-hidden p-0 md:p-0">
              {[...day.positions].reverse().map((p) => {
                const expanded = open === p.positionId
                const fills = fillsByPosition.get(p.positionId) ?? []
                return (
                  <div key={p.positionId} className="border-b border-border/50 last:border-0">
                    <button
                      type="button"
                      className="flex w-full items-center text-left hover:bg-surface-2/60"
                      onClick={() => setOpen(expanded ? null : p.positionId)}
                      aria-expanded={expanded}
                    >
                      <PositionRow p={p} shotCount={shotsByPosition.get(p.positionId)?.length} className="flex-1 pr-1" />
                      <ChevronDown
                        className={cn('mr-3 size-4 shrink-0 text-muted transition-transform', expanded && 'rotate-180')}
                      />
                    </button>
                    {expanded && (
                      <div className="border-t border-border/50 bg-bg/60 px-4 pb-4">
                        <details className="pt-2 text-xs">
                          <summary className="cursor-pointer text-muted hover:text-fg">
                            成交明細（{p.tradeCount} 筆）
                          </summary>
                          {trades.isPending ? (
                            <p className="py-2 text-muted">載入中…</p>
                          ) : (
                            <Fills fills={fills} />
                          )}
                        </details>
                        <PositionShots
                          shots={shotsByPosition.get(p.positionId) ?? []}
                          onAdd={(files) => setRequest({ files, positionIds: [p.positionId] })}
                          onOpen={setViewing}
                        />
                        {options.data && <PositionJournal position={p} options={options.data} />}
                      </div>
                    )}
                  </div>
                )
              })}
            </Card>
          </>
        )}

        {positions.isSuccess && (
          <ScreenshotPanel
            date={date}
            positions={day ? [...day.positions].reverse() : []}
            shots={shots}
            request={request}
            onRequest={setRequest}
            focusId={open}
            viewing={viewing}
            onView={setViewing}
          />
        )}
        {screenshots.isError && <ErrorBox message={screenshots.error.message} />}

        {positions.isSuccess && (
          <DailyJournalCard date={date} accountName={day?.positions[0]?.accountName ?? lastAccount()} />
        )}
      </div>
    </>
  )
}

function Fills({ fills }: { fills: Trade[] }) {
  if (fills.length === 0) return <p className="py-2 text-xs text-muted">沒有成交明細</p>
  return (
    <div className="overflow-x-auto">
      <table className="tabular w-full min-w-[480px] text-xs">
        <thead className="text-muted">
          <tr className="text-left">
            <th className="py-2 font-normal">進場</th>
            <th className="py-2 font-normal">出場</th>
            <th className="py-2 text-right font-normal">進場價</th>
            <th className="py-2 text-right font-normal">出場價</th>
            <th className="py-2 text-right font-normal">持有</th>
            <th className="py-2 text-right font-normal">損益</th>
          </tr>
        </thead>
        <tbody>
          {[...fills]
            .sort((a, b) => a.enteredAt.localeCompare(b.enteredAt))
            .map((t) => (
              <tr key={t.id} className="border-t border-border/40">
                <td className="py-1.5">{timeOf(t.enteredAt, true)}</td>
                <td className="py-1.5">{timeOf(t.exitedAt, true)}</td>
                <td className="py-1.5 text-right">{price(t.entryPrice)}</td>
                <td className="py-1.5 text-right">{price(t.exitPrice)}</td>
                <td className="py-1.5 text-right text-muted">{duration(t.durationSec)}</td>
                <td className={cn('py-1.5 text-right', pnlClass(t.pnl))}>{money(t.pnl)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}

function Tile({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <Card className="p-3 md:p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={cn('tabular mt-1 text-lg font-semibold', className)}>{value}</div>
    </Card>
  )
}

function NavButton({ to, label, children }: { to: string | null; label: string; children: ReactNode }) {
  const cls = 'inline-flex size-9 items-center justify-center rounded-md border border-border'
  if (!to)
    return (
      <span className={cn(cls, 'opacity-30')} aria-hidden>
        {children}
      </span>
    )
  return (
    <Link to={to} aria-label={label} className={cn(cls, 'hover:bg-surface-2')}>
      {children}
    </Link>
  )
}
