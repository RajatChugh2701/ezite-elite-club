import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, Circle, FileText } from 'lucide-react'
import { useApp } from '../data/store'
import { balance, canAccessArea } from '../data/selectors'
import { AccessDenied, Button, Card, Field, KV, Notice, PageHeader, Select, SimLabel, StatusBadge, Textarea, useUI } from '../components/ui'
import { Conversation, Timeline } from './RequestDetail'
import { fmtDate, fmtDateTime, inr } from '../lib/format'

export default function FinanceCaseDetail() {
  const { id } = useParams()
  const { state, actions } = useApp()
  const { toast } = useUI()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [emergency, setEmergency] = useState('')
  if (!canAccessArea(state, 'financial')) return <AccessDenied what="financial cases" />
  const c = state.financeCases.find(x => x.id === id)
  if (!c) return <AccessDenied reason="not_found" what="case" />
  const ef = c.kind === 'emergency_funding'
  const missing = c.checklist.filter(x => x.required && !x.documentId)
  const run = (r: { ok: boolean; error?: string }, ok: string) => toast(r.ok ? { tone: 'ok', title: ok } : { tone: 'bad', title: r.error! })

  return (
    <div>
      <PageHeader back={{ to: '/financial', label: 'Financial services' }} eyebrow={`${c.id} · ${ef ? 'Emergency funding' : 'Financial assurance'}`} title={c.title}
        subtitle={<span className="inline-flex flex-wrap items-center gap-2"><StatusBadge status={c.status} /> Partner: {c.partner} · Case manager: {c.caseManager}</span>} />
      <Notice tone="warn" className="mb-6" title={ef ? 'The lending partner makes all funding decisions' : 'Assistance, not a guaranteed outcome'}>
        {ef ? 'Eligibility, approval, amount, pricing and disbursement are controlled exclusively by the partner. EZIT cannot approve or promise funding.' : 'We help with documentation and coordination. Recovery of any asset depends on verification and the institutions involved.'}
      </Notice>
      {c.status === 'partner_decision' && <Notice tone="ok" className="mb-6" title="Partner update received">{c.timeline[c.timeline.length - 1].label}. Review the partner’s terms carefully before accepting anything.</Notice>}
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          {c.infoRequests.filter(i => i.status === 'open').map(ir => (
            <Card key={ir.id} className="border-warn/40 p-5">
              <p className="text-[13px] text-warn">Information requested · {fmtDate(ir.at)}</p>
              <p className="mt-1 text-ivory">{ir.text}</p>
              <Field className="mt-3" label="Your response" htmlFor={ir.id}><Textarea id={ir.id} value={answers[ir.id] ?? ''} onChange={e => setAnswers({ ...answers, [ir.id]: e.target.value })} className="min-h-16" /></Field>
              <Button className="mt-3" size="sm" onClick={() => run(actions.answerInfoRequest(c.id, ir.id, answers[ir.id] ?? ''), 'Response sent')}>Send response</Button>
            </Card>
          ))}
          <Card className="p-5 sm:p-6">
            <h2 className="mb-1 text-[17px]">Document checklist</h2>
            <p className="mb-4 text-[13px] text-dim">{missing.length ? `${missing.length} required document(s) outstanding` : 'All required documents attached'}</p>
            <ul className="space-y-3">
              {c.checklist.map(it => {
                const doc = state.documents.find(d => d.id === it.documentId)
                return (
                  <li key={it.id} className="flex flex-wrap items-center gap-3">
                    {doc ? <CheckCircle2 className="size-5 text-ok" aria-label="Attached" /> : <Circle className="size-5 text-dim" aria-label="Missing" />}
                    <span className="min-w-0 flex-1 text-sm">{it.label}{!it.required && <span className="text-dim"> (optional)</span>}{doc && <Link to={`/documents?doc=${doc.id}`} className="link block text-[12.5px]"><FileText className="mr-1 inline size-3.5" />{doc.name}</Link>}</span>
                    {!doc && (
                      <Select aria-label={`Attach document for ${it.label}`} className="h-9 w-56 text-sm" value="" onChange={e => e.target.value && run(actions.attachFinanceDoc(c.id, it.id, e.target.value), 'Document attached')}>
                        <option value="">Attach from vault…</option>{state.documents.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </Select>
                    )}
                  </li>
                )
              })}
            </ul>
            <p className="mt-4 text-[12.5px] text-dim">Missing something? <Link className="link" to="/documents">Upload it to your vault</Link> first.</p>
          </Card>
          {ef && c.status === 'documents_pending' && (
            <Card className="p-5 sm:p-6">
              <h2 className="mb-2 text-[17px]">Is this an emergency?</h2>
              <p className="mb-3 text-sm text-mute">Send your request to the lending partner now. Anything still missing can be added later.</p>
              <Field label="What has happened?" htmlFor="emg"><Textarea id="emg" value={emergency} onChange={e => setEmergency(e.target.value)} /></Field>
              <Button className="mt-3" variant="danger" onClick={() => run(actions.triggerEmergency(c.id, emergency), 'Sent to the lending partner')}>Send emergency request</Button>
              {!state.consents.find(x => x.key === 'lender_sharing')?.granted && <p className="mt-2 text-[12.5px] text-dim">Requires consent to share data with lending partners — <Link className="link" to="/profile?tab=consent">manage consent</Link>.</p>}
            </Card>
          )}
          <Conversation title="Communication with your case manager" messages={c.messages} placeholder="Message your case manager" onSend={t => { const r = actions.sendFinanceMessage(c.id, t); return r.ok }} />
        </div>
        <div className="space-y-5">
          <Card className="p-5"><h2 className="mb-2 text-[15px]">Submitted information</h2><KV items={[...Object.entries(c.summary), ['For', state.beneficiaries.find(b => b.id === c.beneficiaryId)?.name], ['Opened', fmtDateTime(c.createdAt)]]} /></Card>
          {c.charges && (
            <Card className="p-5">
              <h2 className="mb-3 text-[15px]">Paperwork charges</h2>
              {c.charges.length ? <ul className="space-y-1.5 text-sm">{c.charges.map(ch => <li key={ch.label} className="flex justify-between gap-3"><span className="text-mute">{ch.label}{ch.coveredByCredit && <span className="block text-[11.5px] text-ok">Covered by documentation credit</span>}</span><span>{inr(ch.amount)}</span></li>)}</ul> : <p className="text-sm text-dim">No charges yet. Itemised charges appear here for approval.</p>}
              <p className="mt-3 border-t border-line pt-3 text-[13px] text-mute">Documentation credit remaining: <span className="text-ivory">{inr(balance(state, 'doc').available)}</span></p>
            </Card>
          )}
          <Card className="p-5"><h2 className="mb-2 text-[15px]">Consents</h2><ul className="text-[13px] text-mute">{c.consents.map(x => <li key={x}>• {x}</li>)}</ul></Card>
          <Card className="p-5"><h2 className="mb-4 text-[15px]">Timeline</h2><Timeline events={c.timeline} /></Card>
          <Card className="border-dashed p-5">
            <p className="mb-2 flex items-center gap-2 text-sm"><SimLabel>Reviewer control</SimLabel> Partner integration is simulated</p>
            <Button size="sm" variant="quiet" onClick={() => run(actions.simulatePartnerUpdate(c.id), 'Partner update simulated')}>Simulate partner update</Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
