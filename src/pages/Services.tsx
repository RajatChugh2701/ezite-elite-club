import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarDays, Clock, Lock, MapPin, Search, X } from 'lucide-react'
import { useApp } from '../data/store'
import { actor, balance, canRequestService } from '../data/selectors'
import { CITIES, SERVICES, SERVICE_CATEGORIES, categoryName } from '../data/config'
import type { Service } from '../data/types'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from '../components/ui'
import { cx, inr } from '../lib/format'

export function pricingLabel(s: Service) {
  if (s.funding === 'bundle_hours') return { text: `Included · ~${s.expectedHours} executive hours from your bundle`, tone: 'green' as const }
  const price = s.rateUnit === 'flat' ? `${inr(s.rateINR)} + GST` : `${inr(s.rateINR)}/h + GST`
  return { text: s.discountPct ? `${price} · ${s.discountPct}% member rate` : price, tone: 'gold' as const }
}

export default function Services() {
  const { state } = useApp()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const cat = params.get('category') ?? 'all'
  const city = params.get('city') ?? 'all'
  const mode = params.get('mode') ?? 'all'
  const set = (k: string, v: string) => { const p = new URLSearchParams(params); if (v === 'all' || !v) p.delete(k); else p.set(k, v); setParams(p, { replace: true }) }
  const isDelegate = actor(state).kind === 'delegate'

  const list = useMemo(() => SERVICES.filter(s =>
    (cat === 'all' || s.categoryId === cat) && (city === 'all' || s.cities.includes(city as never)) && (mode === 'all' || s.delivery.includes(mode as never)) &&
    (!q.trim() || `${s.name} ${s.summary} ${categoryName(s.categoryId)}`.toLowerCase().includes(q.trim().toLowerCase()))), [cat, city, mode, q])
  const filtered = cat !== 'all' || city !== 'all' || mode !== 'all' || q.trim()
  const hrs = balance(state, 'hours').available

  return (
    <div>
      <PageHeader eyebrow="Services" title="How can we help?" subtitle={`Your executive handles the details. ${isDelegate ? '' : `You have ${hrs} executive hours available this benefit year.`}`}
        actions={!isDelegate && <Button to="/request/new">Request assistance</Button>} />
      <div className="mb-5 grid gap-3 md:grid-cols-[1fr_180px_180px_auto]">
        <label className="relative">
          <span className="sr-only">Search services</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-dim" aria-hidden />
          <Input value={q} onChange={e => { setQ(e.target.value); set('q', e.target.value) }} placeholder="Search services, e.g. property tax" className="pl-10" />
        </label>
        <Select aria-label="City" value={city} onChange={e => set('city', e.target.value)}><option value="all">All cities</option>{CITIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Select aria-label="Delivery" value={mode} onChange={e => set('mode', e.target.value)}><option value="all">In person or remote</option><option value="in_person">In person</option><option value="remote">Remote</option></Select>
        <Button variant="secondary" disabled={!filtered} onClick={() => { setQ(''); setParams({}, { replace: true }) }} icon={<X className="size-4" />}>Clear</Button>
      </div>
      <div className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Category">
        {[{ id: 'all', name: 'All' }, ...SERVICE_CATEGORIES].map(c => (
          <button key={c.id} onClick={() => set('category', c.id)} aria-pressed={cat === c.id}
            className={cx('shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] transition-colors', cat === c.id ? 'border-gold bg-gold/10 text-gold-soft' : 'border-line text-mute hover:border-line2 hover:text-ivory')}>
            {c.name}
          </button>
        ))}
      </div>

      {(cat === 'all' || cat === 'consult') && !q.trim() && (
        <Card className="mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <CalendarDays className="size-6 shrink-0 text-gold" aria-hidden />
          <div className="flex-1">
            <p className="text-ivory">Financial, tax & legal consultations</p>
            <p className="text-sm text-mute">Book a session with a vetted expert. {isDelegate ? '' : `${balance(state, 'consult').available} included credits left this benefit year.`}</p>
          </div>
          <Button variant="secondary" to="/consultations">Book a consultation</Button>
        </Card>
      )}

      {list.length === 0 ? (
        cat === 'consult' ? null : <EmptyState icon={<Search className="size-6" />} title="No services match" body="Try another search term or clear the filters." action={<Button variant="secondary" onClick={() => { setQ(''); setParams({}) }}>Clear filters</Button>} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {list.map(s => {
            const pr = pricingLabel(s)
            const allowed = canRequestService(state, s.id)
            return (
              <Card as="li" key={s.id} className="flex flex-col p-5 transition-colors hover:border-line2">
                <p className="text-[12px] uppercase tracking-wider text-dim">{categoryName(s.categoryId)}</p>
                <Link to={`/services/${s.id}`} className="mt-1 text-lg text-ivory hover:text-gold-soft">{s.name}</Link>
                <p className="mt-1 text-sm text-mute">{s.summary}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-dim">
                  <span className="flex items-center gap-1"><Clock className="size-3.5" aria-hidden />{s.duration}</span>
                  <span className="flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{s.cities.length === 4 ? 'All Phase 1 cities' : s.cities.length + ' cities'}</span>
                  <span>{s.delivery.map(d => (d === 'in_person' ? 'In person' : 'Remote')).join(' · ')}</span>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <Badge tone={pr.tone}>{pr.text}</Badge>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" to={`/services/${s.id}`}>Details</Button>
                    {allowed ? <Button size="sm" to={`/request/new?service=${s.id}`}>Request</Button> : <span className="flex items-center gap-1 text-[12px] text-dim"><Lock className="size-3.5" aria-hidden />Not in your permissions</span>}
                  </div>
                </div>
              </Card>
            )
          })}
        </ul>
      )}
      <p className="mt-6 text-[12.5px] text-dim">Not every service is included in your membership. Prices are draft catalogue values and include member-specific rates where configured.</p>
    </div>
  )
}
