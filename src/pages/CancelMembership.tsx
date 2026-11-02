import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calculator } from 'lucide-react'
import { useApp } from '../data/store'
import { balance, canAccessArea, plan, unpaidBalance } from '../data/selectors'
import { CANCELLATION_POLICY, CONFIG_VERSION } from '../data/config'
import { AccessDenied, Button, Card, Checkbox, ConfirmDialog, Field, Input, KV, Notice, PageHeader, Select, SimLabel, StatusBadge, Textarea, useUI } from '../components/ui'
import { fmtDate, inr, parseDate, toISODate, addDays } from '../lib/format'

const REASONS = ['No longer need the service', 'Moving away from covered cities', 'Cost', 'Service experience', 'Other']

export default function CancelMembership() {
  const { state, actions } = useApp()
  const { toast, requireStepUp } = useUI()
  const nav = useNavigate()
  const [effective, setEffective] = useState(toISODate(addDays(new Date(), 30)))
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [calc, setCalc] = useState(false)
  const [ack, setAck] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [err, setErr] = useState<string>()
  if (!canAccessArea(state, 'membership')) return <AccessDenied what="membership cancellation" />

  const p = plan(state)
  const m = state.membership
  const policy = CANCELLATION_POLICY
  const annualRef = policy.annualReferenceINR[m.planCode]
  const existing = state.requests.find(r => r.kind === 'cancellation' && !['cancelled', 'completed'].includes(r.status))

  const start = parseDate(m.startDate)
  const eff = parseDate(effective)
  const monthsUsed = Math.max(0, (eff.getFullYear() - start.getFullYear()) * 12 + eff.getMonth() - start.getMonth() + (eff.getDate() >= start.getDate() ? 1 : 0))
  const chargeable = annualRef ? Math.round((annualRef * monthsUsed) / 12) : 0
  const outstanding = unpaidBalance(state)
  const refundable = Math.max(0, m.amountPaidINR - chargeable - policy.nonRefundableFeeINR - outstanding)
  const hrs = balance(state, 'hours'), con = balance(state, 'consult'), doc = balance(state, 'doc')
  const available = policy.configured && !!annualRef

  const submit = () => {
    setConfirm(false)
    requireStepUp('Requesting cancellation is a sensitive action.', () => {
      const r = actions.submitCancellation({
        'Effective date (requested)': fmtDate(effective), 'Months used (chargeable)': String(monthsUsed), 'Annual reference charge': inr(annualRef ?? 0),
        'Non-refundable fee': inr(policy.nonRefundableFeeINR), 'Outstanding bills': inr(outstanding), 'Estimated refund': inr(refundable), Policy: policy.label,
      }, reason + (notes ? ` — ${notes}` : ''))
      if (!r.ok) return setErr(r.error)
      toast({ tone: 'ok', title: 'Cancellation request submitted', body: 'Your membership remains active during review.' })
      nav(`/requests/${r.data}`)
    })
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader back={{ to: '/membership', label: 'My membership' }} eyebrow="Cancellation & refund" title="Understand your options" subtitle="See an illustrative estimate before deciding. Submitting starts a review — it does not cancel your membership or issue a refund automatically." />
      {existing && (
        <Notice tone="warn" className="mb-6" title={<>A cancellation request is already open · <StatusBadge status={existing.status} /></>}
          action={<div className="flex gap-2"><Button size="sm" variant="secondary" to={`/requests/${existing.id}`}>View</Button><Button size="sm" variant="ghost" onClick={() => { const r = actions.withdrawCancellation(existing.id); if (r.ok) toast({ tone: 'ok', title: 'Cancellation request withdrawn' }) }}>Withdraw</Button></div>}>
          Submitted {fmtDate(existing.createdAt)}. You can withdraw it at any time before a decision.
        </Notice>
      )}
      <div className="grid gap-5 md:grid-cols-[1fr_1fr]">
        <Card className="p-6">
          <h2 className="mb-3 text-lg">Your membership</h2>
          <KV items={[['Plan', p.name], ['Member since', fmtDate(m.startDate)], ['Valid until', fmtDate(m.validUntil)], ['Amount paid (excl. GST)', inr(m.amountPaidINR)], ['GST paid', inr(m.taxPaidINR)],
            ['Hours used this year', `${hrs.used} h`], ['Consultations used', `${con.used}`], ['Documentation credit used', inr(doc.used)], ['Outstanding bills', inr(outstanding)]]} />
        </Card>
        <Card className="p-6">
          <h2 className="mb-1 text-lg">Applicable policy</h2>
          <p className="mb-4 flex items-center gap-2 text-[12.5px] text-warn"><SimLabel>Example</SimLabel>{policy.label}</p>
          {available ? (
            <ul className="space-y-2 text-sm text-mute">
              <li>• Annual reference charge for {p.name}: <span className="text-ivory">{inr(annualRef)}</span> per year, prorated by month used.</li>
              <li>• Non-refundable processing fee: <span className="text-ivory">{inr(policy.nonRefundableFeeINR)}</span>.</li>
              <li>• Outstanding invoices are deducted.</li>
              <li>• Long-term plan discounts are not used to annualise the charge.</li>
              <li>• Manual review within {policy.reviewSlaDays} days; refunds go to the original payment method where possible.</li>
              <li>• GST treatment of refunds is to be confirmed by tax advisers.</li>
            </ul>
          ) : <Notice tone="warn" title="Estimate unavailable">Cancellation values for this plan have not been configured. You can still submit a request for manual review.</Notice>}
          <p className="mt-4 text-[12px] text-dim">Source: {CONFIG_VERSION}. Formula per PRD §6: paid − annual reference × chargeable years − non-refundable fees + credits, bounded by policy.</p>
        </Card>
      </div>

      <Card className="mt-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Requested effective date" htmlFor="eff" hint="Cancellation takes effect only after review and approval."><Input id="eff" type="date" min={toISODate(new Date())} value={effective} onChange={e => { setEffective(e.target.value); setCalc(false) }} /></Field>
          <Field label="Reason" required htmlFor="rsn"><Select id="rsn" value={reason} onChange={e => setReason(e.target.value)}><option value="">Select a reason</option>{REASONS.map(r => <option key={r}>{r}</option>)}</Select></Field>
          <Field className="sm:col-span-2" label="Anything we should know? (optional)" htmlFor="nts"><Textarea id="nts" value={notes} onChange={e => setNotes(e.target.value)} placeholder="If there’s something we could do better, your executive’s supervisor will reach out." /></Field>
        </div>
        {!calc && <Button className="mt-5" icon={<Calculator className="size-4" />} onClick={() => setCalc(true)} disabled={!available}>Calculate illustrative estimate</Button>}
        {calc && available && (
          <div className="mt-6 rounded-xl border border-line bg-bg2 p-5">
            <KV items={[
              ['Membership amount paid (excl. GST)', inr(m.amountPaidINR)],
              [`− Annual reference charge × ${monthsUsed} month(s) / 12`, `−${inr(chargeable)}`],
              ['− Non-refundable fee', `−${inr(policy.nonRefundableFeeINR)}`],
              ['− Outstanding invoices', `−${inr(outstanding)}`],
              ['+ Credits', inr(0)],
              [<strong key="t" className="text-ivory">Illustrative refundable amount</strong>, <strong key="v" className="serif text-2xl text-gold-soft">{inr(refundable)}</strong>],
            ]} />
            <p className="mt-3 text-[12.5px] text-dim">Entitlements already used are covered by the annual reference charge. This preview is illustrative until your contract and the policy are validated; it is not an offer.</p>
          </div>
        )}
        {calc && (
          <div className="mt-6 space-y-4 border-t border-line pt-5">
            <Checkbox checked={ack} onChange={setAck} label="I understand this estimate is illustrative and that submitting starts a review, not an immediate cancellation or refund." />
            {err && <p className="text-[12.5px] text-bad" role="alert">{err}</p>}
            <Button variant="danger" disabled={!ack || !reason || !!existing} onClick={() => setConfirm(true)}>Submit cancellation request</Button>
            {!reason && <p className="text-[12.5px] text-dim">Select a reason to continue.</p>}
          </div>
        )}
      </Card>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={submit} tone="danger" confirmLabel="Submit request" title="Submit cancellation request?">
        Your membership remains active and all services continue while the membership and finance team reviews your request. You can withdraw it before a decision.
      </ConfirmDialog>
    </div>
  )
}
