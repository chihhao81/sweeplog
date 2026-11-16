import { useMemo } from 'react'
import { Card } from '@/components/ui'
import { cn } from '@/lib/cn'
import { pnlClass, rMultiple } from '@/lib/format'
import { analyzeSweeps, sweepOptionLabel, type SweepSettings } from '@/lib/sweep'
import type { Position } from '@/lib/types'

const BUFFERS = [3, 5, 8]

/** Wider-stop what-if from the stop-sweep fields, and how breakeven stops fare. */
export function SweepAnalysisCard({ positions, settings }: { positions: Position[]; settings: SweepSettings }) {
  const a = useMemo(() => analyzeSweeps(positions, BUFFERS), [positions])
  if (a.stopSweeps === 0 && a.breakeven.length === 0) return null

  return (
    <Card>
      <h2 className="mb-1 text-sm font-medium">被掃分析</h2>
      <p className="mb-3 text-xs text-muted">
        讀部位的「出場後」欄位。被掃停損 {a.stopSweeps} 筆，已填 {a.stopSweepsFilled} 筆
        {a.stopSweepsFilled < a.stopSweeps && '；沒填的一律當作救不回來'}
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-x-auto">
          <table className="tabular w-full min-w-[320px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-2 pr-3 font-normal">停損多放</th>
                <th className="py-2 pr-3 text-right font-normal">救回</th>
                <th className="py-2 pr-3 text-right font-normal">其中到目標</th>
                <th className="py-2 text-right font-normal">總 R</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border/50">
                <td className="py-2 pr-3 text-muted">實際</td>
                <td className="py-2 pr-3 text-right text-muted">—</td>
                <td className="py-2 pr-3 text-right text-muted">—</td>
                <td className={cn('py-2 text-right font-medium', pnlClass(a.actualR))}>{rMultiple(a.actualR)}</td>
              </tr>
              {a.buffers.map((b) => (
                <tr key={b.buffer} className="border-t border-border/50">
                  <td className="py-2 pr-3">+{b.buffer} 點</td>
                  <td className="py-2 pr-3 text-right">{b.saved}</td>
                  <td className="py-2 pr-3 text-right">{b.savedToTarget}</td>
                  <td className={cn('py-2 text-right font-medium', pnlClass(b.totalR))}>{rMultiple(b.totalR)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">
            假設 1R 金額不變（停損放寬就減少口數），所以其他交易的 R 會跟著縮小。樣本 {a.sampleCount} 筆有 R 的部位。
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="tabular w-full min-w-[280px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-2 pr-3 font-normal">被掃保本：移保本依據</th>
                <th className="py-2 pr-3 text-right font-normal">筆數</th>
                <th className="py-2 pr-3 text-right font-normal">已填</th>
                <th className="py-2 text-right font-normal">之後到目標</th>
              </tr>
            </thead>
            <tbody>
              {a.breakeven.length === 0 && (
                <tr className="border-t border-border/50">
                  <td colSpan={4} className="py-4 text-center text-muted">
                    沒有被掃保本的部位
                  </td>
                </tr>
              )}
              {a.breakeven.map((g) => (
                <tr key={g.trigger} className="border-t border-border/50">
                  <td className={cn('py-2 pr-3', g.trigger === '未填' && 'text-muted')}>{sweepOptionLabel(g.trigger, settings)}</td>
                  <td className="py-2 pr-3 text-right">{g.count}</td>
                  <td className="py-2 pr-3 text-right text-muted">{g.filled}</td>
                  <td className="py-2 text-right">
                    {g.toTarget}
                    {g.filled > 0 && <span className="text-muted">（{Math.round((g.toTarget / g.filled) * 100)}%）</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  )
}
