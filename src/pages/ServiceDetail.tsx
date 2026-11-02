import { useParams } from 'react-router-dom'
import { Check, FileText, Minus } from 'lucide-react'
import { useApp } from '../data/store'
import { canRequestService } from '../data/selectors'
import { CITIES, serviceById, categoryName, POLICY } from '../data/config'
import { AccessDenied, Badge, Button, Card, KV, Notice, PageHeader } from '../components/ui'
import { inr } from '../lib/format'
import { pricingLabel } from './Services'

export default function ServiceDetail() {
  const { id } = useParams()
  const { state } = useApp()
  const s = serviceById(id)
  if (!s) return <AccessDenied reason="not_found" what="service" />
  const pr = pricingLabel(s)
  const allowed = canRequestService(state, s.id)
  const base = s.rateUnit === 'flat' ? s.rateINR : s.rateINR * s.expectedHours
  const disc = s.discountPct ? Math.round((base * s.discountPct) / 100) : 0

  return (
    <div>
      <PageHeader back={{ to: '/services', label: 'All services' }} eyebrow={categoryName(s.categoryId)} title={s.name} subtitle={s.summary}
        actions={allowed ? <Button to={`/request/new?service=${s.id}`}>Request this service</Button> : <Badge tone="neutral">Not in your delegated permissions</Badge>} />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Card className="p-6">
            <h2 className="mb-2 text-lg">What it involves</h2>
            <p className="text-mute">{s.description}</p>
            <h3 className="mb-2 mt-6 text-[15px]">Who can receive it</h3>
            <p className="text-sm text-mute">{s.whoCanReceive}</p>
          </Card>
          <div className="grid gap-5 sm:grid-cols-2">
            <Card className="p-6">
              <h2 className="mb-3 text-[15px]">We’ll need</h2>
              <ul className="space-y-2 text-sm text-mute">
                {s.requiredInfo.map(x => <li key={x} className="flex gap-2"><Check className="mt-0.5 size-4 text-gold" aria-hidden />{x}</li>)}
                {s.requiredDocs.map(x => <li key={x} className="flex gap-2"><FileText className="mt-0.5 size-4 text-gold" aria-hidden />{x}</li>)}
                {!s.requiredDocs.length && <li className="text-dim">No documents required.</li>}
              </ul>
            </Card>
            <Card className="p-6">
              <h2 className="mb-3 text-[15px]">Not included</h2>
              <ul className="space-y-2 text-sm text-mute">{s.exclusions.map(x => <li key={x} className="flex gap-2"><Minus className="mt-0.5 size-4" aria-hidden />{x}</li>)}</ul>
            </Card>
          </div>
          <Card className="p-6">
            <h2 className="mb-2 text-[15px]">Cancellation & rescheduling</h2>
            <p className="text-sm text-mute">{s.cancellationPolicy}</p>
          </Card>
        </div>
        <Card className="h-fit p-6">
          <h2 className="mb-3 text-lg">Pricing & availability</h2>
          <Badge tone={pr.tone}>{pr.text}</Badge>
          <KV className="mt-4" items={[
            ['Funding', s.funding === 'bundle_hours' ? 'Membership bundle (executive hours)' : 'Charged — prepaid or postpaid'],
            ...(s.funding === 'bundle_hours'
              ? [['Hours beyond your bundle', `${inr(POLICY.outOfBundleHourlyINR)}/h + 18% GST`] as [string, string]]
              : [['Standard price', s.rateUnit === 'flat' ? inr(s.rateINR) : `${inr(s.rateINR)}/h`] as [string, string], ...(disc ? [['Your member price', `${inr(base - disc)} (${s.discountPct}% off)`] as [string, string]] : []), ['GST', `${Math.round(s.taxRate * 100)}%`] as [string, string]]),
            ['Typical duration', s.duration], ['Expected executive time', `${s.expectedHours} h`],
            ['Response', s.responseTime], ...(s.slaHours ? [['Service SLA', `${s.slaHours} h`] as [string, string]] : []),
            ['Delivery', s.delivery.map(d => (d === 'in_person' ? 'In person' : 'Remote')).join(', ')],
            ['Cities', s.cities.map(c => CITIES.find(x => x.id === c)?.name).join(', ')],
          ]} />
          {s.negotiatedNote && <Notice className="mt-4" tone="ok">{s.negotiatedNote}</Notice>}
          <h3 className="mb-2 mt-5 text-[13px] text-mute">Additional charges</h3>
          <ul className="space-y-1 text-[13px] text-dim">{s.additionalCharges.map(x => <li key={x}>• {x}</li>)}</ul>
          {allowed && <Button className="mt-6 w-full" to={`/request/new?service=${s.id}`}>Request this service</Button>}
        </Card>
      </div>
    </div>
  )
}
