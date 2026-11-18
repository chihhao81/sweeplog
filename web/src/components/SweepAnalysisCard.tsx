import { useMemo, type ReactNode } from 'react'
import { Card } from '@/components/ui'
import { cn } from '@/lib/cn'
import { pnlClass, rMultiple } from '@/lib/format'
import { analyzeSweeps, sweepOptionLabel, type SweepSettings, type TriggerGroup } from '@/lib/sweep'
import type { Position } from '@/lib/types'

const BUFFERS = [3, 5, 8]

/** Reads the positions' 出場後 fields: wider-stop what-if, breakeven exits, early profit exits. */
export function SweepAnalysisCard({ positions, settings }: { positions: Position[]; settings: SweepSettings }) {
  const a = useMemo(() => analyzeSweeps(positions, BUFFERS), [positions])
  if (a.losses === 0 && a.breakeven.length === 0 && a.profit.count === 0) return null

  return (
    <Card>
      <h2 className="mb-1 text-sm font-medium">出場後分析</h2>
      <p className="mb-4 text-xs text-muted">讀部位的「出場後」欄位，依出場價分成虧損、保本、獲利但沒到目標三類</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="虧損出場：停損多放幾點"
          note={`虧損出場 ${a.losses} 筆，有填掃過幾點和之後走勢的 ${a.lossesFilled} 筆；沒填的當作救不回來。假設 1R 金額不變（停損放寬就減少口數），其他交易的 R 會跟著縮小。樣本 ${a.sampleCount} 筆有 R 的部位。`}
        >
          <Table head={['停損多放', '救回', '其中到目標', '總 R']}>
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
          </Table>
        </Section>

        <div className="space-y-6">
          <Section title="保本出場：依停損移動依據">
            <Table head={['依據', '筆數', '已填', '之後到目標']}>
              {a.breakeven.length === 0 && <Empty cols={4} text="沒有保本出場的部位" />}
              {a.breakeven.map((g) => (
                <GroupRow key={g.trigger} g={g} label={sweepOptionLabel(g.trigger, settings)} />
              ))}
            </Table>
          </Section>

          <Section
            title="獲利但沒到目標"
            note="移動停利或手動出場的單。平均少賺＝目標價的 R − 實際 R，只算之後有到目標的。"
          >
            <Table head={['筆數', '已填', '之後到目標', '平均少賺']}>
              {a.profit.count === 0 ? (
                <Empty cols={4} text="沒有這類部位" />
              ) : (
                <tr className="border-t border-border/50">
                  <td className="py-2 pr-3">{a.profit.count}</td>
                  <td className="py-2 pr-3 text-right text-muted">{a.profit.filled}</td>
                  <td className="py-2 pr-3 text-right">
                    {a.profit.toTarget}
                    <Pct g={a.profit} />
                  </td>
                  <td className="py-2 text-right">
                    {a.profit.avgMissedR === null ? '—' : `${a.profit.avgMissedR.toFixed(2)}R`}
                  </td>
                </tr>
              )}
            </Table>
          </Section>
        </div>
      </div>
    </Card>
  )
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-1 text-xs font-medium text-accent">{title}</h3>
      {children}
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
    </div>
  )
}

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="tabular w-full min-w-[280px] text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            {head.map((h, i) => (
              <th key={h} className={cn('py-2 font-normal', i > 0 && 'text-right', i < head.length - 1 && 'pr-3')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function GroupRow({ g, label }: { g: TriggerGroup; label: string }) {
  return (
    <tr className="border-t border-border/50">
      <td className={cn('py-2 pr-3', g.trigger === '未填' && 'text-muted')}>{label}</td>
      <td className="py-2 pr-3 text-right">{g.count}</td>
      <td className="py-2 pr-3 text-right text-muted">{g.filled}</td>
      <td className="py-2 text-right">
        {g.toTarget}
        <Pct g={g} />
      </td>
    </tr>
  )
}

function Pct({ g }: { g: TriggerGroup }) {
  return g.filled > 0 ? <span className="text-muted">（{Math.round((g.toTarget / g.filled) * 100)}%）</span> : null
}

function Empty({ cols, text }: { cols: number; text: string }) {
  return (
    <tr className="border-t border-border/50">
      <td colSpan={cols} className="py-4 text-center text-muted">
        {text}
      </td>
    </tr>
  )
}
