import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, List, Search } from 'lucide-react'
import { useApp } from '../data/store'
import { apptStart, isUpcoming, visibleAppointments } from '../data/selectors'
import { cityName, execById, expertById } from '../data/config'
import type { Appointment } from '../data/types'
import { Button, Card, EmptyState, Input, PageHeader, Segmented, Select, StatusBadge, Tabs } from '../components/ui'
import { cx, fmtDate, fmtTime, toISODate } from '../lib/format'

export default function Appointments() {
  const { state } = useApp()
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [type, setType] = useState('all')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const all = visibleAppointments(state)
  const list = useMemo(() => all
    .filter(a => (tab === 'upcoming' ? isUpcoming(a) : !isUpcoming(a)))
    .filter(a => type === 'all' || a.kind === type)
    .filter(a => !from || a.date >= from)
    .filter(a => !q.trim() || a.title.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (tab === 'upcoming' ? 1 : -1) * (apptStart(a).getTime() - apptStart(b).getTime())), [all, tab, type, q, from])

  return (
    <div>
      <PageHeader eyebrow="Appointments" title="Your bookings" subtitle="Visits from your executive and expert consultations."
        actions={<><Button variant="secondary" to="/consultations">Book consultation</Button><Button to="/request/new">Book a visit</Button></>} />
      <Tabs label="Appointment period" value={tab} onChange={setTab} tabs={[{ value: 'upcoming', label: 'Upcoming', count: all.filter(isUpcoming).length }, { value: 'past', label: 'Past & cancelled', count: all.filter(a => !isUpcoming(a)).length }]} />
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Search appointments</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-dim" aria-hidden />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search appointments" className="pl-10" />
        </label>
        <Select aria-label="Type" value={type} onChange={e => setType(e.target.value)} className="w-48"><option value="all">All types</option><option value="service">Executive visits</option><option value="consultation">Consultations</option></Select>
        <Input aria-label="From date" type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-44" />
        {(q || type !== 'all' || from) && <Button variant="ghost" onClick={() => { setQ(''); setType('all'); setFrom('') }}>Clear</Button>}
        <div className="ml-auto"><Segmented label="View" value={view} onChange={setView} options={[{ value: 'list', label: <span className="flex items-center gap-1.5"><List className="size-3.5" />List</span> }, { value: 'calendar', label: <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />Calendar</span> }]} /></div>
      </div>
      {view === 'calendar' ? <MonthView items={all.filter(a => (type === 'all' || a.kind === type))} /> : list.length === 0 ? (
        <EmptyState icon={<CalendarDays className="size-7" />} title={tab === 'upcoming' ? 'No upcoming appointments' : 'No past appointments'} body={q || from || type !== 'all' ? 'Nothing matches your filters.' : 'Book a visit or a consultation to see it here.'} action={<Button to="/request/new">Request assistance</Button>} />
      ) : (
        <ul className="space-y-3">{list.map(a => <ApptRow key={a.id} a={a} />)}</ul>
      )}
    </div>
  )
}

function ApptRow({ a }: { a: Appointment }) {
  const { state } = useApp()
  const d = apptStart(a)
  const who = a.expertId ? `${expertById(a.expertId)?.name} · sample expert` : execById(a.peId)?.name
  return (
    <li>
      <Link to={`/appointments/${a.id}`} className="flex gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line2">
        <div className="grid w-14 shrink-0 place-items-center rounded-xl border border-line bg-bg2 py-1.5 text-center">
          <span className="serif text-xl leading-none">{d.getDate()}</span>
          <span className="text-[10.5px] uppercase tracking-wider text-mute">{d.toLocaleDateString('en-IN', { month: 'short' })}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="text-[15px] text-ivory">{a.title}</span><StatusBadge status={a.status} /></div>
          <p className="mt-1 text-[13px] text-mute">{fmtTime(a.start)}–{fmtTime(a.end)} · {a.mode === 'online' ? 'Online' : cityName(a.city)} · {who}</p>
          <p className="text-[12.5px] text-dim">For {state.beneficiaries.find(b => b.id === a.beneficiaryId)?.name}{a.entitlement ? ` · ${a.entitlement.amount} ${a.entitlement.ent === 'hours' ? 'executive h' : 'credit'}` : a.chargeINR ? ' · charged' : ''}</p>
        </div>
      </Link>
    </li>
  )
}

function MonthView({ items }: { items: Appointment[] }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const start = new Date(cursor); start.setDate(1 - ((cursor.getDay() + 6) % 7))
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
  const today = toISODate(new Date())
  const move = (n: number) => setCursor(c => { const d = new Date(c); d.setMonth(d.getMonth() + n); return d })
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="serif text-xl">{cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
        <div className="flex gap-1">
          <Button size="sm" variant="secondary" aria-label="Previous month" onClick={() => move(-1)} icon={<ChevronLeft className="size-4" />} />
          <Button size="sm" variant="secondary" aria-label="Next month" onClick={() => move(1)} icon={<ChevronRight className="size-4" />} />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line text-[12px]">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="bg-bg2 px-2 py-1.5 text-center text-dim">{d}</div>)}
        {days.map(d => {
          const iso = toISODate(d)
          const on = items.filter(a => a.date === iso)
          return (
            <div key={iso} className={cx('min-h-16 bg-surface p-1 sm:min-h-24 sm:p-1.5', d.getMonth() !== cursor.getMonth() && 'opacity-40')}>
              <span className={cx('inline-grid size-6 place-items-center rounded-full', iso === today && 'bg-gold text-on-gold')}>{d.getDate()}</span>
              <ul className="mt-0.5 space-y-0.5">
                {on.map(a => (
                  <li key={a.id}><Link to={`/appointments/${a.id}`} title={`${a.title} ${fmtTime(a.start)}`}
                    className={cx('block truncate rounded px-1 py-0.5 text-[10.5px] sm:text-[11px]', a.status === 'cancelled' ? 'text-dim line-through' : 'bg-gold/15 text-gold-soft')}>{fmtTime(a.start)} {a.title}</Link></li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-[12px] text-dim">Showing {fmtDate(toISODate(days[0]))} – {fmtDate(toISODate(days[41]))}</p>
    </Card>
  )
}
