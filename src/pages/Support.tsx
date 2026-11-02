import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowUpRight, ChevronDown, LifeBuoy, MessageSquare, Phone, Receipt, ShieldAlert, Sparkles, Star, UserCog, Frown } from 'lucide-react'
import { useApp } from '../data/store'
import { canAccessArea, invoiceTotals } from '../data/selectors'
import { FAQ } from '../data/config'
import type { SupportType } from '../data/types'
import { AccessDenied, Button, Card, EmptyState, Field, Input, Modal, Notice, PageHeader, Select, StatusBadge, Textarea, useUI } from '../components/ui'
import { cx, fmtDate } from '../lib/format'

const FORMS: Record<Exclude<SupportType, 'exec_change'>, { title: string; intro: string; categories: string[] }> = {
  complaint: { title: 'Complaint about a service', intro: 'Tell us what went wrong with an existing request. Complaints are tracked separately from your service requests and reviewed by the city supervisor.', categories: ['Punctuality', 'Quality of work', 'Communication', 'Executive conduct', 'Safety concern', 'Other'] },
  billing: { title: 'Billing query or dispute', intro: 'Questions about an invoice, a charge you don’t recognise, or a disputed amount.', categories: ['Invoice query', 'Disputed charge', 'Refund status', 'Tax / GST details', 'Payment issue'] },
  escalation: { title: 'Escalate an issue', intro: 'If a request or complaint isn’t being resolved, escalate it to the regional head.', categories: ['Unresolved request', 'Unresolved complaint', 'SLA missed', 'Urgent family matter'] },
  general: { title: 'General question', intro: 'Anything else about your membership or the portal.', categories: ['Membership', 'Portal help', 'Privacy & data', 'Other'] },
}

export default function Support() {
  const { state } = useApp()
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const [feedback, setFeedback] = useState(false)
  if (!canAccessArea(state, 'support')) return <AccessDenied what="support" />
  const form = params.get('new') as Exclude<SupportType, 'exec_change'> | null

  const options = [
    { icon: Sparkles, t: 'I need something done', d: 'That’s a service request, not a support case.', go: () => nav('/request/new') },
    { icon: Frown, t: 'Complain about a service', d: 'Something went wrong with an existing request.', go: () => setParams({ new: 'complaint' }) },
    { icon: Receipt, t: 'Billing query or dispute', d: 'Invoices, charges and refunds.', go: () => setParams({ new: 'billing' }) },
    { icon: ShieldAlert, t: 'Escalate', d: 'An issue that isn’t being resolved.', go: () => setParams({ new: 'escalation' }) },
    { icon: UserCog, t: 'Change my executive', d: 'Request a different Personal Executive.', go: () => nav('/team') },
    { icon: Star, t: 'Share feedback', d: 'Rate us and suggest future services.', go: () => setFeedback(true) },
  ]

  return (
    <div>
      <PageHeader eyebrow="Support" title="We’re here to help" subtitle="Choose what best describes your need so it reaches the right team." />
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {options.map(o => (
          <button key={o.t} onClick={o.go} className="group flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-line2">
            <o.icon className="mt-0.5 size-5 text-gold" aria-hidden />
            <span className="flex-1"><span className="block text-[15px] text-ivory">{o.t}</span><span className="block text-[13px] text-dim">{o.d}</span></span>
            <ArrowUpRight className="size-4 text-dim group-hover:text-gold" aria-hidden />
          </button>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card className="p-5 sm:p-6">
          <h2 className="mb-3 text-[17px]">Your support cases</h2>
          {state.supportCases.length ? (
            <ul className="divide-y divide-line">
              {state.supportCases.map(c => (
                <li key={c.id}><Link to={`/support/${c.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 hover:text-gold-soft">
                  <span className="min-w-0"><span className="block text-sm text-ivory">{c.subject}</span><span className="block text-[12px] text-dim">{c.id} · {FORMS[c.type as keyof typeof FORMS]?.title ?? 'Executive change'} · {fmtDate(c.createdAt)}</span></span>
                  <StatusBadge status={c.status} />
                </Link></li>
              ))}
            </ul>
          ) : <EmptyState icon={<LifeBuoy className="size-6" />} title="No support cases" />}
        </Card>
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <h2 className="mb-3 text-[17px]">Contact us</h2>
            <div className="grid gap-2">
              <Button variant="quiet" className="justify-start" icon={<MessageSquare className="size-4 text-gold" />} to="/messages">Message your concierge</Button>
              <Button variant="quiet" className="justify-start" icon={<Phone className="size-4 text-gold" />} to="/team">Call your executive or supervisor</Button>
              <p className="mt-1 text-[12.5px] text-dim">24×7 central desk: +91 40 0000 0000 (placeholder number)</p>
            </div>
          </Card>
          <Card className="p-5 sm:p-6">
            <h2 className="mb-2 text-[17px]">Frequently asked</h2>
            <div className="divide-y divide-line">
              {FAQ.map(f => (
                <details key={f.q} className="group py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm text-ivory">{f.q}<ChevronDown className="size-4 shrink-0 text-gold transition-transform group-open:rotate-180" aria-hidden /></summary>
                  <p className="mt-2 text-[13px] text-mute">{f.a}</p>
                </details>
              ))}
            </div>
          </Card>
        </div>
      </div>
      {form && FORMS[form] && <CaseForm type={form} onClose={() => setParams({})} />}
      {feedback && <FeedbackModal onClose={() => setFeedback(false)} />}
    </div>
  )
}

function CaseForm({ type, onClose }: { type: Exclude<SupportType, 'exec_change'>; onClose: () => void }) {
  const { state, actions } = useApp()
  const { toast } = useUI()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const cfg = FORMS[type]
  const [f, setF] = useState({ subject: '', category: '', urgency: type === 'escalation' ? 'high' : 'medium', description: '', relatedRequestId: '', relatedInvoiceId: params.get('invoice') ?? '', attachment: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const submit = () => {
    const e: Record<string, string> = {}
    if (!f.subject.trim()) e.subject = 'Add a short subject.'
    if (!f.category) e.category = 'Choose a category.'
    if (f.description.trim().length < 15) e.description = 'Please describe the issue (at least 15 characters).'
    if (type === 'complaint' && !f.relatedRequestId) e.relatedRequestId = 'Choose the request this is about.'
    if (type === 'billing' && !f.relatedInvoiceId) e.relatedInvoiceId = 'Choose the invoice.'
    setErrors(e)
    if (Object.keys(e).length) return
    const r = actions.createSupportCase({ type, subject: f.subject, category: f.category, urgency: f.urgency as 'low', description: f.description, relatedRequestId: f.relatedRequestId || undefined, relatedInvoiceId: f.relatedInvoiceId || undefined, attachmentName: f.attachment || undefined })
    if (!r.ok) return setErrors({ form: r.error })
    toast({ tone: 'ok', title: `Case ${r.data} created`, body: 'You can track it from Support.' })
    nav(`/support/${r.data}`)
  }
  return (
    <Modal open onClose={onClose} title={cfg.title} description={cfg.intro} size="lg" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>Submit</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field className="sm:col-span-2" label="Subject" required error={errors.subject} htmlFor="ss"><Input id="ss" value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })} invalid={!!errors.subject} /></Field>
        <Field label="Category" required error={errors.category} htmlFor="sc"><Select id="sc" value={f.category} onChange={e => setF({ ...f, category: e.target.value })} invalid={!!errors.category}><option value="">Select</option>{cfg.categories.map(c => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Urgency" htmlFor="su"><Select id="su" value={f.urgency} onChange={e => setF({ ...f, urgency: e.target.value })}><option value="low">Low — within 5 days</option><option value="medium">Medium — within 3 days</option><option value="high">High — within 24 hours</option></Select></Field>
        {(type === 'complaint' || type === 'escalation' || type === 'general') && (
          <Field className="sm:col-span-2" label="Related request" required={type === 'complaint'} error={errors.relatedRequestId} htmlFor="sr"><Select id="sr" value={f.relatedRequestId} onChange={e => setF({ ...f, relatedRequestId: e.target.value })} invalid={!!errors.relatedRequestId}><option value="">{type === 'complaint' ? 'Select a request' : 'None'}</option>{state.requests.map(r => <option key={r.id} value={r.id}>{r.id} · {r.title}</option>)}</Select></Field>
        )}
        {(type === 'billing' || type === 'escalation') && (
          <Field className="sm:col-span-2" label="Related invoice" required={type === 'billing'} error={errors.relatedInvoiceId} htmlFor="si"><Select id="si" value={f.relatedInvoiceId} onChange={e => setF({ ...f, relatedInvoiceId: e.target.value })} invalid={!!errors.relatedInvoiceId}><option value="">{type === 'billing' ? 'Select an invoice' : 'None'}</option>{state.invoices.map(i => <option key={i.id} value={i.id}>{i.number} · {i.title} · {invoiceTotals(i, state).status}</option>)}</Select></Field>
        )}
        <Field className="sm:col-span-2" label="Description" required error={errors.description} htmlFor="sd"><Textarea id="sd" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} invalid={!!errors.description} /></Field>
        <Field className="sm:col-span-2" label="Attachment (optional)" htmlFor="sa" hint="Only the file name is recorded in this prototype."><Input id="sa" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setF({ ...f, attachment: e.target.files?.[0]?.name ?? '' })} className="py-2" /></Field>
      </div>
      {errors.form && <Notice tone="bad" className="mt-4">{errors.form}</Notice>}
    </Modal>
  )
}

function FeedbackModal({ onClose }: { onClose: () => void }) {
  const { actions } = useApp()
  const { toast } = useUI()
  const [csat, setCsat] = useState(0)
  const [nps, setNps] = useState<number>()
  const [comment, setComment] = useState('')
  const [wishlist, setWishlist] = useState('')
  const [err, setErr] = useState<string>()
  const submit = () => {
    if (nps === undefined) return setErr('Choose how likely you are to recommend us.')
    const r = actions.submitFeedback({ csat, nps, comment, wishlist })
    if (!r.ok) return setErr(r.error)
    toast({ tone: 'ok', title: 'Thank you for your feedback' })
    onClose()
  }
  return (
    <Modal open onClose={onClose} title="Share feedback" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>Send feedback</Button></>}>
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm text-mute">Overall satisfaction</p>
          <div className="flex gap-1" role="radiogroup" aria-label="Satisfaction">{[1, 2, 3, 4, 5].map(n => <button key={n} role="radio" aria-checked={csat === n} aria-label={`${n} of 5`} onClick={() => setCsat(n)} className="p-1"><Star className={cx('size-7', n <= csat ? 'fill-gold text-gold' : 'text-dim')} /></button>)}</div>
        </div>
        <div>
          <p className="mb-2 text-sm text-mute">How likely are you to recommend EZIT ELITE? (0–10)</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Recommendation score">{Array.from({ length: 11 }, (_, n) => <button key={n} role="radio" aria-checked={nps === n} onClick={() => setNps(n)} className={cx('size-9 rounded-lg border text-sm', nps === n ? 'border-gold bg-gold/15 text-gold-soft' : 'border-line hover:border-line2')}>{n}</button>)}</div>
        </div>
        <Field label="Comments" htmlFor="fc"><Textarea id="fc" value={comment} onChange={e => setComment(e.target.value)} className="min-h-16" /></Field>
        <Field label="Services you’d like us to offer in future" htmlFor="fw"><Input id="fw" value={wishlist} onChange={e => setWishlist(e.target.value)} placeholder="e.g. Pet care while I travel" /></Field>
        {err && <Notice tone="bad">{err}</Notice>}
      </div>
    </Modal>
  )
}
