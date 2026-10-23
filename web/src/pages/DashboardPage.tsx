import { useMemo, useState, type ReactNode } from 'react'
import { BreakdownTable } from '@/components/charts/BreakdownTable'
import { EquityChart } from '@/components/charts/EquityChart'
import { PnlCalendar } from '@/components/charts/PnlCalendar'
import { Card, EmptyState, ErrorBox, PageHeader, Spinner } from '@/components/ui'
import { cn } from '@/lib/cn'
import { money, pnlClass, rMultiple } from '@/lib/format'
import { usePositions } from '@/lib/queries'
import { SESSION_ORDER } from '@/lib/sessions'
import { loadConnection } from '@/lib/settings'
import { breakdown, dailyNet, DIMENSIONS, equityByDay, summarize, WEEKDAY_ORDER, type Dimension, type DimensionDef } from '@/lib/stats'
import { NeedsSetup } from './TradesPage'

const PERIODS = [
  { id: 'all', label: '全部', days: null },
  { id: 'ytd', label: '今年', days: 'ytd' },
  { id: '90', label: '近 90 天', days: 90 },
  { id: '30', label: '近 30 天', days: 30 },
] as const
type PeriodId = (typeof PERIODS)[number]['id']

const DIM_ORDER: Partial<Record<Dimension, string[]>> = {
  session: SESSION_ORDER,
  weekday: WEEKDAY_ORDER,
  grade: ['A+', 'A', 'B', 'C'],
}

export function DashboardPage() {
  const positions = usePositions()
  const [period, setPeriod] = useState<PeriodId>('all')
  const [dim, setDim] = useState<Dimension>('setup')

  const filtered = useMemo(() => {
    const cutoff = cutoffDay(period)
    return (positions.data ?? []).filter((p) => !cutoff || p.tradeDay >= cutoff)
  }, [positions.data, period])

  const s = useMemo(() => summarize(filtered), [filtered])
  const equity = useMemo(() => equityByDay(filtered), [filtered])
  const daily = useMemo(() => dailyNet(filtered), [filtered])
  const months = useMemo(() => [...new Set(filtered.map((p) => p.tradeDay.slice(0, 7)))].sort().reverse(), [filtered])
  const rows = useMemo(() => {
    const order = dim === 'hour' ? hourOrder(filtered) : DIM_ORDER[dim]
    return breakdown(filtered, DIMENSIONS[dim].keys, order)
  }, [filtered, dim])

  if (!loadConnection()) return <NeedsSetup />

  return (
    <>
      <PageHeader title="總覽" />

      {positions.isPending && <Spinner />}
      {positions.isError && <ErrorBox message={positions.error.message} />}
      {positions.isSuccess && positions.data.length === 0 && (
        <EmptyState title="還沒有交易資料" hint="先到「匯入」上傳 Topstep 報表" />
      )}

      {positions.isSuccess && positions.data.length > 0 && (
        <div className="space-y-4">
          <Segmented
            value={period}
            onChange={setPeriod}
            options={PERIODS.map((p) => ({ id: p.id, label: p.label }))}
          />

          {filtered.length === 0 ? (
            <EmptyState title="這段期間沒有交易" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                <Kpi label="淨損益" value={money(s.net)} valueClass={pnlClass(s.net)} sub={`${s.count} 筆部位`} />
                <Kpi
                  label="勝率"
                  value={pct(s.winRate)}
                  sub={`${s.wins} 勝 / ${s.losses} 負`}
                />
                <Kpi
                  label="獲利因子"
                  value={s.profitFactor === null ? '—' : s.profitFactor.toFixed(2)}
                  sub={`平均賺 ${s.avgWin === null ? '—' : money(s.avgWin)} / 賠 ${s.avgLoss === null ? '—' : money(s.avgLoss)}`}
                />
                <Kpi
                  label="每筆期望值"
                  value={s.expectancy === null ? '—' : money(s.expectancy)}
                  valueClass={pnlClass(s.expectancy ?? 0)}
                  sub={`平均 ${rMultiple(s.avgR)}（${s.rCount} 筆有 R）`}
                />
                <Kpi label="最大回撤" value={money(s.maxDrawdown)} valueClass={pnlClass(s.maxDrawdown)} sub="以平倉部位計算" />
                <Kpi
                  label="獲利天數"
                  value={pct(s.tradingDays ? s.greenDays / s.tradingDays : null)}
                  sub={`${s.greenDays} / ${s.tradingDays} 天`}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-5">
                <Card className="min-w-0 lg:col-span-3">
                  <h2 className="mb-3 text-sm font-medium">累積損益</h2>
                  <EquityChart points={equity} />
                </Card>
                <Card className="min-w-0 lg:col-span-2">
                  <h2 className="mb-3 text-sm font-medium">每日損益</h2>
                  <PnlCalendar key={period} daily={daily} months={months} />
                </Card>
              </div>

              <Card>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-medium">分類統計</h2>
                  <Segmented
                    value={dim}
                    onChange={setDim}
                    options={(Object.keys(DIMENSIONS) as Dimension[]).map((d) => ({ id: d, label: DIMENSIONS[d].label }))}
                  />
                </div>
                <BreakdownTable rows={rows} formatKey={(DIMENSIONS[dim] as DimensionDef).format} />
                {dim === 'mistakes' && (
                  <p className="mt-2 text-xs text-muted">一筆部位有多個錯誤標籤時，會分別計入每個標籤</p>
                )}
              </Card>
            </>
          )}
        </div>
      )}
    </>
  )
}

function Kpi({ label, value, sub, valueClass }: { label: string; value: string; sub?: ReactNode; valueClass?: string }) {
  return (
    <Card className="p-3 md:p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={cn('tabular mt-1 text-xl font-semibold md:text-2xl', valueClass)}>{value}</div>
      {sub && <div className="tabular mt-0.5 truncate text-xs text-muted">{sub}</div>}
    </Card>
  )
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { id: T; label: string }[]
}) {
  return (
    <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
          className={cn(
            'shrink-0 rounded-full border px-3 py-1 text-sm',
            o.id === value ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function pct(v: number | null): string {
  return v === null ? '—' : `${Math.round(v * 100)}%`
}

function cutoffDay(period: PeriodId): string | null {
  const def = PERIODS.find((p) => p.id === period)!
  if (def.days === null) return null
  const now = new Date()
  const d = def.days === 'ytd' ? new Date(now.getFullYear(), 0, 1) : new Date(now.getTime() - def.days * 86400_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function hourOrder(positions: { openedAt: string }[]): string[] {
  return [...new Set(positions.map((p) => `${String(new Date(p.openedAt).getHours()).padStart(2, '0')}:00`))].sort()
}
