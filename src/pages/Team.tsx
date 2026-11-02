import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BadgeCheck, Clock, Languages, MapPin, MessageSquare, Phone, RefreshCw } from 'lucide-react'
import { useApp } from '../data/store'
import { canAccessArea, visibleRequests } from '../data/selectors'
import { cityName, execById } from '../data/config'
import type { Executive } from '../data/types'
import { AccessDenied, Avatar, Badge, Button, Card, ConfirmDialog, Field, Modal, Notice, PageHeader, Select, StatusBadge, Textarea, useUI } from '../components/ui'
import { ContactModal } from '../components/ContactModal'
import { fmtDate } from '../lib/format'

export default function Team() {
  const { state } = useApp()
  const [contact, setContact] = useState<Executive>()
  const [change, setChange] = useState(false)
  if (!canAccessArea(state, 'team')) return <AccessDenied what="your concierge team" />
  const m = state.membership
  const pe = execById(m.peId)!, backup = execById(m.backupPeId)!, sup = execById(m.supervisorId)!
  const active = visibleRequests(state).filter(r => !['completed', 'cancelled'].includes(r.status))
  const changeReq = state.requests.find(r => r.kind === 'exec_change' && !['completed', 'cancelled'].includes(r.status))

  return (
    <div>
      <PageHeader eyebrow="My concierge team" title="The people looking after you" subtitle="Your Personal Executive is your first point of contact. Your backup and supervisor step in whenever needed." />
      {changeReq && <Notice tone="info" className="mb-6" title={<>Executive change request {changeReq.id} · <StatusBadge status={changeReq.status} /></>} action={<Button size="sm" variant="secondary" to={`/requests/${changeReq.id}`}>View</Button>}>Anita continues to support you until a change is confirmed, so nothing is dropped.</Notice>}
      <Card className="mb-6 grid gap-6 p-6 sm:p-8 md:grid-cols-[auto_1fr]">
        <Avatar name={pe.name} src={pe.photo} size={132} className="mx-auto md:mx-0" />
        <div>
          <p className="eyebrow mb-1">Personal Executive</p>
          <p className="serif text-3xl">{pe.name}</p>
          <p className="text-mute">{pe.role} · {pe.experienceYears} years’ experience</p>
          <ul className="mt-4 grid gap-2 text-sm text-mute sm:grid-cols-2">
            <li className="flex items-center gap-2"><MapPin className="size-4 text-gold" aria-hidden />Service city: {cityName(pe.city)}</li>
            <li className="flex items-center gap-2"><Clock className="size-4 text-gold" aria-hidden />{pe.workingHours}</li>
            <li className="flex items-center gap-2"><Languages className="size-4 text-gold" aria-hidden />{pe.languages.join(', ')}</li>
            {pe.bgCheck && <li className="flex items-center gap-2"><BadgeCheck className="size-4 text-ok" aria-hidden />Background check {pe.bgCheck.status} · {fmtDate(pe.bgCheck.date)}</li>}
          </ul>
          <p className="mt-2 text-[12.5px] text-dim">{pe.bgCheck?.process}. Only verification status is shown — never underlying records.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">{pe.skills.map(s => <Badge key={s} tone="neutral" dot={false}>{s}</Badge>)}</div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button to="/messages" icon={<MessageSquare className="size-4" />}>Message</Button>
            <Button variant="secondary" icon={<Phone className="size-4" />} onClick={() => setContact(pe)}>Call or email</Button>
            <Button variant="secondary" to="/request/new">Request assistance</Button>
            <Button variant="ghost" icon={<RefreshCw className="size-4" />} onClick={() => setChange(true)} disabled={!!changeReq}>Request executive change</Button>
          </div>
        </div>
      </Card>
      <div className="grid gap-5 md:grid-cols-2">
        {[backup, sup].map(x => (
          <Card key={x.id} className="p-6">
            <div className="flex items-center gap-4">
              <Avatar name={x.name} src={x.photo} size={56} />
              <div className="flex-1">
                <p className="text-[12px] uppercase tracking-wider text-dim">{x.kind === 'backup' ? 'Backup executive' : 'Supervisor & escalations'}</p>
                <p className="text-lg text-ivory">{x.name}</p>
                <p className="text-[13px] text-mute">{x.role} · {x.workingHours}</p>
              </div>
            </div>
            {x.bgCheck && <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-dim"><BadgeCheck className="size-3.5 text-ok" aria-hidden />Verified {fmtDate(x.bgCheck.date)}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setContact(x)}>Contact</Button>
              {x.kind === 'supervisor' && <Button size="sm" variant="ghost" to="/support?new=escalation">Raise an escalation</Button>}
            </div>
          </Card>
        ))}
      </div>
      <Card className="mt-6 p-6">
        <div className="flex items-center justify-between"><h2 className="text-[17px]">Active requests with your team</h2><Button size="sm" variant="ghost" to="/requests">View all</Button></div>
        <ul className="mt-3 divide-y divide-line">{active.slice(0, 5).map(r => <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm"><Link className="hover:text-gold-soft" to={`/requests/${r.id}`}>{r.title} <span className="text-dim">· {r.id}</span></Link><StatusBadge status={r.status} /></li>)}</ul>
        {!active.length && <p className="py-3 text-sm text-dim">No active requests.</p>}
      </Card>
      <p className="mt-6 text-[12.5px] text-dim">24×7 central concierge desk available outside working hours for urgent matters.</p>
      {contact && <ContactModal exec={contact} open onClose={() => setContact(undefined)} />}
      {change && <ChangeModal onClose={() => setChange(false)} />}
    </div>
  )
}

function ChangeModal({ onClose }: { onClose: () => void }) {
  const { actions } = useApp()
  const { toast } = useUI()
  const nav = useNavigate()
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [pref, setPref] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [err, setErr] = useState<string>()
  const submit = () => {
    setConfirm(false)
    const r = actions.requestExecutiveChange(reason, details, pref)
    if (!r.ok) return setErr(r.error)
    toast({ tone: 'ok', title: 'Change request submitted', body: `${r.data} — under supervisor review` })
    onClose()
    nav(`/requests/${r.data}`)
  }
  return (
    <>
      <Modal open={!confirm} onClose={onClose} title="Request an executive change"
        footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => { if (!reason) return setErr('Choose a reason.'); setErr(undefined); setConfirm(true) }}>Continue</Button></>}>
        <div className="space-y-4">
          <p className="text-sm text-mute">Your city supervisor will review your request. Your current executive continues to help until a change is confirmed, and your full history moves with you.</p>
          <Field label="Reason" required error={err} htmlFor="cr"><Select id="cr" value={reason} onChange={e => setReason(e.target.value)} invalid={!!err}><option value="">Select</option>{['Language preference', 'Availability doesn’t suit me', 'Service quality concern', 'Moving to another city', 'Personal preference'].map(x => <option key={x}>{x}</option>)}</Select></Field>
          <Field label="Tell us more (optional)" htmlFor="cd"><Textarea id="cd" value={details} onChange={e => setDetails(e.target.value)} /></Field>
          <Field label="Preference for the new executive (optional)" htmlFor="cp"><Select id="cp" value={pref} onChange={e => setPref(e.target.value)}><option value="">No preference</option><option>Speaks Telugu</option><option>Speaks Hindi</option><option>Female executive</option><option>Male executive</option><option>Weekend availability</option></Select></Field>
        </div>
      </Modal>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={submit} confirmLabel="Submit request" title="Submit change request?">
        Reason: {reason}. No automatic reassignment happens — the supervisor confirms any change with you first.
      </ConfirmDialog>
    </>
  )
}
