import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound, LogOut, MonitorSmartphone, RotateCcw, Smartphone, TimerOff } from 'lucide-react'
import { useApp } from '../data/store'
import { actor } from '../data/selectors'
import { categoryName } from '../data/config'
import type { Address, Member } from '../data/types'
import { Badge, Button, Card, ChoiceCards, ConfirmDialog, Field, Input, KV, Modal, Notice, PageHeader, Segmented, Select, SimLabel, Tabs, Toggle, useUI } from '../components/ui'
import { setTheme, useTheme, type ThemePref } from '../lib/theme'
import { fmtDate, fmtDateTime, relTime } from '../lib/format'

type Tab = 'profile' | 'communication' | 'consent' | 'security'

export default function Profile() {
  const { state } = useApp()
  const [params, setParams] = useSearchParams()
  const a = actor(state)
  if (a.kind === 'delegate') return <DelegateProfile />
  const tab = (params.get('tab') as Tab) || 'profile'
  return (
    <div>
      <PageHeader eyebrow="Profile & security" title={state.member.name} subtitle={`${state.membership.memberNo} · ${state.member.email}`} />
      <Tabs label="Profile sections" value={tab} onChange={t => setParams(t === 'profile' ? {} : { tab: t })} tabs={[{ value: 'profile', label: 'Personal details' }, { value: 'communication', label: 'Communication' }, { value: 'consent', label: 'Consent' }, { value: 'security', label: 'Security' }]} />
      {tab === 'profile' && <Details />}
      {tab === 'communication' && <Communication />}
      {tab === 'consent' && <Consent />}
      {tab === 'security' && <Security />}
    </div>
  )
}

function Details() {
  const { state, actions } = useApp()
  const { toast, requireStepUp } = useUI()
  const m = state.member
  const [f, setF] = useState<Member>(m)
  const [err, setErr] = useState<string>()
  const dirty = JSON.stringify(f) !== JSON.stringify(m)
  const contactChanged = f.email !== m.email || f.mobile !== m.mobile
  const save = () => {
    const doSave = () => {
      const r = actions.updateMember(f)
      if (!r.ok) return setErr(r.error)
      setErr(undefined); toast({ tone: 'ok', title: 'Profile saved' })
    }
    if (contactChanged) requireStepUp('Changing your email or mobile requires verification.', doSave)
    else doSave()
  }
  const addr = (k: 'residentialAddress' | 'serviceAddress' | 'billingAddress', title: string) => (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      <legend className="mb-2 text-sm text-ivory">{title}</legend>
      {(['line1', 'line2', 'city', 'postcode', 'country'] as (keyof Address)[]).map(p => (
        <Field key={p} label={{ line1: 'Address line 1', line2: 'Address line 2', city: 'City', postcode: 'PIN / postcode', country: 'Country', state: 'State' }[p]} htmlFor={k + p} className={p === 'line1' ? 'sm:col-span-2' : ''}>
          <Input id={k + p} value={f[k][p] ?? ''} onChange={e => setF({ ...f, [k]: { ...f[k], [p]: e.target.value } })} />
        </Field>
      ))}
    </fieldset>
  )
  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" hint="Contact support to change your legal name." htmlFor="pn"><Input id="pn" value={f.name} disabled /></Field>
          <Field label="Member category" htmlFor="pc"><Input id="pc" value={f.category === 'IND' ? 'India-based' : f.category} disabled /></Field>
          <Field label="Email" htmlFor="pe" hint="Changes require verification."><Input id="pe" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Mobile" htmlFor="pm" hint="Include the country code."><Input id="pm" type="tel" value={f.mobile} onChange={e => setF({ ...f, mobile: e.target.value })} /></Field>
          <Field label="Preferred language" htmlFor="pl"><Select id="pl" value={f.language} onChange={e => setF({ ...f, language: e.target.value })}>{['English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Marathi'].map(x => <option key={x}>{x}</option>)}</Select></Field>
          <Field label="Time zone" htmlFor="pt"><Select id="pt" value={f.timezone} onChange={e => setF({ ...f, timezone: e.target.value })}>{['Asia/Kolkata', 'Europe/London', 'America/New_York', 'Asia/Dubai', 'Asia/Singapore'].map(x => <option key={x}>{x}</option>)}</Select></Field>
          <Field label="Preferred contact window" htmlFor="pw"><Select id="pw" value={f.contactWindow} onChange={e => setF({ ...f, contactWindow: e.target.value })}>{['9:00 AM – 8:00 PM', '7:00 AM – 10:00 AM', '6:00 PM – 10:00 PM', 'Any time'].map(x => <option key={x}>{x}</option>)}</Select></Field>
        </div>
      </Card>
      <Card className="space-y-6 p-6">
        {addr('residentialAddress', 'Residential address')}
        {addr('serviceAddress', 'India service address')}
        {addr('billingAddress', 'Billing address')}
      </Card>
      {err && <Notice tone="bad">{err}</Notice>}
      <div className="flex gap-2"><Button onClick={save} disabled={!dirty}>Save changes</Button><Button variant="secondary" onClick={() => setF(m)} disabled={!dirty}>Discard</Button></div>
    </div>
  )
}

function Communication() {
  const { state, actions } = useApp()
  const { toast } = useUI()
  const m = state.member
  const set = (patch: Partial<Member>) => { const r = actions.updateMember(patch); if (r.ok) toast({ tone: 'ok', title: 'Preference saved' }) }
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Card className="p-6">
        <h2 className="text-[17px]">How we contact you</h2>
        <p className="mb-2 text-[13px] text-dim">For service updates and your executive’s messages.</p>
        <div className="divide-y divide-line">
          <Toggle label="Email" checked={m.contactChannels.email} onChange={v => set({ contactChannels: { ...m.contactChannels, email: v } })} />
          <Toggle label="SMS" checked={m.contactChannels.sms} onChange={v => set({ contactChannels: { ...m.contactChannels, sms: v } })} />
          <Toggle label="Phone calls" checked={m.contactChannels.phone} onChange={v => set({ contactChannels: { ...m.contactChannels, phone: v } })} />
          <Toggle label="WhatsApp" description="Separate opt-in via the WhatsApp Business Platform (simulated). You can opt out at any time." checked={m.whatsappOptIn} onChange={v => set({ whatsappOptIn: v, contactChannels: { ...m.contactChannels, whatsapp: v } })} />
        </div>
      </Card>
      <Card className="p-6">
        <h2 className="text-[17px]">Service notices</h2>
        <p className="mt-2 text-sm text-mute">Legally required notices — payment confirmations, security alerts, changes to terms and cancellation outcomes — are always sent by email, regardless of these preferences.</p>
        <Button className="mt-4" variant="secondary" to="/notifications">Notification categories</Button>
      </Card>
      <Appearance />
    </div>
  )
}

function Appearance() {
  const { pref } = useTheme()
  return (
    <Card className="p-6 md:col-span-2">
      <h2 className="text-[17px]">Appearance</h2>
      <p className="mb-4 mt-1 text-[13px] text-dim">Saved on this device only.</p>
      <Segmented label="Theme" value={pref} onChange={(v: ThemePref) => setTheme(v)} options={[{ value: 'system', label: 'Match device' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
    </Card>
  )
}

function Consent() {
  const { state, actions } = useApp()
  const { toast } = useUI()
  return (
    <Card className="p-6">
      <p className="mb-2 text-sm text-mute">Each consent is recorded separately with a version and timestamp. Required consents can only be withdrawn by cancelling your membership.</p>
      <div className="divide-y divide-line">
        {state.consents.map(c => (
          <div key={c.key}>
            <Toggle label={<span className="flex items-center gap-2">{c.label}{c.required && <Badge tone="neutral" dot={false}>Required</Badge>}</span>} description={<>{c.description} <span className="block text-[11.5px]">Version {c.version} · {c.granted ? 'granted' : 'updated'} {fmtDate(c.at)}</span></>}
              checked={c.granted} disabled={c.required} onChange={v => { const r = actions.setConsent(c.key, v); toast(r.ok ? { tone: 'ok', title: `${c.label}: ${v ? 'granted' : 'withdrawn'}` } : { tone: 'bad', title: r.error }) }} />
          </div>
        ))}
      </div>
    </Card>
  )
}

function Security() {
  const { state, actions } = useApp()
  const { toast, requireStepUp } = useUI()
  const nav = useNavigate()
  const sec = state.security
  const [codes, setCodes] = useState<string[]>()
  const [reset, setReset] = useState(false)
  const run = (r: { ok: boolean; error?: string }, t: string) => toast(r.ok ? { tone: 'ok', title: t } : { tone: 'bad', title: r.error! })
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-6">
        <h2 className="mb-3 text-[17px]">Multi-factor authentication</h2>
        <ChoiceCards name="MFA method" columns={1} value={sec.mfaMethod} onChange={v => requireStepUp('Changing MFA settings needs verification.', () => run(actions.updateSecurity({ mfaMethod: v }), 'MFA method updated'))}
          options={[{ value: 'sms', label: 'SMS code', description: state.member.mobile }, { value: 'email', label: 'Email code', description: state.member.email }, { value: 'authenticator', label: 'Authenticator app', description: 'Simulated setup' }]} />
        <div className="mt-3 border-t border-line"><Toggle label="Verify again for sensitive actions" description="Documents, payments and delegation changes ask for a fresh code (step-up)." checked={sec.stepUpForSensitive} onChange={v => requireStepUp('Changing security settings needs verification.', () => run(actions.updateSecurity({ stepUpForSensitive: v }), 'Saved'))} /></div>
      </Card>
      <Card className="p-6">
        <h2 className="mb-3 text-[17px]">Recovery options</h2>
        <KV items={[['Recovery email', sec.recoveryEmail], ['Recovery phone', sec.recoveryPhone], ['Backup codes', sec.backupCodesGeneratedAt ? `Generated ${fmtDate(sec.backupCodesGeneratedAt)}` : 'Not generated']]} />
        <Button className="mt-4" variant="secondary" icon={<KeyRound className="size-4" />} onClick={() => requireStepUp('Generating backup codes needs verification.', () => { const r = actions.regenerateBackupCodes(); if (r.ok) setCodes(r.data) })}>Generate new backup codes</Button>
      </Card>
      <Card className="p-6">
        <h2 className="mb-3 text-[17px]">Active sessions</h2>
        <ul className="divide-y divide-line">
          {sec.sessions.map(s => (
            <li key={s.id} className="flex items-center gap-3 py-3">
              <MonitorSmartphone className="size-5 text-gold" aria-hidden />
              <span className="flex-1 text-sm">{s.device}{s.current && <Badge tone="green" className="ml-2">This session</Badge>}<span className="block text-[12px] text-dim">{s.location} · active {relTime(s.lastActive)}</span></span>
              {!s.current && <Button size="sm" variant="ghost" onClick={() => run(actions.signOutSession(s.id), 'Session signed out')}>Sign out</Button>}
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-6">
        <h2 className="mb-3 text-[17px]">Trusted devices</h2>
        {sec.devices.length ? <ul className="divide-y divide-line">{sec.devices.map(d => (
          <li key={d.id} className="flex items-center gap-3 py-3">
            <Smartphone className="size-5 text-gold" aria-hidden />
            <span className="flex-1 text-sm">{d.name}<span className="block text-[12px] text-dim">Added {fmtDate(d.addedAt)} · last used {relTime(d.lastUsed)}</span></span>
            <Button size="sm" variant="ghost" onClick={() => requireStepUp('Removing a trusted device needs verification.', () => run(actions.removeDevice(d.id), 'Device removed'))}>Remove</Button>
          </li>))}</ul> : <p className="text-sm text-dim">No trusted devices. You’ll be asked for MFA on every sign-in.</p>}
      </Card>
      <Card className="p-6">
        <h2 className="mb-1 text-[17px]">Security alerts</h2>
        <div className="divide-y divide-line">
          {([['newDevice', 'Sign-in from a new device'], ['failedLogin', 'Failed sign-in attempts'], ['delegateChanges', 'Delegate access changes'], ['documentAccess', 'Document access by others']] as const).map(([k, l]) => (
            <Toggle key={k} label={l} checked={sec.alerts[k]} onChange={v => run(actions.updateSecurity({ alerts: { ...sec.alerts, [k]: v } }), 'Saved')} />
          ))}
        </div>
      </Card>
      <Card className="p-6">
        <h2 className="mb-3 text-[17px]">Session</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<LogOut className="size-4" />} onClick={() => { actions.logout(); nav('/login') }}>Log out</Button>
          <Button variant="ghost" icon={<TimerOff className="size-4" />} onClick={() => { actions.logout(true); nav('/login') }}>Simulate session expiry</Button>
        </div>
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2 flex items-center gap-2 text-sm"><SimLabel>Reviewer</SimLabel> Restore the original sample data</p>
          <Button variant="danger" size="sm" icon={<RotateCcw className="size-4" />} onClick={() => setReset(true)}>Reset demo data</Button>
        </div>
      </Card>
      <Modal open={!!codes} onClose={() => setCodes(undefined)} title="Your backup codes" size="sm" footer={<Button onClick={() => setCodes(undefined)}>I’ve saved them</Button>}>
        <p className="mb-3 text-sm text-mute">Each code works once. They’re shown only now and are not stored by this prototype.</p>
        <ul className="grid grid-cols-2 gap-2 font-mono text-sm">{codes?.map(c => <li key={c} className="rounded-lg bg-bg2 px-3 py-2 text-center">{c}</li>)}</ul>
      </Modal>
      <ConfirmDialog open={reset} onClose={() => setReset(false)} tone="danger" confirmLabel="Reset demo data" title="Reset all demo data?"
        onConfirm={() => { actions.resetDemo(); setReset(false); nav('/') }}>
        All changes made in this browser will be lost and you’ll be signed out.
      </ConfirmDialog>
    </div>
  )
}

function DelegateProfile() {
  const { state, actions } = useApp()
  const nav = useNavigate()
  const a = actor(state)
  if (a.kind !== 'delegate') return null
  const d = a.delegate
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Your access" title={a.name} subtitle={`Delegate for ${state.member.name}`} />
      <Card className="p-6">
        <KV items={[['Relationship', d.relationship], ['Email', d.email], ['Status', d.status], ['Accepted', fmtDateTime(d.acceptedAt)], ['Access until', fmtDate(d.expiresAt)],
          ['Services', d.permissions.serviceCategories.map(categoryName).join(', ') || 'None'], ['Approvals', d.permissions.approvals ? 'Allowed' : 'Not allowed'], ['Visits / OTP', `${d.permissions.visits ? 'Track' : '—'} / ${d.permissions.otp ? 'Share OTP' : '—'}`]]} />
        <p className="mt-4 text-[13px] text-dim">Only {state.member.firstName} can change your access. Profile, payments and membership details are not visible to delegates.</p>
        <Button className="mt-5" variant="secondary" icon={<LogOut className="size-4" />} onClick={() => { actions.logout(); nav('/login') }}>Log out</Button>
      </Card>
    </div>
  )
}
