import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import { compressImage } from './image'
import { withDefaults, type JournalOptions } from './options'
import { loadConnection } from './settings'
import type { JournalEntry, Position, PositionManual, Screenshot } from './types'

export function useOptions() {
  return useQuery({
    queryKey: ['options'],
    queryFn: async () => withDefaults(await api.getOptions()),
    enabled: loadConnection() !== null,
    staleTime: Infinity,
  })
}

export function useSaveOptions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (options: JournalOptions) => api.saveOptions(options),
    onSuccess: (options) => qc.setQueryData(['options'], options),
  })
}

export function useUpdatePosition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ positionId, fields }: { positionId: string; fields: Partial<PositionManual> }) =>
      api.updatePosition(positionId, fields),
    onSuccess: (saved, { positionId, fields }) => {
      qc.setQueryData<Position[]>(['positions'], (list) =>
        list?.map((p) => (p.positionId === positionId ? { ...p, ...fields, updatedAt: saved.updatedAt } : p)),
      )
    },
  })
}

export function useJournal() {
  return useQuery({
    queryKey: ['journal'],
    queryFn: async () => (await api.listJournal()).sort((a, b) => b.date.localeCompare(a.date)),
    enabled: loadConnection() !== null,
  })
}

export function useSaveJournal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entry: JournalEntry) => api.saveJournal(entry),
    onSuccess: (saved) => {
      qc.setQueryData<JournalEntry[]>(['journal'], (list) => {
        const rest = (list ?? []).filter((e) => e.id !== saved.id)
        return [saved, ...rest].sort((a, b) => b.date.localeCompare(a.date))
      })
    },
  })
}

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

export function useScreenshots(date: string) {
  return useQuery({
    queryKey: ['screenshots', date],
    queryFn: () => api.listScreenshots(date),
    enabled: loadConnection() !== null && date !== '',
  })
}

/** Optimistically patches one day's screenshot list in the cache. */
function patchShots(qc: ReturnType<typeof useQueryClient>, date: string, fn: (list: Screenshot[]) => Screenshot[]) {
  qc.setQueryData<Screenshot[]>(['screenshots', date], (list) => fn(list ?? []))
}

export function useUploadScreenshot(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, positionIds }: { file: File; positionIds: string[] }) => {
      const img = await compressImage(file)
      return api.uploadScreenshot({
        date,
        ...img,
        takenAt: new Date(file.lastModified).toISOString(),
        positionIds,
      })
    },
    onSuccess: (shot) => patchShots(qc, date, (list) => [...list, shot]),
  })
}

export function useUpdateScreenshot(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...changes }: { id: string; caption?: string | null; positionIds?: string[] }) =>
      api.updateScreenshot(id, changes),
    onMutate: ({ id, ...changes }) =>
      patchShots(qc, date, (list) => list.map((s) => (s.id === id ? { ...s, ...changes } : s))),
    onError: () => qc.invalidateQueries({ queryKey: ['screenshots', date] }),
  })
}

export function useDeleteScreenshot(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteScreenshot(id),
    onSuccess: ({ id }) => patchShots(qc, date, (list) => list.filter((s) => s.id !== id)),
  })
}
