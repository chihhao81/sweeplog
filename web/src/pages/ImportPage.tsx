import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, FileSpreadsheet, Upload, X } from 'lucide-react'
import { useMemo, useState, type DragEvent } from 'react'
import { Link } from 'react-router'
import { Button, Card, ErrorBox, Field, PageHeader } from '@/components/ui'
import { api, type ImportPayload } from '@/lib/api'
import { cn } from '@/lib/cn'
import { dayLabel, money, pnlClass } from '@/lib/format'
import { parseExport, type ParsedExport } from '@/lib/topstep/parse'
import { buildPositions } from '@/lib/topstep/positions'
import { lastAccount, rememberAccount } from '@/lib/settings'
import type { PositionDerived } from '@/lib/types'

interface LoadedFile {
  name: string
  parsed: ParsedExport
}

export function ImportPage() {
  const queryClient = useQueryClient()
  const [files, setFiles] = useState<LoadedFile[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [account, setAccount] = useState(lastAccount)
  const [dragging, setDragging] = useState(false)

  const existing = useQuery({
    queryKey: ['existingIds'],
    queryFn: api.existingIds,
    enabled: files.length > 0,
    staleTime: 0,
  })

  const tradesFile = files.find((f) => f.parsed.kind === 'trades')?.parsed
  const ordersFile = files.find((f) => f.parsed.kind === 'orders')?.parsed

  const preview = useMemo(() => {
    const parsedTrades = tradesFile?.kind === 'trades' ? tradesFile.rows : []
    const orders = ordersFile?.kind === 'orders' ? ordersFile.rows : []
    const { trades, positions } = buildPositions(parsedTrades, orders, account.trim())
    return { trades, orders, positions }
  }, [tradesFile, ordersFile, account])

  const known = useMemo(
    () => ({ trades: new Set(existing.data?.trades), orders: new Set(existing.data?.orders) }),
    [existing.data],
  )
  const newTrades = preview.trades.filter((t) => !known.trades.has(t.id)).length
  const newOrders = preview.orders.filter((o) => !known.orders.has(o.id)).length

  const importMutation = useMutation({
    mutationFn: () => api.importData(toPayload(preview, Boolean(ordersFile))),
    onSuccess: () => {
      rememberAccount(account.trim())
      queryClient.invalidateQueries({ queryKey: ['positions'] })
      queryClient.invalidateQueries({ queryKey: ['trades'] })
      queryClient.invalidateQueries({ queryKey: ['existingIds'] })
    },
  })

  async function addFiles(list: FileList | null) {
    if (!list) return
    importMutation.reset()
    const loaded: LoadedFile[] = []
    const errs: string[] = []
    for (const file of Array.from(list)) {
      try {
        loaded.push({ name: file.name, parsed: parseExport(await file.text()) })
      } catch (e) {
        errs.push(`${file.name}：${e instanceof Error ? e.message : String(e)}`)
      }
    }
    // A new file of the same kind replaces the old one.
    setFiles((prev) => [
      ...prev.filter((p) => !loaded.some((l) => l.parsed.kind === p.parsed.kind)),
      ...loaded,
    ])
    setErrors(errs)
    const fromOrders = loaded.find((l) => l.parsed.kind === 'orders')?.parsed
    if (fromOrders?.kind === 'orders' && fromOrders.accountNames.length === 1) {
      setAccount(fromOrders.accountNames[0])
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const multiAccount = ordersFile?.kind === 'orders' && ordersFile.accountNames.length > 1
  const canImport =
    preview.trades.length + preview.orders.length > 0 && account.trim() !== '' && !multiAccount

  return (
    <>
      <PageHeader title="匯入" description="上傳 Topstep 匯出的 Trades 與 Orders CSV，可以一次選兩個檔案" />

      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-surface px-4 py-10 text-center transition-colors hover:border-accent/60',
          dragging && 'border-accent bg-accent/5',
        )}
      >
        <Upload className="size-6 text-muted" />
        <span className="text-sm">
          拖曳 CSV 到這裡，或<span className="text-accent">點擊選擇檔案</span>
        </span>
        <span className="text-xs text-muted">重複匯入同一份報表不會產生重複資料</span>
        <input
          type="file"
          accept=".csv,text/csv"
          multiple
          className="sr-only"
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </label>

      {errors.map((err) => (
        <ErrorBox key={err} message={err} />
      ))}

      {files.length > 0 && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {files.map((f) => (
              <span
                key={f.name}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
              >
                <FileSpreadsheet className="size-4 text-accent" />
                <span className="max-w-48 truncate">{f.name}</span>
                <span className="text-xs text-muted">{f.parsed.kind === 'trades' ? 'Trades' : 'Orders'}</span>
                <button
                  type="button"
                  aria-label="移除"
                  onClick={() => setFiles((prev) => prev.filter((p) => p !== f))}
                  className="text-muted hover:text-fg"
                >
                  <X className="size-4" />
                </button>
              </span>
            ))}
          </div>

          {!tradesFile && <Hint>只有 Orders：會存訂單，但不會產生交易部位。</Hint>}
          {!ordersFile && tradesFile && (
            <Hint>沒有 Orders：停損、目標價與自動 R 值無法計算（已存在的值不會被清掉）。</Hint>
          )}
          {multiAccount && <ErrorBox message="Orders 檔案包含多個帳號，請在 Topstep 分帳號匯出" />}

          <Card>
            <div className="grid gap-4 md:grid-cols-[1fr_2fr] md:items-end">
              <Field
                label="帳號"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                hint="Trades 報表沒有帳號欄位，會從 Orders 帶入或沿用上次的帳號"
              />
              <div className="grid grid-cols-3 gap-3">
                <Stat label="成交" value={preview.trades.length} sub={existing.data ? `新 ${newTrades}` : '比對中…'} />
                <Stat label="訂單" value={preview.orders.length} sub={existing.data ? `新 ${newOrders}` : '比對中…'} />
                <Stat label="部位" value={preview.positions.length} sub={dateRange(preview.positions)} />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button disabled={!canImport || importMutation.isPending} onClick={() => importMutation.mutate()}>
                {importMutation.isPending ? '匯入中…' : '匯入到試算表'}
              </Button>
              {existing.isError && <span className="text-xs text-loss">無法比對既有資料：{existing.error.message}</span>}
            </div>

            {importMutation.isSuccess && (
              <div className="mt-4 rounded-md border border-profit/30 bg-profit/10 p-3 text-sm">
                <p className="flex items-center gap-2 font-medium text-profit">
                  <CheckCircle2 className="size-4" /> 匯入完成
                </p>
                <ul className="mt-2 space-y-0.5 text-muted">
                  {(['trades', 'orders', 'positions'] as const).map((k) => {
                    const r = importMutation.data[k]
                    return (
                      <li key={k}>
                        {LABELS[k]}：新增 {r.inserted}、更新 {r.updated}、未變動 {r.unchanged}
                      </li>
                    )
                  })}
                </ul>
                <Link to="/trades" className="mt-2 inline-block text-accent hover:underline">
                  查看交易 →
                </Link>
              </div>
            )}
            {importMutation.isError && <ErrorBox message={importMutation.error.message} />}
          </Card>

          {preview.positions.length > 0 && <DayPreview positions={preview.positions} />}
        </div>
      )}
    </>
  )
}

const LABELS = { trades: '成交', orders: '訂單', positions: '部位' }

function toPayload(
  preview: { trades: ImportPayload['trades']; orders: ImportPayload['orders']; positions: PositionDerived[] },
  hasOrders: boolean,
): ImportPayload {
  // Without an orders file the bracket fields are unknown; omit them so the
  // upsert keeps values stored by an earlier import.
  const positions = hasOrders
    ? preview.positions
    : preview.positions.map(({ stopPrice: _s, targetPrice: _t, autoRisk: _r, ...rest }) => rest)
  return { trades: preview.trades, orders: preview.orders, positions }
}

function DayPreview({ positions }: { positions: PositionDerived[] }) {
  const days = useMemo(() => {
    const map = new Map<string, { count: number; net: number }>()
    for (const p of positions) {
      const d = map.get(p.tradeDay) ?? { count: 0, net: 0 }
      d.count++
      d.net += p.netPnl
      map.set(p.tradeDay, d)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [positions])

  return (
    <Card className="p-0 md:p-0">
      <div className="border-b border-border px-4 py-3 text-sm font-medium">預覽（依交易日）</div>
      <div className="max-h-80 overflow-y-auto">
        <table className="tabular w-full text-sm">
          <tbody>
            {days.map(([day, d]) => (
              <tr key={day} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-2">
                  <span className="text-muted">{day.slice(0, 4)}/</span>
                  {dayLabel(day)}
                </td>
                <td className="px-4 py-2 text-right text-muted">{d.count} 筆</td>
                <td className={cn('px-4 py-2 text-right', pnlClass(d.net))}>{money(d.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-md bg-surface-2 px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className="tabular text-lg font-semibold">{value}</div>
      {sub && <div className="truncate text-xs text-muted">{sub}</div>}
    </div>
  )
}

function Hint({ children }: { children: string }) {
  return <p className="rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-warn">{children}</p>
}


function dateRange(positions: PositionDerived[]): string {
  if (positions.length === 0) return '—'
  const days = positions.map((p) => p.tradeDay).sort()
  const fmt = (d: string) => d.slice(5).replace('-', '/')
  return days[0] === days.at(-1) ? fmt(days[0]) : `${fmt(days[0])}–${fmt(days.at(-1)!)}`
}
