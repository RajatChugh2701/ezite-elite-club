import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, Car, Check, KeyRound, MapPin, Phone, ShieldAlert } from 'lucide-react'
import { useApp } from '../data/store'
import { apptStart, canTrackVisit, canUseVisitOtp, getRequest, trackingOpen } from '../data/selectors'
import { DEV_OTP, POLICY, execById } from '../data/config'
import type { VisitStage } from '../data/types'
import { AccessDenied, Avatar, Badge, Button, Card, EmptyState, Field, Modal, Notice, PageHeader, SimLabel, Textarea, useUI } from '../components/ui'
import { ContactModal } from '../components/ContactModal'
import { cx, fmtDate, fmtDateTime, fmtTime } from '../lib/format'

const STAGES: { key: VisitStage; label: string }[] = [
  { key: 'scheduled', label: 'Scheduled' }, { key: 'on_the_way', label: 'On the way' }, { key: 'arrived', label: 'Arrived' },
  { key: 'in_progress', label: 'Service started' }, { key: 'completed', label: 'Completed' },
]

export default function VisitTracking() {
  const { id } = useParams()
  const { state, actions } = useApp()
  const { toast } = useUI()
  const [now, setNow] = useState(Date.now())
  const [contact, setContact] = useState(false)
  const [esc, setEsc] = useState(false)
  const [escNote, setEscNote] = useState('')
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(t) }, [])

  const g = getRequest(state, id)
  if (!g.ok) return <AccessDenied reason={g.reason} what="this visit" />
  const r = g.data
  const appt = state.appointments.find(a => a.id === r.appointmentId)
  if (!appt?.visit) return <EmptyState className="my-10" title="No visit to track" body="This request doesn’t include an in-person visit." action={<Button variant="secondary" to={`/requests/${r.id}`}>Back to request</Button>} />
  if (!canTrackVisit(state, appt)) return <AccessDenied what="visit tracking for this request" />
  const v = appt.visit
  const pe = execById(appt.peId)!
  const open = trackingOpen(appt)
  const stageIdx = STAGES.findIndex(s => s.key === v.stage)
  const otpAllowed = canUseVisitOtp(state, appt)

  // indicative progress along the illustrative route
  const startedAt = v.events.find(e => e.stage === 'on_the_way')?.at
  const total = (v.etaMin ?? 24) * 60000
  const elapsed = startedAt ? now - new Date(startedAt).getTime() : 0
  const progress = v.stage === 'scheduled' ? 0 : v.stage === 'on_the_way' ? Math.min(0.88, 0.08 + elapsed / Math.max(total, 1) * 0.8) : 1
  const etaLeft = v.stage === 'on_the_way' ? Math.max(2, Math.round((v.etaMin ?? 24) - elapsed / 60000)) : 0

  const act = (step: Parameters<typeof actions.advanceVisit>[1], payload?: { otp?: string; note?: string }) => {
    const res = actions.advanceVisit(appt.id, step, payload)
    if (!res.ok) toast({ tone: 'bad', title: res.error })
    return res.ok
  }

  // Route geometry
  const path = 'M40 220 C 120 220, 140 150, 210 140 S 320 60, 400 70 S 470 110, 520 60'
  const point = (t: number) => {
    // approximate along a polyline matching the curve
    const pts = [[40, 220], [120, 210], [170, 160], [210, 140], [280, 110], [330, 78], [400, 70], [450, 85], [490, 85], [520, 60]]
    const seg = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1)))
    const lt = t * (pts.length - 1) - seg
    return [pts[seg][0] + (pts[seg + 1][0] - pts[seg][0]) * lt, pts[seg][1] + (pts[seg + 1][1] - pts[seg][1]) * lt]
  }
  const [mx, my] = point(progress)

  return (
    <div>
      <PageHeader back={{ to: `/requests/${r.id}`, label: r.id }} eyebrow="Visit status" title={appt.title}
        subtitle={`${fmtDate(appt.date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${fmtTime(appt.start)}–${fmtTime(appt.end)}`} />

      <ol className="mb-6 grid grid-cols-5 gap-1" aria-label="Visit progress">
        {STAGES.map((s, i) => (
          <li key={s.key} className="min-w-0">
            <div className={cx('h-1 rounded-full', i <= stageIdx ? 'bg-gold' : 'bg-line')} />
            <p className={cx('mt-2 truncate text-[11.5px] sm:text-[13px]', i === stageIdx ? 'text-ivory' : i < stageIdx ? 'text-gold-soft' : 'text-dim')} aria-current={i === stageIdx ? 'step' : undefined}>
              {i < stageIdx && <Check className="mr-1 inline size-3" aria-hidden />}{s.label}
            </p>
          </li>
        ))}
      </ol>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden">
          {open || v.stage === 'completed' ? (
            <>
              <div className="relative bg-map">
                <svg viewBox="0 0 560 280" className="block h-auto w-full" role="img" aria-label={`Illustrative route. ${v.stage === 'on_the_way' ? `About ${etaLeft} minutes away.` : STAGES[stageIdx].label}`}>
                  <defs><pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" className="stroke-map-grid" strokeWidth="1" /></pattern></defs>
                  <rect width="560" height="280" fill="url(#grid)" />
                  <path d="M0 180 L560 120 M90 0 L200 280 M380 0 L330 280 M0 40 L560 250" className="stroke-map-road" strokeWidth="10" />
                  <path d={path} fill="none" className="stroke-map-track" strokeWidth="6" strokeLinecap="round" />
                  <path d={path} fill="none" className="stroke-gold" strokeWidth="3" strokeLinecap="round" strokeDasharray="1000" strokeDashoffset={1000 - progress * 1000} pathLength={1000} style={{ transition: 'stroke-dashoffset 1s' }} />
                  <circle cx="40" cy="220" r="5" className="fill-sage" />
                  <g transform="translate(520 60)"><circle r="14" className="fill-gold" opacity=".18" /><circle r="6" className="fill-gold-soft" /></g>
                  {v.stage !== 'completed' && <g transform={`translate(${mx} ${my})`} style={{ transition: 'transform 1s' }}><circle r="16" opacity=".2" className="animate-pulse fill-gold" /><circle r="8" className="fill-bg stroke-gold" strokeWidth="2" /></g>}
                </svg>
                <div className="absolute left-3 top-3"><SimLabel>Simulated route — not live location</SimLabel></div>
              </div>
              <div className="flex flex-wrap items-center gap-4 p-5">
                <div className="flex-1">
                  {v.stage === 'on_the_way' && <><p className="serif text-3xl">{etaLeft} min</p><p className="text-sm text-mute">Indicative ETA · not guaranteed{v.delayMin ? ` · delayed by ${v.delayMin} min` : ''}</p></>}
                  {v.stage === 'scheduled' && <><p className="text-lg">Not yet on the way</p><p className="text-sm text-mute">You’ll be notified when {pe.name.split(' ')[0]} leaves.</p></>}
                  {v.stage === 'arrived' && <><p className="text-lg">{pe.name.split(' ')[0]} has arrived</p><p className="text-sm text-mute">Share the start OTP in person to begin.</p></>}
                  {v.stage === 'in_progress' && <><p className="text-lg">Service in progress</p><p className="text-sm text-mute">Location sharing has stopped.</p></>}
                  {v.stage === 'completed' && <><p className="text-lg">Visit completed</p><p className="text-sm text-mute">Time settled from your bundle.</p></>}
                </div>
                <p className="flex items-center gap-1.5 text-[13px] text-dim"><MapPin className="size-4 text-gold" aria-hidden />{appt.address}</p>
              </div>
              {v.delayMin ? <Notice tone="warn" className="mx-5 mb-5" title="Running late">Traffic has added about {v.delayMin} minutes. We’ll keep you posted.</Notice> : null}
            </>
          ) : (
            <div className="p-8 text-center">
              <Car className="mx-auto mb-3 size-8 text-gold" aria-hidden />
              <p className="text-lg">Live status opens {POLICY.trackingWindowBeforeMin} minutes before the visit</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-mute">To protect your executive’s privacy, location is shown only during the authorised visit window — from {fmtDateTime(new Date(apptStart(appt).getTime() - POLICY.trackingWindowBeforeMin * 60000).toISOString())}.</p>
              <Button className="mt-5" variant="secondary" size="sm" onClick={() => act('open_window')}>Open the window now <SimLabel className="ml-1">Demo</SimLabel></Button>
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <Avatar name={pe.name} src={pe.photo} size={52} />
              <div className="flex-1"><p className="text-ivory">{pe.name}</p><p className="text-[13px] text-dim">{pe.role}</p></div>
              <Button size="sm" variant="secondary" icon={<Phone className="size-4" />} onClick={() => setContact(true)}>Contact</Button>
            </div>
          </Card>

          {(v.stage === 'arrived' || v.stage === 'in_progress') && (
            <Card className="border-gold/40 p-5">
              <p className="mb-1 flex items-center gap-2 text-[15px]"><KeyRound className="size-4 text-gold" aria-hidden />{v.stage === 'arrived' ? 'Start OTP' : 'End OTP'}</p>
              {otpAllowed ? (
                <>
                  <p className="serif my-2 text-3xl tracking-[0.3em]">{DEV_OTP}</p>
                  <p className="text-[12.5px] text-dim">Share only in person with {pe.name.split(' ')[0]}. Single-use, valid 5 minutes, tied to this visit. <SimLabel>Dev code</SimLabel></p>
                  <Button className="mt-4 w-full" onClick={() => { if (act(v.stage === 'arrived' ? 'start' : 'complete', { otp: DEV_OTP })) toast({ tone: 'ok', title: v.stage === 'arrived' ? 'Visit started' : 'Visit completed' }) }}>
                    Simulate executive entering the OTP
                  </Button>
                </>
              ) : <Notice tone="warn">You don’t have OTP approval rights for this visit. The member or an authorised delegate must share it.</Notice>}
            </Card>
          )}

          <Card className="border-dashed p-5">
            <p className="mb-3 flex items-center gap-2 text-sm"><SimLabel>Reviewer controls</SimLabel> Advance the simulated visit</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="quiet" disabled={v.stage !== 'scheduled'} onClick={() => act('on_the_way')}>Executive on the way</Button>
              <Button size="sm" variant="quiet" disabled={v.stage !== 'on_the_way'} onClick={() => act('delay')}>Report delay</Button>
              <Button size="sm" variant="quiet" disabled={v.stage !== 'on_the_way'} onClick={() => act('arrived')}>Arrived</Button>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-[15px]">Updates</h2>
            {v.events.length ? <ul className="space-y-2 text-[13px]">{[...v.events].reverse().map(e => <li key={e.id} className="flex gap-2"><span className="w-20 shrink-0 text-dim">{fmtTime(new Date(e.at).toTimeString().slice(0, 5))}</span><span className={cx(e.stage === 'escalation' ? 'text-bad' : e.stage === 'delay' ? 'text-warn' : 'text-mute')}>{e.note}</span></li>)}</ul> : <p className="text-sm text-dim">No updates yet.</p>}
          </Card>

          <Button variant="danger" className="w-full" icon={<ShieldAlert className="size-4" />} onClick={() => setEsc(true)} disabled={v.stage === 'completed'}>Safety escalation</Button>
          <p className="text-[12px] text-dim">Escalations go to the city supervisor and the 24×7 desk. In an emergency, call 112.</p>
        </div>
      </div>
      <ContactModal exec={pe} open={contact} onClose={() => setContact(false)} />
      <Modal open={esc} onClose={() => setEsc(false)} title="Raise a safety escalation" size="sm"
        footer={<><Button variant="secondary" onClick={() => setEsc(false)}>Cancel</Button><Button variant="danger" icon={<AlertTriangle className="size-4" />} onClick={() => { if (act('escalate', { note: escNote })) { setEsc(false); setEscNote(''); toast({ tone: 'ok', title: 'Escalation raised', body: 'The supervisor will call you within 10 minutes (simulated).' }) } }}>Escalate now</Button></>}>
        <Field label="What’s happening?" htmlFor="escn"><Textarea id="escn" value={escNote} onChange={e => setEscNote(e.target.value)} placeholder="e.g. Executive not reachable, concern about safety" /></Field>
        <p className="mt-3 text-[12.5px] text-dim">For a medical or police emergency, call 112 first.</p>
      </Modal>
      <p className="mt-6 text-[12px] text-dim"><Badge tone="neutral" dot={false}>Privacy</Badge> Location is shown only during the authorised active visit window and is illustrative in this prototype.</p>
    </div>
  )
}
