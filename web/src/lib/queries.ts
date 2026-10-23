import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import { loadConnection } from './settings'
import type { Position } from './types'

/** All positions, newest first. Small enough (hundreds of rows) to fetch at once. */
export function usePositions() {
  return useQuery({
    queryKey: ['positions'],
    queryFn: async () => sortNewest(await api.listPositions()),
    enabled: loadConnection() !== null,
  })
}

export function useDayTrades(tradeDay: string) {
  return useQuery({
    queryKey: ['trades', tradeDay],
    queryFn: () => api.listTrades({ tradeDay }),
    enabled: loadConnection() !== null,
  })
}

function sortNewest(list: Position[]): Position[] {
  return [...list].sort((a, b) => b.openedAt.localeCompare(a.openedAt))
}

export interface DayGroup {
  day: string
  positions: Position[]
  net: number
  wins: number
  losses: number
}

export function groupByDay(positions: Position[]): DayGroup[] {
  const map = new Map<string, DayGroup>()
  for (const p of positions) {
    let g = map.get(p.tradeDay)
    if (!g) {
      g = { day: p.tradeDay, positions: [], net: 0, wins: 0, losses: 0 }
      map.set(p.tradeDay, g)
    }
    g.positions.push(p)
    g.net += p.netPnl
    if (p.netPnl > 0) g.wins++
    else if (p.netPnl < 0) g.losses++
  }
  return [...map.values()].sort((a, b) => b.day.localeCompare(a.day))
}
