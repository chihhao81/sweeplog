import type { Session } from './types'

// Session windows in New York local time, as [start, end) hours. Asia wraps midnight.
const WINDOWS: { session: Session; start: number; end: number }[] = [
  { session: 'Asia', start: 18, end: 2 },
  { session: 'London', start: 2, end: 7 },
  { session: 'NY AM', start: 7, end: 12 },
  { session: 'NY Lunch', start: 12, end: 13.5 },
  { session: 'NY PM', start: 13.5, end: 17 },
]

export const SESSION_ORDER: Session[] = [...WINDOWS.map((w) => w.session), 'Other']

const nyClock = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Trading session of a timestamp, by New York local time. */
export function sessionOf(iso: string): Session {
  const [h, m] = nyClock.format(new Date(iso)).split(':').map(Number)
  const t = h + m / 60
  const w = WINDOWS.find((w) => (w.start < w.end ? t >= w.start && t < w.end : t >= w.start || t < w.end))
  return w?.session ?? 'Other'
}

const nyOffset = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'longOffset' })

/** Hours Taipei (UTC+8) is ahead of New York on the given date: 12 in US summer time, 13 in winter. */
function taipeiAheadOfNy(at: Date): number {
  const name = nyOffset.formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-05:00'
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(name)
  const ny = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) + Number(m[3]) / 60) : -5
  return 8 - ny
}

const clock = (h: number) => {
  const n = ((h % 24) + 24) % 24
  return `${String(Math.floor(n)).padStart(2, '0')}:${n % 1 ? '30' : '00'}`
}

/**
 * "London 14:00–19:00": the session with its Taipei-time window. The window
 * follows US daylight saving as of `at` (today by default), so it shifts by an
 * hour each March and November.
 */
export function sessionLabel(session: string, at: Date = new Date()): string {
  const w = WINDOWS.find((x) => x.session === session)
  if (!w) return session
  const d = taipeiAheadOfNy(at)
  return `${session} ${clock(w.start + d)}–${clock(w.end + d)}`
}
