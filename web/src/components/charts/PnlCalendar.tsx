import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { money } from '@/lib/format'

const WEEK = ['一', '二', '三', '四', '五', '六', '日']

/**
 * Month grid of daily net P&L. Color intensity scales with size; the signed
 * amount is always printed so profit vs loss never relies on color alone.
 */
export function PnlCalendar({ daily, months }: { daily: Map<string, { net: number; count: number }>; months: string[] }) {
  const [idx, setIdx] = useState(0) // months is newest first
  const month = months[idx]
  if (!month) return null

  const [y, m] = month.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1, 1))
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const lead = (first.getUTCDay() + 6) % 7 // Monday-first
  const cells: (string | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ]

  const monthDays = cells.filter((d): d is string => d !== null && daily.has(d))
  const maxAbs = Math.max(1, ...monthDays.map((d) => Math.abs(daily.get(d)!.net)))
  const monthNet = monthDays.reduce((s, d) => s + daily.get(d)!.net, 0)

  return (
    <div className="@container">
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          aria-label="上個月"
          disabled={idx >= months.length - 1}
          onClick={() => setIdx(idx + 1)}
          className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="tabular text-sm font-medium">
          {y}/{String(m).padStart(2, '0')}
        </span>
        <button
          type="button"
          aria-label="下個月"
          disabled={idx === 0}
          onClick={() => setIdx(idx - 1)}
          className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </button>
        <span className="tabular ml-auto text-sm text-muted">
          {monthDays.length} 天 · <span className="text-fg">{money(monthNet)}</span>
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted">
        {WEEK.map((d) => (
          <div key={d} className="pb-1">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} />
          const d = daily.get(day)
          const date = Number(day.slice(8))
          if (!d) {
            return (
              <div key={day} className="aspect-square rounded-md bg-surface-2/40 p-1 text-left text-muted/60 @[26rem]:aspect-[4/3]">
                {date}
              </div>
            )
          }
          // 0.18–0.75 alpha by magnitude, so small days stay visible.
          const alpha = 0.18 + 0.57 * Math.min(1, Math.abs(d.net) / maxAbs)
          const tone = d.net > 0 ? 'var(--color-profit)' : d.net < 0 ? 'var(--color-loss)' : 'var(--color-muted)'
          return (
            <Link
              key={day}
              to={`/day/${day}`}
              title={`${day} ${money(d.net)}（${d.count} 筆）`}
              className="group relative flex aspect-square flex-col justify-between rounded-md p-1 text-left ring-accent hover:ring-2 @[26rem]:aspect-[4/3]"
              style={{ background: `color-mix(in oklab, ${tone} ${Math.round(alpha * 100)}%, transparent)` }}
            >
              <span className="text-fg/80">{date}</span>
              <span className="tabular hidden truncate text-right text-[11px] font-medium text-fg @[26rem]:block">
                {shortMoney(d.net)}
              </span>
              <span className="tabular truncate text-right text-[10px] font-medium text-fg @[26rem]:hidden">
                {d.net > 0 ? '+' : d.net < 0 ? '−' : ''}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function shortMoney(n: number): string {
  const abs = Math.abs(n)
  const body = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : abs.toFixed(0)
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}$${body}`
}
