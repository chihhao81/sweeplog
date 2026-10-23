import Papa from 'papaparse'
import type { Order, Side, Trade } from '@/lib/types'

export type ExportKind = 'trades' | 'orders'

const SIGNATURE: Record<ExportKind, string[]> = {
  trades: ['Id', 'ContractName', 'EnteredAt', 'ExitedAt', 'EntryPrice', 'ExitPrice', 'PnL', 'Type', 'TradeDay'],
  orders: ['Id', 'AccountName', 'ContractName', 'Status', 'Type', 'Side', 'CreatedAt', 'PositionDisposition', 'CreationDisposition'],
}

type RawRow = Record<string, string>

export type ParsedExport =
  | { kind: 'trades'; rows: Omit<Trade, 'accountName' | 'positionId'>[] }
  | { kind: 'orders'; rows: Order[]; accountNames: string[] }

export function parseExport(csv: string): ParsedExport {
  const { data, meta } = Papa.parse<RawRow>(csv.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })
  const headers = meta.fields ?? []
  const kind = (Object.keys(SIGNATURE) as ExportKind[]).find((k) =>
    SIGNATURE[k].every((col) => headers.includes(col)),
  )
  if (kind === 'trades') return { kind, rows: data.map(toTrade) }
  if (kind === 'orders') {
    const rows = data.map(toOrder)
    return { kind, rows, accountNames: [...new Set(rows.map((o) => o.accountName))] }
  }
  throw new Error('無法辨識的檔案：不是 Topstep 的 Trades 或 Orders 匯出')
}

function toTrade(r: RawRow): Omit<Trade, 'accountName' | 'positionId'> {
  return {
    id: r.Id,
    contractName: r.ContractName,
    side: r.Type as Side,
    size: num(r.Size) ?? 1,
    enteredAt: toIso(r.EnteredAt),
    exitedAt: toIso(r.ExitedAt),
    entryPrice: num(r.EntryPrice) ?? 0,
    exitPrice: num(r.ExitPrice) ?? 0,
    pnl: num(r.PnL) ?? 0,
    fees: num(r.Fees) ?? 0,
    commissions: num(r.Commissions) ?? 0,
    tradeDay: toDay(r.TradeDay),
    durationSec: parseDuration(r.TradeDuration),
  }
}

function toOrder(r: RawRow): Order {
  return {
    id: r.Id,
    accountName: r.AccountName,
    contractName: r.ContractName,
    status: r.Status,
    type: r.Type,
    side: r.Side,
    size: num(r.Size) ?? 0,
    createdAt: toIso(r.CreatedAt),
    filledAt: r.FilledAt ? toIso(r.FilledAt) : null,
    cancelledAt: r.CancelledAt ? toIso(r.CancelledAt) : null,
    triggeredAt: r.TriggeredAt ? toIso(r.TriggeredAt) : null,
    stopPrice: num(r.StopPrice),
    limitPrice: num(r.LimitPrice),
    executePrice: num(r.ExecutePrice),
    triggeredPrice: num(r.TriggeredPrice),
    positionDisposition: r.PositionDisposition,
    creationDisposition: r.CreationDisposition,
    rejectionReason: r.RejectionReason ?? '',
    tradeDay: toDay(r.TradeDay),
  }
}

function num(s: string | undefined): number | null {
  if (s === undefined || s.trim() === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** "03/17/2026 10:10:08 +08:00" → "2026-03-17T10:10:08+08:00" */
export function toIso(s: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2}:\d{2})(?:\.\d+)? ([+-]\d{2}:\d{2})$/.exec(s.trim())
  if (!m) throw new Error(`無法解析時間：${s}`)
  const [, mm, dd, yyyy, time, offset] = m
  return `${yyyy}-${mm}-${dd}T${time}${offset}`
}

/** "03/17/2026 00:00:00 -05:00" → "2026-03-17" */
export function toDay(s: string): string {
  return toIso(s).slice(0, 10)
}

/** .NET TimeSpan "[d.]hh:mm:ss[.fffffff]" → whole seconds */
export function parseDuration(s: string | undefined): number {
  const m = /^(?:(\d+)\.)?(\d+):(\d{2}):(\d{2})(?:\.\d+)?$/.exec((s ?? '').trim())
  if (!m) return 0
  const [, d, h, min, sec] = m
  return Number(d ?? 0) * 86400 + Number(h) * 3600 + Number(min) * 60 + Number(sec)
}
