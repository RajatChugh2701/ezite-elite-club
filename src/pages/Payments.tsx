import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Download, FileText, Receipt, Search } from 'lucide-react'
import { useApp } from '../data/store'
import { balance, canAccessArea, invoiceTotals, unbilledUsage, unpaidBalance } from '../data/selectors'
import { POLICY } from '../data/config'
import type { EntitlementKey, LedgerEntry } from '../data/types'
import { AccessDenied, Badge, Button, Card, EmptyState, Field, Input, KV, Meter, Modal, Notice, PageHeader, Select, StatusBadge, Tabs, Textarea, useUI } from '../components/ui'
import { Timeline } from './RequestDetail'
import { addDays, cx, fmtDate, fmtDateTime, inr, toISODate } from '../lib/format'
import { downloadFile } from '../lib/download'

type Tab = 'overview' | 'invoices' | 'transactions' | 'utilization' | 'statement' | 'refunds'

export default function Payments() {
  const { state } = useApp()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'overview'
  if (!canAccessArea(state, 'payments')) return <AccessDenied what="payments and invoices" />
  return (
    <div>
      <PageHeader eyebrow="Payments & wallet" title="Payments, usage & invoices" subtitle="Cash payments, postpaid dues and your membership credits are kept separate so balances never mix." />
      <Tabs label="Payments sections" value={tab} onChange={t => setParams(t === 'overview' ? {} : { tab: t })} tabs={[
        { value: 'overview', label: 'Overview' }, { value: 'invoices', label: 'Invoices' }, { value: 'transactions', label: 'Transactions' },
        { value: 'utilization', label: 'Entitlement usage' }, { value: 'statement', label: 'Postpaid statement' }, { value: 'refunds', label: 'Refunds & disputes' },
      ]} />
      {tab === 'overview' && <Overview />}
      {tab === 'invoices' && <Invoices />}
      {tab === 'transactions' && <Transactions />}
      {tab === 'utilization' && <Utilization />}
      {tab === 'statement' && <Statement />}
      {tab === 'refunds' && <Refunds />}
    </div>
  )
}

function Tile({ label, value, sub, tone, action }: { label: string; value: string; sub: string; tone?: 'bad'; action?: React.ReactNode }) {
  return (
    <Card className="flex flex-col p-5">
      <p className="text-[13px] text-mute">{label}</p>
      <p className={cx('mt-2 text-2xl tabular-nums', tone === 'bad' && 'text-bad')}>{value}</p>
      <p className="mt-1 text-[12.5px] text-dim">{sub}</p>
      {action && <div className="mt-auto pt-3">{action}</div>}
    </Card>
  )
}

function Overview() {
  const { state } = useApp()
  const unpaid = unpaidBalance(state)
  const yearAgo = addDays(new Date(), -365).toISOString()
  const paid12 = state.payments.filter(p => p.status === 'success' && p.at >= yearAgo).reduce((a, p) => a + p.amount, 0)
  const doc = balance(state, 'doc')
  const unbilled = unbilledUsage(state)
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Outstanding balance" value={inr(unpaid)} sub={unpaid ? 'Across unpaid invoices' : 'Nothing due'} tone={unpaid ? 'bad' : undefined} action={<Link className="link text-sm" to="/payments?tab=invoices">View invoices</Link>} />
        <Tile label="Paid — last 12 months" value={inr(paid12)} sub="Successful payments" action={<Link className="link text-sm" to="/payments?tab=transactions">Transactions</Link>} />
        <Tile label="Unbilled postpaid usage" value={inr(unbilled.total)} sub={`Credit limit ${inr(POLICY.postpaidCreditLimitINR)}`} action={<Link className="link text-sm" to="/payments?tab=statement">Statement</Link>} />
        <Tile label="Documentation credit" value={inr(doc.available)} sub="Membership credit — not cash, not withdrawable" action={<Link className="link text-sm" to="/payments?tab=utilization">Usage</Link>} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5"><div className="mb-3 flex items-center justify-between"><h2 className="text-[17px]">Recent invoices</h2><Link className="link text-sm" to="/payments?tab=invoices">All</Link></div><InvoiceList limit={4} /></Card>
        <Card className="p-5"><div className="mb-3 flex items-center justify-between"><h2 className="text-[17px]">Recent transactions</h2><Link className="link text-sm" to="/payments?tab=transactions">All</Link></div><TxList limit={4} /></Card>
      </div>
      <Card className="p-5">
        <h2 className="mb-4 text-[17px]">Entitlement utilisation this benefit year</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {(['hours', 'consult', 'doc'] as EntitlementKey[]).map(e => {
            const b = balance(state, e)
            const f = (n: number) => (e === 'doc' ? inr(n) : `${n}${e === 'hours' ? ' h' : ''}`)
            return <div key={e}><p className="text-sm text-mute">{ENT[e]}</p><p className="my-1 text-lg">{f(b.used)} used · {f(b.available)} left</p><Meter value={b.used} max={b.total} label={`${ENT[e]} used`} tone="sage" /></div>
          })}
        </div>
      </Card>
    </div>
  )
}
const ENT: Record<EntitlementKey, string> = { hours: 'Executive hours', consult: 'Consultation credits', doc: 'Documentation credit' }

function InvoiceList({ limit, status = 'all', q = '' }: { limit?: number; status?: string; q?: string }) {
  const { state } = useApp()
  const rows = state.invoices.map(i => ({ i, t: invoiceTotals(i, state) }))
    .filter(({ i, t }) => (status === 'all' || (status === 'due' ? t.due > 0 : t.status === status)) && (!q || `${i.number} ${i.title}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.i.issueDate.localeCompare(a.i.issueDate)).slice(0, limit)
  if (!rows.length) return <EmptyState icon={<Receipt className="size-6" />} title="No invoices match" />
  return (
    <ul className="divide-y divide-line">
      {rows.map(({ i, t }) => (
        <li key={i.id}><Link to={`/payments/invoices/${i.id}`} className="flex flex-wrap items-center gap-3 py-3 hover:text-gold-soft">
          <FileText className="size-4 text-gold" aria-hidden />
          <span className="min-w-0 flex-1"><span className="block text-sm text-ivory">{i.title}</span><span className="block text-[12px] text-dim">{i.number} · issued {fmtDate(i.issueDate)} · due {fmtDate(i.dueDate)}{i.disputed ? ' · query open' : ''}</span></span>
          <span className="text-right"><span className="block text-sm tabular-nums">{inr(t.due > 0 ? t.due : t.total)}</span><StatusBadge status={t.status} /></span>
        </Link></li>
      ))}
    </ul>
  )
}

function Invoices() {
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="relative min-w-56 flex-1"><span className="sr-only">Search invoices</span><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-dim" aria-hidden /><Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search invoice number or service" className="pl-10" /></label>
        <Select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)} className="w-44"><option value="all">All</option><option value="due">Amount due</option><option value="overdue">Overdue</option><option value="paid">Paid</option><option value="processing">Processing</option><option value="credited">Credited</option></Select>
      </div>
      <Card className="px-5"><InvoiceList status={status} q={q} /></Card>
    </div>
  )
}

function TxList({ limit, q = '', status = 'all' }: { limit?: number; q?: string; status?: string }) {
  const { state } = useApp()
  const rows = state.payments.map(p => {
    const inv = state.invoices.find(i => i.id === p.invoiceId)!
    const t = invoiceTotals(inv, state)
    const refund = state.refunds.find(r => r.invoiceId === inv.id)
    return { p, inv, t, refund }
  }).filter(({ p, inv }) => (status === 'all' || p.status === status) && (!q || `${inv.title} ${inv.number} ${p.reference} ${p.method}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.p.at.localeCompare(a.p.at)).slice(0, limit)
  if (!rows.length) return <EmptyState title="No transactions match" />
  return (
    <ul className="divide-y divide-line">
      {rows.map(({ p, inv, t, refund }) => (
        <li key={p.id} className="flex flex-wrap items-start gap-3 py-3">
          <span className="min-w-0 flex-1">
            <Link to={`/payments/invoices/${inv.id}`} className="block text-sm text-ivory hover:text-gold-soft">{inv.title}</Link>
            <span className="block text-[12px] text-dim">{fmtDateTime(p.at)} · {p.method} · {inv.number} · ref {p.reference}{t.tax ? ` · incl. GST ${inr(Math.round(t.tax * p.amount / t.total))}` : ''}</span>
            {p.failureReason && <span className="block text-[12px] text-bad">{p.failureReason}</span>}
            {refund && <span className="block text-[12px] text-info">Refund {refund.id}: {refund.status.replace('_', ' ')}</span>}
          </span>
          <span className="text-right"><span className="block text-sm tabular-nums">{inr(p.amount)}</span><StatusBadge status={p.status} /></span>
        </li>
      ))}
    </ul>
  )
}

function Transactions() {
  const { state, actions } = useApp()
  const { toast } = useUI()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [older, setOlder] = useState(toISODate(addDays(new Date(), -730)))
  const exportCsv = () => {
    const yearAgo = addDays(new Date(), -365).toISOString()
    const rows = state.payments.filter(p => p.at >= yearAgo).map(p => { const inv = state.invoices.find(i => i.id === p.invoiceId)!; return [p.at, inv.number, inv.title, p.amount, p.status, p.method, p.reference] })
    downloadFile('ezit-transactions-12m.csv', 'date,invoice,service,amount,status,method,reference\n' + rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv')
  }
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="relative min-w-56 flex-1"><span className="sr-only">Search transactions</span><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-dim" aria-hidden /><Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search service, invoice, reference or method" className="pl-10" /></label>
        <Select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)} className="w-44"><option value="all">All statuses</option><option value="success">Successful</option><option value="failed">Failed</option><option value="pending">Pending</option></Select>
        <Button variant="secondary" icon={<Download className="size-4" />} onClick={exportCsv}>Export 12 months</Button>
      </div>
      <Card className="px-5"><TxList q={q} status={status} /></Card>
      <Card className="mt-5 flex flex-wrap items-end gap-3 p-5">
        <Field label="Need records older than 12 months?" htmlFor="older" hint="Generated in the background; you’ll be notified when ready."><Input id="older" type="date" value={older} onChange={e => setOlder(e.target.value)} className="w-48" /></Field>
        <Button variant="secondary" onClick={() => { actions.queueSpendReport(older); toast({ tone: 'info', title: 'Report requested', body: 'We’ll notify you when it is ready.' }) }}>Request report</Button>
      </Card>
    </div>
  )
}

const KIND: Record<LedgerEntry['kind'], string> = { grant: 'Grant', hold: 'Pending hold', release: 'Hold released', consume: 'Used', reversal: 'Reversal', adjustment: 'Adjustment', expiry: 'Expiry' }

function Utilization() {
  const { state } = useApp()
  const [ent, setEnt] = useState<EntitlementKey>('hours')
  const [entry, setEntry] = useState<LedgerEntry>()
  const b = balance(state, ent)
  const f = (n: number) => (ent === 'doc' ? inr(n) : `${n}${ent === 'hours' ? ' h' : ''}`)
  const rows = state.ledger.filter(e => e.ent === ent).sort((x, y) => y.at.localeCompare(x.at))
  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Entitlement">{(['hours', 'consult', 'doc'] as EntitlementKey[]).map(e => <Button key={e} size="sm" variant={ent === e ? 'primary' : 'secondary'} onClick={() => setEnt(e)}>{ENT[e]}</Button>)}</div>
      <div className="mb-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[['Granted', b.granted], ['Used', b.used], ['Remaining', b.available], ['Pending holds', b.held], ['Reversals', b.reversed], ['Adjustments', b.adjusted]].map(([l, v]) => (
          <Card key={l as string} className="p-4"><p className="text-[12px] text-dim">{l}</p><p className="mt-1 text-lg tabular-nums">{f(v as number)}</p></Card>
        ))}
      </div>
      <Card className="px-5">
        <ul className="divide-y divide-line">
          {rows.map(e => (
            <li key={e.id}><button onClick={() => setEntry(e)} className="flex w-full flex-wrap items-center gap-3 py-3 text-left hover:text-gold-soft">
              <span className="min-w-0 flex-1"><span className="block text-sm">{e.description}</span><span className="block text-[12px] text-dim">{fmtDate(e.at)} · {KIND[e.kind]}{e.refId ? ` · ${e.refId}` : ''}</span></span>
              <span className={cx('tabular-nums', e.amount > 0 ? 'text-ok' : 'text-ivory')}>{e.amount > 0 ? '+' : '−'}{f(Math.abs(e.amount))}</span>
            </button></li>
          ))}
        </ul>
      </Card>
      {entry && (
        <Modal open onClose={() => setEntry(undefined)} title="Ledger entry" footer={entry.refId ? <Button variant="secondary" to={entry.refType === 'financeCase' ? `/financial/${entry.refId}` : `/requests/${entry.refId}`}>Open {entry.refId}</Button> : undefined}>
          <KV items={[['Entry ID', entry.id], ['Entitlement', ENT[entry.ent]], ['Type', KIND[entry.kind]], ['Quantity', `${entry.amount > 0 ? '+' : '−'}${f(Math.abs(entry.amount))}`], ['Description', entry.description], ['Recorded', fmtDateTime(entry.at)], ['By', entry.actor], ['Reference', entry.refId ?? '—']]} />
          <p className="mt-3 text-[12.5px] text-dim">Ledger entries are append-only. Corrections are recorded as new reversal or adjustment entries.</p>
        </Modal>
      )}
    </div>
  )
}

function Statement() {
  const { state } = useApp()
  const u = unbilledUsage(state)
  const room = POLICY.postpaidCreditLimitINR - u.total - unpaidBalance(state)
  const cycleEnd = new Date(); cycleEnd.setMonth(cycleEnd.getMonth() + 1, 0)
  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <Card className="p-5">
        <h2 className="mb-1 text-[17px]">Current cycle — unbilled usage</h2>
        <p className="mb-4 text-[13px] text-dim">Cycle closes {fmtDate(toISODate(cycleEnd))}. Your statement is issued the next working day with 7-day payment terms (demo policy).</p>
        {u.items.length ? (
          <ul className="divide-y divide-line">{u.items.map((i, n) => <li key={n} className="flex justify-between gap-3 py-2.5 text-sm"><span>{i.label}<span className="block text-[12px] text-dim">{i.ref} · {fmtDate(i.date)}</span></span><span className="tabular-nums">{inr(i.amount)}</span></li>)}
            <li className="flex justify-between py-3"><span>Estimated total (incl. GST)</span><span className="text-gold-soft">{inr(u.total)}</span></li></ul>
        ) : <EmptyState title="No unbilled usage" body="Postpaid services and approved extras will appear here before they are invoiced." />}
        <Notice className="mt-4">Pending items may change after your executive submits final hours and receipts. Government fees are billed at actuals.</Notice>
      </Card>
      <div className="space-y-5">
        <Card className="p-5"><KV items={[['Credit limit', inr(POLICY.postpaidCreditLimitINR)], ['Unbilled', inr(u.total)], ['Unpaid invoices', inr(unpaidBalance(state))], ['Available', inr(Math.max(0, room))], ['Approval threshold', `Charges above ${inr(POLICY.approvalThresholdINR)} need your explicit approval`]]} /></Card>
        <Card className="p-5"><h2 className="mb-2 text-[15px]">Past statements</h2><InvoiceList status="all" q="statement" /></Card>
      </div>
    </div>
  )
}

function Refunds() {
  const { state, actions } = useApp()
  const { toast } = useUI()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const paid = state.invoices.filter(i => invoiceTotals(i, state).paid > 0)
  const [invoiceId, setInvoice] = useState(paid[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string>()
  const submit = () => {
    const r = actions.requestRefund({ invoiceId, amount: Number(amount), reason })
    if (!r.ok) return setErr(r.error)
    toast({ tone: 'ok', title: 'Refund request submitted', body: 'It will be reviewed — this is not an approved refund yet.' })
    setOpen(false); setAmount(''); setReason('')
  }
  const disputes = state.supportCases.filter(c => c.type === 'billing')
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-[17px]">Refund requests</h2><Button size="sm" onClick={() => setOpen(true)} disabled={!paid.length}>Request a refund</Button></div>
        {state.refunds.length ? state.refunds.map(r => (
          <div key={r.id} className="mb-4 rounded-xl border border-line p-4">
            <div className="flex items-start justify-between gap-2"><p className="text-sm">{r.id} · {inr(r.amount)}<span className="block text-[12.5px] text-dim">{state.invoices.find(i => i.id === r.invoiceId)?.number} · {r.reason}</span></p><Badge tone={r.status === 'approved' || r.status === 'paid' ? 'green' : r.status === 'rejected' ? 'red' : 'blue'}>{r.status.replace('_', ' ')}</Badge></div>
            <div className="mt-3"><Timeline events={r.timeline} /></div>
          </div>
        )) : <EmptyState title="No refund requests" />}
        <p className="text-[12.5px] text-dim">Eligibility depends on the service’s cancellation policy. A request is reviewed by finance and is not an approved refund until confirmed.</p>
      </Card>
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-[17px]">Billing queries & disputes</h2><Button size="sm" variant="secondary" onClick={() => nav('/support?new=billing')}>Raise a billing query</Button></div>
        {disputes.length ? <ul className="divide-y divide-line">{disputes.map(c => <li key={c.id}><Link to={`/support/${c.id}`} className="flex items-center justify-between gap-3 py-3 text-sm hover:text-gold-soft"><span>{c.subject}<span className="block text-[12px] text-dim">{c.id} · {fmtDate(c.createdAt)}</span></span><StatusBadge status={c.status} /></Link></li>)}</ul> : <EmptyState title="No billing queries" />}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Request a refund" footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit}>Submit request</Button></>}>
        <div className="space-y-4">
          <Field label="Invoice" htmlFor="ri"><Select id="ri" value={invoiceId} onChange={e => setInvoice(e.target.value)}>{paid.map(i => <option key={i.id} value={i.id}>{i.number} · {i.title} · paid {inr(invoiceTotals(i, state).paid)}</option>)}</Select></Field>
          <Field label="Amount (₹)" htmlFor="ra"><Input id="ra" type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)} /></Field>
          <Field label="Reason" htmlFor="rr"><Textarea id="rr" value={reason} onChange={e => setReason(e.target.value)} /></Field>
          {err && <Notice tone="bad">{err}</Notice>}
        </div>
      </Modal>
    </div>
  )
}
