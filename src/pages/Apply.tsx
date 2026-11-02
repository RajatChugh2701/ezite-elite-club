import { useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { PublicHeader } from '../components/Layout'
import { Badge, Button, Card, Checkbox, ChoiceCards, DevOtpHint, Field, Input, KV, Notice, OtpInput, Select, SimLabel, Stepper, useUI } from '../components/ui'
import { useApp } from '../data/store'
import { CITIES, PLANS, planByCode } from '../data/config'
import { otpService } from '../data/integrations'
import type { Address, Application, MemberCategory } from '../data/types'
import { nowISO } from '../lib/format'

const STEPS = ['Membership', 'Identity', 'Contact', 'Addresses', 'Preferences', 'Eligibility', 'Consent', 'Review']
const emptyAddr = (country = 'India'): Address => ({ line1: '', line2: '', city: '', state: '', postcode: '', country })
const CORP_INVITES: Record<string, { org: string; allocation: string }> = {
  'ACME-7F3K': { org: 'Acme Technologies Pvt Ltd (fictional sponsor)', allocation: 'Elite 1 CORP IND · 15 executive hours · 5 consultations · contract year 2026–27' },
}

export default function Apply() {
  const [params] = useSearchParams()
  const { state, actions } = useApp()
  const { toast } = useUI()
  const nav = useNavigate()
  const initialCat = (params.get('category') as MemberCategory) || 'IND'
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [f, setF] = useState({
    category: initialCat, plan: params.get('plan') ?? PLANS.find(p => p.category === initialCat)?.code ?? '',
    name: '', dob: '', nationality: 'Indian', residence: initialCat === 'NRI' ? 'United Kingdom' : 'India',
    email: '', emailCode: '', emailSent: false, emailVerified: false,
    phoneCc: initialCat === 'NRI' ? '+44' : '+91', phone: '', phoneCode: '', phoneSent: false, phoneVerified: false, whatsapp: false, passkey: false,
    overseas: emptyAddr('United Kingdom'), residential: emptyAddr(), serviceSame: true, service: emptyAddr(), billingSame: true, billing: emptyAddr(), homeCity: 'hyderabad',
    timezone: initialCat === 'NRI' ? 'Europe/London' : 'Asia/Kolkata', language: 'English', contactWindow: '9:00 AM – 8:00 PM',
    nriAttest: false, passportCountry: 'India', incomeBand: '', incomeAttest: false, inviteCode: '', employeeId: '', workEmail: '', sponsor: null as null | { org: string; allocation: string },
    terms: false, privacy: false, sensitive: false, marketing: false,
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(x => ({ ...x, [k]: v }))
  const setAddr = (k: 'overseas' | 'residential' | 'service' | 'billing', p: Partial<Address>) => setF(x => ({ ...x, [k]: { ...x[k], ...p } }))
  const [done, setDone] = useState<Application>()

  const plans = PLANS.filter(p => p.category === f.category)
  const isNRI = f.category === 'NRI', isCorp = f.category === 'CORP'

  const sendCode = async (which: 'email' | 'phone') => {
    const e: Record<string, string> = {}
    if (which === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Enter a valid email address.'
    if (which === 'phone' && !/^\+\d{1,3}$/.test(f.phoneCc)) e.phone = 'Use a country code like +91.'
    if (which === 'phone' && f.phone.replace(/\D/g, '').length < 7) e.phone = 'Enter a valid mobile number.'
    if (which === 'email' && f.email.toLowerCase() === state.member.email) e.email = 'An account already exists with this email. Please sign in instead.'
    setErrors(e)
    if (Object.keys(e).length) return
    await otpService.send(which)
    set(which === 'email' ? 'emailSent' : 'phoneSent', true)
    toast({ tone: 'info', title: `Code sent to your ${which === 'email' ? 'email' : 'mobile'}`, body: 'Simulated — use the development code.' })
  }
  const verify = (which: 'email' | 'phone') => {
    const code = which === 'email' ? f.emailCode : f.phoneCode
    if (!otpService.verify(code)) return setErrors({ [which + 'Code']: 'Incorrect code.' })
    setErrors({})
    set(which === 'email' ? 'emailVerified' : 'phoneVerified', true)
  }
  const verifyInvite = () => {
    const s = CORP_INVITES[f.inviteCode.trim().toUpperCase()]
    if (!s) return setErrors({ inviteCode: 'We couldn’t find that invitation. Check the code from your HR team (demo code: ACME-7F3K).' })
    if (!f.employeeId.trim()) return setErrors({ employeeId: 'Enter your employee ID.' })
    setErrors({})
    set('sponsor', s)
  }

  const validate = () => {
    const e: Record<string, string> = {}
    const req = (k: string, v: string, msg = 'Required') => { if (!v.trim()) e[k] = msg }
    const addr = (k: string, a: Address) => { req(k + '.line1', a.line1); req(k + '.city', a.city); req(k + '.postcode', a.postcode) }
    if (step === 0 && !f.plan) e.plan = 'Choose a plan.'
    if (step === 1) {
      req('name', f.name, 'Enter your full name as on your ID.')
      req('dob', f.dob, 'Enter your date of birth.')
      if (f.dob && new Date(f.dob) > new Date(Date.now() - 18 * 365.25 * 86400000)) e.dob = 'Members must be 18 or older.'
      req('residence', f.residence)
    }
    if (step === 2) {
      if (!f.emailVerified) e.email = 'Verify your email address.'
      if (!f.phoneVerified) e.phone = 'Verify your mobile number.'
    }
    if (step === 3) {
      if (isNRI) addr('overseas', f.overseas)
      else addr('residential', f.residential)
      if (isNRI || !f.serviceSame) addr('service', f.service)
      if (!f.billingSame) addr('billing', f.billing)
    }
    if (step === 5) {
      if (isNRI && !f.nriAttest) e.nriAttest = 'Confirm your NRI status.'
      if (f.category === 'IND') { req('incomeBand', f.incomeBand, 'Select your income band.'); if (!f.incomeAttest) e.incomeAttest = 'Confirm the declaration.' }
      if (isCorp && !f.sponsor) e.inviteCode = 'Verify your corporate invitation.'
    }
    if (step === 6) { if (!f.terms) e.terms = 'You must accept the membership terms.'; if (!f.privacy) e.privacy = 'You must acknowledge the privacy notice.' }
    setErrors(e)
    return !Object.keys(e).length
  }
  const next = () => { if (validate()) { setStep(s => s + 1); window.scrollTo(0, 0) } }

  const submit = () => {
    const id = actions.newApplicationId()
    const app: Application = {
      id, createdAt: nowISO(), category: f.category, planCode: f.plan, name: f.name, email: f.email,
      status: isCorp ? 'sponsor_approval_pending' : 'pending_payment',
      audit: [{ id: 'A1', at: nowISO(), actor: f.name, label: 'Application submitted' }, { id: 'A2', at: nowISO(), actor: 'System', label: 'Email and mobile verified (simulated OTP)' }],
      sponsor: f.sponsor ? { org: f.sponsor.org, employeeId: f.employeeId, allocation: f.sponsor.allocation } : undefined,
      data: { residence: f.residence, homeCity: f.homeCity, timezone: f.timezone, whatsapp: f.whatsapp, billing: f.billingSame ? (isNRI ? f.overseas : f.residential) : f.billing },
    }
    if (isCorp) app.audit.push({ id: 'A3', at: nowISO(), actor: 'System', label: `Sponsor allocation requested from ${f.sponsor!.org}` })
    actions.saveApplication(app)
    if (isCorp) setDone(app)
    else nav(`/checkout?app=${id}`)
  }

  const approveSponsor = () => {
    if (!done) return
    const app: Application = { ...done, status: 'active', memberNo: 'EZITC' + Math.floor(200000 + Math.random() * 99999), audit: [...done.audit, { id: 'A4', at: nowISO(), actor: done.sponsor!.org, label: 'Sponsor approved allocation (simulated)' }, { id: 'A5', at: nowISO(), actor: 'System', label: 'Membership activated; entitlement ledger opened' }] }
    actions.saveApplication(app)
    setDone(app)
  }

  if (done) {
    return (
      <div className="min-h-dvh">
        <PublicHeader />
        <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <Card className="p-8">
            {done.status === 'active' ? <CheckCircle2 className="mb-4 size-8 text-ok" aria-hidden /> : <ShieldCheck className="mb-4 size-8 text-gold" aria-hidden />}
            <h1 className="serif text-3xl">{done.status === 'active' ? 'Your sponsored membership is active' : 'Awaiting sponsor approval'}</h1>
            <p className="mt-2 text-mute">{done.status === 'active' ? `Member ID ${done.memberNo}. Welcome to EZIT ELITE.` : `${done.sponsor?.org} must approve your allocation. Sponsor approval and member activation are recorded separately.`}</p>
            <KV className="mt-6" items={[['Application', done.id], ['Plan', planByCode(done.planCode)?.name], ['Sponsor', done.sponsor?.org], ['Employee ID', done.sponsor?.employeeId], ['Allocation', done.sponsor?.allocation]]} />
            <h2 className="mb-2 mt-6 text-sm font-medium">Audit trail</h2>
            <ol className="space-y-1.5 text-sm text-mute">{done.audit.map(a => <li key={a.id}>• {a.label} — <span className="text-dim">{a.actor}</span></li>)}</ol>
            <div className="mt-8 flex flex-wrap gap-3">
              {done.status !== 'active' && <Button onClick={approveSponsor}>Simulate sponsor approval</Button>}
              <Button variant="secondary" onClick={() => { actions.demoLogin(); nav('/home') }}>Continue to the demo portal</Button>
            </div>
            <p className="mt-4 text-[12.5px] text-dim">The demo portal shows the sample member Ravi Teja. Your sponsor never sees your personal sensitive records.</p>
          </Card>
        </main>
      </div>
    )
  }

  const addrFields = (k: 'overseas' | 'residential' | 'service' | 'billing', title: string, hint?: string) => (
    <fieldset className="space-y-4">
      <legend className="mb-1 text-[15px] text-ivory">{title}</legend>
      {hint && <p className="-mt-2 text-[13px] text-dim">{hint}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field className="sm:col-span-2" label="Address line 1" required error={errors[k + '.line1']} htmlFor={k + 'l1'}><Input id={k + 'l1'} value={f[k].line1} onChange={e => setAddr(k, { line1: e.target.value })} invalid={!!errors[k + '.line1']} autoComplete="address-line1" /></Field>
        <Field className="sm:col-span-2" label="Address line 2" htmlFor={k + 'l2'}><Input id={k + 'l2'} value={f[k].line2} onChange={e => setAddr(k, { line2: e.target.value })} autoComplete="address-line2" /></Field>
        <Field label="City" required error={errors[k + '.city']} htmlFor={k + 'c'}><Input id={k + 'c'} value={f[k].city} onChange={e => setAddr(k, { city: e.target.value })} invalid={!!errors[k + '.city']} /></Field>
        <Field label={f[k].country === 'India' ? 'PIN code' : 'Postcode / ZIP'} required error={errors[k + '.postcode']} htmlFor={k + 'p'}><Input id={k + 'p'} value={f[k].postcode} onChange={e => setAddr(k, { postcode: e.target.value })} invalid={!!errors[k + '.postcode']} /></Field>
        <Field label="State / region" htmlFor={k + 's'}><Input id={k + 's'} value={f[k].state} onChange={e => setAddr(k, { state: e.target.value })} /></Field>
        <Field label="Country" htmlFor={k + 'co'}><Input id={k + 'co'} value={f[k].country} onChange={e => setAddr(k, { country: e.target.value })} disabled={k === 'service'} /></Field>
      </div>
    </fieldset>
  )

  const body: Record<number, ReactNode> = {
    0: (
      <div className="space-y-6">
        <Field label="Member category" htmlFor="cat">
          <ChoiceCards name="Member category" columns={3} value={f.category} onChange={v => setF(x => ({ ...x, category: v, plan: PLANS.find(p => p.category === v)?.code ?? '' }))}
            options={[{ value: 'NRI', label: 'NRI', description: 'Living overseas' }, { value: 'IND', label: 'India-based', description: 'Resident in India' }, { value: 'CORP', label: 'Corporate', description: 'Employer-sponsored' }]} />
        </Field>
        <Field label="Plan" error={errors.plan} htmlFor="plan">
          <ChoiceCards name="Plan" value={f.plan} onChange={v => set('plan', v)} options={plans.map(p => ({ value: p.code, label: p.name, description: `${p.termYears ? p.termYears + ' years' : 'Contract term'} · ${p.execHoursPerYear} h/yr · ${p.consultationsPerYear} consultations`, aside: <Badge tone="neutral" dot={false}>Draft</Badge> }))} />
        </Field>
      </div>
    ),
    1: (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field className="sm:col-span-2" label="Full name (as on ID)" required error={errors.name} htmlFor="name"><Input id="name" autoComplete="name" value={f.name} onChange={e => set('name', e.target.value)} invalid={!!errors.name} /></Field>
        <Field label="Date of birth" required error={errors.dob} htmlFor="dob"><Input id="dob" type="date" value={f.dob} onChange={e => set('dob', e.target.value)} invalid={!!errors.dob} /></Field>
        <Field label="Nationality" htmlFor="nat"><Input id="nat" value={f.nationality} onChange={e => set('nationality', e.target.value)} /></Field>
        <Field label="Country of residence" required error={errors.residence} htmlFor="res"><Input id="res" value={f.residence} onChange={e => { set('residence', e.target.value); setAddr('overseas', { country: e.target.value }) }} /></Field>
        <Notice className="sm:col-span-2" title="Identity verification">Document-based identity checks are performed by a verification provider in production. This prototype does not verify identity.</Notice>
      </div>
    ),
    2: (
      <div className="space-y-6">
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Email" required error={errors.email} htmlFor="email"><Input id="email" type="email" autoComplete="email" value={f.email} disabled={f.emailVerified} onChange={e => set('email', e.target.value)} invalid={!!errors.email} /></Field>
          {f.emailVerified ? <Badge tone="green" className="mb-3">Verified</Badge> : <Button variant="secondary" onClick={() => sendCode('email')}>{f.emailSent ? 'Resend code' : 'Send code'}</Button>}
        </div>
        {f.emailSent && !f.emailVerified && (
          <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="Email code" error={errors.emailCode} htmlFor="ecode"><OtpInput id="ecode" value={f.emailCode} onChange={v => set('emailCode', v)} invalid={!!errors.emailCode} /></Field>
            <Button onClick={() => verify('email')}>Verify</Button>
          </div>
        )}
        <div className="grid items-end gap-3 sm:grid-cols-[110px_1fr_auto]">
          <Field label="Country code" htmlFor="cc"><Input id="cc" value={f.phoneCc} disabled={f.phoneVerified} onChange={e => set('phoneCc', e.target.value)} /></Field>
          <Field label="Mobile number" required error={errors.phone} htmlFor="phone"><Input id="phone" type="tel" autoComplete="tel-national" value={f.phone} disabled={f.phoneVerified} onChange={e => set('phone', e.target.value)} invalid={!!errors.phone} /></Field>
          {f.phoneVerified ? <Badge tone="green" className="mb-3">Verified</Badge> : <Button variant="secondary" onClick={() => sendCode('phone')}>{f.phoneSent ? 'Resend code' : 'Send code'}</Button>}
        </div>
        {f.phoneSent && !f.phoneVerified && (
          <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="SMS code" error={errors.phoneCode} htmlFor="pcode"><OtpInput id="pcode" value={f.phoneCode} onChange={v => set('phoneCode', v)} invalid={!!errors.phoneCode} /></Field>
            <Button onClick={() => verify('phone')}>Verify</Button>
          </div>
        )}
        {(f.emailSent || f.phoneSent) && <DevOtpHint />}
        <div className="space-y-3 border-t border-line pt-5">
          <Checkbox checked={f.whatsapp} onChange={v => set('whatsapp', v)} label="Send service updates on WhatsApp" description="Optional and separate from required service notifications. You can change this any time." />
          <Checkbox checked={f.passkey} onChange={v => set('passkey', v)} label="Set up a passkey after activation" description="Passwordless sign-in on this device (simulated in the prototype)." />
        </div>
      </div>
    ),
    3: (
      <div className="space-y-8">
        {isNRI ? addrFields('overseas', 'Overseas residential address', 'Where you live today.') : addrFields('residential', 'Residential address in India')}
        {!isNRI && <Checkbox checked={f.serviceSame} onChange={v => set('serviceSame', v)} label="My India service address is the same as my residential address" />}
        {(isNRI || !f.serviceSame) && addrFields('service', 'India service address', 'Where your executive will usually help — for example your parents’ home. This is not assumed to be your residential address.')}
        <Field label="Home service city" hint="Your Personal Executive is assigned here. You can still request service in other cities." htmlFor="hc">
          <Select id="hc" value={f.homeCity} onChange={e => set('homeCity', e.target.value)}>{CITIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        </Field>
        <Checkbox checked={f.billingSame} onChange={v => set('billingSame', v)} label={`Bill to my ${isNRI ? 'overseas' : 'residential'} address`} />
        {!f.billingSame && addrFields('billing', 'Billing address')}
      </div>
    ),
    4: (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Time zone" htmlFor="tz"><Select id="tz" value={f.timezone} onChange={e => set('timezone', e.target.value)}>{['Asia/Kolkata', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Singapore', 'Australia/Sydney'].map(t => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Preferred language" htmlFor="lang"><Select id="lang" value={f.language} onChange={e => set('language', e.target.value)}>{['English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Marathi'].map(t => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Preferred contact window (your time)" htmlFor="cw"><Select id="cw" value={f.contactWindow} onChange={e => set('contactWindow', e.target.value)}>{['9:00 AM – 8:00 PM', '7:00 AM – 10:00 AM', '6:00 PM – 10:00 PM', 'Any time'].map(t => <option key={t}>{t}</option>)}</Select></Field>
        <Notice className="sm:col-span-2">Times for services in India are always shown in India Standard Time alongside your local time.</Notice>
      </div>
    ),
    5: (
      <div className="space-y-5">
        {isNRI && (<>
          <Field label="Passport issuing country" htmlFor="pc"><Input id="pc" value={f.passportCountry} onChange={e => set('passportCountry', e.target.value)} /></Field>
          <Checkbox checked={f.nriAttest} onChange={v => set('nriAttest', v)} label="I confirm I am a Non-Resident Indian or Overseas Citizen of India" description="Self-attestation. Proportionate checks may follow." />
          {errors.nriAttest && <p className="text-[12.5px] text-bad">{errors.nriAttest}</p>}
        </>)}
        {f.category === 'IND' && (<>
          <Field label="Annual income band (self-declared)" required error={errors.incomeBand} htmlFor="ib">
            <Select id="ib" value={f.incomeBand} onChange={e => set('incomeBand', e.target.value)} invalid={!!errors.incomeBand}>
              <option value="">Select</option><option>₹50 lakh – ₹1 crore</option><option>₹1 crore – ₹5 crore</option><option>Above ₹5 crore</option><option value="below">Below ₹50 lakh</option>
            </Select>
          </Field>
          {f.incomeBand === 'below' && <Notice tone="warn" title="This plan is designed for members above ₹50 lakh p.a.">You can still submit; our team will contact you about suitable options. No documents are requested at this stage.</Notice>}
          <Checkbox checked={f.incomeAttest} onChange={v => set('incomeAttest', v)} label="I confirm this declaration is accurate" />
          {errors.incomeAttest && <p className="text-[12.5px] text-bad">{errors.incomeAttest}</p>}
        </>)}
        {isCorp && (<>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Invitation code" required error={errors.inviteCode} hint="From your HR or sponsor admin. Demo: ACME-7F3K" htmlFor="ic"><Input id="ic" value={f.inviteCode} onChange={e => set('inviteCode', e.target.value)} invalid={!!errors.inviteCode} disabled={!!f.sponsor} /></Field>
            <Field label="Employee ID" required error={errors.employeeId} htmlFor="eid"><Input id="eid" value={f.employeeId} onChange={e => set('employeeId', e.target.value)} invalid={!!errors.employeeId} disabled={!!f.sponsor} /></Field>
            <Field label="Work email" htmlFor="we"><Input id="we" type="email" value={f.workEmail} onChange={e => set('workEmail', e.target.value)} /></Field>
          </div>
          {f.sponsor ? <Notice tone="ok" title={f.sponsor.org}>{f.sponsor.allocation}. Your sponsor sees only aggregate usage — never your personal records.</Notice> : <Button variant="secondary" onClick={verifyInvite}>Verify invitation</Button>}
        </>)}
        <p className="text-[13px] text-dim">Duplicate accounts are checked against your verified email and mobile.</p>
      </div>
    ),
    6: (
      <div className="space-y-4">
        <Checkbox checked={f.terms} onChange={v => set('terms', v)} label={<>I accept the <a href="/legal/terms" target="_blank" className="link">membership terms</a> (draft v1.0)</>} />
        {errors.terms && <p className="text-[12.5px] text-bad">{errors.terms}</p>}
        <Checkbox checked={f.privacy} onChange={v => set('privacy', v)} label={<>I have read the <a href="/legal/privacy" target="_blank" className="link">privacy notice</a></>} />
        {errors.privacy && <p className="text-[12.5px] text-bad">{errors.privacy}</p>}
        <Checkbox checked={f.sensitive} onChange={v => set('sensitive', v)} label="Allow processing of sensitive documents I upload" description="Optional. Needed only when you use the document vault." />
        <Checkbox checked={f.marketing} onChange={v => set('marketing', v)} label="Send me occasional updates about new services" description="Optional." />
      </div>
    ),
    7: (
      <div className="space-y-5">
        <KV items={[
          ['Category', f.category], ['Plan', planByCode(f.plan)?.name], ['Name', f.name], ['Date of birth', f.dob], ['Residence', f.residence],
          ['Email', <span key="e">{f.email} <Badge tone="green">Verified</Badge></span>], ['Mobile', <span key="m">{f.phoneCc} {f.phone} <Badge tone="green">Verified</Badge></span>],
          ['WhatsApp updates', f.whatsapp ? 'Yes' : 'No'], ['Home service city', CITIES.find(c => c.id === f.homeCity)?.name],
          ['Service address', isNRI || !f.serviceSame ? `${f.service.line1}, ${f.service.city}` : 'Same as residential'],
          ['Time zone', f.timezone], ['Language', f.language], ...(isCorp ? [['Sponsor', f.sponsor?.org] as [string, string]] : []),
        ]} />
        <Notice>{isCorp ? 'Submitting sends your allocation to your sponsor for approval.' : 'Next, review your plan quote and complete a simulated payment.'}</Notice>
      </div>
    ),
  }

  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="eyebrow mb-2">Apply for membership <SimLabel className="ml-2">Prototype</SimLabel></p>
        <h1 className="serif mb-8 text-3xl sm:text-4xl">{STEPS[step]}</h1>
        <Stepper steps={STEPS} current={step} onStep={i => setStep(i)} />
        <Card className="p-5 sm:p-8">
          {body[step]}
          <div className="mt-8 flex justify-between gap-3 border-t border-line pt-5">
            <Button variant="secondary" onClick={() => (step ? setStep(step - 1) : nav('/'))}>{step ? 'Back' : 'Cancel'}</Button>
            {step < STEPS.length - 1 ? <Button onClick={next}>Continue</Button> : <Button onClick={submit}>{isCorp ? 'Submit for sponsor approval' : 'Continue to checkout'}</Button>}
          </div>
        </Card>
      </main>
    </div>
  )
}
