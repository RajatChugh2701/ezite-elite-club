export const inr = (n: number, opts: { decimals?: boolean } = {}) =>
  '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: opts.decimals ? 2 : 0, minimumFractionDigits: opts.decimals ? 2 : 0 })

export const signedInr = (n: number) => (n < 0 ? '−' : '') + inr(n)

export const pad = (n: number) => String(n).padStart(2, '0')

export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export const nowISO = () => new Date().toISOString()

// Parses YYYY-MM-DD as a local date (avoids UTC shift).
export const parseDate = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const dateTime = (date: string, time: string) => {
  const d = parseDate(date)
  const [h, m] = time.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d
}

export const fmtDate = (s?: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  if (!s) return '—'
  const d = s.length <= 10 ? parseDate(s) : new Date(s)
  return d.toLocaleDateString('en-IN', opts)
}

export const fmtDateTime = (s?: string) =>
  s ? new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'

export const fmtTime = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m)
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export const relTime = (s: string) => {
  const diff = Date.now() - new Date(s).getTime()
  const m = Math.round(diff / 60000)
  if (Math.abs(m) < 1) return 'just now'
  if (m > 0 && m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (m > 0 && h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  if (m > 0 && d < 7) return `${d} d ago`
  return fmtDate(s)
}

export const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000)

export const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export const addMinutes = (hhmm: string, mins: number) => {
  const [h, m] = hhmm.split(':').map(Number)
  const t = h * 60 + m + mins
  return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`
}

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
