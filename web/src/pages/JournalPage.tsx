import { ChevronRight, PenLine } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { Card, EmptyState, ErrorBox, PageHeader, Spinner } from '@/components/ui'
import { cn } from '@/lib/cn'
import { dayLabel, money, pnlClass } from '@/lib/format'
import { groupByDay, useJournal, usePositions } from '@/lib/queries'
import { loadConnection } from '@/lib/settings'
import type { JournalEntry } from '@/lib/types'
import { NeedsSetup } from './TradesPage'

interface Row {
  date: string
  net: number | null
  count: number
  entry: JournalEntry | null
}

export function JournalPage() {
  const positions = usePositions()
  const journal = useJournal()

  const rows = useMemo(() => {
    const map = new Map<string, Row>()
    for (const d of groupByDay(positions.data ?? [])) {
      map.set(d.day, { date: d.day, net: d.net, count: d.positions.length, entry: null })
    }
    for (const e of journal.data ?? []) {
      const row = map.get(e.date) ?? { date: e.date, net: null, count: 0, entry: null }
      row.entry = e
      map.set(e.date, row)
    }
    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date))
  }, [positions.data, journal.data])

  if (!loadConnection()) return <NeedsSetup />

  const written = rows.filter((r) => r.entry).length
  const today = localToday()

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <PageHeader title="日誌" description={`有交易的日子共 ${rows.filter((r) => r.count).length} 天，已寫 ${written} 篇`} />
        <Link
          to={`/day/${today}`}
          className="mb-6 inline-flex h-9 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-accent/90"
        >
          <PenLine className="size-4" /> 寫今天的日誌
        </Link>
      </div>

      {(positions.isPending || journal.isPending) && <Spinner />}
      {journal.isError && <ErrorBox message={journal.error.message} />}
      {positions.isSuccess && journal.isSuccess && rows.length === 0 && (
        <EmptyState title="還沒有日誌" hint="匯入交易或寫下今天的日誌" />
      )}

      {rows.length > 0 && journal.isSuccess && (
        <Card className="overflow-hidden p-0 md:p-0">
          {rows.map((r) => (
            <Link
              key={r.date}
              to={`/day/${r.date}`}
              className="flex items-center gap-3 border-b border-border/50 px-4 py-3 last:border-0 hover:bg-surface-2/60"
            >
              <div className="w-24 shrink-0">
                <div className="text-sm font-medium">{dayLabel(r.date)}</div>
                <div className="text-xs text-muted">{r.date.slice(0, 4)}</div>
              </div>
              <div className="min-w-0 flex-1">
                {r.entry ? (
                  <>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded bg-profit/15 px-1.5 py-0.5 text-profit">已寫</span>
                      {r.entry.bias && <span className="text-muted">方向 {r.entry.bias}</span>}
                      {r.entry.followedDailyRules === false && <span className="text-loss">違反規則</span>}
                    </div>
                    <p className="mt-1 truncate text-sm text-muted">
                      {r.entry.wentWrong || r.entry.wentWell || r.entry.plan || '（沒有文字內容）'}
                    </p>
                  </>
                ) : (
                  <span className="rounded bg-warn/15 px-1.5 py-0.5 text-xs text-warn">未寫</span>
                )}
              </div>
              <div className="tabular shrink-0 text-right">
                {r.net !== null && <div className={cn('text-sm font-medium', pnlClass(r.net))}>{money(r.net)}</div>}
                {r.count > 0 && <div className="text-xs text-muted">{r.count} 筆</div>}
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </Link>
          ))}
        </Card>
      )}
    </>
  )
}

function localToday(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
