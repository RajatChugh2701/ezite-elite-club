import {
  createContext, forwardRef, useCallback, useContext, useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, ChevronRight, Info, Loader2, Lock, ShieldCheck, X, XCircle } from 'lucide-react'
import { cx, initials } from '../lib/format'
import { useApp } from '../data/store'
import { stepUpValid } from '../data/selectors'
import { DEV_OTP } from '../data/config'

// ---------- Button ----------
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet'
const variants: Record<Variant, string> = {
  primary: 'bg-gold text-on-gold hover:bg-gold-soft border border-gold',
  secondary: 'border border-line2 text-ivory hover:border-gold/70 hover:text-gold-soft bg-transparent',
  ghost: 'text-gold-soft hover:text-ivory bg-transparent',
  danger: 'border border-bad/60 text-bad hover:bg-bad/10',
  quiet: 'bg-raised text-ivory hover:bg-line border border-line',
}
const sizes = { sm: 'h-8 px-3 text-[13px] gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-6 text-[15px] gap-2' }

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof sizes; loading?: boolean; icon?: ReactNode; to?: string; iconRight?: ReactNode }

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, iconRight, to, className, children, disabled, ...rest }, ref,
) {
  const cls = cx(
    'inline-flex items-center justify-center rounded-full font-medium transition-colors whitespace-nowrap select-none disabled:opacity-45',
    variants[variant], sizes[size], className,
  )
  const inner = (
    <>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
      {iconRight}
    </>
  )
  if (to && !disabled) return <Link to={to} className={cls} onClick={rest.onClick as unknown as React.MouseEventHandler<HTMLAnchorElement>}>{inner}</Link>
  return (
    <button ref={ref} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {inner}
    </button>
  )
})

// ---------- Layout primitives ----------
export function Card({ className, children, as: As = 'section', ...rest }: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'article' | 'li' } & Record<string, unknown>) {
  return <As className={cx('rounded-2xl border border-line bg-surface', className)} {...rest}>{children}</As>
}

export function PageHeader({ eyebrow, title, subtitle, actions, back }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <header className="mb-8 animate-fade-up">
      {back && (
        <Link to={back.to} className="mb-4 inline-flex items-center gap-1.5 text-sm text-mute hover:text-gold-soft">
          <ArrowLeft className="size-4" aria-hidden /> {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
          <h1 className="serif text-3xl leading-tight sm:text-[2.4rem]">{title}</h1>
          {subtitle && <p className="mt-2 max-w-2xl text-mute">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  )
}

export function SectionHeading({ title, action, sub }: { title: ReactNode; action?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-[17px] font-medium text-ivory">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-dim">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

export function ArrowLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cx('inline-flex items-center gap-1 text-sm text-gold-soft hover:text-ivory', className)}>
      {children} <ChevronRight className="size-4" aria-hidden />
    </Link>
  )
}

// ---------- Badges ----------
type Tone = 'gold' | 'green' | 'red' | 'amber' | 'blue' | 'neutral'
const tones: Record<Tone, string> = {
  gold: 'border-gold/40 text-gold-soft bg-gold/10',
  green: 'border-ok/35 text-ok bg-ok/10',
  red: 'border-bad/40 text-bad bg-bad/10',
  amber: 'border-warn/40 text-warn bg-warn/10',
  blue: 'border-info/35 text-info bg-info/10',
  neutral: 'border-line2 text-mute bg-raised',
}
export function Badge({ tone = 'neutral', children, className, dot = true }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}

const STATUS_TONES: Record<string, [Tone, string]> = {
  submitted: ['blue', 'Submitted'], awaiting_approval: ['amber', 'Awaiting approval'], scheduled: ['gold', 'Scheduled'], in_progress: ['blue', 'In progress'],
  on_hold: ['amber', 'On hold'], under_review: ['blue', 'Under review'], completed: ['green', 'Completed'], cancelled: ['neutral', 'Cancelled'], draft: ['neutral', 'Draft'],
  confirmed: ['green', 'Confirmed'], held: ['amber', 'Held'], pending_approval: ['amber', 'Pending approval'],
  paid: ['green', 'Paid'], unpaid: ['amber', 'Unpaid'], overdue: ['red', 'Overdue'], processing: ['blue', 'Processing'], credited: ['neutral', 'Credited'],
  success: ['green', 'Successful'], failed: ['red', 'Failed'], pending: ['amber', 'Pending'],
  sent: ['blue', 'Awaiting acceptance'], accepted: ['green', 'Active'], expired: ['neutral', 'Expired'], revoked: ['red', 'Revoked'],
  approved: ['green', 'Approved'], rejected: ['red', 'Declined'], clarification_requested: ['blue', 'Clarification requested'],
  open: ['blue', 'Open'], in_review: ['blue', 'In review'], escalated: ['amber', 'Escalated'], resolved: ['green', 'Resolved'], closed: ['neutral', 'Closed'],
  active: ['green', 'Active'], cancellation_requested: ['amber', 'Cancellation under review'], suspended: ['red', 'Suspended'],
  documents_pending: ['amber', 'Documents pending'], readiness: ['neutral', 'Readiness'], partner_review: ['blue', 'Partner review'],
  info_requested: ['amber', 'Information requested'], partner_decision: ['gold', 'Partner decision'],
}
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const [tone, label] = STATUS_TONES[status] ?? ['neutral', status]
  return <Badge tone={tone} className={className}>{label}</Badge>
}

export function SimLabel({ children = 'Simulated', className }: { children?: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 rounded border border-dashed border-sage/60 px-1.5 py-px text-[10.5px] uppercase tracking-wider text-sage-soft', className)}>{children}</span>
}

export function Notice({ tone = 'info', title, children, className, action }: { tone?: 'info' | 'warn' | 'bad' | 'ok'; title?: ReactNode; children?: ReactNode; className?: string; action?: ReactNode }) {
  const Icon = tone === 'warn' ? AlertTriangle : tone === 'bad' ? XCircle : tone === 'ok' ? CheckCircle2 : Info
  const c = { info: 'border-info/25 bg-info/5 text-info', warn: 'border-warn/30 bg-warn/5 text-warn', bad: 'border-bad/30 bg-bad/5 text-bad', ok: 'border-ok/30 bg-ok/5 text-ok' }[tone]
  return (
    <div className={cx('flex gap-3 rounded-xl border p-3.5 text-sm', c, className)} role={tone === 'bad' ? 'alert' : undefined}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 text-ivory/90">
        {title && <p className="font-medium text-ivory">{title}</p>}
        {children && <div className={cx(!!title && 'mt-0.5', 'text-mute')}>{children}</div>}
      </div>
      {action}
    </div>
  )
}

// ---------- Forms ----------
const fieldBase = 'w-full rounded-xl border border-line2 bg-bg2 px-3.5 text-[14.5px] text-ivory placeholder:text-dim transition-colors hover:border-dim focus:border-gold focus:outline-none aria-[invalid=true]:border-bad'

export function Field({ label, hint, error, required, children, className, htmlFor }: { label: ReactNode; hint?: ReactNode; error?: string; required?: boolean; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-mute">
        {label}{required && <span className="text-gold" aria-hidden> *</span>}
      </label>
      {children}
      {error ? <p className="text-[12.5px] text-bad" role="alert">{error}</p> : hint ? <p className="text-[12.5px] text-dim">{hint}</p> : null}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...rest }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cx(fieldBase, 'h-11', className)} {...rest} />
})
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select({ className, invalid, children, ...rest }, ref) {
  return <select ref={ref} aria-invalid={invalid || undefined} className={cx(fieldBase, 'h-11 pr-8', className)} {...rest}>{children}</select>
})
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea({ className, invalid, ...rest }, ref) {
  return <textarea ref={ref} aria-invalid={invalid || undefined} className={cx(fieldBase, 'min-h-24 py-2.5', className)} {...rest} />
})

export function Checkbox({ checked, onChange, label, description, disabled, id }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean; id?: string }) {
  const auto = useId()
  const cid = id ?? auto
  return (
    <label htmlFor={cid} className={cx('flex cursor-pointer items-start gap-3', disabled && 'cursor-not-allowed opacity-50')}>
      <span className="relative mt-0.5 inline-flex">
        <input id={cid} type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
        <span className="grid size-[18px] place-items-center rounded-[5px] border border-dim bg-bg2 transition-colors peer-checked:border-gold peer-checked:bg-gold peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold">
          {checked && <Check className="size-3.5 text-on-gold" strokeWidth={3} aria-hidden />}
        </span>
      </span>
      <span className="text-sm">
        <span className="text-ivory">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-dim">{description}</span>}
      </span>
    </label>
  )
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean }) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm text-ivory">{label}</label>
        {description && <p className="text-[13px] text-dim">{description}</p>}
      </div>
      <button id={id} type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={cx('relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-40', checked ? 'border-gold bg-gold/90' : 'border-line2 bg-raised')}>
        <span className={cx('absolute top-0.5 size-[18px] rounded-full transition-all', checked ? 'left-[22px] bg-on-gold' : 'left-0.5 bg-mute')} />
        <span className="sr-only">{checked ? 'On' : 'Off'}</span>
      </button>
    </div>
  )
}

export function ChoiceCards<T extends string>({ value, onChange, options, name, columns = 2 }: { value: T | undefined; onChange: (v: T) => void; options: { value: T; label: ReactNode; description?: ReactNode; disabled?: boolean; aside?: ReactNode }[]; name: string; columns?: 1 | 2 | 3 }) {
  return (
    <div role="radiogroup" aria-label={name} className={cx('grid gap-3', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3')}>
      {options.map(o => {
        const sel = value === o.value
        return (
          <button key={o.value} type="button" role="radio" aria-checked={sel} disabled={o.disabled} onClick={() => onChange(o.value)}
            className={cx('flex items-start gap-3 rounded-xl border p-4 text-left transition-colors disabled:opacity-40',
              sel ? 'border-gold bg-gold/[0.07]' : 'border-line bg-bg2 hover:border-line2')}>
            <span className={cx('mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border', sel ? 'border-gold' : 'border-dim')}>
              {sel && <span className="size-2 rounded-full bg-gold" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-ivory">{o.label}</span>
                {o.aside}
              </span>
              {o.description && <span className="mt-1 block text-[13px] text-dim">{o.description}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-line bg-bg2 p-1">
      {options.map(o => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cx('rounded-full px-3.5 py-1.5 text-[13px] transition-colors', value === o.value ? 'bg-raised text-ivory shadow-sm ring-1 ring-line2' : 'text-mute hover:text-ivory')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ---------- Tabs ----------
export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { value: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  return (
    <div role="tablist" aria-label={label} className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      {tabs.map((t, i) => (
        <button key={t.value} ref={el => { refs.current[i] = el }} role="tab" type="button" aria-selected={value === t.value} tabIndex={value === t.value ? 0 : -1}
          onClick={() => onChange(t.value)}
          onKeyDown={e => {
            const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
            if (!d) return
            const n = (i + d + tabs.length) % tabs.length
            onChange(tabs[n].value); refs.current[n]?.focus()
          }}
          className={cx('relative -mb-px shrink-0 border-b-2 px-3 py-3 text-sm transition-colors',
            value === t.value ? 'border-gold text-ivory' : 'border-transparent text-mute hover:text-ivory')}>
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-raised px-1.5 text-[11px] text-mute">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

// ---------- Feedback ----------
export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: ReactNode; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-12 text-center', className)}>
      {icon && <div className="mb-3 text-gold/80">{icon}</div>}
      <p className="font-medium text-ivory">{title}</p>
      {body && <p className="mt-1 max-w-md text-sm text-mute">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function AccessDenied({ reason = 'forbidden', what = 'this page' }: { reason?: 'forbidden' | 'not_found'; what?: string }) {
  const { state } = useApp()
  const isDelegate = state.session.actorId !== 'member'
  if (reason === 'not_found')
    return <EmptyState icon={<Info className="size-7" />} title="We couldn’t find that" body={`The ${what} you’re looking for doesn’t exist or may have been removed.`} action={<Button to="/home" variant="secondary">Return home</Button>} className="my-10" />
  return (
    <EmptyState icon={<Lock className="size-7" />} title="You don’t have access" className="my-10"
      body={isDelegate ? `Your delegated permissions don’t include ${what}. Ask the member to update your access if you need it.` : `You are not authorised to view ${what}.`}
      action={<Button to="/home" variant="secondary">Return home</Button>} />
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <span role="status" className="inline-flex items-center gap-2 text-sm text-mute"><Loader2 className="size-4 animate-spin" aria-hidden />{label}</span>
}

export function Avatar({ name, src, size = 40, className }: { name: string; src?: string; size?: number; className?: string }) {
  const [err, setErr] = useState(false)
  return src && !err ? (
    <img src={src} alt="" onError={() => setErr(true)} width={size} height={size} className={cx('shrink-0 rounded-full object-cover ring-1 ring-line2', className)} style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className={cx('serif grid shrink-0 place-items-center rounded-full bg-raised text-gold-soft ring-1 ring-line2', className)} style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials(name)}
    </span>
  )
}

export function Meter({ value, max, label, tone = 'gold' }: { value: number; max: number; label: string; tone?: 'gold' | 'sage' | 'bad' }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-1 w-full overflow-hidden rounded-full bg-line">
      <div className={cx('h-full rounded-full transition-all duration-700', tone === 'gold' ? 'bg-gold' : tone === 'sage' ? 'bg-sage-soft' : 'bg-bad')} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Stepper({ steps, current, onStep }: { steps: string[]; current: number; onStep?: (i: number) => void }) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <p className="mb-3 text-sm text-mute sm:hidden">Step {current + 1} of {steps.length} · <span className="text-ivory">{steps[current]}</span></p>
      <div className="h-1 overflow-hidden rounded-full bg-line sm:hidden"><div className="h-full bg-gold transition-all" style={{ width: `${((current + 1) / steps.length) * 100}%` }} /></div>
      <ol className="hidden items-center gap-2 sm:flex">
        {steps.map((s, i) => (
          <li key={s} className="flex min-w-0 flex-1 items-center gap-2">
            <button type="button" disabled={!onStep || i > current} onClick={() => onStep?.(i)} aria-current={i === current ? 'step' : undefined}
              className={cx('flex min-w-0 items-center gap-2 text-left text-[12.5px] disabled:cursor-default', i === current ? 'text-ivory' : i < current ? 'text-gold-soft hover:text-ivory' : 'text-dim')}>
              <span className={cx('grid size-6 shrink-0 place-items-center rounded-full border text-[11px]', i < current ? 'border-gold bg-gold text-on-gold' : i === current ? 'border-gold text-gold' : 'border-line2')}>
                {i < current ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className="truncate">{s}</span>
            </button>
            {i < steps.length - 1 && <span className="h-px min-w-3 flex-1 bg-line" aria-hidden />}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function KV({ items, className }: { items: [ReactNode, ReactNode][]; className?: string }) {
  return (
    <dl className={cx('divide-y divide-line', className)}>
      {items.map(([k, v], i) => (
        <div key={i} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:justify-between sm:gap-6">
          <dt className="text-sm text-dim">{k}</dt>
          <dd className="text-sm text-ivory sm:text-right">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

// ---------- Modal ----------
const modalStack: symbol[] = []
export function Modal({ open, onClose, title, children, footer, size = 'md', description }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg'; description?: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    const onClose = () => closeRef.current()
    const me = Symbol()
    modalStack.push(me)
    const prev = document.activeElement as HTMLElement | null
    const t = setTimeout(() => {
      const first = panel.current?.querySelector<HTMLElement>('[data-autofocus], input:not([type=hidden]):not([disabled]), select, textarea, button:not([data-close])')
      ;(first ?? panel.current)?.focus()
    }, 20)
    const onKey = (e: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== me) return // only the top-most dialog handles keys
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
      if (e.key === 'Tab' && panel.current) {
        const f = Array.from(panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el => el.offsetParent !== null)
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      clearTimeout(t); document.removeEventListener('keydown', onKey)
      modalStack.splice(modalStack.indexOf(me), 1)
      if (!modalStack.length) document.body.style.overflow = ''
      prev?.focus?.()
    }
  }, [open])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-scrim backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={cx('relative flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-line bg-surface shadow-2xl animate-fade-up sm:rounded-2xl',
          size === 'sm' ? 'sm:max-w-md' : size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-xl')}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <h2 id={titleId} className="serif text-xl">{title}</h2>
            {description && <p className="mt-1 text-sm text-mute">{description}</p>}
          </div>
          <button data-close type="button" onClick={onClose} className="-mr-1 rounded-full p-1.5 text-mute hover:bg-raised hover:text-ivory" aria-label="Close dialog">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel = 'Confirm', tone = 'primary', loading }: { open: boolean; onClose: () => void; onConfirm: () => void; title: ReactNode; children?: ReactNode; confirmLabel?: string; tone?: 'primary' | 'danger'; loading?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Go back</Button><Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button></>}>
      <div className="text-sm text-mute">{children}</div>
    </Modal>
  )
}

// ---------- Toasts + step-up (global UI services) ----------
type Toast = { id: number; tone: 'ok' | 'bad' | 'info'; title: string; body?: string }
interface UICtx { toast: (t: Omit<Toast, 'id'>) => void; requireStepUp: (reason: string, fn: () => void) => void }
const UI = createContext<UICtx | null>(null)
export const useUI = () => {
  const v = useContext(UI)
  if (!v) throw new Error('useUI outside UIProvider')
  return v
}

export function UIProvider({ children }: { children: ReactNode }) {
  const { state, actions } = useApp()
  const [toasts, setToasts] = useState<Toast[]>([])
  const [pending, setPending] = useState<{ reason: string; fn: () => void } | null>(null)
  const [code, setCode] = useState('')
  const [err, setErr] = useState<string>()

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setToasts(x => [...x, { ...t, id }])
    setTimeout(() => setToasts(x => x.filter(y => y.id !== id)), 4800)
  }, [])

  const stateRef = useRef(state)
  stateRef.current = state
  const requireStepUp = useCallback((reason: string, fn: () => void) => {
    if (stepUpValid(stateRef.current)) fn()
    else { setCode(''); setErr(undefined); setPending({ reason, fn }) }
  }, [])

  const verify = () => {
    const r = actions.stepUp(code)
    if (!r.ok) return setErr(r.error)
    const fn = pending?.fn
    setPending(null)
    setTimeout(() => fn?.(), 0)
  }

  return (
    <UI.Provider value={{ toast, requireStepUp }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6">
        {toasts.map(t => (
          <div key={t.id} role="status" className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line2 bg-raised px-4 py-3 shadow-xl animate-fade-up">
            {t.tone === 'ok' ? <CheckCircle2 className="mt-0.5 size-4 text-ok" aria-hidden /> : t.tone === 'bad' ? <XCircle className="mt-0.5 size-4 text-bad" aria-hidden /> : <Info className="mt-0.5 size-4 text-info" aria-hidden />}
            <div className="min-w-0 text-sm">
              <p className="text-ivory">{t.title}</p>
              {t.body && <p className="text-[13px] text-mute">{t.body}</p>}
            </div>
            <button className="ml-auto text-dim hover:text-ivory" onClick={() => setToasts(x => x.filter(y => y.id !== t.id))} aria-label="Dismiss"><X className="size-4" /></button>
          </div>
        ))}
      </div>
      <Modal open={!!pending} onClose={() => setPending(null)} title="Confirm it’s you" size="sm"
        description={pending?.reason}
        footer={<><Button variant="secondary" onClick={() => setPending(null)}>Cancel</Button><Button onClick={verify} icon={<ShieldCheck className="size-4" />}>Verify</Button></>}>
        <form onSubmit={e => { e.preventDefault(); verify() }} className="space-y-4">
          <p className="text-sm text-mute">For your security, sensitive actions need a fresh verification code sent to your mobile ending {state.member.mobile.replace(/\D/g, '').slice(-4)}.</p>
          <Field label="Verification code" error={err} htmlFor="stepup-otp">
            <Input id="stepup-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} invalid={!!err} />
          </Field>
          <DevOtpHint />
        </form>
      </Modal>
    </UI.Provider>
  )
}

export function DevOtpHint() {
  return (
    <p className="flex items-center gap-2 rounded-lg border border-dashed border-sage/50 bg-sage/5 px-3 py-2 text-[13px] text-sage-soft">
      <SimLabel>Dev only</SimLabel> No message is sent. Use code <code className="font-mono text-ivory">{DEV_OTP}</code>
    </p>
  )
}

export function OtpInput({ value, onChange, invalid, id }: { value: string; onChange: (v: string) => void; invalid?: boolean; id?: string }) {
  return <Input id={id} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" value={value} onChange={e => onChange(e.target.value.replace(/\D/g, ''))} invalid={invalid} className="font-mono tracking-[0.4em]" />
}
