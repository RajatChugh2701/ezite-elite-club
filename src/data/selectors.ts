// Pure derived values + permission checks. Balances are always computed from the ledger,
// never stored, so the dashboard cannot drift from the usage history.

import type { AppState, Appointment, Approval, Delegate, EntitlementKey, Invoice, RequestStatus, ServiceRequest, VaultDocument } from './types'
import { EXECUTIVES, EXPERTS, POLICY, planByCode, serviceById, consultTypeById } from './config'
import { addDays, addMinutes, dateTime, parseDate, toISODate, toMin } from '../lib/format'

// ---------- entitlements ----------
export function balance(s: AppState, ent: EntitlementKey) {
  let granted = 0, consumed = 0, reversed = 0, held = 0, adjusted = 0, expired = 0
  for (const e of s.ledger) {
    if (e.ent !== ent) continue
    if (e.kind === 'grant') granted += e.amount
    else if (e.kind === 'consume') consumed += -e.amount
    else if (e.kind === 'reversal') reversed += e.amount
    else if (e.kind === 'hold') held += -e.amount
    else if (e.kind === 'release') held -= e.amount
    else if (e.kind === 'adjustment') adjusted += e.amount
    else if (e.kind === 'expiry') expired += -e.amount
  }
  const available = granted - consumed + reversed - held + adjusted - expired
  const used = consumed - reversed
  const last = s.ledger.filter(e => e.ent === ent).reduce((a, e) => (e.at > a ? e.at : a), '')
  return { granted, consumed, reversed, held, adjusted, expired, used, available, total: granted + adjusted, lastEntryAt: last }
}

export function heldFor(s: AppState, refId: string, ent: EntitlementKey) {
  return s.ledger.filter(e => e.refId === refId && e.ent === ent && (e.kind === 'hold' || e.kind === 'release')).reduce((a, e) => a - e.amount, 0)
}

export const plan = (s: AppState) => planByCode(s.membership.planCode)!

// PRD S15: first five *eligible* consultations per benefit year use included credits.
export const consultCreditFree = (s: AppState, typeId: string) =>
  !!consultTypeById(typeId)?.creditEligible && balance(s, 'consult').available >= 1

// ---------- invoices ----------
export function invoiceTotals(inv: Invoice, s: AppState) {
  const subtotal = inv.lines.reduce((a, l) => a + l.qty * l.rate, 0)
  const tax = Math.round(inv.lines.reduce((a, l) => a + l.qty * l.rate * l.taxRate, 0))
  const total = subtotal + tax
  const payments = s.payments.filter(p => p.invoiceId === inv.id)
  const paid = payments.filter(p => p.status === 'success').reduce((a, p) => a + p.amount, 0)
  const credit = inv.creditApplied ?? 0
  const due = Math.max(0, total - paid - credit)
  const pending = payments.some(p => p.status === 'pending')
  const today = toISODate(new Date())
  const status: 'paid' | 'credited' | 'overdue' | 'unpaid' | 'processing' =
    due === 0 ? (credit >= total ? 'credited' : 'paid') : pending ? 'processing' : inv.dueDate < today ? 'overdue' : 'unpaid'
  return { subtotal, tax, total, paid, credit, due, status, payments }
}

export const unpaidInvoices = (s: AppState) => s.invoices.filter(i => invoiceTotals(i, s).due > 0)
export const unpaidBalance = (s: AppState) => unpaidInvoices(s).reduce((a, i) => a + invoiceTotals(i, s).due, 0)

// Postpaid unbilled usage = approved extras + postpaid request quotes not yet invoiced.
export function unbilledUsage(s: AppState) {
  const invoicedReq = new Set(s.invoices.map(i => i.requestId).filter(Boolean))
  const items: { label: string; amount: number; ref: string; date: string }[] = []
  for (const a of s.approvals) if (a.status === 'approved') items.push({ label: a.title, amount: a.amountINR, ref: a.requestId, date: a.decidedAt ?? a.createdAt })
  for (const r of s.requests)
    if (r.funding === 'postpaid' && r.quote && r.quote.total > 0 && !invoicedReq.has(r.id) && !['cancelled', 'awaiting_approval'].includes(r.status))
      items.push({ label: r.title, amount: r.quote.total, ref: r.id, date: r.createdAt })
  return { items, total: items.reduce((a, i) => a + i.amount, 0) }
}

// ---------- actor & permissions ----------
export type Actor = { kind: 'member'; name: string } | { kind: 'delegate'; name: string; delegate: Delegate }

export const delegateActive = (d: Delegate) => d.status === 'accepted' && d.expiresAt >= toISODate(new Date())
export const inviteExpiresAt = (d: Delegate) => (d.sentAt ? toISODate(addDays(new Date(d.sentAt), 7)) : undefined)

export function actor(s: AppState): Actor {
  if (s.session.actorId === 'member') return { kind: 'member', name: s.member.name }
  const d = s.delegates.find(x => x.id === s.session.actorId)
  // A revoked/expired delegate session has no rights: treat as an unauthorised delegate.
  return { kind: 'delegate', name: d?.name ?? 'Unknown delegate', delegate: d ?? ({ status: 'revoked', permissions: { serviceCategories: [], documentIds: [], approvals: false, visits: false, otp: false, beneficiaryIds: [] } } as unknown as Delegate) }
}

export type Area = 'membership' | 'payments' | 'family' | 'financial' | 'team' | 'support' | 'profile' | 'assistant' | 'messages' | 'consultations'

export function canAccessArea(s: AppState, area: Area) {
  const a = actor(s)
  if (a.kind === 'member') return true
  if (!delegateActive(a.delegate)) return false
  return area === 'profile' // delegates may only view their own access summary
}

const requestCategory = (r: ServiceRequest) =>
  r.kind === 'consultation' ? 'consult' : r.serviceId ? serviceById(r.serviceId)?.categoryId : undefined

export function canViewRequest(s: AppState, r: ServiceRequest) {
  const a = actor(s)
  if (a.kind === 'member') return true
  const d = a.delegate
  if (!delegateActive(d)) return false
  if (r.ownerId === d.id) return true
  const cat = requestCategory(r)
  return !!cat && d.permissions.serviceCategories.includes(cat) && d.permissions.beneficiaryIds.includes(r.beneficiaryId)
}

export function canRequestService(s: AppState, serviceId: string, beneficiaryId?: string) {
  const a = actor(s)
  if (a.kind === 'member') return true
  const d = a.delegate
  if (!delegateActive(d)) return false
  const cat = serviceById(serviceId)?.categoryId
  return !!cat && d.permissions.serviceCategories.includes(cat) && (!beneficiaryId || d.permissions.beneficiaryIds.includes(beneficiaryId))
}

export function canApprove(s: AppState, ap: Approval) {
  const a = actor(s)
  if (a.kind === 'member') return true
  const req = s.requests.find(r => r.id === ap.requestId)
  return delegateActive(a.delegate) && a.delegate.permissions.approvals && !!req && canViewRequest(s, req)
}

export function canViewDocument(s: AppState, doc: VaultDocument) {
  const a = actor(s)
  if (a.kind === 'member') return true
  return delegateActive(a.delegate) && a.delegate.permissions.documentIds.includes(doc.id)
}

export function canTrackVisit(s: AppState, appt: Appointment) {
  const a = actor(s)
  const req = appt.requestId ? s.requests.find(r => r.id === appt.requestId) : undefined
  if (a.kind === 'member') return true
  return delegateActive(a.delegate) && a.delegate.permissions.visits && !!req && canViewRequest(s, req)
}

export function canUseVisitOtp(s: AppState, appt: Appointment) {
  const a = actor(s)
  if (a.kind === 'member') return true
  return canTrackVisit(s, appt) && a.delegate.permissions.otp
}

type Guarded<T> = { ok: true; data: T } | { ok: false; reason: 'not_found' | 'forbidden' }

export function getRequest(s: AppState, id?: string): Guarded<ServiceRequest> {
  const r = s.requests.find(x => x.id === id)
  if (!r) return { ok: false, reason: 'not_found' }
  return canViewRequest(s, r) ? { ok: true, data: r } : { ok: false, reason: 'forbidden' }
}

export function getDocument(s: AppState, id?: string): Guarded<VaultDocument> {
  const d = s.documents.find(x => x.id === id)
  if (!d) return { ok: false, reason: 'not_found' }
  return canViewDocument(s, d) ? { ok: true, data: d } : { ok: false, reason: 'forbidden' }
}

export function getAppointment(s: AppState, id?: string): Guarded<Appointment> {
  const a = s.appointments.find(x => x.id === id)
  if (!a) return { ok: false, reason: 'not_found' }
  if (actor(s).kind === 'member') return { ok: true, data: a }
  const req = a.requestId ? s.requests.find(r => r.id === a.requestId) : undefined
  return req && canViewRequest(s, req) ? { ok: true, data: a } : { ok: false, reason: 'forbidden' }
}

export const visibleRequests = (s: AppState) => s.requests.filter(r => canViewRequest(s, r))
export const visibleDocuments = (s: AppState) => s.documents.filter(d => canViewDocument(s, d))
export const visibleAppointments = (s: AppState) =>
  s.appointments.filter(a => getAppointment(s, a.id).ok)

export const pendingApprovals = (s: AppState) =>
  s.approvals.filter(a => a.status === 'pending' && canApprove(s, a))

export function stepUpValid(s: AppState) {
  if (!s.security.stepUpForSensitive) return true
  const t = s.session.lastStepUpAt
  return !!t && Date.now() - new Date(t).getTime() < POLICY.stepUpValidityMin * 60000
}

// ---------- appointments ----------
export const apptStart = (a: Appointment) => dateTime(a.date, a.start)
export const apptEnd = (a: Appointment) => dateTime(a.date, a.end)
export const isUpcoming = (a: Appointment) => ['confirmed', 'held', 'pending_approval'].includes(a.status) && apptEnd(a).getTime() > Date.now()

export function nextAppointment(s: AppState) {
  return visibleAppointments(s).filter(isUpcoming).sort((a, b) => apptStart(a).getTime() - apptStart(b).getTime())[0]
}

export function trackingOpen(a: Appointment) {
  if (!a.visit) return false
  if (a.visit.trackingOverride) return true
  const now = Date.now()
  return now >= apptStart(a).getTime() - POLICY.trackingWindowBeforeMin * 60000 && now <= apptEnd(a).getTime() + 60 * 60000
}

export interface Slot { start: string; end: string; available: boolean; execId?: string; source?: 'assigned_pe' | 'city_pool'; reason?: string }

// Assigned PE first, then the city pool (backup PE in the home city, pool executives elsewhere).
export function serviceSlots(s: AppState, opts: { city: string; date: string; hours: number; mode: 'in_person' | 'remote'; excludeApptId?: string }): Slot[] {
  const date = parseDate(opts.date)
  const weekday = date.getDay()
  const pe = EXECUTIVES.find(e => e.id === s.membership.peId)!
  const candidates = (opts.city === pe.city ? [pe, EXECUTIVES.find(e => e.id === s.membership.backupPeId)!] : EXECUTIVES.filter(e => e.city === opts.city && e.kind === 'pool'))
  const dur = Math.max(1, Math.ceil(opts.hours)) * 60
  const buffer = opts.mode === 'in_person' ? POLICY.travelBufferMin : 0
  const out: Slot[] = []
  for (let h = 9; h <= 17; h++) {
    const start = `${String(h).padStart(2, '0')}:00`
    const end = addMinutes(start, dur)
    if (toMin(end) > 19 * 60) continue
    const startAt = dateTime(opts.date, start).getTime()
    if (startAt < Date.now() + 2 * 3600000) { out.push({ start, end, available: false, reason: 'Too soon' }); continue }
    let chosen: Slot | undefined
    let reason = 'Fully booked'
    for (const ex of candidates) {
      if (!ex.workDays.includes(weekday)) { reason = 'Executives off duty'; continue }
      if (toMin(start) < ex.shift[0] * 60 || toMin(end) > ex.shift[1] * 60) { reason = 'Outside working hours'; continue }
      const dayAppts = s.appointments.filter(a => a.peId === ex.id && a.date === opts.date && a.id !== opts.excludeApptId && !['cancelled'].includes(a.status))
      if (dayAppts.length >= ex.maxVisitsPerDay) { reason = 'Capacity reached'; continue }
      const clash = dayAppts.some(a => toMin(start) < toMin(a.end) + buffer && toMin(a.start) < toMin(end) + buffer)
      if (clash) { reason = buffer ? 'Booked (incl. travel buffer)' : 'Booked'; continue }
      chosen = { start, end, available: true, execId: ex.id, source: ex.id === pe.id ? 'assigned_pe' : 'city_pool' }
      break
    }
    out.push(chosen ?? { start, end, available: false, reason })
  }
  return out
}

export function expertSlots(s: AppState, expertId: string, date: string, excludeApptId?: string) {
  const ex = EXPERTS.find(e => e.id === expertId)
  if (!ex) return []
  const weekday = parseDate(date).getDay()
  if (!ex.workDays.includes(weekday)) return []
  const dur = consultTypeById(ex.categoryId)?.durationMin ?? 60
  return ex.slotTimes.map(t => {
    const taken = s.appointments.some(a => a.expertId === expertId && a.date === date && a.start === t && a.status !== 'cancelled' && a.id !== excludeApptId)
    const tooSoon = dateTime(date, t).getTime() < Date.now() + 2 * 3600000
    return { start: t, end: addMinutes(t, dur), available: !taken && !tooSoon, reason: taken ? 'Booked' : tooSoon ? 'Too soon' : undefined }
  })
}

// Cancellation outcome under the configured booking policy.
export function cancellationOutcome(s: AppState, a: Appointment) {
  const hoursBefore = (apptStart(a).getTime() - Date.now()) / 3600000
  const late = hoursBefore < POLICY.freeCancelHours
  const ent = a.entitlement
  let consume = 0
  if (late && ent?.ent === 'hours') consume = Math.min(POLICY.lateCancelConsumesHours, ent.amount)
  if (late && ent?.ent === 'consult' && POLICY.lateCancelConsumesConsultation) consume = 1
  const chargeKept = late && !!a.chargeINR
  return { late, hoursBefore, consume, release: ent ? ent.amount - consume : 0, chargeKept, ent: ent?.ent }
}

// ---------- requests ----------
export const STATUS_FLOW: Record<RequestStatus, RequestStatus[]> = {
  draft: ['submitted'],
  submitted: ['awaiting_approval', 'scheduled', 'in_progress', 'under_review', 'cancelled'],
  awaiting_approval: ['scheduled', 'in_progress', 'on_hold', 'cancelled'],
  scheduled: ['in_progress', 'on_hold', 'cancelled', 'awaiting_approval'],
  in_progress: ['completed', 'on_hold', 'awaiting_approval', 'scheduled'],
  on_hold: ['in_progress', 'scheduled', 'cancelled'],
  under_review: ['in_progress', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export const STATUS_LABEL: Record<RequestStatus, string> = {
  draft: 'Draft', submitted: 'Submitted', awaiting_approval: 'Awaiting approval', scheduled: 'Scheduled', in_progress: 'In progress',
  on_hold: 'On hold', under_review: 'Under review', completed: 'Completed', cancelled: 'Cancelled',
}

export function quoteFor(s: AppState, serviceId: string, expectedHours: number, funding: 'bundle' | 'prepaid' | 'postpaid', heldElsewhere = 0) {
  const svc = serviceById(serviceId)!
  const lines: { label: string; amount: number }[] = []
  let bundleHours = 0, chargeableHours = 0, base = 0, discount = 0, tax = 0
  if (svc.funding === 'bundle_hours') {
    const avail = Math.max(0, balance(s, 'hours').available + heldElsewhere)
    bundleHours = funding === 'bundle' ? Math.min(expectedHours, avail) : 0
    chargeableHours = expectedHours - bundleHours
    if (bundleHours) lines.push({ label: `${bundleHours} executive hour${bundleHours === 1 ? '' : 's'} from your bundle`, amount: 0 })
    if (chargeableHours) {
      base = chargeableHours * POLICY.outOfBundleHourlyINR
      lines.push({ label: `${chargeableHours} h beyond bundle × ₹${POLICY.outOfBundleHourlyINR.toLocaleString('en-IN')}`, amount: base })
    }
  } else {
    base = svc.rateUnit === 'flat' ? svc.rateINR : svc.rateINR * expectedHours
    lines.push({ label: svc.rateUnit === 'flat' ? 'Service fee' : `${expectedHours} h × ₹${svc.rateINR.toLocaleString('en-IN')}`, amount: base })
    if (svc.discountPct) {
      discount = Math.round((base * svc.discountPct) / 100)
      lines.push({ label: `Member discount (${svc.discountPct}%)`, amount: -discount })
    }
  }
  tax = Math.round((base - discount) * svc.taxRate)
  if (tax) lines.push({ label: `GST ${Math.round(svc.taxRate * 100)}%`, amount: tax })
  const total = base - discount + tax
  return { bundleHours, chargeableHours, base, discount, tax, extras: 0, total, lines }
}

export const memberSince = (s: AppState) => parseDate(s.membership.startDate)
export const anniversary = (s: AppState) => toISODate(addDays(parseDate(s.membership.benefitYearEnd), 1))
