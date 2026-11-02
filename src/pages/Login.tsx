import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Fingerprint, KeyRound, UserRound, Users } from 'lucide-react'
import { PublicHeader } from '../components/Layout'
import { Button, Card, DevOtpHint, Field, Input, Notice, OtpInput, SimLabel, useUI } from '../components/ui'
import { useApp } from '../data/store'
import { otpService } from '../data/integrations'

export default function Login() {
  const { state, actions } = useApp()
  const { toast } = useUI()
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from ?? '/home'
  const [step, setStep] = useState<'id' | 'otp'>('id')
  const [identifier, setIdentifier] = useState('')
  const [target, setTarget] = useState<{ actorId: string; destination: string }>()
  const [code, setCode] = useState('')
  const [err, setErr] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [passkey, setPasskey] = useState(false)

  if (state.session.loggedIn) return <Navigate to={from} replace />

  const submitId = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(undefined)
    if (!identifier.trim()) return setErr('Enter your email address or mobile number.')
    const r = actions.startLogin(identifier)
    if (!r.ok) return setErr(r.error)
    setBusy(true)
    await otpService.send(r.data.destination)
    setBusy(false)
    setTarget(r.data)
    setStep('otp')
  }
  const submitOtp = (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) return setErr('Enter the 6-digit code.')
    const r = actions.completeLogin(target!.actorId, code)
    if (!r.ok) return setErr(r.error)
    toast({ tone: 'ok', title: 'Signed in' })
    nav(from, { replace: true })
  }
  const demo = (actorId: string) => {
    const r = actorId === 'member' ? actions.demoLogin() : actions.demoLogin(actorId)
    if (r.ok) nav(actorId === 'member' ? from : '/home', { replace: true })
  }
  const delegate = state.delegates.find(d => d.id === 'DLG-01' && d.status === 'accepted')

  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1fr_340px] md:py-20">
        <Card className="p-6 sm:p-10">
          <p className="eyebrow mb-3">Member sign in</p>
          <h1 className="serif mb-2 text-3xl">Welcome back</h1>
          <p className="mb-8 text-sm text-mute">Sign in with the email or mobile number on your membership. We’ll send a one-time code.</p>
          {state.session.expiredNotice && <Notice tone="warn" className="mb-6" title="Your session expired">For your security, please sign in again.</Notice>}
          {step === 'id' ? (
            <form onSubmit={submitId} noValidate className="space-y-5">
              <Field label="Email or mobile number" htmlFor="ident" error={err} hint="Mobile numbers should include the country code, e.g. +91 or +44.">
                <Input id="ident" autoComplete="username" value={identifier} onChange={e => setIdentifier(e.target.value)} invalid={!!err} placeholder="you@example.com or +91 98480 12345" />
              </Field>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" loading={busy}>Send code</Button>
                <Button type="button" variant="secondary" icon={<Fingerprint className="size-4" />} onClick={() => setPasskey(true)}>Use a passkey</Button>
              </div>
              {passkey && (
                <Notice tone="info" title="Passkey sign-in (simulated)" action={<Button size="sm" onClick={() => demo('member')}>Continue</Button>}>
                  Real WebAuthn registration requires a backend. This prototype simulates a successful passkey for the demo member.
                </Notice>
              )}
              <p className="text-[13px] text-dim">Try <button type="button" className="link" onClick={() => setIdentifier(state.member.email)}>{state.member.email}</button>{delegate && <> or the delegate <button type="button" className="link" onClick={() => setIdentifier(delegate.email)}>{delegate.email}</button></>}.</p>
            </form>
          ) : (
            <form onSubmit={submitOtp} noValidate className="space-y-5">
              <p className="text-sm text-mute">Enter the code sent to <span className="text-ivory">{target?.destination}</span>.</p>
              <Field label="One-time code" htmlFor="otp" error={err}>
                <OtpInput id="otp" value={code} onChange={setCode} invalid={!!err} />
              </Field>
              <DevOtpHint />
              <div className="flex flex-wrap gap-3">
                <Button type="submit" icon={<KeyRound className="size-4" />}>Verify and sign in</Button>
                <Button type="button" variant="ghost" onClick={() => { setStep('id'); setCode(''); setErr(undefined) }}>Use a different account</Button>
              </div>
            </form>
          )}
          <p className="mt-10 text-sm text-mute">Not a member yet? <Link to="/apply" className="link">Apply for membership</Link></p>
        </Card>
        <aside className="space-y-4">
          <Card className="p-6">
            <div className="mb-3 flex items-center gap-2"><SimLabel>Reviewer access</SimLabel></div>
            <p className="mb-4 text-sm text-mute">Explore the prototype without a code.</p>
            <div className="space-y-2">
              <Button className="w-full" icon={<UserRound className="size-4" />} onClick={() => demo('member')}>Demo member — Ravi Teja</Button>
              {delegate && <Button className="w-full" variant="secondary" icon={<Users className="size-4" />} onClick={() => demo(delegate.id)}>Demo delegate — {delegate.name}</Button>}
            </div>
          </Card>
          <p className="px-2 text-[12.5px] text-dim">Prototype only: sessions are stored in this browser. No real authentication, MFA or identity verification takes place.</p>
        </aside>
      </main>
    </div>
  )
}
