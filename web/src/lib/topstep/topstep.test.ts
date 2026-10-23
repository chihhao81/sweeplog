import { describe, expect, it } from 'vitest'
import { contractRoot, pointValue } from './contracts'
import { parseDuration, parseExport, toDay, toIso } from './parse'
import { buildPositions, sessionOf } from './positions'

const TRADES_CSV = `﻿Id,ContractName,EnteredAt,ExitedAt,EntryPrice,ExitPrice,Fees,PnL,Size,Type,TradeDay,TradeDuration,Commissions
1,MNQM6,06/18/2026 16:30:40 +08:00,06/18/2026 16:31:02 +08:00,30433.5,30431.5,0.72,-4,1,Long,06/18/2026 00:00:00 -05:00,00:00:22.1,0.5
2,MNQM6,06/18/2026 16:30:40 +08:00,06/18/2026 16:31:15 +08:00,30433.5,30423.5,0.72,-20,1,Long,06/18/2026 00:00:00 -05:00,00:00:35.1,0.5
3,MNQM6,06/18/2026 16:31:15 +08:00,06/18/2026 16:35:18 +08:00,30428.25,30429,0.72,1.5,1,Long,06/18/2026 00:00:00 -05:00,00:04:03.0,0.5
4,MNQM6,06/18/2026 16:32:00 +08:00,06/18/2026 16:33:00 +08:00,30430,30425,0.72,10,1,Short,06/18/2026 00:00:00 -05:00,00:01:00.0,
`

const ORDERS_CSV = `Id,AccountName,ContractName,Status,Type,Size,Side,CreatedAt,TradeDay,FilledAt,CancelledAt,TriggeredAt,StopPrice,LimitPrice,ExecutePrice,TriggeredPrice,PositionDisposition,CreationDisposition,RejectionReason,ExchangeOrderId,PlatformOrderId
10,ACC-1,MNQM6,Filled,Market,1,Bid,06/18/2026 16:30:40 +08:00,06/18/2026 00:00:00 -05:00,06/18/2026 16:30:40 +08:00,,,,,30433.5,,Opening,Trader,,,
11,ACC-1,MNQM6,Filled,Stop,2,Ask,06/18/2026 16:30:40 +08:00,06/18/2026 00:00:00 -05:00,06/18/2026 16:31:15 +08:00,,06/18/2026 16:31:15 +08:00,30423.5,,30423.5,30423.5,Closing,StopLoss,,,
12,ACC-1,MNQM6,Cancelled,Limit,2,Ask,06/18/2026 16:30:40 +08:00,06/18/2026 00:00:00 -05:00,,06/18/2026 16:31:15 +08:00,,,30533.5,,,Undetermined,TakeProfit,Cancelled by system,,
`

describe('parse', () => {
  it('converts Topstep timestamps', () => {
    expect(toIso('03/17/2026 10:10:08 +08:00')).toBe('2026-03-17T10:10:08+08:00')
    expect(toDay('03/17/2026 00:00:00 -05:00')).toBe('2026-03-17')
  })

  it('parses .NET durations', () => {
    expect(parseDuration('00:40:10.8267230')).toBe(2410)
    expect(parseDuration('1.02:00:00')).toBe(93600)
    expect(parseDuration('')).toBe(0)
  })

  it('detects export kind and reads rows', () => {
    const t = parseExport(TRADES_CSV)
    if (t.kind !== 'trades') throw new Error('expected trades')
    expect(t.rows[0]).toMatchObject({ id: '1', side: 'Long', pnl: -4, commissions: 0.5, durationSec: 22 })
    expect(t.rows[3].commissions).toBe(0)

    const o = parseExport(ORDERS_CSV)
    expect(o.kind).toBe('orders')
    if (o.kind === 'orders') expect(o.accountNames).toEqual(['ACC-1'])
  })

  it('rejects unknown files', () => {
    expect(() => parseExport('a,b\n1,2')).toThrow()
  })
})

describe('contracts', () => {
  it('maps contract names to point values', () => {
    expect(contractRoot('MNQZ6')).toBe('MNQ')
    expect(contractRoot('MGCQ6')).toBe('MGC')
    expect(pointValue('MNQU6')).toBe(2)
    expect(pointValue('XYZZ6')).toBeNull()
  })
})

describe('buildPositions', () => {
  const trades = parseExport(TRADES_CSV)
  const orders = parseExport(ORDERS_CSV)
  if (trades.kind !== 'trades' || orders.kind !== 'orders') throw new Error('fixture')
  const { trades: linked, positions } = buildPositions(trades.rows, orders.rows, 'ACC-1')

  it('groups overlapping same-side trades', () => {
    // Trade 3 enters exactly when trade 2 exits, so it starts a new position.
    expect(positions.map((p) => p.positionId)).toEqual(['1', '3', '4'])
    expect(linked.find((t) => t.id === '2')?.positionId).toBe('1')
  })

  it('summarizes P&L and size', () => {
    const p = positions[0]
    expect(p).toMatchObject({ tradeCount: 2, maxSize: 2, grossPnl: -24, costs: 2.44, netPnl: -26.44 })
  })

  it('links the bracket and computes risk', () => {
    const p = positions[0]
    expect(p.stopPrice).toBe(30423.5)
    expect(p.targetPrice).toBe(30533.5)
    expect(p.autoRisk).toBe(40) // 10 pts × $2 × 2 contracts
  })

  it('leaves risk empty without a stop', () => {
    expect(positions[2].autoRisk).toBeNull()
  })
})

describe('sessionOf', () => {
  it('uses New York time', () => {
    expect(sessionOf('2026-06-18T21:45:00+08:00')).toBe('NY AM') // 09:45 EDT
    expect(sessionOf('2026-06-18T16:30:00+08:00')).toBe('London') // 04:30 EDT
    expect(sessionOf('2026-01-15T09:00:00+08:00')).toBe('Asia') // 20:00 EST
  })
})
