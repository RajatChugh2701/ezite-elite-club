import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell, Bot, CalendarDays, ChevronDown, CreditCard, FileLock2, Home, Landmark, LifeBuoy, LogOut, Menu, RotateCcw, ShieldCheck, Sparkles,
  UserRound, Users, UsersRound, ClipboardList, Crown, Eye, X,
} from 'lucide-react'
import { useApp } from '../data/store'
import { actor, delegateActive } from '../data/selectors'
import { POLICY } from '../data/config'
import { cx, relTime } from '../lib/format'
import { Avatar, Button, ConfirmDialog, SimLabel, useUI } from './ui'
import { setTheme, useTheme } from '../lib/theme'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const { resolved } = useTheme()
  const next = resolved === 'dark' ? 'light' : 'dark'
  return (
    <button type="button" onClick={e => setTheme(next, { x: e.clientX, y: e.clientY })} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}
      className="relative grid size-9 place-items-center rounded-full text-mute transition-colors hover:bg-raised hover:text-ivory">
      <Sun className={cx('absolute size-[18px] transition-all duration-500', resolved === 'dark' ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0')} aria-hidden />
      <Moon className={cx('absolute size-[18px] transition-all duration-500', resolved === 'light' ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-50 opacity-0')} aria-hidden />
    </button>
  )
}

export const MORE_ITEMS = [
  { to: '/membership', label: 'My Membership', icon: Crown, desc: 'Plan, entitlements and ledger' },
  { to: '/appointments', label: 'Appointments', icon: CalendarDays, desc: 'Bookings and consultations' },
  { to: '/team', label: 'My Concierge Team', icon: UsersRound, desc: 'Your executive and escalation contacts' },
  { to: '/documents', label: 'Documents & Vault', icon: FileLock2, desc: 'Upload, share and revoke' },
  { to: '/payments', label: 'Payments & Wallet', icon: CreditCard, desc: 'Invoices, usage and refunds' },
  { to: '/financial', label: 'Financial Services', icon: Landmark, desc: 'Emergency funding and estate cases' },
  { to: '/assistant', label: 'AI Concierge', icon: Bot, desc: 'Simulated assistant' },
  { to: '/support', label: 'Support', icon: LifeBuoy, desc: 'Help, complaints and feedback' },
  { to: '/profile', label: 'Profile & Security', icon: ShieldCheck, desc: 'Details, consent and sessions' },
]

const PRIMARY = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/services', label: 'Services', icon: Sparkles },
  { to: '/requests', label: 'My Requests', icon: ClipboardList },
  { to: '/family', label: 'My Family', icon: Users },
]

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <path d="M16 3.5l10 4.8v8.2c0 6.2-4.3 10-10 12-5.7-2-10-5.8-10-12V8.3z" fill="none" className="stroke-gold" strokeWidth="1.3" />
        <path d="M16 10v13M16 15.5l-3.6-2.6M16 19l3.6-2.6" className="stroke-gold" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </svg>
      <span className="leading-none">
        <span className="serif block text-[17px] tracking-[0.14em] text-ivory">EZIT ELITE</span>
        {!compact && <span className="mt-1 block text-[9.5px] tracking-[0.22em] text-gold">MEMBERSHIP & CONCIERGE</span>}
      </span>
    </span>
  )
}

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open, close])
  return ref
}

function Popover({ label, button, children, open, setOpen, align = 'right', className }: { label: string; button: ReactNode; children: ReactNode; open: boolean; setOpen: (v: boolean) => void; align?: 'left' | 'right'; className?: string }) {
  const ref = useOutside(open, () => setOpen(false))
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="true" aria-expanded={open} aria-label={label} onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm text-mute transition-colors hover:text-ivory">
        {button}
      </button>
      {open && (
        <div className={cx('absolute top-full z-50 mt-2 rounded-2xl border border-line bg-surface p-2 shadow-2xl animate-fade-up', align === 'right' ? 'right-0' : 'left-0', className)}>
          {children}
        </div>
      )}
    </div>
  )
}

export function AppLayout() {
  const { state, actions } = useApp()
  const { toast } = useUI()
  const nav = useNavigate()
  const loc = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const [meOpen, setMeOpen] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const a = actor(state)
  const unread = state.notifications.filter(n => !n.read).length
  const moreActive = MORE_ITEMS.some(i => loc.pathname.startsWith(i.to)) || loc.pathname.startsWith('/consultations') || loc.pathname.startsWith('/messages')

  useEffect(() => { setMoreOpen(false); setBellOpen(false); setMeOpen(false); setSheet(false); window.scrollTo(0, 0) }, [loc.pathname])

  // Prototype session expiry
  useEffect(() => {
    const check = () => {
      const st = state.session.startedAt
      if (st && Date.now() - new Date(st).getTime() > POLICY.sessionMaxHours * 3600000) { actions.logout(true); nav('/login') }
    }
    check()
    const t = setInterval(check, 60000)
    return () => clearInterval(t)
  }, [state.session.startedAt, actions, nav])

  // A revoked delegate loses access immediately.
  useEffect(() => {
    if (a.kind === 'delegate' && !delegateActive(a.delegate)) {
      actions.switchActor('member')
      toast({ tone: 'info', title: 'Delegate preview ended', body: `${a.name}’s access is no longer active.` })
    }
  }, [a, actions, toast])

  const activeDelegates = state.delegates.filter(delegateActive)

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-lg focus:bg-gold focus:px-3 focus:py-2 focus:text-on-gold">Skip to content</a>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link to="/home" aria-label="EZIT ELITE home"><Logo compact /></Link>
          <nav aria-label="Primary" className="hidden flex-1 items-center gap-1 md:flex">
            {PRIMARY.map(i => (
              <NavLink key={i.to} to={i.to} className={({ isActive }) => cx('relative rounded-full px-3.5 py-2 text-[14px] transition-colors', isActive ? 'text-ivory' : 'text-mute hover:text-ivory')}>
                {({ isActive }) => <>{i.label}{isActive && <span className="absolute inset-x-3.5 -bottom-[13px] h-px bg-gold" aria-hidden />}</>}
              </NavLink>
            ))}
            <Popover label="More" open={moreOpen} setOpen={setMoreOpen} align="left" className="w-[520px]"
              button={<span className={cx('relative flex items-center gap-1 px-1.5 text-[14px]', moreActive && 'text-ivory')}>More <ChevronDown className="size-3.5" aria-hidden />{moreActive && <span className="absolute inset-x-1.5 -bottom-[15px] h-px bg-gold" aria-hidden />}</span>}>
              <ul className="grid grid-cols-2 gap-0.5">
                {MORE_ITEMS.map(i => (
                  <li key={i.to}>
                    <NavLink to={i.to} className={({ isActive }) => cx('flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-raised', isActive && 'bg-raised')}>
                      <i.icon className="mt-0.5 size-4 text-gold" aria-hidden />
                      <span><span className="block text-sm text-ivory">{i.label}</span><span className="block text-[12px] text-dim">{i.desc}</span></span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </Popover>
          </nav>
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <ThemeToggle />
            <Popover label={`Notifications, ${unread} unread`} open={bellOpen} setOpen={setBellOpen} className="w-[min(92vw,380px)]"
              button={<span className="relative"><Bell className="size-5" aria-hidden />{unread > 0 && <span className="absolute -right-1.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-semibold text-on-gold">{unread}</span>}</span>}>
              <div className="flex items-center justify-between px-2 pb-2 pt-1">
                <p className="text-sm font-medium">Notifications</p>
                <button className="text-[12.5px] text-gold-soft hover:text-ivory disabled:opacity-40" disabled={!unread} onClick={() => actions.markAllRead()}>Mark all as read</button>
              </div>
              <ul className="max-h-[360px] overflow-y-auto">
                {state.notifications.slice(0, 6).map(n => (
                  <li key={n.id}>
                    <button onClick={() => { actions.markRead(n.id); nav(n.link) }} className="flex w-full gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-raised">
                      <span className={cx('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-gold')} aria-label={n.read ? undefined : 'Unread'} />
                      <span className="min-w-0">
                        <span className={cx('block text-[13.5px]', n.read ? 'text-mute' : 'text-ivory')}>{n.title}</span>
                        <span className="block truncate text-[12.5px] text-dim">{n.body}</span>
                        <span className="block text-[11.5px] text-dim">{relTime(n.at)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <Link to="/notifications" className="mt-1 block rounded-xl px-2 py-2 text-center text-[13px] text-gold-soft hover:bg-raised">View all notifications</Link>
            </Popover>
            <Popover label="Account menu" open={meOpen} setOpen={setMeOpen} className="w-72"
              button={<><Avatar name={a.name} src={a.kind === 'member' ? state.member.photo : undefined} size={32} /><span className="hidden text-ivory lg:inline">{a.name.split(' ')[0]}</span><ChevronDown className="hidden size-3.5 lg:block" aria-hidden /></>}>
              <div className="border-b border-line px-3 pb-3 pt-1">
                <p className="text-sm text-ivory">{a.name}</p>
                <p className="text-[12.5px] text-dim">{a.kind === 'member' ? `${state.membership.memberNo} · Member` : 'Delegate (limited access)'}</p>
              </div>
              <div className="border-b border-line px-3 py-3">
                <label htmlFor="viewas" className="mb-1.5 flex items-center gap-1.5 text-[12px] text-dim"><Eye className="size-3.5" aria-hidden /> View portal as <SimLabel>Demo</SimLabel></label>
                <select id="viewas" value={state.session.actorId} onChange={e => { const r = actions.switchActor(e.target.value); if (r.ok) { toast({ tone: 'info', title: e.target.value === 'member' ? 'Viewing as member' : 'Previewing delegate access' }); nav('/home') } }}
                  className="h-9 w-full rounded-lg border border-line2 bg-bg2 px-2 text-sm">
                  <option value="member">{state.member.name} (member)</option>
                  {activeDelegates.map(d => <option key={d.id} value={d.id}>{d.name} (delegate)</option>)}
                </select>
              </div>
              <Link to="/profile" className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-raised"><UserRound className="size-4 text-gold" aria-hidden />Profile & Security</Link>
              <button onClick={() => setResetOpen(true)} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-raised"><RotateCcw className="size-4 text-gold" aria-hidden />Reset demo data</button>
              <button onClick={() => { actions.logout(); nav('/login') }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-raised"><LogOut className="size-4 text-gold" aria-hidden />Log out</button>
            </Popover>
          </div>
        </div>
      </header>

      {a.kind === 'delegate' && (
        <div className="border-b border-sage/30 bg-sage/10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-[13px] sm:px-6">
            <Eye className="size-4 text-sage-soft" aria-hidden />
            <span>Viewing as <strong className="font-medium">{a.name}</strong>, delegate for {state.member.name}. Only permitted services, documents and visits are available.</span>
            <button className="ml-auto text-gold-soft underline-offset-2 hover:underline" onClick={() => { actions.switchActor('member'); nav('/home') }}>Return to member view</button>
          </div>
        </div>
      )}

      <main id="main" className="mx-auto max-w-6xl px-4 pb-28 pt-8 sm:px-6 md:pb-16">
        <Outlet />
      </main>

      <footer className="hidden border-t border-line md:block">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-6 text-[12.5px] text-dim">
          <span className="serif text-mute">Everything that matters, taken care of.</span>
          <span className="flex items-center gap-2"><SimLabel>Prototype</SimLabel> Fictional data; payments, OTP, maps, messaging and partners are simulated.</span>
          <span className="ml-auto flex gap-4"><Link to="/legal/terms" className="hover:text-ivory">Terms</Link><Link to="/legal/privacy" className="hover:text-ivory">Privacy</Link><Link to="/support" className="hover:text-ivory">Support</Link></span>
        </div>
      </footer>

      {/* Mobile bottom navigation */}
      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        <ul className="grid grid-cols-5">
          {PRIMARY.map(i => (
            <li key={i.to}>
              <NavLink to={i.to} className={({ isActive }) => cx('flex flex-col items-center gap-1 py-2.5 text-[10.5px]', isActive ? 'text-gold' : 'text-mute')}>
                <i.icon className="size-5" aria-hidden />{i.label.replace('My ', '')}
              </NavLink>
            </li>
          ))}
          <li>
            <button onClick={() => setSheet(true)} aria-expanded={sheet} className={cx('flex w-full flex-col items-center gap-1 py-2.5 text-[10.5px]', moreActive ? 'text-gold' : 'text-mute')}>
              <Menu className="size-5" aria-hidden />More
            </button>
          </li>
        </ul>
      </nav>
      {sheet && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="More">
          <div className="absolute inset-0 bg-scrim" onClick={() => setSheet(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-line bg-surface p-4 pb-8 animate-fade-up">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="serif text-lg">More</p>
              <button onClick={() => setSheet(false)} aria-label="Close" className="rounded-full p-1.5 text-mute hover:bg-raised"><X className="size-5" /></button>
            </div>
            <ul>
              {MORE_ITEMS.map(i => (
                <li key={i.to}>
                  <NavLink to={i.to} className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-raised">
                    <i.icon className="size-5 text-gold" aria-hidden />
                    <span><span className="block text-[15px]">{i.label}</span><span className="block text-[12.5px] text-dim">{i.desc}</span></span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <ConfirmDialog open={resetOpen} onClose={() => setResetOpen(false)} tone="danger" confirmLabel="Reset demo data" title="Reset all demo data?"
        onConfirm={() => { actions.resetDemo(); setResetOpen(false); toast({ tone: 'ok', title: 'Demo data reset' }); nav('/') }}>
        This restores the original sample member, requests, invoices and documents, and signs you out. Changes you made in this browser will be lost.
      </ConfirmDialog>
    </div>
  )
}

export function PublicHeader() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" aria-label="EZIT ELITE"><Logo /></Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" to="/login">Sign in</Button>
          <Button size="sm" to="/apply">Apply</Button>
        </div>
      </div>
    </header>
  )
}
