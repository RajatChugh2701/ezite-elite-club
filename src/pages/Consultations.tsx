import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Languages, MapPin, Video } from 'lucide-react'
import { useApp } from '../data/store'
import { anniversary, apptStart, balance, canAccessArea, consultCreditFree, expertSlots } from '../data/selectors'
import { CONSULTATION_TYPES, CONSULT_EXTRA_FEE_NOTE, EXPERTS, GST_RATE, cityName, consultTypeById } from '../data/config'
import { AccessDenied, Avatar, Badge, Button, Card, Checkbox, ChoiceCards, EmptyState, Field, Notice, PageHeader, Segmented, Select, SimLabel, StatusBadge, Textarea, useUI } from '../components/ui'
import { addDays, cx, fmtDate, fmtTime, inr, toISODate } from '../lib/format'

export default function Consultations() {
  const { state, actions } = useApp()
  const { toast } = useUI()
  const [typeId, setTypeId] = useState<string>()
  const [expertId, setExpertId] = useState<string>()
  const [mode, setMode] = useState<'online' | 'in_person'>('online')
  const [city, setCity] = useState<string>(state.member.homeCity)
  const [date, setDate] = useState<string>()
  const [start, setStart] = useState<string>()
  const [beneficiaryId, setBen] = useState('BEN-SELF')
  const [notes, setNotes] = useState('')
  const [docs, setDocs] = useState<string[]>([])
  const [ackCharge, setAckCharge] = useState(false)
  const [err, setErr] = useState<string>()
  const [booked, setBooked] = useState<string>()
  if (!canAccessArea(state, 'consultations')) return <AccessDenied what="consultation booking" />

  const con = balance(state, 'consult')
  const type = consultTypeById(typeId)
  const expert = EXPERTS.find(e => e.id === expertId)
  const free = type ? consultCreditFree(state, type.id) : false
  const fee = type?.feeINR ?? 0
  const tax = Math.round(fee * GST_RATE)
  const days = Array.from({ length: 14 }, (_, i) => toISODate(addDays(new Date(), i + 1)))
  const slots = expert && date ? expertSlots(state, expert.id, date) : []
  const history = state.appointments.filter(a => a.kind === 'consultation').sort((a, b) => apptStart(b).getTime() - apptStart(a).getTime())

  const reset = () => { setExpertId(undefined); setDate(undefined); setStart(undefined); setAckCharge(false) }
  const book = () => {
    setErr(undefined)
    if (!type || !expert || !date || !start) return setErr('Choose an expert and a time.')
    if (!free && !ackCharge) return setErr('Please confirm the charge before booking.')
    const r = actions.bookConsultation({ expertId: expert.id, typeId: type.id, date, start, mode, city: mode === 'in_person' ? city : undefined, beneficiaryId, notes, documentIds: docs })
    if (!r.ok) { setErr(r.error); setStart(undefined); return }
    setBooked(r.data)
    toast({ tone: 'ok', title: 'Consultation booked' })
  }

  if (booked) {
    const a = state.appointments.find(x => x.id === booked)!
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="p-8">
          <CheckCircle2 className="mb-4 size-9 text-ok" aria-hidden />
          <h1 className="serif text-3xl">Your consultation is confirmed</h1>
          <p className="mt-2 text-mute">{a.title} · {fmtDate(a.date, { weekday: 'long', day: 'numeric', month: 'long' })} at {fmtTime(a.start)}</p>
          <p className="mt-3 text-sm">{a.entitlement ? <>1 included credit placed on hold — you now have <strong>{balance(state, 'consult').available}</strong> of {con.total} available. It is consumed when the session is completed.</> : <>Charged {inr(a.chargeINR ?? 0)} incl. GST — an invoice has been issued.</>}</p>
          <div className="mt-8 flex flex-wrap gap-2">
            <Button to={`/appointments/${a.id}`}>View booking</Button>
            {a.invoiceId && <Button variant="secondary" to={`/payments/invoices/${a.invoiceId}`}>View invoice</Button>}
            <Button variant="secondary" to="/home">Back to home</Button>
            <Button variant="ghost" onClick={() => { setBooked(undefined); setTypeId(undefined); reset() }}>Book another</Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader eyebrow="Expert consultations" title="Speak with a specialist"
        subtitle={<>You have <span className="text-ivory">{con.available} of {con.total}</span> included consultations left this benefit year (resets {fmtDate(anniversary(state))}). {CONSULT_EXTRA_FEE_NOTE}</>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <h2 className="mb-4 text-[17px]">1. What would you like advice on?</h2>
            <ChoiceCards name="Consultation type" value={typeId} onChange={v => { setTypeId(v); reset() }}
              options={CONSULTATION_TYPES.map(t => ({ value: t.id, label: t.name, description: t.description, aside: t.creditEligible ? <Badge tone="green" dot={false}>Credit eligible</Badge> : <Badge tone="gold" dot={false}>{inr(t.feeINR)} + GST</Badge> }))} />
          </Card>
          {type && (
            <Card className="p-5 sm:p-6">
              <h2 className="mb-1 text-[17px]">2. Choose an expert</h2>
              <p className="mb-4 flex items-center gap-2 text-[12.5px] text-dim"><SimLabel>Fictional profiles</SimLabel> Sample experts for the prototype — not real professionals.</p>
              <ul className="space-y-3">
                {EXPERTS.filter(e => e.categoryId === type.id).map(e => (
                  <li key={e.id}>
                    <button type="button" aria-pressed={expertId === e.id} onClick={() => { setExpertId(e.id); setDate(undefined); setStart(undefined); setMode(e.modes.includes('online') ? 'online' : 'in_person'); if (e.cities[0]) setCity(e.cities.includes(state.member.homeCity) ? state.member.homeCity : e.cities[0]) }}
                      className={cx('flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-colors', expertId === e.id ? 'border-gold bg-gold/[0.07]' : 'border-line bg-bg2 hover:border-line2')}>
                      <Avatar name={e.name} size={48} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-ivory">{e.name}</span>
                        <span className="block text-[13px] text-mute">{e.title} · {e.specialty}</span>
                        <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-dim">
                          <span>{e.experienceYears} years</span>
                          <span className="flex items-center gap-1"><Languages className="size-3.5" aria-hidden />{e.languages.join(', ')}</span>
                          <span className="flex items-center gap-1"><Video className="size-3.5" aria-hidden />{e.modes.map(m => (m === 'online' ? 'Online' : 'In person')).join(' · ')}</span>
                          {e.cities.length > 0 && <span className="flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{e.cities.map(cityName).join(', ')}</span>}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {expert && (
            <Card className="p-5 sm:p-6">
              <h2 className="mb-4 text-[17px]">3. Pick a time</h2>
              <div className="mb-4 flex flex-wrap items-end gap-3">
                {expert.modes.length > 1 && <Segmented label="Mode" value={mode} onChange={setMode} options={[{ value: 'online', label: 'Online' }, { value: 'in_person', label: 'In person' }]} />}
                {mode === 'in_person' && <Select aria-label="City" value={city} onChange={e => setCity(e.target.value)} className="w-44">{expert.cities.map(c => <option key={c} value={c}>{cityName(c)}</option>)}</Select>}
              </div>
              <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="Date">
                {days.map(d => {
                  const dt = new Date(d + 'T00:00')
                  const works = expert.workDays.includes(dt.getDay())
                  return (
                    <button key={d} type="button" role="radio" aria-checked={date === d} disabled={!works} onClick={() => { setDate(d); setStart(undefined) }}
                      className={cx('w-16 shrink-0 rounded-xl border py-2 text-center disabled:opacity-30', date === d ? 'border-gold bg-gold/10' : 'border-line bg-bg2 hover:border-line2')}>
                      <span className="block text-[11px] uppercase text-dim">{dt.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                      <span className="block text-lg">{dt.getDate()}</span>
                    </button>
                  )
                })}
              </div>
              {date && (slots.every(s => !s.available) ? <EmptyState title="Fully booked" body="Choose another date." /> : (
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Time">
                  {slots.map(s => (
                    <button key={s.start} type="button" role="radio" aria-checked={start === s.start} disabled={!s.available} onClick={() => setStart(s.start)}
                      className={cx('rounded-full border px-4 py-2 text-sm disabled:line-through disabled:opacity-35', start === s.start ? 'border-gold bg-gold/10 text-gold-soft' : 'border-line hover:border-line2')}>
                      {fmtTime(s.start)}<span className="sr-only">{s.available ? '' : ` ${s.reason}`}</span>
                    </button>
                  ))}
                </div>
              ))}
            </Card>
          )}
          {start && type && (
            <Card className="p-5 sm:p-6">
              <h2 className="mb-4 text-[17px]">4. Details</h2>
              <div className="grid gap-4">
                <Field label="Who is this consultation for?" htmlFor="cben"><Select id="cben" value={beneficiaryId} onChange={e => setBen(e.target.value)}>{state.beneficiaries.map(b => <option key={b.id} value={b.id}>{b.name} ({b.relationship})</option>)}</Select></Field>
                <Field label="What would you like to discuss?" htmlFor="cnotes" hint="Shared with the expert before the session."><Textarea id="cnotes" value={notes} onChange={e => setNotes(e.target.value)} /></Field>
                <div>
                  <p className="mb-1 text-[13px] font-medium text-mute">Documents to share for this session</p>
                  {type.requiredDocs.length > 0 && <p className="mb-2 text-[12.5px] text-dim">Helpful: {type.requiredDocs.join(', ')}</p>}
                  <div className="space-y-2">{state.documents.slice(0, 6).map(d => <Checkbox key={d.id} checked={docs.includes(d.id)} onChange={v => setDocs(v ? [...docs, d.id] : docs.filter(x => x !== d.id))} label={d.name} />)}</div>
                </div>
              </div>
            </Card>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-6">
            <h2 className="mb-4 text-[17px]">Summary</h2>
            {!type ? <p className="text-sm text-dim">Choose a consultation type to begin.</p> : (
              <div className="space-y-3 text-sm">
                <p><span className="text-dim">Type</span><br />{type.name}</p>
                {expert && <p><span className="text-dim">Expert</span><br />{expert.name} <span className="text-dim">(sample)</span></p>}
                {date && start && <p><span className="text-dim">When</span><br />{fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short' })} · {fmtTime(start)} · {mode === 'online' ? 'Online' : cityName(city)}</p>}
                <div className="rounded-xl border border-line bg-bg2 p-4">
                  {free ? (
                    <><Badge tone="green">Included credit</Badge><p className="mt-2 text-[13px] text-mute">Uses 1 of your {con.available} remaining credits (held now, consumed after the session).</p></>
                  ) : (
                    <>
                      <Badge tone="gold">Charged session</Badge>
                      <p className="mt-2 text-[13px] text-mute">{type.creditEligible ? 'Your included credits for this benefit year are used up.' : 'Specialist sessions are not covered by included credits.'}</p>
                      <ul className="mt-3 space-y-1 text-[13px]"><li className="flex justify-between"><span>Fee</span><span>{inr(fee)}</span></li><li className="flex justify-between"><span>GST 18%</span><span>{inr(tax)}</span></li><li className="flex justify-between border-t border-line pt-1 text-ivory"><span>Total</span><span>{inr(fee + tax)}</span></li></ul>
                      <div className="mt-3"><Checkbox checked={ackCharge} onChange={setAckCharge} label={`I agree to pay ${inr(fee + tax)}`} /></div>
                    </>
                  )}
                </div>
                {err && <Notice tone="bad">{err}</Notice>}
                <Button className="w-full" onClick={book} disabled={!start}>Confirm booking</Button>
              </div>
            )}
          </Card>
        </aside>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-[17px]">Consultation history</h2>
        {history.length ? (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {history.map(a => (
              <li key={a.id}><Link to={`/appointments/${a.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 hover:bg-raised/50">
                <span className="text-sm">{a.title} <span className="text-dim">· {fmtDate(a.date)}</span></span>
                <span className="flex items-center gap-2 text-[12.5px] text-dim">{a.entitlement ? 'Credit' : a.chargeINR ? inr(a.chargeINR) : ''}<StatusBadge status={a.status} /></span>
              </Link></li>
            ))}
          </ul>
        ) : <EmptyState title="No consultations yet" />}
      </section>
    </div>
  )
}
