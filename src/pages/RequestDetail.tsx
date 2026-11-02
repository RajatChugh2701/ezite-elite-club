import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarDays, Check, FileText, MapPin, Navigation, Send, Star } from 'lucide-react'
import { useApp } from '../data/store'
import { actor, canApprove, canTrackVisit, getDocument, getRequest, STATUS_FLOW } from '../data/selectors'
import { cityName, execById, expertById, serviceById } from '../data/config'
import type { Approval, Message, TimelineEvent } from '../data/types'
import { AccessDenied, Avatar, Badge, Button, Card, ConfirmDialog, Field, KV, Modal, Notice, PageHeader, StatusBadge, Textarea, useUI } from '../components/ui'
import { cx, fmtDate, fmtDateTime, fmtTime, inr } from '../lib/format'

export default function RequestDetail() {
  const { id } = useParams()
  const { state, actions } = useApp()
  const { toast } = useUI()
  const [approval, setApproval] = useState<Approval>()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const g = getRequest(state, id)
  if (!g.ok) return <AccessDenied reason={g.reason} what="this request" />
  const r = g.data
  const a = actor(state)
  const isMember = a.kind === 'member'
  const ben = state.beneficiaries.find(b => b.id === r.beneficiaryId)
  const appt = state.appointments.find(x => x.id === r.appointmentId)
  const approvals = r.approvalIds.map(x => state.approvals.find(y => y.id === x)!).filter(Boolean)
  const assignee = execById(r.assignedTo) ?? undefined
  const expert = expertById(r.assignedTo)
  const canCancel = isMember && STATUS_FLOW[r.status].includes('cancelled') && r.kind !== 'cancellation'
  const svc = serviceById(r.serviceId)

  return (
    <div>
      <PageHeader back={{ to: '/requests', label: 'My requests' }} eyebrow={`${r.id}${svc ? ` · ${svc.name}` : ''}`} title={r.title}
        subtitle={<span className="inline-flex flex-wrap items-center gap-2"><StatusBadge status={r.status} /> for {ben?.name} · {cityName(r.city)} · created {fmtDate(r.createdAt)}</span>}
        actions={<>
          {appt?.visit && canTrackVisit(state, appt) && appt.status !== 'cancelled' && <Button to={`/requests/${r.id}/visit`} icon={<Navigation className="size-4" />}>{appt.visit.stage === 'completed' ? 'Visit record' : 'Live visit'}</Button>}
          {canCancel && <Button variant="secondary" onClick={() => setCancelOpen(true)}>Cancel request</Button>}
        </>} />

      {approvals.filter(x => x.status === 'pending' || x.status === 'clarification_requested').map(ap => (
        <Card key={ap.id} className="mb-5 border-warn/40 bg-warn/[0.04] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-[13px] text-warn"><StatusBadge status={ap.status} /> Requested by {ap.requestedBy} · {fmtDate(ap.createdAt)}</p>
              <p className="mt-2 text-lg text-ivory">{ap.title}</p>
              <p className="mt-1 text-sm text-mute">{ap.amountINR ? `${inr(ap.amountINR)} additional` : 'No additional charge'}{ap.extraHours ? ` · includes ${ap.extraHours} extra executive hours` : ''}</p>
            </div>
            {ap.status === 'pending' && (canApprove(state, ap)
              ? <Button onClick={() => setApproval(ap)}>Review & decide</Button>
              : <Badge tone="neutral">Only {state.member.name} can approve</Badge>)}
            {ap.status === 'clarification_requested' && <Badge tone="blue">Waiting for your executive’s answer</Badge>}
          </div>
        </Card>
      ))}

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <h2 className="mb-4 text-[17px]">Timeline</h2>
            <Timeline events={r.timeline} />
          </Card>
          <Conversation messages={r.messages} onSend={t => { const res = actions.sendRequestMessage(r.id, t); if (!res.ok) toast({ tone: 'bad', title: res.error }); return res.ok }}
            disabled={r.status === 'cancelled'} placeholder={`Message ${assignee?.name.split(' ')[0] ?? expert?.name.split(' ')[0] ?? 'the team'} about this request`} />
        </div>
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <h2 className="mb-2 text-[17px]">Details</h2>
            <KV items={[
              ['Request ID', r.id], ['Beneficiary', ben?.name], ['Requested by', r.ownerName + (r.ownerId !== 'member' ? ' (delegate)' : '')],
              ['Assigned to', assignee ? <span key="a" className="inline-flex items-center gap-2"><Avatar name={assignee.name} src={assignee.photo} size={22} />{assignee.name}</span> : expert ? `${expert.name} (sample expert)` : r.assignedTo],
              ['Delivery', r.mode === 'in_person' ? 'In person' : 'Remote'], ['Priority', r.priority],
              ['Address', r.address], ...(r.locationNotes ? [['Location notes', r.locationNotes] as [string, string]] : []),
              ...(r.slaDue ? [['Expected by (SLA)', fmtDateTime(r.slaDue)] as [string, string]] : []),
              ...(isMember && (r.kind === 'service' || r.kind === 'consultation') ? [['Funding', r.funding.replace('_', ' ')] as [string, string]] : []),
              ...(r.instructions ? [['Instructions', r.instructions] as [string, string]] : []),
            ]} />
          </Card>
          {isMember && r.quote && r.quote.total > 0 && (
            <Card className="p-5 sm:p-6">
              <h2 className="mb-3 text-[17px]">Quote</h2>
              <ul className="space-y-1.5 text-sm">{r.quote.lines.map(l => <li key={l.label} className="flex justify-between gap-3"><span className="text-mute">{l.label}</span><span>{l.amount ? (l.amount < 0 ? '−' : '') + inr(l.amount) : 'Included'}</span></li>)}
                <li className="flex justify-between border-t border-line pt-2"><span>Total</span><span className="text-gold-soft">{inr(r.quote.total)}</span></li></ul>
              {r.meta?.invoiceId && <Button size="sm" variant="secondary" className="mt-3" to={`/payments/invoices/${r.meta.invoiceId}`}>View invoice</Button>}
            </Card>
          )}
          {appt && (
            <Card className="p-5 sm:p-6">
              <div className="mb-3 flex items-center justify-between"><h2 className="text-[17px]">Appointment</h2><StatusBadge status={appt.status} /></div>
              <p className="flex items-center gap-2 text-sm"><CalendarDays className="size-4 text-gold" aria-hidden />{fmtDate(appt.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {fmtTime(appt.start)}–{fmtTime(appt.end)}</p>
              <p className="mt-1 flex items-center gap-2 text-sm text-mute"><MapPin className="size-4 text-gold" aria-hidden />{appt.mode === 'online' ? 'Online' : appt.address ?? cityName(appt.city)}</p>
              <p className="mt-1 text-[13px] text-dim">{appt.source === 'city_pool' ? 'City pool executive' : appt.source === 'expert' ? 'Expert session' : 'Your Personal Executive'}{appt.entitlement ? ` · ${appt.entitlement.amount} ${appt.entitlement.ent === 'hours' ? 'h' : 'credit'} on hold` : ''}</p>
              <Button size="sm" variant="secondary" className="mt-4" to={`/appointments/${appt.id}`}>Manage booking</Button>
              {appt.visit && appt.visit.events.length > 0 && (
                <div className="mt-4 border-t border-line pt-3">
                  <p className="mb-1 text-[13px] text-mute">Visit history</p>
                  <ul className="space-y-1 text-[12.5px] text-dim">{appt.visit.events.map(e => <li key={e.id}>{fmtDateTime(e.at)} — {e.note}</li>)}</ul>
                </div>
              )}
            </Card>
          )}
          <Card className="p-5 sm:p-6">
            <h2 className="mb-3 text-[17px]">Documents</h2>
            <DocList ids={r.documentIds} />
          </Card>
          {approvals.some(x => x.status !== 'pending' && x.status !== 'clarification_requested') && (
            <Card className="p-5 sm:p-6">
              <h2 className="mb-3 text-[17px]">Approval history</h2>
              <ul className="space-y-3 text-sm">{approvals.filter(x => !['pending', 'clarification_requested'].includes(x.status)).map(ap => (
                <li key={ap.id}><div className="flex items-center justify-between gap-2"><span>{ap.title}</span><StatusBadge status={ap.status} /></div><p className="text-[12.5px] text-dim">{ap.decidedBy} · {fmtDateTime(ap.decidedAt)}{ap.note ? ` · “${ap.note}”` : ''}</p></li>
              ))}</ul>
            </Card>
          )}
          {r.completion && (
            <Card className="p-5 sm:p-6">
              <h2 className="mb-2 text-[17px]">Completion</h2>
              <p className="text-sm text-mute">{r.completion.summary}</p>
              <p className="mt-2 text-[13px] text-dim">Completed {fmtDateTime(r.completion.at)}{r.completion.hours ? ` · ${r.completion.hours} h settled` : ''}</p>
              <ul className="mt-3 space-y-1 text-[13px]">{r.completion.evidence.map(e => <li key={e} className="flex items-center gap-2"><Check className="size-3.5 text-ok" aria-hidden />{e}</li>)}</ul>
              {isMember && <FeedbackInline requestId={r.id} />}
            </Card>
          )}
          {r.meta && r.kind === 'cancellation' && (
            <Card className="p-5 sm:p-6"><h2 className="mb-2 text-[17px]">Estimate submitted</h2><KV items={Object.entries(r.meta)} /></Card>
          )}
        </div>
      </div>
      {approval && <ApprovalModal approval={approval} onClose={() => setApproval(undefined)} />}
      <ConfirmDialog open={cancelOpen} onClose={() => setCancelOpen(false)} tone="danger" confirmLabel="Cancel request" title="Cancel this request?"
        onConfirm={() => { const res = actions.cancelRequest(r.id, cancelReason); setCancelOpen(false); toast(res.ok ? { tone: 'ok', title: 'Request cancelled' } : { tone: 'bad', title: res.error }) }}>
        {appt && appt.status !== 'cancelled' ? 'The booking will be cancelled under the configured policy: holds are released in full when cancelled 24 hours or more before; later cancellations may consume time.' : 'Your executive will stop work on this request.'}
        <Field className="mt-4" label="Reason (optional)" htmlFor="creason"><Textarea id="creason" value={cancelReason} onChange={e => setCancelReason(e.target.value)} className="min-h-16" /></Field>
      </ConfirmDialog>
    </div>
  )
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="relative space-y-5 pl-6 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-line">
      {[...events].reverse().map((e, i) => (
        <li key={e.id} className="relative">
          <span className={cx('absolute -left-6 top-1 grid size-[15px] place-items-center rounded-full border', i === 0 ? 'border-gold bg-gold/20' : 'border-line2 bg-surface')} aria-hidden />
          <p className="text-sm text-ivory">{e.label}</p>
          {e.detail && <p className="text-[13px] text-mute">{e.detail}</p>}
          <p className="text-[12px] text-dim">{e.actor} · {fmtDateTime(e.at)}</p>
        </li>
      ))}
    </ol>
  )
}

export function Conversation({ messages, onSend, disabled, placeholder, title = 'Messages' }: { messages: Message[]; onSend: (t: string) => boolean; disabled?: boolean; placeholder: string; title?: string }) {
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  useEffect(() => { if (first.current) { first.current = false; return } end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [messages.length])
  const send = (e: React.FormEvent) => { e.preventDefault(); if (text.trim() && onSend(text)) setText('') }
  const mine = (m: Message) => m.from === 'member' || m.from === 'delegate'
  return (
    <Card className="flex flex-col p-5 sm:p-6">
      <h2 className="mb-4 text-[17px]">{title}</h2>
      <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1" aria-live="polite">
        {messages.length === 0 && <p className="text-sm text-dim">No messages yet. Your executive will reply here.</p>}
        {messages.map(m => (
          <div key={m.id} className={cx('flex', mine(m) ? 'justify-end' : 'justify-start')}>
            <div className={cx('max-w-[85%] rounded-2xl px-4 py-2.5 text-sm', mine(m) ? 'rounded-br-md bg-gold/15 text-ivory' : 'rounded-bl-md border border-line bg-bg2')}>
              <p className="mb-0.5 text-[11.5px] text-dim">{m.author} · {fmtDateTime(m.at)}</p>
              <p className="whitespace-pre-wrap">{m.text}</p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="mt-4 flex gap-2">
        <label htmlFor="msg" className="sr-only">Message</label>
        <input id="msg" value={text} onChange={e => setText(e.target.value)} disabled={disabled} placeholder={disabled ? 'This conversation is closed' : placeholder} maxLength={1000}
          className="h-11 min-w-0 flex-1 rounded-full border border-line2 bg-bg2 px-4 text-sm placeholder:text-dim focus:border-gold focus:outline-none disabled:opacity-50" />
        <Button type="submit" disabled={disabled || !text.trim()} aria-label="Send message" icon={<Send className="size-4" />}><span className="hidden sm:inline">Send</span></Button>
      </form>
    </Card>
  )
}

function DocList({ ids }: { ids: string[] }) {
  const { state } = useApp()
  if (!ids.length) return <p className="text-sm text-dim">No documents attached.</p>
  return (
    <ul className="space-y-2">
      {ids.map(id => {
        const g = getDocument(state, id)
        return (
          <li key={id} className="flex items-center gap-2 text-sm">
            <FileText className="size-4 text-gold" aria-hidden />
            {g.ok ? <Link className="link" to={`/documents?doc=${id}`}>{g.data.name}</Link> : <span className="text-dim">{g.reason === 'forbidden' ? 'Restricted document' : 'Removed document'}</span>}
          </li>
        )
      })}
    </ul>
  )
}

function ApprovalModal({ approval, onClose }: { approval: Approval; onClose: () => void }) {
  const { state, actions } = useApp()
  const { toast } = useUI()
  const [mode, setMode] = useState<'review' | 'approve' | 'reject' | 'clarify'>('review')
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string>()
  const decide = () => {
    const res = actions.decideApproval(approval.id, mode === 'approve' ? 'approve' : mode === 'reject' ? 'reject' : 'clarify', note)
    if (!res.ok) return setErr(res.error)
    toast({ tone: 'ok', title: mode === 'approve' ? 'Approved' : mode === 'reject' ? 'Declined' : 'Question sent', body: mode === 'clarify' ? 'Your executive will reply in the request thread.' : undefined })
    onClose()
  }
  return (
    <Modal open onClose={onClose} title={mode === 'review' ? 'Review approval' : mode === 'approve' ? 'Confirm approval' : mode === 'reject' ? 'Decline approval' : 'Ask for clarification'} size="lg"
      footer={mode === 'review' ? <>
        <Button variant="ghost" onClick={() => setMode('clarify')}>Ask a question</Button>
        <Button variant="danger" onClick={() => setMode('reject')}>Decline</Button>
        <Button onClick={() => setMode('approve')}>Approve</Button>
      </> : <>
        <Button variant="secondary" onClick={() => { setMode('review'); setErr(undefined) }}>Back</Button>
        <Button variant={mode === 'reject' ? 'danger' : 'primary'} onClick={decide}>{mode === 'approve' ? `Approve ${approval.amountINR ? inr(approval.amountINR) : ''}` : mode === 'reject' ? 'Decline' : 'Send question'}</Button>
      </>}>
      {mode === 'review' ? (
        <div className="space-y-5">
          <div>
            <p className="text-lg text-ivory">{approval.title}</p>
            <p className="text-[13px] text-dim">Requested by {approval.requestedBy} · {fmtDateTime(approval.createdAt)}</p>
          </div>
          <div><p className="mb-1 text-[13px] font-medium text-mute">Why approval is needed</p><p className="text-sm">{approval.reason}</p></div>
          {approval.breakdown.length > 0 && (
            <div className="rounded-xl border border-line bg-bg2 p-4">
              <ul className="space-y-1.5 text-sm">{approval.breakdown.map(b => <li key={b.label} className="flex justify-between gap-3"><span className="text-mute">{b.label}</span><span>{b.amount ? inr(b.amount) : 'Included'}</span></li>)}
                <li className="flex justify-between border-t border-line pt-2"><span>Additional amount</span><span className="text-gold-soft">{inr(approval.amountINR)}</span></li></ul>
              <p className="mt-2 text-[12px] text-dim">Approved amounts are added to your postpaid statement.</p>
            </div>
          )}
          {approval.documentIds.length > 0 && <div><p className="mb-2 text-[13px] font-medium text-mute">Supporting documents</p><DocList ids={approval.documentIds} /></div>}
          <Notice>Opening this approval does not approve it. Choose an action below.</Notice>
        </div>
      ) : (
        <div className="space-y-4">
          {mode === 'approve' && <p className="text-sm text-mute">You are authorising {approval.amountINR ? <strong className="text-ivory">{inr(approval.amountINR)}</strong> : 'this step'} for {approval.title.toLowerCase()}. Your executive will proceed immediately.</p>}
          {mode === 'reject' && <p className="text-sm text-mute">The request will be put on hold and your executive will propose alternatives.</p>}
          <Field label={mode === 'approve' ? 'Note (optional)' : 'Note for your executive'} required={mode !== 'approve'} error={err} htmlFor="apnote">
            <Textarea id="apnote" value={note} onChange={e => setNote(e.target.value)} invalid={!!err} />
          </Field>
          {state.session.actorId !== 'member' && <p className="text-[12.5px] text-dim">You are acting as a delegate with approval rights.</p>}
        </div>
      )}
    </Modal>
  )
}

function FeedbackInline({ requestId }: { requestId: string }) {
  const { state, actions } = useApp()
  const { toast } = useUI()
  const [rating, setRating] = useState(0)
  const given = state.feedback.find(f => f.requestId === requestId)
  if (given) return <p className="mt-4 border-t border-line pt-3 text-[13px] text-dim">You rated this {given.csat}/5. Thank you.</p>
  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="mb-2 text-[13px] text-mute">How did we do?</p>
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(n)} className="p-1">
            <Star className={cx('size-5', n <= rating ? 'fill-gold text-gold' : 'text-dim')} />
          </button>
        ))}
        <Button size="sm" variant="secondary" className="ml-2" disabled={!rating} onClick={() => { const res = actions.submitFeedback({ csat: rating, nps: rating * 2, comment: '', wishlist: '', requestId }); if (res.ok) toast({ tone: 'ok', title: 'Thank you for your feedback' }) }}>Submit</Button>
      </div>
    </div>
  )
}
