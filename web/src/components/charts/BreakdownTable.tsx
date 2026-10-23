import { cn } from '@/lib/cn'
import { money, pnlClass, rMultiple } from '@/lib/format'
import type { BreakdownRow } from '@/lib/stats'

/**
 * One row per group with an inline bar for net P&L, drawn from a shared zero
 * line so gains and losses read by direction as well as color.
 */
export function BreakdownTable({ rows, formatKey }: { rows: BreakdownRow[]; formatKey?: (key: string) => string }) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted">沒有資料</p>
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.net)))
  const hasNeg = rows.some((r) => r.net < 0)
  const hasPos = rows.some((r) => r.net > 0)
  // Zero sits at the left when everything is positive, at the right when all negative.
  const zero = hasNeg && hasPos ? 50 : hasNeg ? 100 : 0
  const scale = hasNeg && hasPos ? 50 : 100

  return (
    <div className="overflow-x-auto">
      <table className="tabular w-full min-w-[460px] text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="py-2 pr-3 font-normal">分類</th>
            <th className="py-2 pr-3 text-right font-normal">筆數</th>
            <th className="py-2 pr-3 text-right font-normal">勝率</th>
            <th className="py-2 pr-3 text-right font-normal">平均 R</th>
            <th className="w-[35%] py-2 pr-3 font-normal" />
            <th className="py-2 text-right font-normal">淨損益</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const len = (Math.abs(r.net) / maxAbs) * scale
            const left = r.net >= 0 ? zero : zero - len
            return (
              <tr key={r.key} className="border-t border-border/50">
                <td className={cn('py-2 pr-3 whitespace-nowrap', r.key === '未填' && 'text-muted')}>
                  {formatKey ? formatKey(r.key) : r.key}
                </td>
                <td className="py-2 pr-3 text-right text-muted">{r.count}</td>
                <td className="py-2 pr-3 text-right">{r.winRate === null ? '—' : `${Math.round(r.winRate * 100)}%`}</td>
                <td className="py-2 pr-3 text-right text-muted">{rMultiple(r.avgR)}</td>
                <td className="py-2 pr-3">
                  <div className="relative h-2.5">
                    <div className="absolute inset-y-[-3px] w-px bg-border" style={{ left: `${zero}%` }} />
                    <div
                      className={cn('absolute inset-y-0 rounded-sm', r.net >= 0 ? 'bg-profit/80' : 'bg-loss/80')}
                      style={{ left: `${left}%`, width: `${Math.max(len, 0.5)}%` }}
                    />
                  </div>
                </td>
                <td className={cn('py-2 text-right font-medium', pnlClass(r.net))}>{money(r.net)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
