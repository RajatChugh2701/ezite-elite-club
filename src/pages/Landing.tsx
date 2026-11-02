import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Building2, Check, ChevronDown, Globe2, Home as HomeIcon, MapPin, Minus } from 'lucide-react'
import { PublicHeader } from '../components/Layout'
import { Badge, Button, Card, Notice, Segmented, SimLabel } from '../components/ui'
import { CITIES, CONFIG_VERSION, EXCHANGE_RATES, FAQ, FX_NOTE, PLANS, SERVICE_CATEGORIES } from '../data/config'
import type { MemberCategory } from '../data/types'
import { cx } from '../lib/format'

const PATHS = [
  { cat: 'NRI' as const, icon: Globe2, title: 'Living overseas', body: 'Care for parents, property and paperwork in India from wherever you are.' },
  { cat: 'IND' as const, icon: HomeIcon, title: 'Based in India', body: 'A trusted executive for the responsibilities that take your time.' },
  { cat: 'CORP' as const, icon: Briefcase, title: 'Through your employer', body: 'Activate a sponsored membership with your invitation code.' },
]

export default function Landing() {
  const [cat, setCat] = useState<MemberCategory>('NRI')
  const [cur, setCur] = useState('INR')
  const fx = EXCHANGE_RATES.find(r => r.code === cur)!
  const price = (inr: number | null) =>
    inr === null ? 'Per corporate contract' : cur === 'INR' ? `₹${inr.toLocaleString('en-IN')}` : `${fx.symbol}${Math.round(inr * fx.perINR).toLocaleString('en-US')}`

  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-12 sm:px-6 md:grid-cols-[1.05fr_1fr] md:items-center md:pt-20">
          <div className="animate-fade-up">
            <p className="eyebrow mb-5">Private membership · Personal concierge</p>
            <h1 className="serif text-[2.6rem] leading-[1.08] sm:text-6xl">Everything that matters, <em className="text-gold-soft">taken care of.</em></h1>
            <p className="mt-6 max-w-lg text-[17px] text-mute">
              A dedicated Personal Executive, expert consultations and secure document handling — for you, your parents and the people you trust, across India.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" to="/apply">Apply for membership</Button>
              <Button size="lg" variant="secondary" to="/login">Member sign in</Button>
            </div>
          </div>
          <div className="relative">
            <img src="/hero-family.jpg" alt="A Personal Executive helping a family at home with a tablet" className="aspect-[4/3] w-full rounded-3xl object-cover object-[30%_center] opacity-90 ring-1 ring-line md:aspect-[5/4]" />
            <div className="absolute -bottom-5 left-5 right-5 rounded-2xl border border-line bg-surface/95 p-4 backdrop-blur sm:left-auto sm:w-72">
              <p className="serif text-lg">“Ask once. Your executive takes it from there.”</p>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-bg2" aria-labelledby="paths">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 id="paths" className="serif mb-8 text-3xl">Choose how you’d like to join</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {PATHS.map(p => (
                <Link key={p.cat} to={`/apply?category=${p.cat}`} className="group rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-gold/60">
                  <p.icon className="mb-5 size-6 text-gold" aria-hidden />
                  <p className="text-lg text-ivory">{p.title}</p>
                  <p className="mt-2 text-sm text-mute">{p.body}</p>
                  <p className="mt-5 text-sm text-gold-soft group-hover:text-ivory">Start {p.cat === 'CORP' ? 'activation' : 'application'} →</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="plans">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow mb-2">Plan explorer</p>
              <h2 id="plans" className="serif text-3xl">Memberships</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Segmented label="Member category" value={cat} onChange={setCat} options={[{ value: 'NRI', label: 'NRI' }, { value: 'IND', label: 'India' }, { value: 'CORP', label: 'Corporate' }]} />
              <label className="flex items-center gap-2 text-sm text-mute">
                Currency
                <select value={cur} onChange={e => setCur(e.target.value)} className="h-9 rounded-full border border-line2 bg-bg2 px-3 text-sm text-ivory">
                  {EXCHANGE_RATES.map(r => <option key={r.code} value={r.code}>{r.code}</option>)}
                </select>
              </label>
            </div>
          </div>
          <Notice tone="warn" className="mb-6" title="Draft commercial inputs">
            Prices, hour allotments and documentation credits come from a draft plan configuration ({CONFIG_VERSION}) and are pending approval. {cur !== 'INR' && FX_NOTE}
          </Notice>
          <div className="grid gap-5 md:grid-cols-2">
            {PLANS.filter(p => p.category === cat).map(p => (
              <Card key={p.code} className="flex flex-col p-6 sm:p-7">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="serif text-2xl">{p.name}</p>
                    <p className="mt-1 text-sm text-mute">{p.audience}</p>
                  </div>
                  <Badge tone="gold">{p.termYears ? `${p.termYears} years` : 'Contract term'}</Badge>
                </div>
                <p className="mt-6 text-3xl text-ivory">{price(p.priceINR)}</p>
                <p className="text-[12.5px] text-dim">{p.priceINR ? 'One-time prepaid, plus applicable taxes · draft price' : 'Funded by your employer'}</p>
                <ul className="mt-6 space-y-2.5 border-t border-line pt-5 text-sm">
                  <li className="flex gap-2.5"><Check className="mt-0.5 size-4 text-gold" aria-hidden />{p.execHoursPerYear} Personal Executive hours each benefit year</li>
                  <li className="flex gap-2.5"><Check className="mt-0.5 size-4 text-gold" aria-hidden />{p.consultationsPerYear} expert consultations each benefit year</li>
                  <li className="flex gap-2.5"><Check className="mt-0.5 size-4 text-gold" aria-hidden />Documentation credit up to ₹{p.docCreditINR.toLocaleString('en-IN')} for eligible events</li>
                  {p.highlights.map(h => <li key={h} className="flex gap-2.5"><Check className="mt-0.5 size-4 text-gold" aria-hidden />{h}</li>)}
                </ul>
                <ul className="mt-4 space-y-1.5 text-[13px] text-dim">
                  {p.exclusions.map(x => <li key={x} className="flex gap-2.5"><Minus className="mt-0.5 size-3.5" aria-hidden /> Not included: {x}</li>)}
                </ul>
                <div className="mt-auto pt-6">
                  <Button className="w-full" variant={p.category === 'CORP' ? 'secondary' : 'primary'} to={`/apply?category=${p.category}&plan=${p.code}`}>
                    {p.category === 'CORP' ? 'Activate with invitation' : `Apply for ${p.name}`}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-t border-line bg-bg2">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2">
            <div>
              <h2 className="serif mb-5 text-2xl">What your executive can help with</h2>
              <ul className="space-y-3">
                {SERVICE_CATEGORIES.map(c => (
                  <li key={c.id} className="border-b border-line pb-3">
                    <p className="text-ivory">{c.name}</p>
                    <p className="text-sm text-dim">{c.description}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="serif mb-5 text-2xl">Service coverage</h2>
              <p className="mb-4 text-sm text-mute">Phase 1 cities. Request service in any covered city — not only your home city.</p>
              <ul className="grid grid-cols-2 gap-3">
                {CITIES.map(c => (
                  <li key={c.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm"><MapPin className="size-4 text-gold" aria-hidden />{c.name}</li>
                ))}
              </ul>
              <h2 className="serif mb-4 mt-10 text-2xl" id="faq">Questions</h2>
              <div className="divide-y divide-line border-y border-line">
                {FAQ.map(f => (
                  <details key={f.q} className="group py-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] text-ivory">
                      {f.q}<ChevronDown className="size-4 text-gold transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
                    <p className="mt-2 text-sm text-mute">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-8 text-[13px] text-dim sm:px-6">
          <span className="flex items-center gap-2"><Building2 className="size-4" aria-hidden /> EZIT ELITE</span>
          <span className="flex items-center gap-2"><SimLabel>Prototype</SimLabel> Fictional data and simulated integrations</span>
          <span className="ml-auto flex gap-5"><Link className={cx('hover:text-ivory')} to="/legal/terms">Terms</Link><Link className="hover:text-ivory" to="/legal/privacy">Privacy</Link><a className="hover:text-ivory" href="#faq">FAQ</a></span>
        </div>
      </footer>
    </div>
  )
}
