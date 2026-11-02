import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock, Download, XCircle } from 'lucide-react'
import { PublicHeader } from '../components/Layout'
import { Button, Card, Checkbox, ChoiceCards, EmptyState, Field, Input, KV, Notice, Select, SimLabel } from '../components/ui'
import { useApp } from '../data/store'
import { COUPONS, EXCHANGE_RATES, FX_NOTE, GST_RATE, planByCode } from '../data/config'
import { paymentGateway, type SimOutcome } from '../data/integrations'
import type { Application } from '../data/types'
import { inr, nowISO, toISODate } from '../lib/format'
import { downloadFile, invoiceDocument } from '../lib/download'

export default function Checkout() {
  const [params] = useSearchParams()
  const { state, actions } = useApp()
  const nav = useNavigate()
  const app = state.applications.find(a => a.id === params.get('app'))
  const plan = app ? planByCode(app.planCode) : undefined
  const [currency, setCurrency] = useState(app?.category === 'NRI' ? 'USD' : 'INR')
  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState<string>()
  const [couponErr, setCouponErr] = useState<string>()
  const [billName, setBillName] = useState(app?.name ?? '')
  const [gstin, setGstin] = useState('')
  const [terms, setTerms] = useState(false)
  const [method, setMethod] = useState<string>('UPI')
  const [outcome, setOutcome] = useState<SimOutcome>('success')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string>()
  const [result, setResult] = useState<{ status: 'success' | 'failed' | 'pending'; reference: string; reason?: string }>()

  const q = useMemo(() => {
    const base = plan?.priceINR ?? 0
    const c = coupon ? COUPONS[coupon] : undefined
    const discount = c ? (c.type === 'pct' ? Math.round((base * c.value) / 100) : c.value) : 0
    const taxable = base - discount
    const tax = Math.round(taxable * GST_RATE)
    return { base, discount, tax, total: taxable + tax }
  }, [plan, coupon])
  const fx = EXCHANGE_RATES.find(r => r.code === currency)!
  const conv = (n: number) => (currency === 'INR' ? inr(n) : `${fx.symbol}${(n * fx.perINR).toLocaleString('en-US', { maximumFractionDigits: 2 })}`)

  if (!app || !plan || !plan.priceINR)
    return (
      <div className="min-h-dvh"><PublicHeader />
        <main className="mx-auto max-w-2xl px-4 py-16"><EmptyState title="No application to check out" body="Start with an application so we can prepare your quote." action={<Button to="/apply">Apply for membership</Button>} /></main>
      </div>
    )

  const applyCoupon = () => {
    const code = couponInput.trim().toUpperCase()
    if (!COUPONS[code]) { setCouponErr('This coupon is not valid. Demo coupons: FOUNDER5, WELCOME10K'); return }
    setCoupon(code); setCouponErr(undefined)
  }

  const pay = async () => {
    if (!billName.trim()) return setErr('Enter the billing name.')
    if (!terms) return setErr('Please accept the terms to continue.')
    setErr(undefined); setBusy(true)
    const r = await paymentGateway.charge(q.total, method, outcome)
    setBusy(false)
    setResult({ status: r.status, reference: r.reference, reason: r.failureReason })
    const upd: Application = {
      ...app, status: r.status === 'success' ? 'active' : r.status === 'pending' ? 'payment_pending' : 'payment_failed',
      memberNo: r.status === 'success' ? 'EZITE' + Math.floor(200000 + Math.random() * 99999) : app.memberNo,
      checkout: { currency, totalINR: q.total, totalFx: currency === 'INR' ? undefined : q.total * fx.perINR, coupon, invoiceNo: r.status === 'success' ? 'EZ/26-27/M' + Math.floor(1000 + Math.random() * 8999) : undefined },
      audit: [...app.audit, { id: 'P' + Date.now(), at: nowISO(), actor: 'Payment gateway (simulated)', label: `Payment ${r.status} — ${r.reference}` }],
    }
    if (r.status === 'success') upd.audit.push({ id: 'P2' + Date.now(), at: nowISO(), actor: 'System', label: 'Membership activated; entitlement ledger opened; executive assignment queued' })
    actions.saveApplication(upd)
  }
  const pollPending = async () => {
    setBusy(true)
    const s = await paymentGateway.poll(result!.reference, 'success')
    setBusy(false)
    setResult({ ...result!, status: s })
    actions.saveApplication({ ...app, status: 'active', memberNo: 'EZITE' + Math.floor(200000 + Math.random() * 99999), checkout: { currency, totalINR: q.total, coupon, invoiceNo: 'EZ/26-27/M' + Math.floor(1000 + Math.random() * 8999) } })
  }
  const current = state.applications.find(a => a.id === app.id)!

  const invoice = () => invoiceDocument({
    number: current.checkout?.invoiceNo ?? 'PREVIEW', title: `${plan.name} membership`, issueDate: toISODate(new Date()), dueDate: toISODate(new Date()), billedTo: billName,
    lines: [{ description: `${plan.name} — ${plan.termYears}-year prepaid membership (draft price)`, qty: 1, rate: q.base - q.discount, taxRate: GST_RATE }],
    subtotal: q.base - q.discount, tax: q.tax, total: q.total, paid: q.total, due: 0, status: 'Paid (simulated)',
  })

  if (result?.status === 'success' || result?.status === 'pending' && current.status === 'active') {
    return (
      <div className="min-h-dvh"><PublicHeader />
        <main className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
          <Card className="p-8">
            <CheckCircle2 className="mb-4 size-9 text-ok" aria-hidden />
            <h1 className="serif text-3xl">Welcome to EZIT ELITE, {app.name.split(' ')[0]}</h1>
            <p className="mt-2 text-mute">Your {plan.name} membership is active. Your Personal Executive will call you within one working day for a welcome conversation.</p>
            <KV className="mt-6" items={[['Member ID', current.memberNo], ['Plan', plan.name], ['Amount', `${inr(q.total)}${currency !== 'INR' ? ` (≈ ${conv(q.total)})` : ''}`], ['Invoice', current.checkout?.invoiceNo], ['Payment reference', result.reference]]} />
            <Notice className="mt-6"><SimLabel /> No money moved. A production system activates only after a webhook-verified payment status.</Notice>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="secondary" icon={<Download className="size-4" />} onClick={() => downloadFile(`${current.checkout?.invoiceNo ?? 'invoice'}.html`.replace(/\//g, '-'), invoice())}>Download invoice</Button>
              <Button onClick={() => { actions.demoLogin(); nav('/home') }}>Continue to the demo portal</Button>
            </div>
            <p className="mt-4 text-[12.5px] text-dim">The demo portal shows the sample member Ravi Teja.</p>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div>
            <p className="eyebrow mb-2">Checkout <SimLabel className="ml-2">Simulated payment</SimLabel></p>
            <h1 className="serif text-3xl sm:text-4xl">Complete your membership</h1>
          </div>
          {result?.status === 'failed' && <Notice tone="bad" title="Payment failed" action={<Button size="sm" onClick={pay} loading={busy}>Retry</Button>}>{result.reason} Your membership has not been activated and you have not been charged.</Notice>}
          {result?.status === 'pending' && <Notice tone="warn" title="Awaiting confirmation from your bank" action={<Button size="sm" onClick={pollPending} loading={busy} icon={<Clock className="size-4" />}>Check status</Button>}>We’ll activate your membership once the payment is confirmed. Reference {result.reference}.</Notice>}
          <Card className="p-6">
            <h2 className="mb-4 text-[17px]">Billing details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Billing name" required htmlFor="bn"><Input id="bn" value={billName} onChange={e => setBillName(e.target.value)} /></Field>
              <Field label="GSTIN (optional)" hint="For business invoices in India" htmlFor="gst"><Input id="gst" value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())} maxLength={15} /></Field>
              <Field label="Currency" htmlFor="cur" hint={currency !== 'INR' ? `1 ${currency} ≈ ₹${(1 / fx.perINR).toFixed(2)} · indicative` : undefined}>
                <Select id="cur" value={currency} onChange={e => setCurrency(e.target.value)}>{EXCHANGE_RATES.map(r => <option key={r.code} value={r.code}>{r.code} — {r.label}</option>)}</Select>
              </Field>
            </div>
          </Card>
          <Card className="p-6">
            <h2 className="mb-4 text-[17px]">Payment method</h2>
            <ChoiceCards name="Payment method" value={method} onChange={setMethod} options={paymentGateway.methods.map(m => ({ value: m, label: m, description: m === 'International card' ? 'Subject to merchant approval' : undefined }))} />
            <div className="mt-5 rounded-xl border border-dashed border-sage/50 p-4">
              <Field label={<span className="flex items-center gap-2"><SimLabel>Reviewer control</SimLabel> Simulated gateway outcome</span>} htmlFor="outcome">
                <Select id="outcome" value={outcome} onChange={e => setOutcome(e.target.value as SimOutcome)}>
                  <option value="success">Success</option><option value="failure">Failure</option><option value="pending">Pending (bank confirmation)</option>
                </Select>
              </Field>
              <p className="mt-2 text-[12.5px] text-dim">No card or bank details are collected or stored.</p>
            </div>
          </Card>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="p-6">
            <p className="serif text-xl">{plan.name}</p>
            <p className="text-sm text-mute">{plan.termYears}-year prepaid · {plan.execHoursPerYear} h & {plan.consultationsPerYear} consultations per year</p>
            <div className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
              <div className="flex justify-between"><span className="text-mute">Membership (draft price)</span><span>{conv(q.base)}</span></div>
              {q.discount > 0 && <div className="flex justify-between text-ok"><span>{COUPONS[coupon!].label}</span><span>−{conv(q.discount)}</span></div>}
              <div className="flex justify-between"><span className="text-mute">GST 18%</span><span>{conv(q.tax)}</span></div>
              <div className="flex justify-between border-t border-line pt-3 text-base"><span>Total</span><span className="text-gold-soft">{conv(q.total)}</span></div>
              {currency !== 'INR' && <p className="text-[12px] text-dim">Charged as {inr(q.total)}. {FX_NOTE}</p>}
              <p className="text-[12px] text-dim">Tax treatment for overseas members (export of services) is to be confirmed by tax advisers.</p>
            </div>
            <div className="mt-5 flex gap-2">
              <Input aria-label="Coupon code" placeholder="Coupon code" value={couponInput} onChange={e => setCouponInput(e.target.value)} invalid={!!couponErr} />
              {coupon ? <Button variant="secondary" onClick={() => { setCoupon(undefined); setCouponInput('') }}>Remove</Button> : <Button variant="secondary" onClick={applyCoupon}>Apply</Button>}
            </div>
            {couponErr && <p className="mt-1.5 text-[12.5px] text-bad" role="alert">{couponErr}</p>}
            <div className="mt-5"><Checkbox checked={terms} onChange={setTerms} label={<>I agree to the <a className="link" href="/legal/terms" target="_blank">membership terms</a> and cancellation policy</>} /></div>
            {err && <p className="mt-2 text-[12.5px] text-bad" role="alert">{err}</p>}
            <Button className="mt-5 w-full" size="lg" onClick={pay} loading={busy} disabled={result?.status === 'pending'}>{busy ? 'Processing…' : `Pay ${conv(q.total)}`}</Button>
            <button className="mt-3 w-full text-center text-[13px] text-mute hover:text-ivory" onClick={() => downloadFile('invoice-preview.html', invoice())}>Preview invoice</button>
          </Card>
          {result?.status === 'failed' && <p className="flex items-center gap-2 px-2 text-[12.5px] text-dim"><XCircle className="size-4" aria-hidden /> Failed attempts are logged; retry is safe and idempotent.</p>}
        </aside>
      </main>
    </div>
  )
}
