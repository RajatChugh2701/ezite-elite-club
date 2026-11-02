import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Clock, FileText, Gem, Hourglass, MapPin, MessageSquare, Phone, Receipt, ScrollText, Sparkles, UserRound } from 'lucide-react'
import { useApp } from '../data/store'
import {
  actor, anniversary, apptStart, balance, nextAppointment, pendingApprovals, plan, unpaidBalance, unpaidInvoices, invoiceTotals, visibleRequests, visibleDocuments,
} from '../data/selectors'
import { cityName, execById, expertById, categoryName } from '../data/config'
import { ArrowLink, Avatar, Badge, Button, Card, EmptyState, Meter, SectionHeading, StatusBadge } from '../components/ui'
import { ContactModal } from '../components/ContactModal'
import { cx, fmtDate, fmtDateTime, fmtTime, greeting, inr, relTime } from '../lib/format'

export default function Home() {
  const { state } = useApp()
  const a = actor(state)
  if (a.kind === 'delegate') return <DelegateHome />
  return <MemberHome />
}

function MemberHome() {
  const { state } = useApp()
  const [contact, setContact] = useState(false)
  const p = plan(state)
  const m = state.membership
  const hrs = balance(state, 'hours')
  const con = balance(state, 'consult')
  const doc = balance(state, 'doc')
  const approvals = pendingApprovals(state)
  const unpaid = unpaidBalance(state)
  const overdue = unpaidInvoices(state).filter(i => invoiceTotals(i, state).status === 'overdue').length
  const next = nextAppointment(state)
  const pe = execById(m.peId)!
  const attention = state.notifications.filter(n => !n.read).slice(0, 4)
  const asOf = new Date().toISOString()

  return (
    <div className="space-y-10">
      {/* Welcome */}
      <section className="relative overflow-hidden rounded-3xl border border-line bg-bg2 animate-fade-up">
        <img src="/hero-family.jpg" alt="" className="absolute inset-y-0 right-0 hidden h-full w-[62%] object-cover object-[40%_30%] opacity-80 md:block" />
        <div className="absolute inset-y-0 right-0 hidden w-[62%] bg-gradient-to-r from-bg2 via-bg2/40 to-transparent md:block" aria-hidden />
        <img src="/hero-family.jpg" alt="" className="h-40 w-full object-cover object-[45%_25%] opacity-80 md:hidden" />
        <div className="relative max-w-lg p-6 sm:p-10">
          <p className="serif text-xl text-gold-soft">{greeting()},</p>
          <h1 className="serif mt-1 text-4xl leading-tight sm:text-5xl">{state.member.firstName}.</h1>
          <div className="my-5 h-px w-12 bg-gold" aria-hidden />
          <p className="text-[16px] text-ivory/90">Your membership, personal assistance, and family support — all in one place.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button to="/request/new" icon={<Sparkles className="size-4" />}>Request assistance</Button>
            <Button to="/consultations" variant="secondary">Book consultation</Button>
          </div>
        </div>
      </section>

      {/* Membership + allowances */}
      <section className="grid gap-5 lg:grid-cols-[290px_1fr]">
        <Card className="relative flex flex-col overflow-hidden bg-gradient-to-br from-raised to-surface p-6">
          <svg className="pointer-events-none absolute -right-6 -bottom-6 size-40 opacity-[0.08]" viewBox="0 0 100 100" aria-hidden><path d="M50 10 C70 30 80 60 50 92 C20 60 30 30 50 10Z M50 20 V88" className="stroke-gold-soft" fill="none" strokeWidth="1.5" /></svg>
          <div className="flex items-center justify-between">
            <span className="serif text-[15px] tracking-[0.14em] text-gold-soft">EZIT ELITE</span>
            <StatusBadge status={m.status} />
          </div>
          <p className="serif mt-6 text-3xl">{p.name}</p>
          <p className="mt-1 text-sm text-mute">Valid till {fmtDate(m.validUntil)}</p>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
            <div><p className="text-[12px] text-dim">Member ID</p><p className="font-medium tracking-wide">{m.memberNo}</p></div>
            <div><p className="text-[12px] text-dim">Plan anniversary</p><p>{fmtDate(anniversary(state), { day: 'numeric', month: 'short' })}</p></div>
          </div>
          <div className="mt-auto pt-5"><ArrowLink to="/membership">View membership</ArrowLink></div>
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionHeading title="Your membership allowances"
            sub={<>Benefit year {fmtDate(m.benefitYearStart)} – {fmtDate(m.benefitYearEnd)} · as of {fmtDateTime(asOf)}</>}
            action={<ArrowLink to="/membership?tab=ledger">Ledger</ArrowLink>} />
          <ul className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 xl:grid-cols-5">
            <Indicator icon={<UserRound className="size-4" />} label="Executive hours" value={<>{hrs.available}<span className="text-base text-mute"> / {hrs.total}</span></>} sub={`remaining · ${hrs.held} h on hold`}
              meter={<Meter value={hrs.available} max={hrs.total} label="Executive hours remaining" />} action={<ArrowLink to="/membership?tab=ledger&ent=hours">View usage</ArrowLink>} />
            <Indicator icon={<MessageSquare className="size-4" />} label="Consultation credits" value={<>{con.available}<span className="text-base text-mute"> / {con.total}</span></>} sub={`remaining this benefit year${con.held ? ` · ${con.held} on hold` : ''}`}
              meter={<Meter value={con.available} max={con.total} label="Consultation credits remaining" tone="sage" />} action={<ArrowLink to="/consultations">Book consultation</ArrowLink>} />
            <Indicator icon={<ScrollText className="size-4" />} label="Documentation credit" value={inr(doc.available)} sub={`available of ${inr(doc.total)} · eligible events only`}
              meter={<Meter value={doc.available} max={doc.total} label="Documentation credit available" />} action={<ArrowLink to="/membership?tab=ledger&ent=doc">View details</ArrowLink>} />
            <Indicator icon={<Hourglass className="size-4" />} label="Pending approvals" value={approvals.length} sub={approvals.length ? approvals.map(x => x.title.split(' ').slice(0, 3).join(' ')).join(' · ') : 'Nothing needs you'}
              highlight={approvals.length > 0} action={<ArrowLink to="/requests?status=awaiting_approval">Review approvals</ArrowLink>} />
            <Indicator icon={<Receipt className="size-4" />} label="Unpaid balance" value={<span className={cx(unpaid > 0 && 'text-bad')}>{inr(unpaid)}</span>} sub={unpaid ? (overdue ? `${overdue} invoice overdue` : 'due') : 'All settled'}
              action={<ArrowLink to="/payments?tab=invoices">View invoices</ArrowLink>} />
          </ul>
          <p className="mt-3 text-[12px] text-dim">Balances are calculated from your entitlement ledger, including holds for upcoming bookings and reversals.</p>
        </Card>
      </section>

      {/* Quick actions */}
      <section aria-labelledby="qa">
        <h2 id="qa" className="sr-only">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: '/request/new', icon: Sparkles, t: 'Request assistance', d: 'From your Personal Executive', primary: true },
            { to: '/consultations', icon: CalendarDays, t: 'Book consultation', d: `${con.available} included credit${con.available === 1 ? '' : 's'} left` },
            { to: '/membership?tab=benefits', icon: Gem, t: 'View benefits', d: 'What your plan includes' },
            { to: '#contact', icon: Phone, t: 'Contact my executive', d: `${pe.name} · ${pe.workingHours.split(',')[0]}` },
          ].map(q => {
            const inner = (
              <>
                <span className={cx('grid size-10 shrink-0 place-items-center rounded-full', q.primary ? 'bg-gold text-on-gold' : 'bg-raised text-gold')}><q.icon className="size-[18px]" aria-hidden /></span>
                <span className="min-w-0 flex-1"><span className="block text-[15px] text-ivory">{q.t}</span><span className="block truncate text-[12.5px] text-dim">{q.d}</span></span>
                <ArrowRight className="size-4 text-dim transition-transform group-hover:translate-x-0.5 group-hover:text-gold" aria-hidden />
              </>
            )
            const cls = cx('group flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors', q.primary ? 'border-gold/50 bg-gold/[0.06] hover:border-gold' : 'border-line bg-surface hover:border-line2')
            return q.to === '#contact'
              ? <button key={q.t} className={cls} onClick={() => setContact(true)}>{inner}</button>
              : <Link key={q.t} to={q.to} className={cls}>{inner}</Link>
          })}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <SectionHeading title="Next appointment" action={<ArrowLink to="/appointments">All appointments</ArrowLink>} />
            {next ? (
              <div className="flex gap-4">
                <div className="grid w-16 shrink-0 place-items-center rounded-xl border border-line bg-bg2 py-2 text-center">
                  <span className="serif text-2xl leading-none">{apptStart(next).getDate()}</span>
                  <span className="text-[11px] uppercase tracking-wider text-mute">{apptStart(next).toLocaleDateString('en-IN', { month: 'short' })}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><p className="text-[15px] text-ivory">{next.title}</p><StatusBadge status={next.status} /></div>
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-mute">
                    <span className="flex items-center gap-1.5"><Clock className="size-3.5" aria-hidden />{fmtTime(next.start)} – {fmtTime(next.end)}</span>
                    <span className="flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden />{next.mode === 'online' ? 'Online' : cityName(next.city)}</span>
                  </p>
                  <p className="mt-1 text-[13px] text-dim">{next.expertId ? `With ${expertById(next.expertId)?.name} (sample expert)` : `With ${execById(next.peId)?.name}`} · for {state.beneficiaries.find(b => b.id === next.beneficiaryId)?.name}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" to={`/appointments/${next.id}`}>View details</Button>
                    {next.visit && next.requestId && <Button size="sm" variant="ghost" to={`/requests/${next.requestId}/visit`}>Visit status</Button>}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState title="No upcoming appointments" body="When you book a visit or consultation it will appear here." action={<Button size="sm" to="/request/new">Request assistance</Button>} />
            )}
          </Card>
          <Card className="p-5 sm:p-6">
            <SectionHeading title="Needs your attention" action={<ArrowLink to="/notifications">View all</ArrowLink>} />
            {attention.length ? (
              <ul className="divide-y divide-line">
                {attention.map(n => (
                  <li key={n.id}>
                    <Link to={n.link} className="group flex items-start gap-3 py-3">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold" aria-hidden />
                      <span className="min-w-0 flex-1"><span className="block text-sm text-ivory group-hover:text-gold-soft">{n.title}</span><span className="block truncate text-[12.5px] text-dim">{n.body}</span></span>
                      <span className="shrink-0 text-[12px] text-dim">{relTime(n.at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="py-4 text-sm text-mute">You’re all caught up.</p>}
          </Card>
        </div>

        <Card className="flex flex-col p-5 sm:p-6">
          <SectionHeading title="Your Personal Executive" action={<Badge tone="green">Available today</Badge>} />
          <div className="flex items-center gap-4">
            <Avatar name={pe.name} src={pe.photo} size={84} />
            <div>
              <p className="serif text-2xl">{pe.name}</p>
              <p className="text-sm text-mute">{pe.role} · {cityName(pe.city)}</p>
              <p className="mt-1 text-[13px] text-dim">{pe.workingHours}</p>
            </div>
          </div>
          <p className="serif mt-6 text-[17px] italic text-ivory/80">“Ask once. Your executive takes it from there.”</p>
          <p className="mt-2 text-[13px] text-dim">{pe.experienceYears} years’ experience · {pe.languages.join(', ')} · background verified {fmtDate(pe.bgCheck?.date, { month: 'short', year: 'numeric' })}</p>
          <div className="mt-auto flex flex-wrap gap-2 pt-6">
            <Button to="/messages" icon={<MessageSquare className="size-4" />}>Message</Button>
            <Button variant="secondary" icon={<Phone className="size-4" />} onClick={() => setContact(true)}>Contact</Button>
            <Button variant="ghost" to="/team">Your team</Button>
          </div>
        </Card>
      </section>
      <ContactModal exec={pe} open={contact} onClose={() => setContact(false)} />
    </div>
  )
}

function Indicator({ icon, label, value, sub, meter, action, highlight }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub: string; meter?: React.ReactNode; action: React.ReactNode; highlight?: boolean }) {
  return (
    <li className="flex flex-col bg-surface p-4">
      <span className={cx('mb-2 grid size-8 place-items-center rounded-full bg-raised text-gold', highlight && 'text-warn')}>{icon}</span>
      <p className="text-[12.5px] leading-tight text-mute">{label}</p>
      <p className="mt-2 text-[26px] leading-tight text-ivory tabular-nums">{value}</p>
      <p className="mb-3 mt-0.5 line-clamp-2 text-[12px] text-dim">{sub}</p>
      {meter && <div className="mb-3">{meter}</div>}
      <div className="mt-auto">{action}</div>
    </li>
  )
}

function DelegateHome() {
  const { state } = useApp()
  const a = actor(state)
  if (a.kind !== 'delegate') return null
  const d = a.delegate
  const reqs = visibleRequests(state)
  const docs = visibleDocuments(state)
  const next = nextAppointment(state)
  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow mb-2">Delegate access</p>
        <h1 className="serif text-4xl">{greeting()}, {a.name.split(' ')[0]}.</h1>
        <p className="mt-2 max-w-2xl text-mute">You’re helping {state.member.name}’s family. You can only see what {state.member.firstName} has shared with you, until {fmtDate(d.expiresAt)}.</p>
      </header>
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="p-6">
          <SectionHeading title="What you can do" />
          <ul className="space-y-2 text-sm text-mute">
            <li>• Request services: {d.permissions.serviceCategories.map(categoryName).join(', ') || 'none'}</li>
            <li>• For: {d.permissions.beneficiaryIds.map(id => state.beneficiaries.find(b => b.id === id)?.name).join(', ') || 'no one'}</li>
            <li>• Approve charges: {d.permissions.approvals ? 'Yes' : 'No — the member approves'}</li>
            <li>• Track visits: {d.permissions.visits ? 'Yes' : 'No'} · Share visit OTP: {d.permissions.otp ? 'Yes' : 'No'}</li>
            <li>• Documents: {docs.length ? docs.map(x => x.name).join(', ') : 'none'}</li>
          </ul>
          <div className="mt-5 flex gap-2"><Button to="/services">Request a service</Button><Button variant="secondary" to="/documents">Shared documents</Button></div>
        </Card>
        <Card className="p-6">
          <SectionHeading title="Next visit" />
          {next ? (
            <div>
              <p className="text-ivory">{next.title}</p>
              <p className="text-sm text-mute">{fmtDate(next.date)} · {fmtTime(next.start)} · {cityName(next.city)}</p>
              <div className="mt-4 flex gap-2"><Button size="sm" variant="secondary" to={`/appointments/${next.id}`}>Details</Button>{next.visit && <Button size="sm" to={`/requests/${next.requestId}/visit`}>Visit status</Button>}</div>
            </div>
          ) : <p className="text-sm text-mute">No visits you can see.</p>}
        </Card>
      </div>
      <Card className="p-6">
        <SectionHeading title="Requests you can see" action={<ArrowLink to="/requests">All</ArrowLink>} />
        {reqs.length ? <ul className="divide-y divide-line">{reqs.slice(0, 5).map(r => <li key={r.id}><Link to={`/requests/${r.id}`} className="flex items-center justify-between gap-3 py-3 text-sm hover:text-gold-soft"><span>{r.title} <span className="text-dim">· {r.id}</span></span><StatusBadge status={r.status} /></Link></li>)}</ul> : <EmptyState icon={<FileText className="size-6" />} title="Nothing shared yet" />}
      </Card>
    </div>
  )
}
