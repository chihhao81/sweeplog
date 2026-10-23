const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Signed dollars: +$12.50 / -$3.20 */
export function money(n: number): string {
  return (n > 0 ? '+' : n < 0 ? '-' : '') + usd.format(Math.abs(n))
}

export function rMultiple(r: number | null): string {
  if (r === null) return '—'
  return `${r > 0 ? '+' : ''}${r.toFixed(2)}R`
}

export function pnlClass(n: number): string {
  return n > 0 ? 'text-profit' : n < 0 ? 'text-loss' : 'text-muted'
}

const clock = new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const clockSec = new Intl.DateTimeFormat('zh-TW', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/** Local wall-clock time of an ISO timestamp. */
export function timeOf(iso: string, seconds = false): string {
  return (seconds ? clockSec : clock).format(new Date(iso))
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/** "2026-10-21" → "10/21（三）" */
export function dayLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${m}/${d}（${WEEKDAYS[wd]}）`
}

export function price(n: number | null): string {
  if (n === null) return '—'
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export function duration(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  if (m < 60) return `${m}m ${sec % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}
