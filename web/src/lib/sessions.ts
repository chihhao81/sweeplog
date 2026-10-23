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

function taipeiWindow(session: string, ahead: number): string | null {
  const w = WINDOWS.find((x) => x.session === session)
  return w ? `${clock(w.start + ahead)}–${clock(w.end + ahead)}` : null
}

/**
 * "London 14:00–19:00": the session with its Taipei-time window as of `at`.
 * The window follows US daylight saving, so pass the trade's own time to get
 * the hours it was actually traded in.
 */
export function sessionLabel(session: string, at: Date = new Date()): string {
  const range = taipeiWindow(session, taipeiAheadOfNy(at))
  return range ? `${session} ${range}` : session
}

/**
 * Label for a group of trades. When the group spans both US summer and winter
 * time, both Taipei windows are shown: "London 14:00–19:00（冬令 15:00–20:00）".
 */
export function sessionLabelAcross(session: string, times: Date[]): string {
  const aheads = new Set(times.map(taipeiAheadOfNy))
  if (aheads.size <= 1) return sessionLabel(session, times[0])
  const summer = taipeiWindow(session, 12)
  const winter = taipeiWindow(session, 13)
  return summer && winter ? `${session} ${summer}（冬令 ${winter}）` : session
}
