import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Clock, CreditCard, Download, MessageSquareWarning, XCircle } from 'lucide-react'
import { useApp } from '../data/store'
import { canAccessArea, invoiceTotals } from '../data/selectors'
import { paymentGateway, type SimOutcome } from '../data/integrations'
import type { Payment } from '../data/types'
import { AccessDenied, Button, Card, ChoiceCards, Field, KV, Modal, Notice, PageHeader, Select, SimLabel, StatusBadge, useUI } from '../components/ui'
import { fmtDate, fmtDateTime, inr } from '../lib/format'
import { downloadFile, invoiceDocument } from '../lib/download'

export default function InvoiceDetail() {
  const { id } = useParams()
  const { state } = useApp()
  const [pay, setPay] = useState(false)
  const [receipt, setReceipt] = useState<Payment>()
  const inv = state.invoices.find(i => i.id === id)
  if (!canAccessArea(state, 'payments')) return <AccessDenied what="invoices" />
  if (!inv) return <AccessDenied reason="not_found" what="invoice" />
  const t = invoiceTotals(inv, state)
  const addr = state.member.billingAddress
  const pdf = () => downloadFile(`${inv.number.replace(/\//g, '-')}.html`, invoiceDocument({
    number: inv.number, title: inv.title, issueDate: fmtDate(inv.issueDate), dueDate: fmtDate(inv.dueDate), billedTo: inv.billedTo, address: [addr.line1, addr.line2, addr.city, addr.postcode].filter(Boolean).join(', '),
    lines: inv.lines, subtotal: t.subtotal, tax: t.tax, total: t.total, paid: t.paid, due: t.due, credit: t.credit, status: t.status,
  }))

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader back={{ to: '/payments?tab=invoices', label: 'Invoices' }} eyebrow={`Invoice ${inv.number}`} title={inv.title}
        subtitle={<span className="inline-flex flex-wrap items-center gap-2"><StatusBadge status={t.status} /> Issued {fmtDate(inv.issueDate)} · due {fmtDate(inv.dueDate)}{inv.period ? ` · ${inv.period}` : ''}</span>}
        actions={<>
          <Button variant="secondary" icon={<Download className="size-4" />} onClick={pdf}>Download</Button>
          {t.due > 0 && t.status !== 'processing' && <Button icon={<CreditCard className="size-4" />} onClick={() => setPay(true)}>Pay {inr(t.due)}</Button>}
        </>} />
      {inv.disputed && <Notice className="mb-5" tone="info" title="Billing query open">Our finance team is reviewing a query on this invoice. You can still pay any undisputed amount.</Notice>}
      {t.status === 'overdue' && <Notice className="mb-5" tone="bad" title="This invoice is overdue">Please pay or raise a query if something looks wrong.</Notice>}
      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[1fr_60px_110px_80px_120px] gap-3 border-b border-line px-5 py-3 text-[12px] uppercase tracking-wider text-dim sm:grid"><span>Description</span><span>Qty</span><span>Rate</span><span>GST</span><span className="text-right">Amount</span></div>
        <ul className="divide-y divide-line">
          {inv.lines.map((l, i) => (
            <li key={i} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[1fr_60px_110px_80px_120px] sm:gap-3">
              <span>{l.description}{l.serviceDate && <span className="block text-[12px] text-dim">Service date {fmtDate(l.serviceDate)}</span>}</span>
              <span className="text-mute"><span className="sm:hidden">Qty </span>{l.qty}</span>
              <span className="text-mute">{inr(l.rate)}</span>
              <span className="text-mute">{l.taxRate ? `${Math.round(l.taxRate * 100)}%` : 'At actuals'}</span>
              <span className="tabular-nums sm:text-right">{inr(l.qty * l.rate)}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-line px-5 py-4">
          <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-mute">Subtotal</dt><dd>{inr(t.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-mute">GST (CGST + SGST)</dt><dd>{inr(t.tax)}</dd></div>
            <div className="flex justify-between border-t border-line pt-1.5"><dt>Total</dt><dd>{inr(t.total)}</dd></div>
            {t.paid > 0 && <div className="flex justify-between text-ok"><dt>Paid</dt><dd>−{inr(t.paid)}</dd></div>}
            {t.credit > 0 && <div className="flex justify-between text-ok"><dt>Credit note</dt><dd>−{inr(t.credit)}</dd></div>}
            <div className="flex justify-between text-base"><dt>Amount due</dt><dd className={t.due ? 'text-gold-soft' : ''}>{inr(t.due)}</dd></div>
          </dl>
        </div>
      </Card>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-[15px]">Payment history</h2>
          {t.payments.length ? <ul className="space-y-3">{[...t.payments].reverse().map(p => (
            <li key={p.id} className="flex flex-wrap items-start justify-between gap-2 text-sm">
              <span>{inr(p.amount)} · {p.method}<span className="block text-[12px] text-dim">{fmtDateTime(p.at)} · {p.reference}</span>{p.failureReason && <span className="block text-[12px] text-bad">{p.failureReason}</span>}</span>
              <span className="flex items-center gap-2"><StatusBadge status={p.status} />{p.status === 'success' && <Button size="sm" variant="ghost" onClick={() => setReceipt(p)}>Receipt</Button>}</span>
            </li>
          ))}</ul> : <p className="text-sm text-dim">No payments yet.</p>}
          {t.status === 'processing' && <PendingResolver paymentId={t.payments.find(p => p.status === 'pending')!.id} />}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-[15px]">Billing details</h2>
          <KV items={[['Billed to', inv.billedTo], ['Address', [addr.line1, addr.city, addr.postcode].join(', ')], ['Type', inv.type], ...(inv.requestId ? [['Request', inv.requestId] as [string, string]] : [])]} />
          <Button className="mt-4" size="sm" variant="secondary" icon={<MessageSquareWarning className="size-4" />} to={`/support?new=billing&invoice=${inv.id}`}>Raise a query or dispute</Button>
          <p className="mt-3 text-[12px] text-dim">Invoice numbering, GST and foreign billing treatment are to be validated by finance advisers.</p>
        </Card>
      </div>
      {pay && <PayModal invoiceId={inv.id} onClose={() => setPay(false)} onReceipt={setReceipt} />}
      {receipt && (
        <Modal open onClose={() => setReceipt(undefined)} title="Payment receipt" size="sm" footer={<Button variant="secondary" onClick={() => setReceipt(undefined)}>Back to invoice</Button>}>
          <CheckCircle2 className="mb-3 size-7 text-ok" aria-hidden />
          <KV items={[['Amount', inr(receipt.amount)], ['Invoice', inv.number], ['Method', receipt.method], ['Reference', receipt.reference], ['Date', fmtDateTime(receipt.at)], ['Remaining due', inr(invoiceTotals(inv, state).due)]]} />
          <p className="mt-3"><SimLabel>Simulated payment — no money moved</SimLabel></p>
        </Modal>
      )}
    </div>
  )
}

function PendingResolver({ paymentId }: { paymentId: string }) {
  const { actions } = useApp()
  const { toast } = useUI()
  const [busy, setBusy] = useState(false)
  return (
    <Notice className="mt-4" tone="warn" title="Awaiting bank confirmation" action={
      <div className="flex flex-col gap-1">
        <Button size="sm" loading={busy} icon={<Clock className="size-4" />} onClick={async () => { setBusy(true); const s = await paymentGateway.poll(paymentId, 'success'); setBusy(false); actions.resolvePayment(paymentId, s === 'success' ? 'success' : 'failed'); toast({ tone: 'ok', title: 'Payment confirmed' }) }}>Check status</Button>
        <Button size="sm" variant="ghost" onClick={() => { actions.resolvePayment(paymentId, 'failed'); toast({ tone: 'bad', title: 'Payment not confirmed' }) }}>Simulate failure</Button>
      </div>}>
      The invoice stays unpaid until the gateway confirms.
    </Notice>
  )
}

function PayModal({ invoiceId, onClose, onReceipt }: { invoiceId: string; onClose: () => void; onReceipt: (p: Payment) => void }) {
  const { state, actions } = useApp()
  const { toast, requireStepUp } = useUI()
  const inv = state.invoices.find(i => i.id === invoiceId)!
  const due = invoiceTotals(inv, state).due
  const [method, setMethod] = useState('UPI')
  const [outcome, setOutcome] = useState<SimOutcome>('success')
  const [stage, setStage] = useState<'choose' | 'processing' | 'success' | 'failed' | 'pending'>('choose')
  const [fail, setFail] = useState<string>()
  const [payId, setPayId] = useState<string>()

  const go = () => requireStepUp('Payments require verification.', async () => {
    setStage('processing')
    const r = await paymentGateway.charge(due, method, outcome)
    const rec = actions.recordPayment(invoiceId, { amount: due, method, status: r.status, reference: r.reference, failureReason: r.failureReason })
    if (!rec.ok) { setFail(rec.error); setStage('failed'); return }
    setPayId(rec.data)
    if (r.status === 'success') { setStage('success'); toast({ tone: 'ok', title: 'Payment successful' }) }
    else if (r.status === 'pending') setStage('pending')
    else { setFail(r.failureReason); setStage('failed') }
  })

  return (
    <Modal open onClose={stage === 'processing' ? () => {} : onClose} title={stage === 'success' ? 'Payment successful' : stage === 'failed' ? 'Payment failed' : stage === 'pending' ? 'Payment pending' : `Pay ${inr(due)}`}
      footer={stage === 'choose' ? <><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={go}>Pay {inr(due)}</Button></>
        : stage === 'failed' ? <><Button variant="secondary" onClick={onClose}>Back to invoice</Button><Button onClick={() => setStage('choose')}>Try again</Button></>
          : stage === 'success' ? <><Button variant="secondary" onClick={() => { const p = state.payments.find(x => x.id === payId); onClose(); if (p) onReceipt(p) }}>View receipt</Button><Button onClick={onClose}>Back to invoice</Button></>
            : stage === 'pending' ? <Button onClick={onClose}>Back to invoice</Button> : undefined}>
      {stage === 'choose' && (
        <div className="space-y-5">
          <p className="text-sm text-mute">{inv.number} · {inv.title}</p>
          <ChoiceCards name="Payment method" value={method} onChange={setMethod} options={paymentGateway.methods.map(m => ({ value: m, label: m }))} />
          <div className="rounded-xl border border-dashed border-sage/50 p-4">
            <Field label={<span className="flex items-center gap-2"><SimLabel>Reviewer control</SimLabel> Gateway outcome</span>} htmlFor="po">
              <Select id="po" value={outcome} onChange={e => setOutcome(e.target.value as SimOutcome)}><option value="success">Success</option><option value="failure">Failure</option><option value="pending">Pending</option></Select>
            </Field>
            <p className="mt-2 text-[12px] text-dim">{paymentGateway.label}. No card or bank details are collected.</p>
          </div>
        </div>
      )}
      {stage === 'processing' && <div className="py-8 text-center" role="status"><span className="mx-auto mb-3 block size-8 animate-spin rounded-full border-2 border-line border-t-gold" /><p>Processing your payment…</p><p className="text-sm text-dim">Please don’t close this window.</p></div>}
      {stage === 'success' && <div className="py-4 text-center"><CheckCircle2 className="mx-auto mb-3 size-10 text-ok" aria-hidden /><p className="text-lg">{inr(due)} received</p><p className="text-sm text-mute">The invoice is now marked paid and your balance is updated.</p></div>}
      {stage === 'failed' && <div className="py-4 text-center"><XCircle className="mx-auto mb-3 size-10 text-bad" aria-hidden /><p className="text-lg">The payment didn’t go through</p><p className="text-sm text-mute">{fail} You have not been charged and the invoice remains unpaid.</p></div>}
      {stage === 'pending' && <div className="py-4 text-center"><Clock className="mx-auto mb-3 size-10 text-warn" aria-hidden /><p className="text-lg">Waiting for your bank</p><p className="text-sm text-mute">We’ll update the invoice once the payment is confirmed. You can check status from the invoice.</p></div>}
    </Modal>
  )
}
