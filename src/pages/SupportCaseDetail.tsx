import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp } from '../data/store'
import { canAccessArea } from '../data/selectors'
import { AccessDenied, Button, Card, Field, KV, Modal, Notice, PageHeader, SimLabel, StatusBadge, Textarea, useUI } from '../components/ui'
import { Conversation, Timeline } from './RequestDetail'
import { fmtDateTime } from '../lib/format'

export default function SupportCaseDetail() {
  const { id } = useParams()
  const { state, actions } = useApp()
  const { toast } = useUI()
  const [esc, setEsc] = useState(false)
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string>()
  if (!canAccessArea(state, 'support')) return <AccessDenied what="support cases" />
  const c = state.supportCases.find(x => x.id === id)
  if (!c) return <AccessDenied reason="not_found" what="support case" />
  const overdue = new Date(c.slaDue).getTime() < Date.now() && !['resolved', 'closed'].includes(c.status)
  const run = (r: { ok: boolean; error?: string }, t: string) => toast(r.ok ? { tone: 'ok', title: t } : { tone: 'bad', title: r.error! })
  return (
    <div>
      <PageHeader back={{ to: '/support', label: 'Support' }} eyebrow={`${c.id} · ${c.category}`} title={c.subject}
        subtitle={<span className="inline-flex flex-wrap items-center gap-2"><StatusBadge status={c.status} /> Raised {fmtDateTime(c.createdAt)}</span>}
        actions={<>
          {!['resolved', 'closed', 'escalated'].includes(c.status) && <Button variant="secondary" onClick={() => setEsc(true)}>Escalate</Button>}
          {c.status === 'resolved' && <Button variant="secondary" onClick={() => run(actions.closeSupportCase(c.id), 'Case closed')}>Close case</Button>}
        </>} />
      {overdue && <Notice tone="warn" className="mb-5" title="Response target passed">We’re sorry for the delay. You can escalate this case.</Notice>}
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          <Card className="p-5 sm:p-6"><h2 className="mb-2 text-[15px]">Description</h2><p className="text-sm text-mute">{c.description}</p></Card>
          <Conversation title="Messages" messages={c.messages} disabled={c.status === 'closed'} placeholder="Add information or reply" onSend={t => { const r = actions.sendSupportMessage(c.id, t); if (!r.ok) toast({ tone: 'bad', title: r.error }); return r.ok }} />
        </div>
        <div className="space-y-5">
          <Card className="p-5">
            <KV items={[['Case ID', c.id], ['Type', c.type], ['Urgency', c.urgency], ['Response target', fmtDateTime(c.slaDue)],
              ['Related request', c.relatedRequestId ? <Link key="r" className="link" to={`/requests/${c.relatedRequestId}`}>{c.relatedRequestId}</Link> : '—'],
              ['Related invoice', c.relatedInvoiceId ? <Link key="i" className="link" to={`/payments/invoices/${c.relatedInvoiceId}`}>{c.relatedInvoiceId}</Link> : '—'],
              ['Attachment', c.attachmentName ?? '—']]} />
          </Card>
          <Card className="p-5"><h2 className="mb-4 text-[15px]">Status timeline</h2><Timeline events={c.timeline} /></Card>
          {!['resolved', 'closed'].includes(c.status) && (
            <Card className="border-dashed p-5">
              <p className="mb-2 flex items-center gap-2 text-sm"><SimLabel>Reviewer control</SimLabel></p>
              <Button size="sm" variant="quiet" onClick={() => run(actions.simulateSupportResolution(c.id), 'Resolution simulated')}>Simulate team resolution</Button>
            </Card>
          )}
        </div>
      </div>
      <Modal open={esc} onClose={() => setEsc(false)} title="Escalate this case" size="sm"
        footer={<><Button variant="secondary" onClick={() => setEsc(false)}>Cancel</Button><Button onClick={() => { const r = actions.escalateSupportCase(c.id, reason); if (!r.ok) return setErr(r.error); setEsc(false); toast({ tone: 'ok', title: 'Escalated to the regional head' }) }}>Escalate</Button></>}>
        <Field label="Why are you escalating?" error={err} htmlFor="er"><Textarea id="er" value={reason} onChange={e => setReason(e.target.value)} invalid={!!err} /></Field>
      </Modal>
    </div>
  )
}
