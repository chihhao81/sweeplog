import { Image } from 'lucide-react'
import { cn } from '@/lib/cn'
import { money, pnlClass, price, rMultiple, timeOf } from '@/lib/format'
import { sessionLabel } from '@/lib/sessions'
import { positionR, type Position } from '@/lib/types'

export function SideBadge({ side }: { side: Position['side'] }) {
  return (
    <span
      className={cn(
        'inline-flex w-12 justify-center rounded px-1.5 py-0.5 text-xs font-medium',
        side === 'Long' ? 'bg-profit/15 text-profit' : 'bg-loss/15 text-loss',
      )}
    >
      {side === 'Long' ? '多' : '空'}
    </span>
  )
}

/** One position as a compact two-line row; works on phone and desktop. */
export function PositionRow({ p, shotCount, className }: { p: Position; shotCount?: number; className?: string }) {
  const r = positionR(p)
  return (
    <div className={cn('flex items-center gap-3 px-4 py-3', className)}>
      <div className="tabular w-11 shrink-0 text-sm text-muted">{timeOf(p.openedAt)}</div>
      <SideBadge side={p.side} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 text-sm">
          <span className="font-medium">{p.contractName}</span>
          {p.maxSize > 1 && <span className="text-xs text-muted">×{p.maxSize}</span>}
          <span className="hidden text-xs text-muted sm:inline">{sessionLabel(p.session, new Date(p.openedAt))}</span>
          {p.setup && <span className="truncate text-xs text-accent">{p.setup}</span>}
          {shotCount ? (
            <span className="inline-flex items-center gap-0.5 text-xs text-muted">
              <Image className="size-3" />
              {shotCount}
            </span>
          ) : null}
        </div>
        <div className="tabular truncate text-xs text-muted">
          {price(p.avgEntry)} → {price(p.avgExit)}
          {p.stopPrice !== null && <span className="ml-2">SL {price(p.stopPrice)}</span>}
        </div>
      </div>
      <div className="tabular shrink-0 text-right">
        <div className={cn('text-sm font-medium', pnlClass(p.netPnl))}>{money(p.netPnl)}</div>
        <div className="text-xs text-muted">{rMultiple(r)}</div>
      </div>
    </div>
  )
}
