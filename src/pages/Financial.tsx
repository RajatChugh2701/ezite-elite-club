import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { HandCoins, ScrollText } from 'lucide-react'
import { useApp } from '../data/store'
import { balance, canAccessArea } from '../data/selectors'
import type { FinanceCaseKind } from '../data/types'
import { AccessDenied, Button, Card, Checkbox, EmptyState, Field, Input, Modal, Notice, PageHeader, Select, SimLabel, StatusBadge, Textarea, useUI } from '../components/ui'
import { fmtDate, inr } from '../lib/format'

export default function Financial() {
  const { state } = useApp()
  const [open, setOpen] = useState<FinanceCaseKind>()
  if (!canAccessArea(state, 'financial')) return <AccessDenied what="financial services" />
  const doc = balance(state, 'doc')
  const cases = (k: FinanceCaseKind) => state.financeCases.filter(c => c.kind === k)

  return (
    <div>
      <PageHeader eyebrow="Financial services" title="Support when it matters most" subtitle="EZIT prepares, coordinates and follows up. Decisions on funding and asset recovery are made by independent partners." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="flex flex-col p-6">
          <HandCoins className="mb-4 size-6 text-gold" aria-hidden />
          <h2 className="serif text-2xl">Emergency funding</h2>
          <p className="mt-2 text-sm text-mute">Get ready in advance so that, if a medical or family emergency happens, your request reaches a lending partner quickly and complete.</p>
          <Notice tone="warn" className="mt-4" title="Partner-controlled decisions">Eligibility, approval, amount, pricing and disbursement timing are decided solely by the lending partner. EZIT does not guarantee funding or timelines.</Notice>
          <ul className="mt-4 space-y-1.5 text-[13px] text-dim">
            <li>• Readiness profile with consented KYC and a document checklist</li>
            <li>• One-tap emergency request with evidence upload</li>
            <li>• Status updates and partner communication in one place</li>
          </ul>
          <CaseList items={cases('emergency_funding')} />
          <div className="mt-auto flex flex-wrap gap-2 pt-5"><Button onClick={() => setOpen('emergency_funding')}>{cases('emergency_funding').length ? 'Start another request' : 'Start readiness profile'}</Button></div>
        </Card>
        <Card className="flex flex-col p-6">
          <ScrollText className="mb-4 size-6 text-gold" aria-hidden />
          <h2 className="serif text-2xl">Financial assurance & wealth retrieval</h2>
          <p className="mt-2 text-sm text-mute">After the loss of a family member, we help establish claimant authority, gather documents and coordinate with partners to trace and claim assets.</p>
          <Notice className="mt-4" title={`Documentation credit: ${inr(doc.available)} available`}>Covers eligible, approved paperwork and service charges after a verified event. It is not a guarantee of recovery proceeds.</Notice>
          <ul className="mt-4 space-y-1.5 text-[13px] text-dim">
            <li>• Eligibility: a death event of an eligible family member, with verified legal authority</li>
            <li>• Needed: death certificate, legal heir or succession certificate, claimant ID</li>
          </ul>
          <CaseList items={cases('financial_assurance')} />
          <div className="mt-auto flex flex-wrap gap-2 pt-5"><Button onClick={() => setOpen('financial_assurance')}>Open a case</Button><Button variant="secondary" to="/consultations">Talk to a succession expert</Button></div>
        </Card>
      </div>
      <p className="mt-6 text-[12.5px] text-dim"><SimLabel>Simulated partners</SimLabel> No real lender or asset-tracing partner is connected in this prototype. Need help? <Link className="link" to="/support">Contact support</Link>.</p>
      {open && <NewCaseModal kind={open} onClose={() => setOpen(undefined)} />}
    </div>
  )
}

function CaseList({ items }: { items: { id: string; title: string; status: string; createdAt: string }[] }) {
  if (!items.length) return <EmptyState className="mt-5 py-6" title="No cases yet" />
  return (
    <ul className="mt-5 divide-y divide-line rounded-xl border border-line">
      {items.map(c => <li key={c.id}><Link to={`/financial/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-raised/40"><span>{c.title}<span className="block text-[12px] text-dim">{c.id} · opened {fmtDate(c.createdAt)}</span></span><StatusBadge status={c.status} /></Link></li>)}
    </ul>
  )
}

function NewCaseModal({ kind, onClose }: { kind: FinanceCaseKind; onClose: () => void }) {
  const { state, actions } = useApp()
  const { toast, requireStepUp } = useUI()
  const nav = useNavigate()
  const ef = kind === 'emergency_funding'
  const [f, setF] = useState({ beneficiaryId: 'BEN-SELF', purpose: '', need: '', employment: 'Salaried', emergency: false, details: '', deceased: '', relationship: '', dod: '', authority: 'Legal heir certificate (applying)', assets: '' })
  const [consent, setConsent] = useState(false)
  const [err, setErr] = useState<string>()
  const submit = () => {
    if (ef && !f.purpose.trim()) return setErr('Describe the purpose.')
    if (ef && f.emergency && !f.details.trim()) return setErr('Describe the emergency.')
    if (!ef && (!f.deceased.trim() || !f.relationship || !f.dod)) return setErr('Name, relationship and date of death are required.')
    if (!consent) return setErr('Your consent is required to share this information with the partner.')
    requireStepUp('Opening a financial case shares sensitive data with a partner.', () => {
      if (ef) actions.setConsent('lender_sharing', true)
      const summary: Record<string, string> = ef
        ? { Purpose: f.purpose, 'Indicative need (self-declared)': f.need || 'Not stated', Employment: f.employment, ...(f.emergency ? { Emergency: f.details } : {}) }
        : { 'Name of deceased': f.deceased, 'Relationship to deceased': f.relationship, 'Date of death': f.dod, 'Claimant authority': f.authority, 'Assets to trace': f.assets || 'Unknown' }
      const r = actions.createFinanceCase(kind, { beneficiaryId: f.beneficiaryId, summary, consents: [ef ? 'Share KYC and case details with the lending partner' : 'Share case documents with the asset-tracing partner'], emergency: ef && f.emergency })
      if (!r.ok) return setErr(r.error)
      toast({ tone: 'ok', title: 'Case created', body: r.data })
      nav(`/financial/${r.data}`)
    })
  }
  return (
    <Modal open onClose={onClose} title={ef ? 'Emergency funding' : 'Open a financial assurance case'} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>{ef && f.emergency ? 'Send to partner' : 'Create case'}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        {ef ? (<>
          <Field className="sm:col-span-2" label="Purpose" required htmlFor="fp"><Input id="fp" value={f.purpose} onChange={e => setF({ ...f, purpose: e.target.value })} placeholder="e.g. Readiness for a medical emergency in the family" /></Field>
          <Field label="Indicative need (optional)" htmlFor="fn" hint="Self-declared. The partner decides any amount."><Select id="fn" value={f.need} onChange={e => setF({ ...f, need: e.target.value })}><option value="">Prefer not to say</option><option>Up to ₹2,00,000</option><option>₹2,00,000 – ₹5,00,000</option><option>₹5,00,000 – ₹10,00,000</option></Select></Field>
          <Field label="Employment" htmlFor="fe"><Select id="fe" value={f.employment} onChange={e => setF({ ...f, employment: e.target.value })}><option>Salaried</option><option>Self-employed</option><option>Retired</option></Select></Field>
          <Field label="For" htmlFor="fb"><Select id="fb" value={f.beneficiaryId} onChange={e => setF({ ...f, beneficiaryId: e.target.value })}>{state.beneficiaries.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
          <div className="sm:col-span-2"><Checkbox checked={f.emergency} onChange={v => setF({ ...f, emergency: v })} label="This is an emergency — send my request to the partner now" description="Otherwise we’ll create a readiness profile you can complete in advance." /></div>
          {f.emergency && <Field className="sm:col-span-2" label="What has happened?" required htmlFor="fd"><Textarea id="fd" value={f.details} onChange={e => setF({ ...f, details: e.target.value })} /></Field>}
        </>) : (<>
          <Field label="Name of the deceased" required htmlFor="dn"><Input id="dn" value={f.deceased} onChange={e => setF({ ...f, deceased: e.target.value })} /></Field>
          <Field label="Your relationship" required htmlFor="dr"><Select id="dr" value={f.relationship} onChange={e => setF({ ...f, relationship: e.target.value })}><option value="">Select</option>{['Spouse', 'Son', 'Daughter', 'Parent', 'Grandson', 'Granddaughter', 'Sibling', 'Other legal heir'].map(x => <option key={x}>{x}</option>)}</Select></Field>
          <Field label="Date of death" required htmlFor="dd"><Input id="dd" type="date" max={new Date().toISOString().slice(0, 10)} value={f.dod} onChange={e => setF({ ...f, dod: e.target.value })} /></Field>
          <Field label="Claimant authority" htmlFor="da"><Select id="da" value={f.authority} onChange={e => setF({ ...f, authority: e.target.value })}><option>Nominee on record</option><option>Legal heir certificate (applying)</option><option>Succession certificate</option><option>Probate / will</option><option>Not sure</option></Select></Field>
          <Field className="sm:col-span-2" label="Known assets (optional)" htmlFor="das"><Textarea id="das" value={f.assets} onChange={e => setF({ ...f, assets: e.target.value })} placeholder="Bank accounts, policies, investments you know of" className="min-h-16" /></Field>
          <Notice className="sm:col-span-2">Eligibility and legal authority are verified before any documentation credit is applied. Recovery outcomes are not guaranteed.</Notice>
        </>)}
        <div className="sm:col-span-2"><Checkbox checked={consent} onChange={setConsent} label={ef ? 'I consent to sharing my KYC and case details with the lending partner' : 'I consent to sharing case documents with the asset-tracing partner'} description="Recorded with a timestamp. You can withdraw consent before submission to the partner." /></div>
      </div>
      {err && <Notice tone="bad" className="mt-4">{err}</Notice>}
    </Modal>
  )
}
