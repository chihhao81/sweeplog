import { ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { PositionRow } from '@/components/PositionRow'
import { Card, EmptyState, ErrorBox, PageHeader, Spinner } from '@/components/ui'
import { cn } from '@/lib/cn'
import { dayLabel, money, pnlClass } from '@/lib/format'
import { groupByDay, usePositions } from '@/lib/queries'
import { loadConnection } from '@/lib/settings'

export function TradesPage() {
  const positions = usePositions()
  const months = useMemo(
    () => [...new Set((positions.data ?? []).map((p) => p.tradeDay.slice(0, 7)))],
    [positions.data],
  )
  const [month, setMonth] = useState<string | null>(null)
  const activeMonth = month ?? months[0] ?? null

  const days = useMemo(
    () => groupByDay((positions.data ?? []).filter((p) => !activeMonth || p.tradeDay.startsWith(activeMonth))),
    [positions.data, activeMonth],
  )
  const monthNet = days.reduce((s, d) => s + d.net, 0)
  const monthCount = days.reduce((s, d) => s + d.positions.length, 0)

  if (!loadConnection()) return <NeedsSetup />

  return (
    <>
      <PageHeader title="交易" description="依交易日分組；點日期進入當日檢視" />

      {positions.isPending && <Spinner />}
      {positions.isError && <ErrorBox message={positions.error.message} />}
      {positions.isSuccess && positions.data.length === 0 && (
        <EmptyState title="還沒有交易資料" hint="先到「匯入」上傳 Topstep 報表" />
      )}

      {months.length > 0 && (
        <>
          <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            {months.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMonth(m)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1 text-sm',
                  m === activeMonth
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border text-muted hover:text-fg',
                )}
              >
                {m.replace('-', '/')}
              </button>
            ))}
          </div>

          <div className="mb-4 flex items-baseline gap-3 text-sm text-muted">
            <span>{monthCount} 筆部位</span>
            <span className={cn('tabular font-medium', pnlClass(monthNet))}>{money(monthNet)}</span>
          </div>

          <div className="space-y-3">
            {days.map((d) => (
              <Card key={d.day} className="overflow-hidden p-0 md:p-0">
                <Link
                  to={`/day/${d.day}`}
                  className="flex items-center gap-3 border-b border-border bg-surface-2/50 px-4 py-2.5 hover:bg-surface-2"
                >
                  <span className="font-medium">{dayLabel(d.day)}</span>
                  <span className="text-xs text-muted">
                    {d.positions.length} 筆 · {d.wins}W {d.losses}L
                  </span>
                  <span className={cn('tabular ml-auto text-sm font-medium', pnlClass(d.net))}>
                    {money(d.net)}
                  </span>
                  <ChevronRight className="size-4 text-muted" />
                </Link>
                {[...d.positions].reverse().map((p) => (
                  <Link
                    key={p.positionId}
                    to={`/day/${d.day}?open=${p.positionId}`}
                    className="block border-b border-border/50 last:border-0 hover:bg-surface-2/60"
                  >
                    <PositionRow p={p} />
                  </Link>
                ))}
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  )
}

export function NeedsSetup() {
  return (
    <EmptyState title="尚未連線到試算表" hint="請先到「設定」填寫 GAS 網址與 Token" />
  )
}
