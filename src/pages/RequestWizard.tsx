import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock, Lock, MapPin, Pencil } from 'lucide-react'
import { useApp, type RequestDraft } from '../data/store'
import { actor, balance, canRequestService, quoteFor, serviceSlots, unbilledUsage, unpaidBalance, type Slot } from '../data/selectors'
import { CITIES, POLICY, SERVICES, SERVICE_CATEGORIES, cityName, execById, serviceById, categoryName } from '../data/config'
import { Badge, Button, Card, Checkbox, ChoiceCards, EmptyState, Field, Input, KV, Notice, PageHeader, Segmented, Select, SimLabel, Stepper, Textarea, useUI } from '../components/ui'
import { addDays, cx, fmtDate, fmtTime, inr, toISODate } from '../lib/format'

const STEPS = ['Service', 'Beneficiary', 'Location', 'Date & time', 'Details', 'Quote & funding', 'Consent', 'Review']

export default function RequestWizard() {
  const { state, actions } = useApp()
  const { toast } = useUI()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const a = actor(state)
  const allowedBens = state.beneficiaries.filter(b => a.kind === 'member' || a.delegate.permissions.beneficiaryIds.includes(b.id))
  const initSvc = serviceById(params.get('service') ?? '')
  const initBen = allowedBens.find(b => b.id === params.get('beneficiary')) ?? allowedBens[0]

  const [step, setStep] = useState(initSvc ? 1 : 0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitErr, setSubmitErr] = useState<string>()
  const [createdId, setCreatedId] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [holdUntil, setHoldUntil] = useState<number>()
  const [now, setNow] = useState(Date.now())
  const [d, setD] = useState<Omit<RequestDraft, 'quote'> & { noSlot: boolean }>({
    serviceId: initSvc?.id ?? '', beneficiaryId: initBen?.id ?? '', city: initBen?.city ?? state.member.homeCity,
    address: initBen ? [initBen.indiaAddress.line1, initBen.indiaAddress.line2, initBen.indiaAddress.city, initBen.indiaAddress.postcode].filter(Boolean).join(', ') : '',
    locationNotes: '', date: toISODate(addDays(new Date(), addDays(new Date(), 2).getDay() === 0 ? 3 : 2)), slot: undefined, altWindow: '', priority: 'standard', mode: initSvc?.delivery[0] ?? 'in_person',
    instructions: params.get('notes') ?? '', contactName: initBen?.name ?? '', contactPhone: initBen?.phone ?? '', expectedHours: initSvc?.expectedHours ?? 2,
    documentIds: [], funding: initSvc && initSvc.funding !== 'bundle_hours' ? 'postpaid' : 'bundle', consents: [], noSlot: false,
  })
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD(x => ({ ...x, [k]: v }))
  const svc = serviceById(d.serviceId)
  const ben = state.beneficiaries.find(b => b.id === d.beneficiaryId)

  // simulated slot hold countdown
  useEffect(() => {
    if (!holdUntil) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [holdUntil])
  useEffect(() => {
    if (holdUntil && now > holdUntil) { set('slot', undefined); setHoldUntil(undefined); toast({ tone: 'info', title: 'Slot hold expired', body: 'Please choose a time again.' }) }
  }, [now, holdUntil, toast])

  const slots: Slot[] = useMemo(() => svc ? serviceSlots(state, { city: d.city, date: d.date, hours: d.expectedHours, mode: d.mode }) : [], [state, svc, d.city, d.date, d.expectedHours, d.mode])
  const quote = useMemo(() => svc ? quoteFor(state, svc.id, d.expectedHours, d.funding) : undefined, [state, svc, d.expectedHours, d.funding])
  const postpaidRoom = POLICY.postpaidCreditLimitINR - unbilledUsage(state).total - unpaidBalance(state)

  const validate = (i = step) => {
    const e: Record<string, string> = {}
    if (i === 0 && !svc) e.service = 'Choose a service.'
    if (i === 0 && svc && !canRequestService(state, svc.id)) e.service = 'This service is not in your delegated permissions.'
    if (i === 1 && !d.beneficiaryId) e.beneficiary = 'Choose who this is for.'
    if (i === 1 && svc && !canRequestService(state, svc.id, d.beneficiaryId)) e.beneficiary = 'You are not permitted to request this service for this person.'
    if (i === 2) { if (!d.address.trim()) e.address = 'Enter the service address.'; if (svc && !svc.cities.includes(d.city as never)) e.city = 'This service is not available in that city.' }
    if (i === 3 && !d.slot && !(d.noSlot && d.mode === 'remote')) e.slot = d.mode === 'remote' ? 'Choose a time, or let your executive coordinate.' : 'Choose an available time slot.'
    if (i === 4) {
      if (d.instructions.trim().length < 10) e.instructions = 'Please describe what you need (at least 10 characters).'
      if (!d.contactName.trim()) e.contactName = 'Who should the executive contact?'
      if (d.contactPhone.replace(/\D/g, '').length < 10) e.contactPhone = 'Enter a valid phone number with country code.'
      if (!(d.expectedHours >= 1 && d.expectedHours <= 12)) e.expectedHours = 'Between 1 and 12 hours.'
    }
    if (i === 5 && d.funding === 'postpaid' && quote && quote.total > postpaidRoom) e.funding = 'This exceeds your available postpaid credit. Choose prepaid instead.'
    if (i === 6) {
      if (!d.consents.includes('terms')) e.terms = 'Please accept the booking and cancellation terms.'
      if (quote && quote.total > 0 && !d.consents.includes('charges')) e.charges = 'Please authorise the charges.'
      if (d.documentIds.length && !d.consents.includes('docs')) e.docs = 'Please consent to sharing the selected documents.'
    }
    setErrors(e)
    return !Object.keys(e).length
  }
  const next = () => { if (validate()) { setStep(s => Math.min(s + 1, STEPS.length - 1)); window.scrollTo(0, 0) } }
  const goto = (i: number) => { setStep(i); window.scrollTo(0, 0) }

  const pickService = (id: string) => {
    const s = serviceById(id)!
    setD(x => ({ ...x, serviceId: id, mode: s.delivery.includes(x.mode) ? x.mode : s.delivery[0], expectedHours: s.expectedHours, funding: s.funding === 'bundle_hours' ? 'bundle' : 'postpaid', slot: undefined }))
  }
  const pickBen = (id: string) => {
    const b = state.beneficiaries.find(x => x.id === id)!
    setD(x => ({ ...x, beneficiaryId: id, city: b.city, address: [b.indiaAddress.line1, b.indiaAddress.line2, b.indiaAddress.city, b.indiaAddress.postcode].filter(Boolean).join(', '), contactName: b.name, contactPhone: b.phone === '—' ? state.member.mobile : b.phone, slot: undefined }))
  }

  const submit = async () => {
    for (let i = 0; i < STEPS.length - 1; i++) if (!validate(i)) { goto(i); return }
    setBusy(true); setSubmitErr(undefined)
    await new Promise(r => setTimeout(r, 700))
    const r = actions.createRequest({ ...d, slot: d.noSlot && d.mode === 'remote' ? undefined : d.slot, quote: quote! })
    setBusy(false)
    if (!r.ok) {
      setSubmitErr(r.error)
      if (/slot/i.test(r.error)) { set('slot', undefined); goto(3) }
      return
    }
    setCreatedId(r.data)
    toast({ tone: 'ok', title: 'Request submitted', body: r.data })
  }

  if (createdId) {
    const r = state.requests.find(x => x.id === createdId)!
    const awaiting = r.status === 'awaiting_approval'
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="p-8">
          <CheckCircle2 className="mb-4 size-9 text-ok" aria-hidden />
          <h1 className="serif text-3xl">{awaiting ? 'Request sent for approval' : 'Your request is in good hands'}</h1>
          <p className="mt-2 text-mute">Request <span className="text-ivory">{r.id}</span> · <Badge tone={awaiting ? 'amber' : 'gold'}>{awaiting ? 'Awaiting member approval' : r.status === 'scheduled' ? 'Scheduled' : 'Submitted'}</Badge></p>
          <h2 className="mb-2 mt-6 text-sm font-medium">What happens next</h2>
          <ol className="space-y-2 text-sm text-mute">
            {awaiting && <li>1. {state.member.name} reviews and approves the request and any charges. The slot is held meanwhile.</li>}
            <li>{awaiting ? '2.' : '1.'} {execById(r.assignedTo)?.name ?? 'Your executive'} reviews the details and messages you if anything is missing.</li>
            {r.appointmentId && <li>{awaiting ? '3.' : '2.'} You’ll get reminders before the visit, and live status on the day.</li>}
            {r.meta?.invoiceId && <li>• A prepaid invoice has been issued — pay it from Payments to keep the booking.</li>}
          </ol>
          <div className="mt-8 flex flex-wrap gap-2">
            <Button to={`/requests/${r.id}`}>View request</Button>
            {r.meta?.invoiceId && <Button variant="secondary" to={`/payments/invoices/${r.meta.invoiceId}`}>Pay invoice</Button>}
            <Button variant="secondary" to="/home">Back to home</Button>
          </div>
        </Card>
      </div>
    )
  }

  const reviewRow = (label: string, value: ReactNode, editStep: number): [ReactNode, ReactNode] => [label, <span key={label} className="inline-flex items-center gap-2">{value}<button className="text-gold-soft hover:text-ivory" aria-label={`Edit ${label}`} onClick={() => goto(editStep)}><Pencil className="size-3.5" /></button></span>]

  const body: Record<number, ReactNode> = {
    0: (
      <div className="space-y-6">
        {errors.service && <Notice tone="bad">{errors.service}</Notice>}
        {SERVICE_CATEGORIES.filter(c => SERVICES.some(s => s.categoryId === c.id)).map(c => (
          <fieldset key={c.id}>
            <legend className="mb-2 text-[13px] uppercase tracking-wider text-dim">{c.name}</legend>
            <ChoiceCards name={c.name} value={d.serviceId} onChange={pickService}
              options={SERVICES.filter(s => s.categoryId === c.id).map(s => ({ value: s.id, label: s.name, description: s.summary, disabled: !canRequestService(state, s.id), aside: !canRequestService(state, s.id) ? <Lock className="size-3.5 text-dim" aria-label="Not permitted" /> : undefined }))} />
          </fieldset>
        ))}
      </div>
    ),
    1: (
      <div className="space-y-4">
        {errors.beneficiary && <Notice tone="bad">{errors.beneficiary}</Notice>}
        <ChoiceCards name="Beneficiary" value={d.beneficiaryId} onChange={pickBen}
          options={state.beneficiaries.map(b => {
            const ok = allowedBens.includes(b) && (!svc || canRequestService(state, svc.id, b.id))
            return { value: b.id, label: b.isSelf ? `${b.name} (myself)` : b.name, description: `${b.relationship} · ${cityName(b.city)}${b.consent === 'pending' ? ' · consent pending' : ''}`, disabled: !ok, aside: !ok ? <Lock className="size-3.5 text-dim" aria-label="Not permitted" /> : undefined }
          })} />
        <p className="text-[13px] text-dim">Requested by {a.name}{a.kind === 'delegate' ? ' (delegate) — only permitted family members can be selected.' : '.'} Add family in <a className="link" href="/family">My Family</a>.</p>
      </div>
    ),
    2: (
      <div className="grid gap-4">
        <Field label="Service city" required error={errors.city} htmlFor="city" hint={d.city !== state.member.homeCity ? `Cross-city request — your home city is ${cityName(state.member.homeCity)}. A local executive will be assigned and your Personal Executive kept informed.` : undefined}>
          <Select id="city" value={d.city} onChange={e => setD(x => ({ ...x, city: e.target.value, slot: undefined }))}>{CITIES.map(c => <option key={c.id} value={c.id} disabled={!!svc && !svc.cities.includes(c.id)}>{c.name}</option>)}</Select>
        </Field>
        <Field label="Service address" required error={errors.address} htmlFor="addr"><Textarea id="addr" value={d.address} onChange={e => set('address', e.target.value)} invalid={!!errors.address} className="min-h-20" /></Field>
        <Field label="Location details (optional)" htmlFor="ln" hint="Landmark, gate code, floor, parking"><Input id="ln" value={d.locationNotes} onChange={e => set('locationNotes', e.target.value)} /></Field>
      </div>
    ),
    3: (
      <div className="space-y-5">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Preferred date" htmlFor="date"><Input id="date" type="date" min={toISODate(new Date())} max={toISODate(addDays(new Date(), 60))} value={d.date} onChange={e => { setD(x => ({ ...x, date: e.target.value, slot: undefined })); setHoldUntil(undefined) }} className="w-48" /></Field>
          {svc && svc.delivery.length > 1 && <Segmented label="Delivery" value={d.mode} onChange={v => setD(x => ({ ...x, mode: v, slot: undefined }))} options={svc.delivery.map(m => ({ value: m, label: m === 'in_person' ? 'In person' : 'Remote' }))} />}
        </div>
        <div>
          <p className="mb-2 text-[13px] text-mute">Available times in {cityName(d.city)} · {d.expectedHours} h · {d.mode === 'in_person' ? `${POLICY.travelBufferMin}-min travel buffer applied` : 'remote'}</p>
          {slots.every(s => !s.available) ? (
            <EmptyState title="No slots on this date" body={slots[0]?.reason === 'Executives off duty' ? 'Executives are off duty on this day. Try another date.' : 'All executives are booked. Try another date or let your executive coordinate.'} />
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" role="radiogroup" aria-label="Time slots">
              {slots.map(s => {
                const sel = d.slot?.start === s.start
                return (
                  <li key={s.start}>
                    <button type="button" role="radio" aria-checked={sel} disabled={!s.available}
                      onClick={() => { set('slot', { start: s.start, end: s.end, execId: s.execId!, source: s.source! }); set('noSlot', false); setHoldUntil(Date.now() + POLICY.slotHoldMinutes * 60000); setNow(Date.now()) }}
                      className={cx('w-full rounded-xl border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                        sel ? 'border-gold bg-gold/10' : 'border-line bg-bg2 hover:border-line2')}>
                      <span className="block text-sm">{fmtTime(s.start)} – {fmtTime(s.end)}</span>
                      <span className="block text-[11.5px] text-dim">{s.available ? (s.source === 'assigned_pe' ? `${execById(s.execId)?.name.split(' ')[0]} · your PE` : `${execById(s.execId)?.name.split(' ')[0]} · city pool`) : s.reason}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {errors.slot && <p className="mt-2 text-[12.5px] text-bad" role="alert">{errors.slot}</p>}
        </div>
        {d.slot && holdUntil && (
          <Notice tone="ok" title={`Holding ${fmtTime(d.slot.start)} on ${fmtDate(d.date)} for you`}>
            <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5" aria-hidden />{Math.max(0, Math.floor((holdUntil - now) / 60000))}:{String(Math.max(0, Math.floor(((holdUntil - now) / 1000) % 60))).padStart(2, '0')} left to complete your request <SimLabel>Simulated hold</SimLabel></span>
          </Notice>
        )}
        {d.mode === 'remote' && <Checkbox checked={d.noSlot} onChange={v => setD(x => ({ ...x, noSlot: v, slot: v ? undefined : x.slot }))} label="No fixed time needed — my executive can coordinate" />}
        <Field label="Alternative time (optional)" htmlFor="alt"><Select id="alt" value={d.altWindow} onChange={e => set('altWindow', e.target.value)}><option value="">No alternative</option><option>Same day, any time</option><option>Next working day, morning</option><option>Next working day, afternoon</option><option>Any time this week</option></Select></Field>
      </div>
    ),
    4: (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Priority" htmlFor="pri"><Select id="pri" value={d.priority} onChange={e => set('priority', e.target.value as RequestDraft['priority'])}><option value="standard">Standard</option><option value="priority">Priority</option><option value="urgent">Urgent (call me)</option></Select></Field>
        <Field label="Expected executive hours" error={errors.expectedHours} htmlFor="eh" hint={`Typical for this service: ${svc?.expectedHours} h`}>
          <Input id="eh" type="number" min={1} max={12} step={1} value={d.expectedHours} onChange={e => setD(x => ({ ...x, expectedHours: Number(e.target.value), slot: undefined }))} invalid={!!errors.expectedHours} disabled={svc?.rateUnit === 'flat'} />
        </Field>
        <Field className="sm:col-span-2" label="Instructions for your executive" required error={errors.instructions} htmlFor="ins"><Textarea id="ins" value={d.instructions} onChange={e => set('instructions', e.target.value)} invalid={!!errors.instructions} placeholder="What should be done, any preferences, things to bring…" /></Field>
        <Field label="Contact on the day" required error={errors.contactName} htmlFor="cn"><Input id="cn" value={d.contactName} onChange={e => set('contactName', e.target.value)} invalid={!!errors.contactName} /></Field>
        <Field label="Contact phone" required error={errors.contactPhone} htmlFor="cp"><Input id="cp" type="tel" value={d.contactPhone} onChange={e => set('contactPhone', e.target.value)} invalid={!!errors.contactPhone} /></Field>
        <div className="sm:col-span-2">
          <p className="mb-2 text-[13px] font-medium text-mute">Documents</p>
          {svc?.requiredDocs.length ? <p className="mb-2 text-[13px] text-dim">Usually needed: {svc.requiredDocs.join(', ')}</p> : <p className="mb-2 text-[13px] text-dim">No documents required for this service.</p>}
          {a.kind === 'member' ? (
            <div className="space-y-2">
              {state.documents.map(doc => <Checkbox key={doc.id} checked={d.documentIds.includes(doc.id)} onChange={v => set('documentIds', v ? [...d.documentIds, doc.id] : d.documentIds.filter(x => x !== doc.id))} label={doc.name} />)}
              <p className="text-[12.5px] text-dim">Need to add something? <a href="/documents" className="link" target="_blank">Upload to your vault</a>, then return here.</p>
            </div>
          ) : <p className="text-[13px] text-dim">Delegates cannot attach vault documents.</p>}
          {svc?.requiredDocs.length && !d.documentIds.length ? <Notice tone="warn" className="mt-3">No documents selected. You can still submit; your executive may ask for them.</Notice> : null}
        </div>
      </div>
    ),
    5: svc && quote && (
      <div className="space-y-5">
        <Field label="Funding source" error={errors.funding} htmlFor="fund">
          <ChoiceCards name="Funding source" columns={3} value={d.funding} onChange={v => set('funding', v)} options={[
            ...(svc.funding === 'bundle_hours' ? [{ value: 'bundle' as const, label: 'Membership bundle', description: `${balance(state, 'hours').available} executive hours available` }] : []),
            { value: 'prepaid' as const, label: 'Prepaid', description: 'Invoice issued now, payable before service' },
            { value: 'postpaid' as const, label: 'Postpaid', description: `Added to your monthly statement · ${inr(Math.max(0, postpaidRoom))} credit available`, disabled: postpaidRoom <= 0 },
          ]} />
        </Field>
        <Card className="bg-bg2 p-5">
          <ul className="space-y-2 text-sm">
            {quote.lines.map(l => <li key={l.label} className="flex justify-between gap-4"><span className="text-mute">{l.label}</span><span className="tabular-nums">{l.amount ? (l.amount < 0 ? '−' : '') + inr(l.amount) : 'Included'}</span></li>)}
            <li className="flex justify-between border-t border-line pt-3 text-base"><span>Total payable now or on statement</span><span className="text-gold-soft">{inr(quote.total)}</span></li>
          </ul>
          {quote.bundleHours > 0 && <p className="mt-3 text-[12.5px] text-dim">{quote.bundleHours} hour(s) will be placed on hold from your bundle. Actual time is settled after the visit; unused hours are released.</p>}
        </Card>
        {svc.additionalCharges.length > 0 && <Notice title="Possible additional charges">{svc.additionalCharges.join(' · ')}. Anything beyond the quote needs your approval first.</Notice>}
      </div>
    ),
    6: svc && quote && (
      <div className="space-y-4">
        <Checkbox checked={d.consents.includes('terms')} onChange={v => set('consents', v ? [...d.consents, 'terms'] : d.consents.filter(x => x !== 'terms'))} label="I accept the booking terms and cancellation rules" description={svc.cancellationPolicy} />
        {errors.terms && <p className="text-[12.5px] text-bad">{errors.terms}</p>}
        {quote.total > 0 && <Checkbox checked={d.consents.includes('charges')} onChange={v => set('consents', v ? [...d.consents, 'charges'] : d.consents.filter(x => x !== 'charges'))} label={`I authorise charges of ${inr(quote.total)} (${d.funding})`} />}
        {errors.charges && <p className="text-[12.5px] text-bad">{errors.charges}</p>}
        {d.documentIds.length > 0 && <Checkbox checked={d.consents.includes('docs')} onChange={v => set('consents', v ? [...d.consents, 'docs'] : d.consents.filter(x => x !== 'docs'))} label="Share the selected documents with the assigned executive for this request only" />}
        {errors.docs && <p className="text-[12.5px] text-bad">{errors.docs}</p>}
        {a.kind === 'delegate' && !a.delegate.permissions.approvals && <Notice tone="warn" title="Member approval required">You don’t have approval rights, so {state.member.name} must approve this request before it is confirmed. The slot will be held meanwhile.</Notice>}
        {ben?.consent === 'pending' && <Notice tone="warn">{ben.name}’s consent is pending. Your executive will confirm it before the service.</Notice>}
      </div>
    ),
    7: svc && quote && (
      <div className="space-y-5">
        <KV items={[
          reviewRow('Service', svc.name, 0), reviewRow('For', ben?.name, 1), reviewRow('City', cityName(d.city), 2), reviewRow('Address', d.address, 2),
          reviewRow('When', d.slot ? `${fmtDate(d.date)} · ${fmtTime(d.slot.start)}–${fmtTime(d.slot.end)} (${execById(d.slot.execId)?.name})` : 'Executive will coordinate', 3),
          reviewRow('Delivery', d.mode === 'in_person' ? 'In person' : 'Remote', 3), reviewRow('Priority', d.priority, 4), reviewRow('Expected hours', `${d.expectedHours} h`, 4),
          reviewRow('Contact', `${d.contactName} · ${d.contactPhone}`, 4), reviewRow('Documents', d.documentIds.length ? `${d.documentIds.length} attached` : 'None', 4),
          reviewRow('Funding', d.funding, 5), reviewRow('Total', quote.total ? inr(quote.total) : 'Included in bundle', 5),
        ]} />
        <p className="rounded-xl border border-line bg-bg2 p-4 text-sm text-mute"><span className="text-ivory">Instructions:</span> {d.instructions}</p>
        {submitErr && <Notice tone="bad" title="We couldn’t submit your request">{submitErr}</Notice>}
      </div>
    ),
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader back={{ to: '/services', label: 'Services' }} eyebrow="Request assistance" title={svc ? svc.name : 'What do you need help with?'}
        subtitle={svc && step > 0 ? <span className="inline-flex flex-wrap items-center gap-2">{categoryName(svc.categoryId)}{ben && step > 1 && <> · for {ben.name}</>}{step > 2 && <> · <MapPin className="size-3.5" aria-hidden />{cityName(d.city)}</>}</span> : undefined} />
      <Stepper steps={STEPS} current={step} onStep={goto} />
      <Card className="p-5 sm:p-8">
        <h2 className="serif mb-6 text-2xl">{STEPS[step]}</h2>
        {body[step]}
        <div className="mt-8 flex justify-between gap-3 border-t border-line pt-5">
          <Button variant="secondary" onClick={() => (step ? goto(step - 1) : nav(-1))}>{step ? 'Back' : 'Cancel'}</Button>
          {step < STEPS.length - 1 ? <Button onClick={next}>Continue</Button> : <Button onClick={submit} loading={busy}>Submit request</Button>}
        </div>
      </Card>
    </div>
  )
}
