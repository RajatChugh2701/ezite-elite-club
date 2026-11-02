import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, FileText } from 'lucide-react'
import { useApp } from '../data/store'
import { anniversary, balance, canAccessArea, plan } from '../data/selectors'
import { CONFIG_VERSION, CANCELLATION_POLICY, POLICY } from '../data/config'
import type { EntitlementKey, LedgerEntry } from '../data/types'
import { AccessDenied, Badge, Button, Card, EmptyState, Field, Input, KV, Meter, Modal, Notice, PageHeader, Select, StatusBadge, Tabs } from '../components/ui'
import { cx, fmtDate, fmtDateTime, inr } from '../lib/format'
import { downloadFile } from '../lib/download'

const ENT_LABEL: Record<EntitlementKey, string> = { hours: 'Executive hours', consult: 'Consultation credits', doc: 'Documentation credit' }
const KIND_LABEL: Record<LedgerEntry['kind'], [string, 'gold' | 'green' | 'red' | 'amber' | 'blue' | 'neutral']> = {
  grant: ['Grant', 'gold'], hold: ['Hold', 'amber'], release: ['Hold released', 'neutral'], consume: ['Used', 'blue'], reversal: ['Reversal', 'green'], adjustment: ['Adjustment', 'neutral'], expiry: ['Expired', 'red'],
}
const fmtQty = (ent: EntitlementKey, n: number) => (ent === 'doc' ? (n < 0 ? '−' : '+') + inr(n) : `${n > 0 ? '+' : '−'}${Math.abs(n)}${ent === 'hours' ? ' h' : ''}`)
const fmtBal = (ent: EntitlementKey, n: number) => (ent === 'doc' ? inr(n) : `${n}${ent === 'hours' ? ' h' : ''}`)

type Tab = 'overview' | 'benefits' | 'ledger' | 'documents'

export default function Membership() {
  const { state } = useApp()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'overview'
  const [explain, setExplain] = useState<EntitlementKey>()
  if (!canAccessArea(state, 'membership')) return <AccessDenied what="membership details" />
  const p = plan(state)
  const m = state.membership
  const setTab = (t: Tab) => setParams(t === 'overview' ? {} : { tab: t })
  const cancelReq = state.requests.find(r => r.kind === 'cancellation' && !['cancelled', 'completed'].includes(r.status))

  return (
    <div>
      <PageHeader eyebrow="My membership" title={p.name} subtitle={<>Member ID {m.memberNo} · <StatusBadge status={m.status} /></>}
        actions={<Button variant="secondary" to="/membership/cancel">Cancellation & refund estimate</Button>} />
      {cancelReq && <Notice tone="warn" className="mb-6" title="Cancellation under review" action={<Button size="sm" variant="secondary" to={`/requests/${cancelReq.id}`}>View request</Button>}>Your membership stays active until the review is complete.</Notice>}
      <Tabs label="Membership sections" value={tab} onChange={setTab} tabs={[{ value: 'overview', label: 'Overview' }, { value: 'benefits', label: 'Benefits' }, { value: 'ledger', label: 'Usage & ledger' }, { value: 'documents', label: 'Documents & terms' }]} />
      {tab === 'overview' && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
          <Card className="p-6">
            <KV items={[
              ['Plan', p.name], ['Category', p.category === 'NRI' ? 'Non-Resident Indian' : p.category === 'IND' ? 'India-based' : 'Corporate'], ['Member ID', m.memberNo],
              ['Status', <StatusBadge key="s" status={m.status} />], ['Start date', fmtDate(m.startDate)], ['Valid until', fmtDate(m.validUntil)],
              ['Current benefit year', `${fmtDate(m.benefitYearStart)} – ${fmtDate(m.benefitYearEnd)}`], ['Next anniversary (allowances reset)', fmtDate(anniversary(state))],
              ['Amount paid', `${inr(m.amountPaidINR)} + ${inr(m.taxPaidINR)} GST`], ['Plan configuration', CONFIG_VERSION],
            ]} />
          </Card>
          <div className="space-y-4">
            {(['hours', 'consult', 'doc'] as EntitlementKey[]).map(ent => {
              const b = balance(state, ent)
              return (
                <Card key={ent} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-mute">{ENT_LABEL[ent]}</p>
                      <p className="mt-1 text-2xl">{fmtBal(ent, b.available)} <span className="text-base text-mute">available of {fmtBal(ent, b.total)}</span></p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setExplain(ent)}>How is this calculated?</Button>
                  </div>
                  <div className="my-3"><Meter value={b.available} max={b.total} label={`${ENT_LABEL[ent]} available`} /></div>
                  <p className="text-[12.5px] text-dim">Used {fmtBal(ent, b.used)} · On hold {fmtBal(ent, b.held)}{b.reversed ? ` · Reversed ${fmtBal(ent, b.reversed)}` : ''}</p>
                </Card>
              )
            })}
          </div>
        </div>
      )}
      {tab === 'benefits' && (
        <div className="grid gap-5 md:grid-cols-2">
          <Card className="p-6">
            <h2 className="mb-4 text-lg">Included each benefit year</h2>
            <ul className="space-y-3 text-sm">
              <li><span className="text-ivory">{p.execHoursPerYear} Personal Executive hours</span><br /><span className="text-dim">Holds are placed when you book; actual time is settled after the visit. Out-of-bundle hours: {inr(POLICY.outOfBundleHourlyINR)}/h + GST.</span></li>
              <li><span className="text-ivory">{p.consultationsPerYear} expert consultations</span><br /><span className="text-dim">Consumed when a session is completed (or cancelled less than {POLICY.freeCancelHours} h before). Specialist sessions are charged separately.</span></li>
              <li><span className="text-ivory">Documentation credit up to {inr(p.docCreditINR)}</span><br /><span className="text-dim">Applied to approved paperwork charges after a validated trigger event and claimant authority. Not a cash wallet.</span></li>
              {p.highlights.map(h => <li key={h} className="text-ivory">{h}</li>)}
            </ul>
            <Button className="mt-6" variant="secondary" to="/services">Browse services</Button>
          </Card>
          <Card className="p-6">
            <h2 className="mb-4 text-lg">Not included</h2>
            <ul className="space-y-2 text-sm text-mute">{p.exclusions.map(x => <li key={x}>• {x}</li>)}</ul>
            <Notice className="mt-6" tone="warn" title="Draft plan rules">Hour allotment, documentation credit and anniversary rules are draft configuration values pending policy decisions.</Notice>
          </Card>
        </div>
      )}
      {tab === 'ledger' && <Ledger onExplain={setExplain} />}
      {tab === 'documents' && (
        <div className="grid gap-5 md:grid-cols-2">
          <Card className="p-6">
            <h2 className="mb-4 text-lg">Membership documents</h2>
            <ul className="divide-y divide-line">
              {[
                ['Membership certificate', `<h1>EZIT ELITE</h1><p>This certifies that ${state.member.name} holds ${p.name} membership ${m.memberNo}, valid ${fmtDate(m.startDate)} to ${fmtDate(m.validUntil)}.</p>`],
                ['Welcome letter', `<h1>Welcome</h1><p>Dear ${state.member.firstName}, your Personal Executive is ready to help.</p>`],
                ['Membership invoice', ''],
              ].map(([name, html]) => (
                <li key={name} className="flex items-center justify-between gap-3 py-3">
                  <span className="flex items-center gap-2.5 text-sm"><FileText className="size-4 text-gold" aria-hidden />{name}</span>
                  {html ? <Button size="sm" variant="ghost" icon={<Download className="size-4" />} onClick={() => downloadFile(`${name}.html`, `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;max-width:640px;margin:40px auto">${html}<p style="color:#888;font-size:12px">Prototype document — fictional data.</p></body>`)}>Download</Button>
                    : <Button size="sm" variant="ghost" to="/payments/invoices/INV-C">Open</Button>}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-6">
            <h2 className="mb-4 text-lg">Terms & cancellation</h2>
            <p className="text-sm text-mute">Cancellation requests are reviewed manually. The estimator shows an illustrative figure based on the configured example policy ({CANCELLATION_POLICY.label.toLowerCase()}).</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="secondary" to="/legal/terms">Membership terms</Button>
              <Button variant="secondary" to="/membership/cancel">Cancellation & refund estimator</Button>
            </div>
          </Card>
        </div>
      )}
      <ExplainModal ent={explain} onClose={() => setExplain(undefined)} />
    </div>
  )
}

function Ledger({ onExplain }: { onExplain: (e: EntitlementKey) => void }) {
  const { state } = useApp()
  const [params, setParams] = useSearchParams()
  const ent = (params.get('ent') as EntitlementKey | null) ?? 'all'
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [kind, setKind] = useState('all')
  const rows = useMemo(() => state.ledger
    .filter(e => (ent === 'all' || e.ent === ent) && (kind === 'all' || e.kind === kind) && (!from || e.at.slice(0, 10) >= from) && (!to || e.at.slice(0, 10) <= to))
    .sort((a, b) => b.at.localeCompare(a.at)), [state.ledger, ent, kind, from, to])
  const setEnt = (v: string) => { const p = new URLSearchParams(params); p.set('tab', 'ledger'); if (v === 'all') p.delete('ent'); else p.set('ent', v); setParams(p) }

  return (
    <div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Entitlement" htmlFor="lent"><Select id="lent" value={ent} onChange={e => setEnt(e.target.value)}><option value="all">All</option><option value="hours">Executive hours</option><option value="consult">Consultation credits</option><option value="doc">Documentation credit</option></Select></Field>
        <Field label="Entry type" htmlFor="lkind"><Select id="lkind" value={kind} onChange={e => setKind(e.target.value)}><option value="all">All</option>{Object.entries(KIND_LABEL).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
        <Field label="From" htmlFor="lfrom"><Input id="lfrom" type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field>
        <Field label="To" htmlFor="lto"><Input id="lto" type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
        <div className="flex items-end gap-2">
          <Button variant="secondary" className="w-full" onClick={() => { setKind('all'); setFrom(''); setTo(''); setEnt('all') }}>Clear filters</Button>
        </div>
      </div>
      {ent !== 'all' && <p className="mb-3 text-sm text-mute">Current balance: <span className="text-ivory">{fmtBal(ent, balance(state, ent).available)}</span> · <button className="link" onClick={() => onExplain(ent)}>How is this calculated?</button></p>}
      {rows.length === 0 ? <EmptyState title="No ledger entries match" body="Try widening the date range or clearing filters." /> : (
        <Card className="overflow-hidden">
          <table className="hidden w-full text-sm md:table">
            <thead className="border-b border-line text-left text-[12px] uppercase tracking-wider text-dim">
              <tr><th className="px-5 py-3 font-medium">Date</th><th className="px-3 py-3 font-medium">Description</th><th className="px-3 py-3 font-medium">Entitlement</th><th className="px-3 py-3 font-medium">Type</th><th className="px-5 py-3 text-right font-medium">Quantity</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(e => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-5 py-3 text-mute">{fmtDate(e.at)}</td>
                  <td className="px-3 py-3">{e.description}{e.refId && <> · <RefLink id={e.refId} type={e.refType} /></>}<span className="block text-[12px] text-dim">{e.actor}</span></td>
                  <td className="px-3 py-3 text-mute">{ENT_LABEL[e.ent]}</td>
                  <td className="px-3 py-3"><Badge tone={KIND_LABEL[e.kind][1]}>{KIND_LABEL[e.kind][0]}</Badge></td>
                  <td className={cx('px-5 py-3 text-right tabular-nums', e.amount < 0 ? 'text-ivory' : 'text-ok')}>{fmtQty(e.ent, e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="divide-y divide-line md:hidden">
            {rows.map(e => (
              <li key={e.id} className="p-4">
                <div className="flex justify-between gap-3"><span className="text-sm">{e.description}</span><span className="shrink-0 tabular-nums">{fmtQty(e.ent, e.amount)}</span></div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-dim">{fmtDate(e.at)} · {ENT_LABEL[e.ent]} <Badge tone={KIND_LABEL[e.kind][1]}>{KIND_LABEL[e.kind][0]}</Badge>{e.refId && <RefLink id={e.refId} type={e.refType} />}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <p className="mt-3 text-[12px] text-dim">The ledger is append-only: corrections appear as reversals or adjustments, never as edits. Effective {fmtDateTime(new Date().toISOString())}.</p>
    </div>
  )
}

const RefLink = ({ id, type }: { id: string; type?: string }) => (
  <Link to={type === 'financeCase' ? `/financial/${id}` : `/requests/${id}`} className="link text-[12.5px]">{id}</Link>
)

function ExplainModal({ ent, onClose }: { ent?: EntitlementKey; onClose: () => void }) {
  const { state } = useApp()
  if (!ent) return null
  const b = balance(state, ent)
  const rows: [string, string][] = [
    ['Granted this benefit year', fmtBal(ent, b.granted)],
    ['− Used (settled)', fmtBal(ent, b.consumed)],
    ['+ Reversed', fmtBal(ent, b.reversed)],
    ['− On hold for upcoming bookings', fmtBal(ent, b.held)],
    ...(b.adjusted ? [['± Adjustments', fmtBal(ent, b.adjusted)] as [string, string]] : []),
    ...(b.expired ? [['− Expired', fmtBal(ent, b.expired)] as [string, string]] : []),
  ]
  return (
    <Modal open onClose={onClose} title={`${ENT_LABEL[ent]} — how it’s calculated`} footer={<Button variant="secondary" to={`/membership?tab=ledger&ent=${ent}`} onClick={onClose}>Open ledger</Button>}>
      <KV items={[...rows, ['= Available now', fmtBal(ent, b.available)]]} />
      <p className="mt-4 text-[13px] text-dim">As of {fmtDateTime(new Date().toISOString())}. Holds are released when a booking is cancelled in time, or converted to usage when it is completed.</p>
    </Modal>
  )
}
