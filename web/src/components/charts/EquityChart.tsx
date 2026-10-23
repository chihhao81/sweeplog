import { useState, type PointerEvent } from 'react'
import { useNavigate } from 'react-router'
import { cn } from '@/lib/cn'
import { dayLabel, money, pnlClass } from '@/lib/format'
import type { EquityPoint } from '@/lib/stats'
import { useWidth } from '@/lib/useWidth'

const HEIGHT = 220
const PAD = { top: 12, right: 12, bottom: 24, left: 56 }

/** Cumulative net P&L by trading day, with a crosshair tooltip. Click a point to open that day. */
export function EquityChart({ points }: { points: EquityPoint[] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const navigate = useNavigate()

  const w = Math.max(0, width - PAD.left - PAD.right)
  const h = HEIGHT - PAD.top - PAD.bottom
  const values = points.map((p) => p.equity)
  const lo = Math.min(0, ...values)
  const hi = Math.max(0, ...values)
  const span = hi - lo || 1
  const x = (i: number) => PAD.left + (points.length > 1 ? (i / (points.length - 1)) * w : w / 2)
  const y = (v: number) => PAD.top + (1 - (v - lo) / span) * h

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.equity).toFixed(1)}`).join('')
  const ticks = niceTicks(lo, hi, 4)

  function onMove(e: PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect()
    const rel = (e.clientX - box.left) / box.width
    setHover(Math.round(rel * (points.length - 1)))
  }

  const hp = hover !== null ? points[hover] : null
  // Keep the tooltip inside the chart.
  const tipLeft = hover !== null ? Math.min(Math.max(x(hover), 90), width - 90) : 0

  return (
    <div ref={ref} className="relative w-full min-w-0 overflow-hidden">
      {width > 0 && points.length > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label="累積損益曲線" className="block">
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                className={t === 0 ? 'stroke-muted/60' : 'stroke-border'}
                strokeDasharray={t === 0 ? undefined : '2 4'}
              />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                {compactMoney(t)}
              </text>
            </g>
          ))}
          <text x={PAD.left} y={HEIGHT - 6} className="fill-muted text-[11px]">
            {points[0].day}
          </text>
          <text x={width - PAD.right} y={HEIGHT - 6} textAnchor="end" className="fill-muted text-[11px]">
            {points.at(-1)!.day}
          </text>

          <path d={path} fill="none" className="stroke-accent" strokeWidth={2} strokeLinejoin="round" />

          {hp && hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + h} className="stroke-muted/70" />
              <circle cx={x(hover)} cy={y(hp.equity)} r={4.5} className="fill-accent stroke-surface" strokeWidth={2} />
            </g>
          )}

          <rect
            x={PAD.left}
            y={0}
            width={w}
            height={HEIGHT}
            fill="transparent"
            className="cursor-pointer"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            onClick={() => hp && navigate(`/day/${hp.day}`)}
          />
        </svg>
      )}

      {hp && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs shadow-lg"
          style={{ left: tipLeft }}
        >
          <div className="mb-1 font-medium">
            {hp.day.slice(0, 4)}/{dayLabel(hp.day)}
          </div>
          <div className="tabular flex justify-between gap-4">
            <span className="text-muted">當日</span>
            <span className={pnlClass(hp.dayNet)}>{money(hp.dayNet)}</span>
          </div>
          <div className="tabular flex justify-between gap-4">
            <span className="text-muted">累積</span>
            <span className={cn('font-medium', pnlClass(hp.equity))}>{money(hp.equity)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function compactMoney(n: number): string {
  const abs = Math.abs(n)
  const s = abs >= 1000 ? `${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k` : abs.toFixed(0)
  return `${n < 0 ? '-' : ''}$${s}`
}

/** Round tick values spanning [lo, hi], always including 0. */
function niceTicks(lo: number, hi: number, count: number): number[] {
  const raw = (hi - lo) / count || 1
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const ticks: number[] = []
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) ticks.push(Math.round(t * 100) / 100)
  if (!ticks.includes(0)) ticks.push(0)
  return ticks
}
