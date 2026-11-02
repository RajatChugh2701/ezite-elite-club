import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Eye, Mail, Pencil, Phone, Plus, ShieldOff, UserPlus, X } from 'lucide-react'
import { useApp } from '../data/store'
import { canAccessArea, delegateActive, inviteExpiresAt } from '../data/selectors'
import { CITIES, SERVICE_CATEGORIES, cityName, categoryName } from '../data/config'
import type { Beneficiary, Delegate, DelegatedPermissions } from '../data/types'
import { AccessDenied, Badge, Button, Card, Checkbox, ConfirmDialog, EmptyState, Field, Input, Modal, Notice, PageHeader, Select, SimLabel, Stepper, StatusBadge, Textarea, Toggle, useUI } from '../components/ui'
import { addDays, fmtDate, toISODate } from '../lib/format'

export default function Family() {
  const { state, actions } = useApp()
  const { toast, requireStepUp } = useUI()
  const nav = useNavigate()
  const [benEdit, setBenEdit] = useState<Beneficiary | 'new'>()
  const [invite, setInvite] = useState<Delegate | 'new'>()
  const [revoke, setRevoke] = useState<Delegate>()
  if (!canAccessArea(state, 'family')) return <AccessDenied what="family and delegation settings" />

  const run = (r: { ok: boolean; error?: string }, ok: string) => toast(r.ok ? { tone: 'ok', title: ok } : { tone: 'bad', title: r.error ?? 'Something went wrong' })

  return (
    <div>
      <PageHeader eyebrow="My family" title="Family, nominees & delegates" subtitle="The people you care for, and the people you trust to act for you — with exactly the access you choose."
        actions={<><Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => setBenEdit('new')}>Add family member</Button><Button icon={<UserPlus className="size-4" />} onClick={() => setInvite('new')}>Invite a delegate</Button></>} />

      <section className="mb-10">
        <h2 className="mb-4 text-[17px]">Beneficiaries</h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {state.beneficiaries.map(b => (
            <Card as="li" key={b.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg text-ivory">{b.name}{b.isSelf && <span className="text-sm text-dim"> (you)</span>}</p>
                  <p className="text-sm text-mute">{b.relationship} · {cityName(b.city)}{b.dob && ` · born ${fmtDate(b.dob, { year: 'numeric', month: 'short' })}`}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={b.consent === 'given' ? 'green' : 'amber'}>{b.consent === 'given' ? 'Consent recorded' : 'Consent pending'}</Badge>
                  <Button size="sm" variant="ghost" aria-label={`Edit ${b.name}`} icon={<Pencil className="size-4" />} onClick={() => setBenEdit(b)} />
                </div>
              </div>
              <dl className="mt-4 grid gap-2 text-[13px] sm:grid-cols-2">
                <div><dt className="text-dim">India service address</dt><dd>{[b.indiaAddress.line1, b.indiaAddress.line2, b.indiaAddress.city, b.indiaAddress.postcode].filter(Boolean).join(', ')}</dd></div>
                <div><dt className="text-dim">Phone</dt><dd>{b.phone}</dd></div>
                <div><dt className="text-dim">Emergency contact</dt><dd>{b.emergencyContact.name} · {b.emergencyContact.phone}</dd></div>
                {b.notes && <div><dt className="text-dim">Notes for your executive</dt><dd>{b.notes}</dd></div>}
              </dl>
              {!b.isSelf && <Button size="sm" variant="secondary" className="mt-4" to={`/request/new?beneficiary=${b.id}`}>Request help for {b.name.split(' ')[0]}</Button>}
            </Card>
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[17px]">Delegates & nominees</h2>
            <p className="text-sm text-dim">Delegates can act only within the permissions you set. Revoking takes effect immediately.</p>
          </div>
        </div>
        {state.delegates.length === 0 ? <EmptyState title="No delegates yet" body="Invite a trusted person — for example someone who lives near your parents." action={<Button onClick={() => setInvite('new')}>Invite a delegate</Button>} /> : (
          <ul className="space-y-4">
            {state.delegates.map(d => {
              const exp = inviteExpiresAt(d)
              return (
                <Card as="li" key={d.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="flex flex-wrap items-center gap-2 text-lg text-ivory">{d.name} <StatusBadge status={d.status} /></p>
                      <p className="text-sm text-mute">{d.relationship}</p>
                      <p className="mt-1 flex flex-wrap gap-x-4 text-[12.5px] text-dim"><span className="flex items-center gap-1"><Mail className="size-3.5" aria-hidden />{d.email}</span><span className="flex items-center gap-1"><Phone className="size-3.5" aria-hidden />{d.phone}</span></p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {d.status === 'draft' && <Button size="sm" onClick={() => requireStepUp('Sending a delegate invitation changes who can act for you.', () => run(actions.sendInvite(d.id), 'Invitation sent'))}>Send invitation</Button>}
                      {d.status === 'sent' && <>
                        <Button size="sm" variant="secondary" onClick={() => run(actions.acceptInvite(d.id), `${d.name} accepted`)}>Simulate acceptance <SimLabel className="ml-1">Demo</SimLabel></Button>
                        <Button size="sm" variant="ghost" onClick={() => run(actions.expireInvite(d.id), 'Invitation expired')}>Simulate expiry</Button>
                      </>}
                      {d.status === 'expired' && <Button size="sm" variant="secondary" onClick={() => requireStepUp('Re-sending an invitation changes who can act for you.', () => run(actions.sendInvite(d.id), 'Invitation re-sent'))}>Resend invitation</Button>}
                      {(d.status === 'accepted' || d.status === 'sent' || d.status === 'draft') && <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} onClick={() => setInvite(d)}>Edit access</Button>}
                      {d.status === 'accepted' && delegateActive(d) && <Button size="sm" variant="ghost" icon={<Eye className="size-4" />} onClick={() => { actions.switchActor(d.id); nav('/home'); toast({ tone: 'info', title: `Previewing ${d.name}’s access` }) }}>Preview access</Button>}
                      {d.status !== 'revoked' && d.status !== 'expired' && <Button size="sm" variant="danger" icon={<ShieldOff className="size-4" />} onClick={() => setRevoke(d)}>Revoke</Button>}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 border-t border-line pt-4 text-[13px] sm:grid-cols-3">
                    <div><p className="text-dim">Services</p><p>{d.permissions.serviceCategories.map(categoryName).join(', ') || 'None'}</p></div>
                    <div><p className="text-dim">On behalf of</p><p>{d.permissions.beneficiaryIds.map(id => state.beneficiaries.find(b => b.id === id)?.name).filter(Boolean).join(', ') || 'No one'}</p></div>
                    <div><p className="text-dim">Documents</p><p>{d.permissions.documentIds.map(id => state.documents.find(x => x.id === id)?.name).filter(Boolean).join(', ') || 'None'}</p></div>
                    <div className="flex flex-wrap gap-1.5 sm:col-span-3">
                      <PermChip on={d.permissions.approvals}>Approve charges</PermChip>
                      <PermChip on={d.permissions.visits}>Track visits</PermChip>
                      <PermChip on={d.permissions.otp}>Share visit OTP</PermChip>
                      <PermChip on={d.termsAccepted}>Terms accepted</PermChip>
                    </div>
                    <p className="text-dim sm:col-span-3">
                      {d.status === 'revoked' ? `Revoked ${fmtDate(d.revokedAt)}` : `Access until ${fmtDate(d.expiresAt)}`}
                      {d.status === 'sent' && exp && ` · invitation expires ${fmtDate(exp)}`}
                      {d.acceptedAt && ` · accepted ${fmtDate(d.acceptedAt)}`}
                    </p>
                  </div>
                </Card>
              )
            })}
          </ul>
        )}
      </section>

      {benEdit && <BeneficiaryModal b={benEdit === 'new' ? undefined : benEdit} onClose={() => setBenEdit(undefined)} />}
      {invite && <DelegateModal d={invite === 'new' ? undefined : invite} onClose={() => setInvite(undefined)} />}
      <ConfirmDialog open={!!revoke} onClose={() => setRevoke(undefined)} tone="danger" confirmLabel="Revoke access" title={`Revoke ${revoke?.name}’s access?`}
        onConfirm={() => { const d = revoke!; setRevoke(undefined); requireStepUp('Revoking a delegate is a sensitive change.', () => run(actions.revokeDelegate(d.id), `${d.name}’s access revoked`)) }}>
        They will immediately lose access to all requests, visits and documents you shared. Their past actions remain in the audit history.
      </ConfirmDialog>
    </div>
  )
}

const PermChip = ({ on, children }: { on: boolean; children: React.ReactNode }) => (
  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] ${on ? 'border-ok/35 text-ok' : 'border-line text-dim'}`}>
    {on ? <Check className="size-3" aria-hidden /> : <X className="size-3" aria-hidden />}{children}<span className="sr-only">{on ? ' allowed' : ' not allowed'}</span>
  </span>
)

function BeneficiaryModal({ b, onClose }: { b?: Beneficiary; onClose: () => void }) {
  const { actions } = useApp()
  const { toast } = useUI()
  const [f, setF] = useState<Omit<Beneficiary, 'id'> & { id?: string }>(b ?? {
    name: '', relationship: '', city: 'hyderabad', indiaAddress: { line1: '', line2: '', city: 'Hyderabad', postcode: '', country: 'India' }, phone: '', emergencyContact: { name: '', phone: '' }, consent: 'pending', notes: '',
  })
  const [err, setErr] = useState<string>()
  const save = () => {
    const r = actions.saveBeneficiary(f)
    if (!r.ok) return setErr(r.error)
    toast({ tone: 'ok', title: b ? 'Details updated' : `${f.name} added` })
    onClose()
  }
  const addr = (p: Partial<Beneficiary['indiaAddress']>) => setF(x => ({ ...x, indiaAddress: { ...x.indiaAddress, ...p } }))
  return (
    <Modal open onClose={onClose} title={b ? `Edit ${b.name}` : 'Add a family member'} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>{b ? 'Save changes' : 'Add family member'}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required htmlFor="bn"><Input id="bn" value={f.name} disabled={b?.isSelf} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Relationship" required htmlFor="br"><Select id="br" value={f.relationship} disabled={b?.isSelf} onChange={e => setF({ ...f, relationship: e.target.value })}><option value="">Select</option>{['Self', 'Spouse', 'Mother', 'Father', 'Son', 'Daughter', 'Sibling', 'Parent-in-law', 'Grandparent', 'Other'].map(x => <option key={x}>{x}</option>)}</Select></Field>
        <Field label="Date of birth" htmlFor="bd"><Input id="bd" type="date" value={f.dob ?? ''} onChange={e => setF({ ...f, dob: e.target.value })} /></Field>
        <Field label="Service city" htmlFor="bc"><Select id="bc" value={f.city} onChange={e => { const c = e.target.value as Beneficiary['city']; setF({ ...f, city: c }); addr({ city: CITIES.find(x => x.id === c)?.name ?? '' }) }}>{CITIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field className="sm:col-span-2" label="India address" required htmlFor="ba"><Input id="ba" value={f.indiaAddress.line1} onChange={e => addr({ line1: e.target.value })} placeholder="House / flat, street" /></Field>
        <Field label="Area" htmlFor="ba2"><Input id="ba2" value={f.indiaAddress.line2} onChange={e => addr({ line2: e.target.value })} /></Field>
        <Field label="PIN code" required htmlFor="bp"><Input id="bp" inputMode="numeric" value={f.indiaAddress.postcode} onChange={e => addr({ postcode: e.target.value })} /></Field>
        <Field label="Phone" htmlFor="bph"><Input id="bph" type="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></Field>
        <div />
        <Field label="Emergency contact name" htmlFor="ben"><Input id="ben" value={f.emergencyContact.name} onChange={e => setF({ ...f, emergencyContact: { ...f.emergencyContact, name: e.target.value } })} /></Field>
        <Field label="Emergency contact phone" htmlFor="bep"><Input id="bep" type="tel" value={f.emergencyContact.phone} onChange={e => setF({ ...f, emergencyContact: { ...f.emergencyContact, phone: e.target.value } })} /></Field>
        <Field className="sm:col-span-2" label="Notes for your executive" htmlFor="bno"><Textarea id="bno" value={f.notes ?? ''} onChange={e => setF({ ...f, notes: e.target.value })} className="min-h-16" placeholder="Language, routines, health considerations to be aware of" /></Field>
        <div className="sm:col-span-2"><Checkbox checked={f.consent === 'given'} onChange={v => setF({ ...f, consent: v ? 'given' : 'pending' })} label="I have their consent (or am their guardian) to share these details with my concierge team" /></div>
      </div>
      {err && <Notice tone="bad" className="mt-4">{err}</Notice>}
    </Modal>
  )
}

const NONE: DelegatedPermissions = { serviceCategories: [], documentIds: [], approvals: false, visits: false, otp: false, beneficiaryIds: [] }

function DelegateModal({ d, onClose }: { d?: Delegate; onClose: () => void }) {
  const { state, actions } = useApp()
  const { toast, requireStepUp } = useUI()
  const [step, setStep] = useState(d ? 1 : 0)
  const [info, setInfo] = useState({ name: d?.name ?? '', email: d?.email ?? '', phone: d?.phone ?? '', relationship: d?.relationship ?? '', expiresAt: d?.expiresAt ?? toISODate(addDays(new Date(), 180)) })
  const [p, setP] = useState<DelegatedPermissions>(d?.permissions ?? NONE)
  const [err, setErr] = useState<string>()
  const toggle = (k: 'serviceCategories' | 'documentIds' | 'beneficiaryIds', v: string, on: boolean) => setP(x => ({ ...x, [k]: on ? [...x[k], v] : x[k].filter(y => y !== v) }))

  const next = () => {
    if (step === 0) {
      if (!info.name.trim() || !info.relationship.trim()) return setErr('Name and relationship are required.')
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email)) return setErr('Enter a valid email.')
      if (info.phone.replace(/\D/g, '').length < 10) return setErr('Enter a valid phone number with country code.')
      if (info.expiresAt <= toISODate(new Date())) return setErr('Access expiry must be in the future.')
    }
    if (step === 1 && !p.serviceCategories.length && !p.documentIds.length && !p.visits) return setErr('Grant at least one permission, or cancel.')
    setErr(undefined); setStep(s => s + 1)
  }
  const finish = (send: boolean) => {
    requireStepUp('Changing delegated access is a sensitive action.', () => {
      const r = d ? actions.updateDelegate(d.id, { permissions: p, expiresAt: info.expiresAt }) : actions.createDelegate({ ...info, permissions: p }, send)
      if (!r.ok) return setErr(r.error)
      toast({ tone: 'ok', title: d ? 'Access updated' : send ? `Invitation sent to ${info.name}` : 'Saved as draft', body: send && !d ? 'Simulated message — nothing is actually sent.' : undefined })
      onClose()
    })
  }
  const yes = (s: string) => <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />{s}</li>
  const no = (s: string) => <li className="flex gap-2 text-dim"><X className="mt-0.5 size-4 shrink-0" aria-hidden />{s}</li>

  return (
    <Modal open onClose={onClose} title={d ? `Edit ${d.name}’s access` : 'Invite a delegate'} size="lg"
      footer={<>
        <Button variant="secondary" onClick={() => (step > (d ? 1 : 0) ? setStep(step - 1) : onClose())}>{step > (d ? 1 : 0) ? 'Back' : 'Cancel'}</Button>
        {step < 2 ? <Button onClick={next}>Continue</Button> : d ? <Button onClick={() => finish(false)}>Save access</Button> : <><Button variant="secondary" onClick={() => finish(false)}>Save as draft</Button><Button onClick={() => finish(true)}>Send invitation</Button></>}
      </>}>
      <Stepper steps={['Person', 'Permissions', 'Review']} current={step} />
      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required htmlFor="dn"><Input id="dn" value={info.name} onChange={e => setInfo({ ...info, name: e.target.value })} /></Field>
          <Field label="Relationship to you" required htmlFor="dr"><Input id="dr" value={info.relationship} onChange={e => setInfo({ ...info, relationship: e.target.value })} placeholder="e.g. Brother, family friend" /></Field>
          <Field label="Email" required htmlFor="de"><Input id="de" type="email" value={info.email} onChange={e => setInfo({ ...info, email: e.target.value })} /></Field>
          <Field label="Mobile (with country code)" required htmlFor="dp"><Input id="dp" type="tel" value={info.phone} onChange={e => setInfo({ ...info, phone: e.target.value })} /></Field>
          <Field label="Access expires on" htmlFor="dx" hint="You can revoke earlier at any time."><Input id="dx" type="date" min={toISODate(addDays(new Date(), 1))} value={info.expiresAt} onChange={e => setInfo({ ...info, expiresAt: e.target.value })} /></Field>
        </div>
      )}
      {step === 1 && (
        <div className="space-y-6">
          <Notice>Nothing is allowed by default. Choose only what this person needs.</Notice>
          <fieldset><legend className="mb-2 text-sm text-ivory">Services they may request</legend>
            <div className="grid gap-2 sm:grid-cols-2">{SERVICE_CATEGORIES.filter(c => c.id !== 'corporate').map(c => <Checkbox key={c.id} checked={p.serviceCategories.includes(c.id)} onChange={v => toggle('serviceCategories', c.id, v)} label={c.name} />)}</div>
          </fieldset>
          <fieldset><legend className="mb-2 text-sm text-ivory">On behalf of</legend>
            <div className="grid gap-2 sm:grid-cols-2">{state.beneficiaries.map(b => <Checkbox key={b.id} checked={p.beneficiaryIds.includes(b.id)} onChange={v => toggle('beneficiaryIds', b.id, v)} label={`${b.name} (${b.relationship})`} />)}</div>
          </fieldset>
          <fieldset><legend className="mb-2 text-sm text-ivory">Documents they may view</legend>
            <div className="grid gap-2">{state.documents.map(doc => <Checkbox key={doc.id} checked={p.documentIds.includes(doc.id)} onChange={v => toggle('documentIds', doc.id, v)} label={doc.name} />)}</div>
          </fieldset>
          <div className="divide-y divide-line rounded-xl border border-line px-4">
            <Toggle checked={p.approvals} onChange={v => setP({ ...p, approvals: v })} label="Approve requests and charges" description="Within the services above only." />
            <Toggle checked={p.visits} onChange={v => setP({ ...p, visits: v, otp: v ? p.otp : false })} label="Track visits" description="Live status during authorised visit windows." />
            <Toggle checked={p.otp} disabled={!p.visits} onChange={v => setP({ ...p, otp: v })} label="Share visit start / end OTP" description="Requires visit tracking." />
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-4 text-sm">
          <p className="text-mute"><span className="text-ivory">{info.name}</span> ({info.relationship}) will be able to, until {fmtDate(info.expiresAt)}:</p>
          <ul className="space-y-2">
            {p.serviceCategories.length ? yes(`Request ${p.serviceCategories.map(categoryName).join(', ')} for ${p.beneficiaryIds.map(id => state.beneficiaries.find(b => b.id === id)?.name).join(', ') || 'no one'}`) : no('Request services')}
            {p.documentIds.length ? yes(`View ${p.documentIds.length} document(s): ${p.documentIds.map(id => state.documents.find(x => x.id === id)?.name).join(', ')}`) : no('View any documents')}
            {p.approvals ? yes('Approve requests and additional charges within these services') : no('Approve charges — requests they raise will need your approval')}
            {p.visits ? yes('Track visits during the active window') : no('Track visits')}
            {p.otp ? yes('Share start / end OTP for visits') : no('Share visit OTPs')}
            {no('See your membership, payments, invoices or other family members’ records')}
          </ul>
          {!d && <Notice>They must accept the delegate terms before access begins. Invitations expire after 7 days.</Notice>}
          {err && <Notice tone="bad">{err}</Notice>}
        </div>
      )}
      {err && step < 2 && <Notice tone="bad" className="mt-4">{err}</Notice>}
    </Modal>
  )
}
