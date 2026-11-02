import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarClock, Video, XCircle } from 'lucide-react'
import { useApp } from '../data/store'
import { actor, apptStart, cancellationOutcome, expertSlots, getAppointment, isUpcoming, serviceSlots } from '../data/selectors'
import { POLICY, cityName, consultTypeById, execById, expertById } from '../data/config'
import { AccessDenied, Button, Card, EmptyState, Field, Input, KV, Modal, Notice, PageHeader, SimLabel, StatusBadge, Textarea, useUI } from '../components/ui'
import { addDays, cx, fmtDate, fmtDateTime, fmtTime, inr, toISODate } from '../lib/format'

export default function AppointmentDetail() {
  const { id } = useParams()
  const { state } = useApp()
  const [resched, setResched] = useState(false)
  const [cancel, setCancel] = useState(false)
  const g = getAppointment(state, id)
  if (!g.ok) return <AccessDenied reason={g.reason} what="this appointment" />
  const a = g.data
  const isMember = actor(state).kind === 'member'
  const upcoming = isUpcoming(a)
  const pe = execById(a.peId)
  const ex = expertById(a.expertId)
  const hrsBefore = (apptStart(a).getTime() - Date.now()) / 3600000

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader back={{ to: '/appointments', label: 'Appointments' }} eyebrow={a.kind === 'consultation' ? 'Consultation' : 'Executive visit'} title={a.title}
        subtitle={<span className="inline-flex flex-wrap items-center gap-2"><StatusBadge status={a.status} /> {fmtDate(a.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {fmtTime(a.start)}–{fmtTime(a.end)}</span>}
        actions={isMember && upcoming && <>
          <Button variant="secondary" icon={<CalendarClock className="size-4" />} onClick={() => setResched(true)}>Reschedule</Button>
          <Button variant="danger" icon={<XCircle className="size-4" />} onClick={() => setCancel(true)}>Cancel</Button>
        </>} />
      <div className="grid gap-5 md:grid-cols-[1.3fr_1fr]">
        <Card className="p-6">
          <KV items={[
            ['With', ex ? `${ex.name}, ${ex.title} (sample expert)` : pe ? `${pe.name} — ${pe.role}` : '—'],
            ['For', state.beneficiaries.find(b => b.id === a.beneficiaryId)?.name],
            ['Where', a.mode === 'online' ? 'Online' : `${a.address ?? ''} (${cityName(a.city)})`],
            ['Assigned via', a.source === 'assigned_pe' ? 'Your Personal Executive' : a.source === 'city_pool' ? 'City-pool fallback' : 'Expert calendar'],
            ['Entitlement', a.entitlement ? `${a.entitlement.amount} ${a.entitlement.ent === 'hours' ? 'executive hour(s)' : 'consultation credit'} ${a.status === 'completed' ? 'used' : a.status === 'cancelled' ? 'released / settled per policy' : 'on hold'}` : 'None'],
            ...(a.chargeINR ? [['Charge', `${inr(a.chargeINR)} incl. GST`] as [string, string]] : []),
            ...(a.consultTypeId ? [['Consultation type', consultTypeById(a.consultTypeId)?.name] as [string, string | undefined]] : []),
            ...(a.notes ? [['Notes', a.notes] as [string, string]] : []),
          ]} />
          {a.meetingLink && upcoming && (
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-bg2 p-4">
              <Video className="size-5 text-gold" aria-hidden />
              <span className="flex-1 text-sm">Meeting link is shared 15 minutes before <SimLabel>Placeholder link</SimLabel></span>
              <Button size="sm" variant="secondary" onClick={() => window.open(a.meetingLink, '_blank', 'noopener')}>Open</Button>
            </div>
          )}
          {a.postNotes && <Notice className="mt-5" title="Session notes">{a.postNotes}</Notice>}
          <div className="mt-5 flex flex-wrap gap-2">
            {a.requestId && <Button size="sm" variant="secondary" to={`/requests/${a.requestId}`}>Open request {a.requestId}</Button>}
            {a.visit && a.requestId && a.status !== 'cancelled' && <Button size="sm" variant="secondary" to={`/requests/${a.requestId}/visit`}>Visit status</Button>}
            {a.invoiceId && isMember && <Button size="sm" variant="secondary" to={`/payments/invoices/${a.invoiceId}`}>Invoice</Button>}
          </div>
        </Card>
        <div className="space-y-5">
          <Card className="p-6">
            <h2 className="mb-3 text-[15px]">History</h2>
            <ul className="space-y-2 text-[13px]">{[...a.history].reverse().map((h, i) => <li key={i}><span className="text-ivory">{h.label}</span><br /><span className="text-dim">{fmtDateTime(h.at)}</span></li>)}</ul>
          </Card>
          {upcoming && (
            <Card className="p-6 text-[13px] text-mute">
              <h2 className="mb-2 text-[15px] text-ivory">Booking rules</h2>
              <p>Reschedule online up to {POLICY.rescheduleFreeHours} h before. Cancel free up to {POLICY.freeCancelHours} h before; later cancellations {a.entitlement?.ent === 'consult' ? 'consume the credit' : a.entitlement ? `consume ${POLICY.lateCancelConsumesHours} h` : a.chargeINR ? 'keep the charge' : 'are recorded'}.</p>
              <p className="mt-2 text-dim">{hrsBefore > 0 ? `Starts in ${hrsBefore < 48 ? Math.round(hrsBefore) + ' hours' : Math.round(hrsBefore / 24) + ' days'}.` : 'In progress.'}</p>
            </Card>
          )}
        </div>
      </div>
      {resched && <RescheduleModal id={a.id} onClose={() => setResched(false)} />}
      {cancel && <CancelModal id={a.id} onClose={() => setCancel(false)} />}
    </div>
  )
}

function RescheduleModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, actions } = useApp()
  const { toast } = useUI()
  const a = state.appointments.find(x => x.id === id)!
  const [date, setDate] = useState(toISODate(addDays(new Date(), 3)))
  const [pick, setPick] = useState<{ start: string; end: string; execId?: string }>()
  const [err, setErr] = useState<string>()
  const hours = (new Date(`2000-01-01T${a.end}`).getTime() - new Date(`2000-01-01T${a.start}`).getTime()) / 3600000
  const slots = useMemo(() => a.expertId
    ? expertSlots(state, a.expertId, date, a.id)
    : serviceSlots(state, { city: a.city === 'online' ? state.member.homeCity : a.city, date, hours, mode: a.mode === 'online' ? 'remote' : 'in_person', excludeApptId: a.id }), [state, a, date, hours])
  const save = () => {
    if (!pick) return setErr('Choose a new time.')
    const r = actions.rescheduleAppointment(a.id, date, pick.start, pick.end, pick.execId)
    if (!r.ok) return setErr(r.error)
    toast({ tone: 'ok', title: 'Booking rescheduled', body: `${fmtDate(date)} at ${fmtTime(pick.start)}` })
    onClose()
  }
  return (
    <Modal open onClose={onClose} title="Reschedule" description={`Currently ${fmtDate(a.date)} at ${fmtTime(a.start)}`} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Keep current time</Button><Button onClick={save} disabled={!pick}>Confirm new time</Button></>}>
      <Field label="New date" htmlFor="rd"><Input id="rd" type="date" min={toISODate(new Date())} value={date} onChange={e => { setDate(e.target.value); setPick(undefined) }} className="w-48" /></Field>
      <div className="mt-4">
        {slots.length === 0 || slots.every(s => !s.available) ? <EmptyState title="No availability on this date" body="Try another day." /> : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Available times">
            {slots.map(s => (
              <li key={s.start}><button type="button" role="radio" aria-checked={pick?.start === s.start} disabled={!s.available} onClick={() => { setPick({ start: s.start, end: s.end, execId: 'execId' in s ? s.execId : undefined }); setErr(undefined) }}
                className={cx('w-full rounded-xl border px-3 py-2 text-sm disabled:opacity-35', pick?.start === s.start ? 'border-gold bg-gold/10' : 'border-line bg-bg2 hover:border-line2')}>
                {fmtTime(s.start)}<span className="block text-[11px] text-dim">{s.available ? ('source' in s && s.source === 'city_pool' ? 'City pool' : 'Available') : s.reason}</span>
              </button></li>
            ))}
          </ul>
        )}
      </div>
      {a.entitlement && <p className="mt-4 text-[13px] text-dim">Your existing hold is released and re-applied to the new time in one step — nothing is deducted twice.</p>}
      {err && <Notice tone="bad" className="mt-4">{err}</Notice>}
    </Modal>
  )
}

function CancelModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, actions } = useApp()
  const { toast } = useUI()
  const a = state.appointments.find(x => x.id === id)!
  const o = cancellationOutcome(state, a)
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string>()
  const go = () => {
    const r = actions.cancelAppointment(a.id, reason)
    if (!r.ok) return setErr(r.error)
    toast({ tone: 'ok', title: 'Booking cancelled' })
    onClose()
  }
  const unit = o.ent === 'hours' ? 'executive hour(s)' : 'consultation credit'
  return (
    <Modal open onClose={onClose} title="Cancel this booking?" size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Keep booking</Button><Button variant="danger" onClick={go}>Cancel booking</Button></>}>
      <div className="space-y-4 text-sm">
        <Notice tone={o.late ? 'warn' : 'info'} title={o.late ? `Late cancellation (less than ${POLICY.freeCancelHours} h before)` : `Free cancellation (${POLICY.freeCancelHours} h or more before)`}>
          {a.entitlement
            ? o.late && o.consume ? `${o.consume} ${unit} will be consumed and ${o.release} released.` : `All ${a.entitlement.amount} ${unit} on hold will be released.`
            : a.chargeINR ? (o.chargeKept ? `The charge of ${inr(a.chargeINR)} remains payable.` : `A credit note for ${inr(a.chargeINR)} will be applied to the invoice.`) : 'No entitlement or charge is affected.'}
        </Notice>
        <p className="text-[12.5px] text-dim">Configured demo policy — final rules pending.</p>
        <Field label="Reason (optional)" htmlFor="cr"><Textarea id="cr" value={reason} onChange={e => setReason(e.target.value)} className="min-h-16" /></Field>
        {err && <p className="text-bad" role="alert">{err}</p>}
      </div>
    </Modal>
  )
}
