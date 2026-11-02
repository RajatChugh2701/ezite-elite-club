// Mock data service: the single place that creates/updates records.
// Pages call these actions; a real backend client can implement the same surface later.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  AppNotification, AppState, Application, Appointment, Beneficiary, DelegatedPermissions, DocCategory, EntitlementKey,
  FinanceCase, FinanceCaseKind, LedgerEntry, Message, Result, ServiceRequest, SupportCase, SupportType, TimelineEvent, VaultDocument, RequestStatus, Quote,
} from './types'
import { createSeed, STATE_VERSION } from './seed'
import {
  actor, balance, canApprove, canRequestService, canTrackVisit, canUseVisitOtp, cancellationOutcome, consultCreditFree, delegateActive,
  expertSlots, getDocument, heldFor, inviteExpiresAt, invoiceTotals, serviceSlots, STATUS_FLOW, STATUS_LABEL, apptStart,
} from './selectors'
import { CONSULTATION_TYPES, DEV_OTP, EXPERTS, GST_RATE, POLICY, execById, expertById, serviceById, consultTypeById, categoryName } from './config'
import { messagingService, otpService } from './integrations'
import { addDays, addMinutes, fmtDate, fmtTime, nowISO, toISODate } from '../lib/format'

const KEY = 'ezit-elite-portal'

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (parsed.version === STATE_VERSION) return parsed
    }
  } catch { /* fall through to seed */ }
  return createSeed()
}

const ok = <T,>(data: T): Result<T> => ({ ok: true, data })
const fail = (error: string): Result<never> => ({ ok: false, error })

// ---------- draft helpers (operate on a cloned state) ----------
function nextId(s: AppState, key: string, prefix: string) {
  s.counters[key] = (s.counters[key] ?? 0) + 1
  return `${prefix}-${s.counters[key]}`
}
const actorName = (s: AppState) => {
  const a = actor(s)
  return a.kind === 'member' ? s.member.name : `${a.name} (delegate)`
}
function notify(s: AppState, n: Omit<AppNotification, 'id' | 'at' | 'read'>) {
  s.notifications.unshift({ ...n, id: nextId(s, 'notification', 'N'), at: nowISO(), read: false })
}
function event(s: AppState, actorLabel: string, label: string, status?: RequestStatus, detail?: string): TimelineEvent {
  return { id: nextId(s, 'event', 'EV'), at: nowISO(), actor: actorLabel, label, status, detail }
}
function setStatus(s: AppState, r: ServiceRequest, to: RequestStatus, who: string, label?: string, detail?: string) {
  if (r.status === to) return true
  if (!STATUS_FLOW[r.status].includes(to)) return false
  r.status = to
  r.timeline.push(event(s, who, label ?? STATUS_LABEL[to], to, detail))
  return true
}
function ledger(s: AppState, ent: EntitlementKey, kind: LedgerEntry['kind'], amount: number, description: string, refId?: string, refType: LedgerEntry['refType'] = 'request', who = 'System') {
  if (amount === 0) return
  s.ledger.push({ id: nextId(s, 'ledger', 'LG'), ent, kind, amount, at: nowISO(), description, refId, refType: refId ? refType : undefined, actor: who })
}
const msg = (s: AppState, from: Message['from'], author: string, text: string): Message => ({ id: nextId(s, 'msg', 'MSG'), at: nowISO(), from, author, text })
const execName = (id?: string) => execById(id)?.name ?? expertById(id)?.name ?? 'EZIT operations'

// ---------- input types ----------
export interface RequestDraft {
  serviceId: string
  beneficiaryId: string
  city: string
  address: string
  locationNotes: string
  date: string
  slot?: { start: string; end: string; execId: string; source: 'assigned_pe' | 'city_pool' }
  altWindow: string
  priority: 'standard' | 'priority' | 'urgent'
  mode: 'in_person' | 'remote'
  instructions: string
  contactName: string
  contactPhone: string
  expectedHours: number
  documentIds: string[]
  funding: 'bundle' | 'prepaid' | 'postpaid'
  quote: Quote
  consents: string[]
}

export interface ConsultDraft {
  expertId: string
  typeId: string
  date: string
  start: string
  mode: 'online' | 'in_person'
  city?: string
  beneficiaryId: string
  notes: string
  documentIds: string[]
}

// ---------- store ----------
function useStoreImpl() {
  const [state, setState] = useState<AppState>(load)
  const ref = useRef(state)
  const [storageError, setStorageError] = useState<string>()

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
      setStorageError(undefined)
    } catch {
      setStorageError('Browser storage is full. Remove uploaded files or reset demo data.')
    }
  }, [state])

  const mutate = useCallback(<T,>(fn: (s: AppState) => Result<T>): Result<T> => {
    const draft = structuredClone(ref.current)
    const res = fn(draft)
    if (res.ok) {
      ref.current = draft
      setState(draft)
    }
    return res
  }, [])

  const later = useCallback((ms: number, fn: (s: AppState) => void) => {
    setTimeout(() => mutate(s => { fn(s); return ok(undefined) }), ms)
  }, [mutate])

  const actions = useMemo(() => {
    const memberOnly = (s: AppState) => actor(s).kind === 'member'

    return {
      // ================= session =================
      startLogin(identifier: string): Result<{ actorId: string; destination: string }> {
        const id = identifier.trim().toLowerCase()
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id)
        const digits = id.replace(/[^\d]/g, '')
        if (!isEmail && digits.length < 10) return fail('Enter a valid email address or mobile number with country code.')
        const s = ref.current
        const matchMobile = (m: string) => digits.length >= 10 && m.replace(/[^\d]/g, '').endsWith(digits.slice(-10))
        if ((isEmail && s.member.email === id) || (!isEmail && matchMobile(s.member.mobile)))
          return ok({ actorId: 'member', destination: isEmail ? s.member.email : s.member.mobile })
        const d = s.delegates.find(x => (isEmail ? x.email === id : matchMobile(x.phone)))
        if (d) {
          if (!delegateActive(d)) return fail(d.status === 'revoked' ? 'This delegate access has been revoked by the member.' : 'This delegate invitation is not active. Ask the member to send a new invitation.')
          return ok({ actorId: d.id, destination: isEmail ? d.email : d.phone })
        }
        return fail('We couldn’t find a membership for that email or mobile number.')
      },
      completeLogin(actorId: string, code: string) {
        if (!otpService.verify(code)) return fail('That code is incorrect or has expired. Use the development code shown.')
        return mutate(s => {
          s.session = { loggedIn: true, actorId, startedAt: nowISO(), lastStepUpAt: nowISO() }
          const cur = s.security.sessions.find(x => x.current)
          if (cur) cur.lastActive = nowISO()
          return ok(undefined)
        })
      },
      demoLogin(actorId: string = 'member') {
        return mutate(s => {
          s.session = { loggedIn: true, actorId, startedAt: nowISO(), lastStepUpAt: nowISO() }
          return ok(undefined)
        })
      },
      logout(expired = false) {
        return mutate(s => {
          s.session = { loggedIn: false, actorId: 'member', expiredNotice: expired }
          return ok(undefined)
        })
      },
      switchActor(actorId: string) {
        return mutate(s => {
          if (actorId !== 'member') {
            const d = s.delegates.find(x => x.id === actorId)
            if (!d || !delegateActive(d)) return fail('Only accepted, unexpired delegates can be previewed.')
          }
          s.session.actorId = actorId
          return ok(undefined)
        })
      },
      stepUp(code: string) {
        if (!otpService.verify(code)) return fail('Incorrect code. Use the development code shown.')
        return mutate(s => { s.session.lastStepUpAt = nowISO(); return ok(undefined) })
      },

      // ================= notifications =================
      markRead(id: string) {
        return mutate(s => { const n = s.notifications.find(x => x.id === id); if (n) n.read = true; return ok(undefined) })
      },
      markAllRead() {
        return mutate(s => { s.notifications.forEach(n => (n.read = true)); return ok(undefined) })
      },
      setNotificationPrefs(patch: Partial<AppState['notificationPrefs']>) {
        return mutate(s => { Object.assign(s.notificationPrefs, patch); return ok(undefined) })
      },

      // ================= requests =================
      createRequest(d: RequestDraft): Result<string> {
        return mutate(s => {
          const svc = serviceById(d.serviceId)
          if (!svc) return fail('Select a service.')
          if (!canRequestService(s, d.serviceId, d.beneficiaryId)) return fail('Your delegated permissions do not cover this service or beneficiary.')
          if (!d.address.trim() || !d.contactName.trim() || !d.contactPhone.trim()) return fail('Location and contact details are required.')
          const a = actor(s)
          if (d.funding === 'bundle' && d.quote.bundleHours > balance(s, 'hours').available) return fail('Your executive-hour balance changed. Please review the quote again.')
          if (d.slot) {
            const still = serviceSlots(s, { city: d.city, date: d.date, hours: d.expectedHours, mode: d.mode }).find(x => x.start === d.slot!.start)
            if (!still?.available) return fail('That time slot was just taken. Please choose another slot.')
          }
          const needsApproval = a.kind === 'delegate' && !a.delegate.permissions.approvals
          const id = nextId(s, 'request', 'REQ')
          const who = actorName(s)
          const r: ServiceRequest = {
            id, kind: 'service', serviceId: svc.id, title: svc.name, beneficiaryId: d.beneficiaryId,
            ownerId: a.kind === 'member' ? 'member' : a.delegate.id, ownerName: a.name,
            assignedTo: d.slot?.execId ?? s.membership.peId, status: 'submitted', priority: d.priority, mode: d.mode,
            city: d.city as ServiceRequest['city'], address: d.address, locationNotes: d.locationNotes, preferredDate: d.date,
            window: d.slot ? `${d.slot.start}–${d.slot.end}` : undefined, altWindow: d.altWindow, instructions: d.instructions,
            contactName: d.contactName, contactPhone: d.contactPhone, expectedHours: d.expectedHours, funding: d.funding, quote: d.quote,
            documentIds: d.documentIds, approvalIds: [], createdAt: nowISO(),
            slaDue: svc.slaHours ? new Date(Date.now() + svc.slaHours * 3600000).toISOString() : undefined,
            timeline: [event(s, who, 'Request submitted', 'submitted', d.city !== s.member.homeCity ? `Cross-city request — service city differs from home city` : undefined)],
            messages: [],
            meta: { consents: d.consents.join(' · ') },
          }
          s.requests.unshift(r)
          if (d.funding === 'prepaid' && d.quote.total > 0) {
            const invId = nextId(s, 'invoice', 'INV')
            s.invoices.unshift({
              id: invId, number: `EZ/26-27/0${s.counters.invoice}`, type: 'service', title: svc.name, issueDate: toISODate(new Date()), dueDate: toISODate(new Date()),
              requestId: id, billedTo: s.member.name, lines: [{ description: `${svc.name} — ${id}`, qty: 1, rate: d.quote.base - d.quote.discount, taxRate: svc.taxRate, serviceDate: d.date }],
            })
            r.meta = { ...r.meta, invoiceId: invId }
            r.timeline.push(event(s, 'System', 'Prepaid invoice issued', undefined, `₹${d.quote.total.toLocaleString('en-IN')} payable before the service`))
          }
          if (d.slot) {
            const apptId = nextId(s, 'appointment', 'APT')
            s.appointments.push({
              id: apptId, kind: 'service', title: svc.name, requestId: id, serviceId: svc.id, peId: d.slot.execId, beneficiaryId: d.beneficiaryId,
              date: d.date, start: d.slot.start, end: d.slot.end, city: d.city as Appointment['city'], mode: d.mode === 'remote' ? 'online' : 'in_person', address: d.address,
              status: needsApproval ? 'pending_approval' : 'confirmed', source: d.slot.source, createdAt: nowISO(),
              entitlement: d.quote.bundleHours ? { ent: 'hours', amount: d.quote.bundleHours } : undefined,
              chargeINR: d.quote.total || undefined,
              history: [{ at: nowISO(), label: needsApproval ? 'Slot held pending member approval' : `Confirmed with ${execName(d.slot.execId)}` }],
              visit: d.mode === 'in_person' ? { stage: 'scheduled', startOtpVerified: false, endOtpVerified: false, events: [] } : undefined,
            })
            r.appointmentId = apptId
            if (d.quote.bundleHours) {
              ledger(s, 'hours', 'hold', -d.quote.bundleHours, `Hold for ${svc.name}`, id)
              r.timeline.push(event(s, 'System', `${d.quote.bundleHours} executive hour(s) placed on hold`))
            }
            if (d.slot.source === 'city_pool') r.timeline.push(event(s, 'City dispatch', `Assigned to ${execName(d.slot.execId)} (city pool)`, undefined, 'Your Personal Executive has been notified.'))
          }
          if (needsApproval) {
            const apId = nextId(s, 'approval', 'APR')
            s.approvals.unshift({
              id: apId, requestId: id, title: `Request raised by ${a.name}`, requestedBy: `${a.name} (delegate)`, status: 'pending', createdAt: nowISO(),
              reason: `${a.name} does not have approval rights. As the member, please confirm this request and its charges before it is scheduled.`,
              amountINR: d.quote.total, breakdown: d.quote.lines, documentIds: d.documentIds,
            })
            r.approvalIds.push(apId)
            setStatus(s, r, 'awaiting_approval', 'System', 'Awaiting member approval')
            notify(s, { type: 'approval', title: 'Approval needed for a delegate request', body: `${a.name} requested “${svc.name}”.`, link: `/requests/${id}` })
          } else if (d.slot) {
            setStatus(s, r, 'scheduled', 'System', 'Visit confirmed', `${fmtDate(d.date)} · ${fmtTime(d.slot.start)}`)
            notify(s, { type: 'booking', title: 'Booking confirmed', body: `${svc.name} on ${fmtDate(d.date)} at ${fmtTime(d.slot.start)}.`, link: `/requests/${id}` })
          } else {
            notify(s, { type: 'request', title: 'Request received', body: `${svc.name} — your executive will confirm next steps.`, link: `/requests/${id}` })
          }
          later(4000, st => {
            const rr = st.requests.find(x => x.id === id)
            if (rr && rr.status !== 'cancelled') rr.messages.push(msg(st, 'executive', execName(rr.assignedTo), `Hello, I’ve received your request for ${svc.name.toLowerCase()}. I’ll review the details and reach out if I need anything.`))
          })
          return ok(id)
        })
      },

      sendRequestMessage(requestId: string, text: string) {
        if (!text.trim()) return fail('Write a message first.')
        const res = mutate(s => {
          const r = s.requests.find(x => x.id === requestId)
          if (!r) return fail('Request not found.')
          const a = actor(s)
          r.messages.push(msg(s, a.kind === 'member' ? 'member' : 'delegate', actorName(s), text.trim()))
          return ok(r.assignedTo)
        })
        if (res.ok) later(2200, s => {
          const r = s.requests.find(x => x.id === requestId)
          if (r) r.messages.push(msg(s, 'executive', execName(r.assignedTo), messagingService.autoReply()))
        })
        return res
      },

      cancelRequest(requestId: string, reason: string) {
        return mutate(s => {
          const r = s.requests.find(x => x.id === requestId)
          if (!r) return fail('Request not found.')
          if (!STATUS_FLOW[r.status].includes('cancelled')) return fail(`A ${STATUS_LABEL[r.status].toLowerCase()} request cannot be cancelled.`)
          const appt = s.appointments.find(a => a.id === r.appointmentId)
          if (appt && !['cancelled', 'completed'].includes(appt.status)) cancelApptDraft(s, appt.id, reason)
          for (const apId of r.approvalIds) { const ap = s.approvals.find(x => x.id === apId); if (ap?.status === 'pending') ap.status = 'rejected' }
          setStatus(s, r, 'cancelled', actorName(s), 'Request cancelled', reason || undefined)
          notify(s, { type: 'request', title: 'Request cancelled', body: `${r.title} (${r.id}).`, link: `/requests/${r.id}` })
          return ok(undefined)
        })
      },

      // ================= approvals =================
      decideApproval(approvalId: string, decision: 'approve' | 'reject' | 'clarify', note: string) {
        const res = mutate(s => {
          const ap = s.approvals.find(x => x.id === approvalId)
          if (!ap) return fail('Approval not found.')
          if (!canApprove(s, ap)) return fail('You are not authorised to act on this approval.')
          if (ap.status !== 'pending') return fail('This approval has already been actioned.')
          if ((decision === 'reject' || decision === 'clarify') && !note.trim()) return fail('Please add a short note for the executive.')
          const r = s.requests.find(x => x.id === ap.requestId)!
          const who = actorName(s)
          ap.decidedAt = nowISO(); ap.decidedBy = who; ap.note = note.trim() || undefined
          const appt = s.appointments.find(a => a.id === r.appointmentId)
          if (decision === 'approve') {
            ap.status = 'approved'
            r.timeline.push(event(s, who, `Approved: ${ap.title}`, undefined, ap.amountINR ? `₹${ap.amountINR.toLocaleString('en-IN')} authorised` : undefined))
            if (appt?.status === 'pending_approval') {
              appt.status = 'confirmed'
              appt.history.push({ at: nowISO(), label: 'Confirmed after member approval' })
              setStatus(s, r, 'scheduled', 'System', 'Visit confirmed')
            } else setStatus(s, r, 'in_progress', execName(r.assignedTo), 'Work resumed', 'Next step: executive proceeds with the approved scope')
            notify(s, { type: 'request', title: 'Approval recorded', body: `${r.title} can now proceed.`, link: `/requests/${r.id}` })
          } else if (decision === 'reject') {
            ap.status = 'rejected'
            r.timeline.push(event(s, who, `Declined: ${ap.title}`, undefined, note))
            if (appt?.status === 'pending_approval') cancelApptDraft(s, appt.id, 'Approval declined')
            setStatus(s, r, 'on_hold', 'System', 'On hold — executive will propose alternatives')
            notify(s, { type: 'request', title: 'Approval declined', body: `${r.title} is on hold. Your executive will be in touch.`, link: `/requests/${r.id}` })
          } else {
            ap.status = 'clarification_requested'
            r.messages.push(msg(s, actor(s).kind === 'member' ? 'member' : 'delegate', who, `Clarification requested: ${note}`))
            r.timeline.push(event(s, who, 'Clarification requested', undefined, note))
          }
          return ok(r.id)
        })
        if (res.ok && decision === 'clarify') later(3000, s => {
          const ap = s.approvals.find(x => x.id === approvalId)
          const r = s.requests.find(x => x.id === ap?.requestId)
          if (!ap || !r || ap.status !== 'clarification_requested') return
          r.messages.push(msg(s, 'executive', execName(r.assignedTo), 'Happy to clarify: the amount is based on the official assessment and receipts will be uploaded to your vault. The approval is open again for your decision.'))
          ap.status = 'pending'
          r.timeline.push(event(s, execName(r.assignedTo), 'Clarification provided — approval re-opened'))
          notify(s, { type: 'approval', title: 'Clarification received', body: `Your executive answered your question on ${r.id}.`, link: `/requests/${r.id}` })
        })
        return res
      },

      // ================= appointments =================
      bookConsultation(d: ConsultDraft): Result<string> {
        return mutate(s => {
          if (!memberOnly(s)) return fail('Only the member can book consultations.')
          const ex = EXPERTS.find(e => e.id === d.expertId)
          const type = CONSULTATION_TYPES.find(t => t.id === d.typeId)
          if (!ex || !type) return fail('Select an expert.')
          const slot = expertSlots(s, ex.id, d.date).find(x => x.start === d.start)
          if (!slot?.available) return fail('That session was just taken. Please choose another time.')
          const useCredit = consultCreditFree(s, type.id)
          const reqId = nextId(s, 'request', 'REQ')
          const apptId = nextId(s, 'appointment', 'APT')
          const end = addMinutes(d.start, type.durationMin)
          const charge = useCredit ? 0 : type.feeINR
          const tax = Math.round(charge * GST_RATE)
          const r: ServiceRequest = {
            id: reqId, kind: 'consultation', title: `${type.name} consultation`, beneficiaryId: d.beneficiaryId, ownerId: 'member', ownerName: s.member.name,
            assignedTo: ex.id, status: 'submitted', priority: 'standard', mode: d.mode === 'online' ? 'remote' : 'in_person', city: (d.city ?? s.member.homeCity) as ServiceRequest['city'],
            address: d.mode === 'online' ? 'Online (meeting link shared before the session)' : 'EZIT Lounge (address shared on confirmation)', preferredDate: d.date, window: `${d.start}–${end}`,
            instructions: d.notes, contactName: s.member.name, contactPhone: s.member.mobile, expectedHours: 0, funding: useCredit ? 'consult_credit' : 'postpaid',
            quote: useCredit ? undefined : { bundleHours: 0, chargeableHours: 0, base: charge, discount: 0, tax, extras: 0, total: charge + tax, lines: [{ label: 'Consultation fee', amount: charge }, { label: 'GST 18%', amount: tax }] },
            documentIds: d.documentIds, approvalIds: [], appointmentId: apptId, createdAt: nowISO(), timeline: [], messages: [],
          }
          r.timeline.push(event(s, s.member.name, 'Consultation booked', 'submitted'))
          let invoiceId: string | undefined
          if (useCredit) {
            ledger(s, 'consult', 'hold', -1, `Credit hold — ${type.name} consultation`, reqId)
            r.timeline.push(event(s, 'System', 'Included credit placed on hold', undefined, 'Consumed when the session is completed'))
          } else {
            invoiceId = nextId(s, 'invoice', 'INV')
            s.invoices.unshift({
              id: invoiceId, number: `EZ/26-27/0${s.counters.invoice}`, type: 'consultation', title: `${type.name} consultation`, issueDate: toISODate(new Date()),
              dueDate: toISODate(addDays(new Date(), 7)), requestId: reqId, billedTo: s.member.name,
              lines: [{ description: `${type.name} consultation with ${ex.name} (${fmtDate(d.date)})`, qty: 1, rate: charge, taxRate: GST_RATE, serviceDate: d.date }],
            })
            r.timeline.push(event(s, 'System', `Invoice issued — ₹${(charge + tax).toLocaleString('en-IN')}`, undefined, type.creditEligible ? 'Included credits exhausted' : 'Specialist sessions are not covered by credits'))
          }
          setStatus(s, r, 'scheduled', 'System', 'Session confirmed', `${fmtDate(d.date)} · ${fmtTime(d.start)}`)
          s.requests.unshift(r)
          s.appointments.push({
            id: apptId, kind: 'consultation', title: `${type.name} consultation`, requestId: reqId, expertId: ex.id, consultTypeId: type.id, beneficiaryId: d.beneficiaryId,
            date: d.date, start: d.start, end, city: d.mode === 'online' ? 'online' : ((d.city ?? s.member.homeCity) as Appointment['city']), mode: d.mode, status: 'confirmed', source: 'expert',
            entitlement: useCredit ? { ent: 'consult', amount: 1 } : undefined, chargeINR: useCredit ? undefined : charge + tax, invoiceId,
            meetingLink: d.mode === 'online' ? `https://meet.example/ezit-${apptId.toLowerCase()}` : undefined, notes: d.notes, createdAt: nowISO(),
            history: [{ at: nowISO(), label: useCredit ? 'Booked using an included credit' : `Booked — ₹${(charge + tax).toLocaleString('en-IN')} charged` }],
          })
          notify(s, { type: 'booking', title: 'Consultation confirmed', body: `${ex.name}, ${fmtDate(d.date)} at ${fmtTime(d.start)}${useCredit ? ' — included credit' : ''}.`, link: `/appointments/${apptId}` })
          return ok(apptId)
        })
      },

      rescheduleAppointment(id: string, date: string, start: string, end: string, execId?: string) {
        return mutate(s => {
          const a = s.appointments.find(x => x.id === id)
          if (!a) return fail('Appointment not found.')
          if (!memberOnly(s)) return fail('Only the member can reschedule bookings.')
          if (!['confirmed', 'held', 'pending_approval'].includes(a.status)) return fail('Only upcoming bookings can be rescheduled.')
          const hrs = (apptStart(a).getTime() - Date.now()) / 3600000
          if (hrs < POLICY.rescheduleFreeHours) return fail(`Bookings can be rescheduled online up to ${POLICY.rescheduleFreeHours} hours before. Please message your executive.`)
          const free = a.expertId
            ? expertSlots(s, a.expertId, date, a.id).find(x => x.start === start)?.available
            : serviceSlots(s, { city: a.city === 'online' ? s.member.homeCity : a.city, date, hours: (new Date(`2000-01-01T${a.end}`).getTime() - new Date(`2000-01-01T${a.start}`).getTime()) / 3600000, mode: a.mode === 'online' ? 'remote' : 'in_person', excludeApptId: a.id }).find(x => x.start === start)?.available
          if (!free) return fail('That slot is no longer available.')
          const old = `${fmtDate(a.date)} ${fmtTime(a.start)}`
          if (a.entitlement && a.requestId) {
            // release + re-hold so the ledger shows the reservation moving with the booking
            ledger(s, a.entitlement.ent, 'release', a.entitlement.amount, `Hold released — rescheduled from ${old}`, a.requestId)
            ledger(s, a.entitlement.ent, 'hold', -a.entitlement.amount, `Hold re-applied for ${fmtDate(date)} ${fmtTime(start)}`, a.requestId)
          }
          a.date = date; a.start = start; a.end = end
          if (execId) a.peId = execId
          a.history.push({ at: nowISO(), label: `Rescheduled from ${old}` })
          const r = s.requests.find(x => x.id === a.requestId)
          if (r) {
            r.preferredDate = date; r.window = `${start}–${end}`
            r.timeline.push(event(s, s.member.name, 'Rescheduled', undefined, `${old} → ${fmtDate(date)} ${fmtTime(start)}`))
          }
          notify(s, { type: 'booking', title: 'Booking rescheduled', body: `${a.title} moved to ${fmtDate(date)} at ${fmtTime(start)}.`, link: `/appointments/${a.id}` })
          return ok(undefined)
        })
      },

      cancelAppointment(id: string, reason: string) {
        return mutate(s => {
          if (!memberOnly(s)) return fail('Only the member can cancel bookings.')
          const a = s.appointments.find(x => x.id === id)
          if (!a || !['confirmed', 'held', 'pending_approval'].includes(a.status)) return fail('Only upcoming bookings can be cancelled.')
          cancelApptDraft(s, id, reason)
          const r = s.requests.find(x => x.id === a.requestId)
          if (r && STATUS_FLOW[r.status].includes('cancelled')) setStatus(s, r, 'cancelled', s.member.name, 'Booking cancelled', reason || undefined)
          return ok(undefined)
        })
      },

      advanceVisit(apptId: string, step: 'open_window' | 'on_the_way' | 'delay' | 'arrived' | 'start' | 'complete' | 'escalate', payload?: { otp?: string; note?: string }) {
        return mutate(s => {
          const a = s.appointments.find(x => x.id === apptId)
          if (!a?.visit) return fail('This booking has no visit to track.')
          if (!canTrackVisit(s, a)) return fail('You are not authorised to view this visit.')
          const v = a.visit
          const r = s.requests.find(x => x.id === a.requestId)
          const pe = execName(a.peId)
          const push = (stage: NonNullable<typeof v>['events'][number]['stage'], note: string) => v.events.push({ id: nextId(s, 'event', 'VE'), stage, at: nowISO(), note })
          const otpOk = () => {
            if (!canUseVisitOtp(s, a)) return 'You do not have OTP approval rights for this visit.'
            if (!payload?.otp || payload.otp.trim() !== DEV_OTP) return 'Incorrect OTP. The development OTP is shown on screen.'
            return undefined
          }
          switch (step) {
            case 'open_window': v.trackingOverride = true; push('note', 'Demo: tracking window opened early by reviewer'); break
            case 'on_the_way':
              if (v.stage !== 'scheduled') return fail('Visit already started.')
              v.stage = 'on_the_way'; v.etaMin = 24; push('on_the_way', `${pe} is on the way`)
              notify(s, { type: 'request', title: `${pe} is on the way`, body: `Indicative ETA 24 min for ${a.title}.`, link: `/requests/${a.requestId}/visit` })
              break
            case 'delay':
              if (v.stage !== 'on_the_way') return fail('Delays apply only while the executive is on the way.')
              v.delayMin = (v.delayMin ?? 0) + 10; v.etaMin = (v.etaMin ?? 20) + 10; push('delay', `Traffic delay — ETA revised by 10 min`)
              notify(s, { type: 'request', title: 'Visit delayed', body: `${pe} is running about 10 minutes late.`, link: `/requests/${a.requestId}/visit` })
              break
            case 'arrived':
              if (v.stage !== 'on_the_way') return fail('The executive must be on the way first.')
              v.stage = 'arrived'; v.etaMin = 0; push('arrived', `${pe} has arrived`)
              notify(s, { type: 'request', title: `${pe} has arrived`, body: 'Share the start OTP to begin the visit.', link: `/requests/${a.requestId}/visit` })
              break
            case 'start': {
              if (v.stage !== 'arrived') return fail('The executive has not arrived yet.')
              const e = otpOk(); if (e) return fail(e)
              v.stage = 'in_progress'; v.startOtpVerified = true; push('in_progress', `Start OTP verified by ${actorName(s)}`)
              if (r) setStatus(s, r, 'in_progress', pe, 'Visit started', 'Start OTP verified')
              break
            }
            case 'complete': {
              if (v.stage !== 'in_progress') return fail('The visit has not started.')
              const e = otpOk(); if (e) return fail(e)
              v.stage = 'completed'; v.endOtpVerified = true; push('completed', `End OTP verified by ${actorName(s)}`)
              a.status = 'completed'; a.history.push({ at: nowISO(), label: 'Completed' })
              if (a.entitlement && r) {
                const held = heldFor(s, r.id, a.entitlement.ent)
                ledger(s, a.entitlement.ent, 'release', held, 'Hold released on completion', r.id)
                ledger(s, a.entitlement.ent, 'consume', -a.entitlement.amount, `${a.title} — ${a.entitlement.amount} h settled`, r.id, 'request', pe)
              }
              if (r) {
                r.completion = { summary: `${a.title} completed. ${pe} will upload notes and receipts.`, hours: a.entitlement?.amount ?? 0, evidence: ['Start and end OTP log', 'Visit notes (to follow)'], at: nowISO() }
                setStatus(s, r, 'completed', pe, 'Completed', a.entitlement ? `${a.entitlement.amount} h settled from bundle` : undefined)
              }
              notify(s, { type: 'request', title: 'Visit completed', body: `${a.title} is complete. Tell us how it went.`, link: `/requests/${a.requestId}` })
              break
            }
            case 'escalate':
              push('escalation', `Safety escalation raised by ${actorName(s)}: ${payload?.note || 'No details'}`)
              notify(s, { type: 'service', title: 'Escalation received', body: 'The city supervisor has been alerted and will call you within 10 minutes (simulated).', link: `/requests/${a.requestId}/visit` })
              if (r) r.timeline.push(event(s, actorName(s), 'Safety escalation raised', undefined, payload?.note))
              break
          }
          return ok(undefined)
        })
      },

      // ================= family & delegation =================
      saveBeneficiary(b: Omit<Beneficiary, 'id'> & { id?: string }) {
        return mutate(s => {
          if (!memberOnly(s)) return fail('Only the member can manage family members.')
          if (!b.name.trim() || !b.relationship.trim() || !b.indiaAddress.line1.trim() || !b.indiaAddress.postcode.trim()) return fail('Name, relationship and India address are required.')
          if (b.id) {
            const cur = s.beneficiaries.find(x => x.id === b.id)
            if (!cur) return fail('Not found.')
            Object.assign(cur, b)
            return ok(cur.id)
          }
          const id = nextId(s, 'beneficiary', 'BEN')
          s.beneficiaries.push({ ...b, id })
          notify(s, { type: 'family', title: 'Family member added', body: `${b.name} is now a beneficiary.`, link: '/family' })
          return ok(id)
        })
      },
      createDelegate(d: { name: string; email: string; phone: string; relationship: string; expiresAt: string; permissions: DelegatedPermissions }, send: boolean) {
        return mutate(s => {
          if (!memberOnly(s)) return fail('Only the member can invite delegates.')
          if (s.delegates.some(x => x.email.toLowerCase() === d.email.toLowerCase() && ['sent', 'accepted', 'draft'].includes(x.status))) return fail('This person already has an active or pending invitation.')
          const id = nextId(s, 'delegate', 'DLG')
          s.delegates.unshift({ ...d, id, status: send ? 'sent' : 'draft', createdAt: nowISO(), sentAt: send ? nowISO() : undefined, termsAccepted: false })
          if (send) notify(s, { type: 'family', title: 'Invitation sent', body: `${d.name} has been invited as a delegate (simulated message).`, link: '/family' })
          return ok(id)
        })
      },
      updateDelegate(id: string, patch: { permissions?: DelegatedPermissions; expiresAt?: string }) {
        return mutate(s => {
          if (!memberOnly(s)) return fail('Only the member can change delegate permissions.')
          const d = s.delegates.find(x => x.id === id)
          if (!d || d.status === 'revoked') return fail('This delegate cannot be edited.')
          Object.assign(d, patch)
          notify(s, { type: 'family', title: 'Delegate permissions updated', body: `${d.name}’s access has been changed.`, link: '/family' })
          return ok(undefined)
        })
      },
      sendInvite(id: string) {
        return mutate(s => {
          const d = s.delegates.find(x => x.id === id)
          if (!d || !['draft', 'expired'].includes(d.status)) return fail('Only draft or expired invitations can be sent.')
          d.status = 'sent'; d.sentAt = nowISO()
          notify(s, { type: 'family', title: 'Invitation sent', body: `${d.name} has been invited (simulated message).`, link: '/family' })
          return ok(undefined)
        })
      },
      acceptInvite(id: string) {
        return mutate(s => {
          const d = s.delegates.find(x => x.id === id)
          if (!d || d.status !== 'sent') return fail('Only sent invitations can be accepted.')
          const exp = inviteExpiresAt(d)
          if (exp && exp < toISODate(new Date())) { d.status = 'expired'; return fail('This invitation has expired. Send a new one.') }
          d.status = 'accepted'; d.acceptedAt = nowISO(); d.termsAccepted = true
          notify(s, { type: 'family', title: 'Invitation accepted', body: `${d.name} accepted the delegate terms.`, link: '/family' })
          return ok(undefined)
        })
      },
      expireInvite(id: string) {
        return mutate(s => {
          const d = s.delegates.find(x => x.id === id)
          if (!d || d.status !== 'sent') return fail('Only pending invitations can expire.')
          d.status = 'expired'
          return ok(undefined)
        })
      },
      revokeDelegate(id: string) {
        return mutate(s => {
          if (!memberOnly(s)) return fail('Only the member can revoke access.')
          const d = s.delegates.find(x => x.id === id)
          if (!d || d.status === 'revoked') return fail('Already revoked.')
          d.status = 'revoked'; d.revokedAt = nowISO()
          notify(s, { type: 'family', title: 'Delegate access revoked', body: `${d.name} no longer has access. This took effect immediately.`, link: '/family' })
          return ok(undefined)
        })
      },

      // ================= concierge =================
      sendConciergeMessage(text: string) {
        if (!text.trim()) return fail('Write a message first.')
        const res = mutate(s => {
          if (!memberOnly(s)) return fail('Only the member can message the concierge team.')
          s.conciergeMessages.push(msg(s, 'member', s.member.name, text.trim()))
          return ok(undefined)
        })
        if (res.ok) later(2200, s => {
          s.conciergeMessages.push(msg(s, 'executive', execName(s.membership.peId), messagingService.autoReply()))
          notify(s, { type: 'message', title: `New message from ${execName(s.membership.peId)}`, body: 'Reply in your concierge conversation.', link: '/messages' })
        })
        return res
      },
      requestExecutiveChange(reason: string, details: string, preference: string): Result<string> {
        return mutate(s => {
          if (!memberOnly(s)) return fail('Only the member can request an executive change.')
          if (!reason) return fail('Choose a reason.')
          if (s.requests.some(r => r.kind === 'exec_change' && !['completed', 'cancelled'].includes(r.status))) return fail('You already have an executive change request under review.')
          const id = nextId(s, 'request', 'REQ')
          s.requests.unshift({
            id, kind: 'exec_change', title: 'Personal Executive change request', beneficiaryId: 'BEN-SELF', ownerId: 'member', ownerName: s.member.name,
            assignedTo: s.membership.supervisorId, status: 'submitted', priority: 'standard', mode: 'remote', city: s.member.homeCity, address: '—',
            instructions: `${reason}. ${details}`.trim(), contactName: s.member.name, contactPhone: s.member.mobile, expectedHours: 0, funding: 'bundle',
            documentIds: [], approvalIds: [], createdAt: nowISO(), slaDue: new Date(Date.now() + 72 * 3600000).toISOString(),
            timeline: [event(s, s.member.name, 'Change requested', 'submitted', `Reason: ${reason}${preference ? ` · Preference: ${preference}` : ''}`)], messages: [],
            meta: { reason, preference },
          })
          const r = s.requests[0]
          setStatus(s, r, 'under_review', 'Farah Siddiqui', 'Under supervisor review', 'Your current executive continues until a change is confirmed, so nothing is dropped.')
          notify(s, { type: 'request', title: 'Executive change request received', body: 'Your city supervisor will review within 72 hours.', link: `/requests/${id}` })
          return ok(id)
        })
      },

      // ================= documents =================
      uploadDocument(d: { name: string; fileType: string; sizeKB: number; category: DocCategory; beneficiaryId?: string; relatedRequestId?: string; dataUrl?: string }): Result<string> {
        const res = mutate(s => {
          if (!memberOnly(s)) return fail('Delegates cannot upload to the member’s vault.')
          if (!POLICY.allowedFileTypes.includes(d.fileType)) return fail('Unsupported file type. Upload PDF, JPG, PNG or WEBP.')
          if (d.sizeKB > POLICY.maxUploadKB) return fail(`File is too large. The limit is ${POLICY.maxUploadKB / 1024} MB.`)
          const id = nextId(s, 'document', 'DOC')
          s.documents.unshift({
            id, name: d.name, fileType: d.fileType, sizeKB: d.sizeKB, category: d.category, uploadedAt: nowISO(), uploadedBy: s.member.name,
            beneficiaryId: d.beneficiaryId, relatedRequestId: d.relatedRequestId, dataUrl: d.sizeKB <= POLICY.maxStoredDataUrlKB ? d.dataUrl : undefined,
            scan: 'scanning', shares: [], accessLog: [{ id: nextId(s, 'event', 'AE'), at: nowISO(), actor: s.member.name, action: 'uploaded' }],
          })
          if (d.relatedRequestId) {
            const r = s.requests.find(x => x.id === d.relatedRequestId)
            if (r) { r.documentIds.push(id); r.timeline.push(event(s, s.member.name, 'Document attached', undefined, d.name)) }
          }
          return ok(id)
        })
        if (res.ok) later(1500, s => { const doc = s.documents.find(x => x.id === res.data); if (doc) doc.scan = 'clean' })
        return res
      },
      renameDocument(id: string, name: string) {
        return mutate(s => {
          const d = s.documents.find(x => x.id === id)
          if (!d || !memberOnly(s)) return fail('Not permitted.')
          if (d.locked) return fail('System documents cannot be renamed.')
          if (!name.trim()) return fail('Enter a name.')
          d.accessLog.push({ id: nextId(s, 'event', 'AE'), at: nowISO(), actor: s.member.name, action: 'renamed', detail: `${d.name} → ${name.trim()}` })
          d.name = name.trim()
          return ok(undefined)
        })
      },
      deleteDocument(id: string) {
        return mutate(s => {
          const d = s.documents.find(x => x.id === id)
          if (!d || !memberOnly(s)) return fail('Not permitted.')
          if (d.locked) return fail('System documents are retained per the retention schedule and cannot be deleted.')
          s.documents = s.documents.filter(x => x.id !== id)
          s.requests.forEach(r => (r.documentIds = r.documentIds.filter(x => x !== id)))
          s.delegates.forEach(dl => (dl.permissions.documentIds = dl.permissions.documentIds.filter(x => x !== id)))
          return ok(undefined)
        })
      },
      shareDocument(id: string, share: { recipientId: string; purpose: string; requestId?: string; permission: 'view' | 'view_download'; days: number }) {
        return mutate(s => {
          const d = s.documents.find(x => x.id === id)
          if (!d || !memberOnly(s)) return fail('Not permitted.')
          if (!share.recipientId || !share.purpose.trim()) return fail('Choose a recipient and purpose.')
          const ex = execById(share.recipientId) ?? expertById(share.recipientId)
          if (!ex) return fail('Unknown recipient.')
          const role = 'kind' in ex ? ex.role : `${ex.title} (sample expert)`
          const expiresAt = new Date(Date.now() + share.days * 86400000).toISOString()
          d.shares.push({ id: nextId(s, 'share', 'SH'), recipientId: ex.id, recipientName: ex.name, recipientRole: role, purpose: share.purpose.trim(), requestId: share.requestId, permission: share.permission, createdAt: nowISO(), expiresAt })
          d.accessLog.push({ id: nextId(s, 'event', 'AE'), at: nowISO(), actor: s.member.name, action: 'shared', detail: `With ${ex.name}${share.requestId ? ` for ${share.requestId}` : ''}, ${share.permission === 'view' ? 'view only' : 'view & download'}, ${share.days} day(s)` })
          notify(s, { type: 'document', title: 'Document shared', body: `“${d.name}” shared with ${ex.name} until ${fmtDate(expiresAt)}.`, link: `/documents?doc=${d.id}` })
          return ok(undefined)
        })
      },
      revokeShare(docId: string, shareId: string) {
        return mutate(s => {
          const d = s.documents.find(x => x.id === docId)
          const sh = d?.shares.find(x => x.id === shareId)
          if (!d || !sh || !memberOnly(s)) return fail('Not permitted.')
          if (sh.revokedAt) return fail('Already revoked.')
          sh.revokedAt = nowISO()
          d.accessLog.push({ id: nextId(s, 'event', 'AE'), at: nowISO(), actor: s.member.name, action: 'revoked', detail: `Access for ${sh.recipientName} revoked` })
          notify(s, { type: 'document', title: 'Access revoked', body: `${sh.recipientName} can no longer open “${d.name}”.`, link: `/documents?doc=${d.id}` })
          return ok(undefined)
        })
      },
      logDocAccess(id: string, action: 'viewed' | 'downloaded') {
        return mutate(s => {
          const g = getDocument(s, id)
          if (!g.ok) return fail(g.reason === 'forbidden' ? 'You do not have permission to open this document.' : 'Document not found.')
          const doc = s.documents.find(x => x.id === id)!
          doc.accessLog.push({ id: nextId(s, 'event', 'AE'), at: nowISO(), actor: actorName(s), action })
          return ok(doc as VaultDocument)
        })
      },

      // ================= payments =================
      recordPayment(invoiceId: string, p: { amount: number; method: string; status: 'success' | 'failed' | 'pending'; reference: string; failureReason?: string }): Result<string> {
        return mutate(s => {
          if (!memberOnly(s)) return fail('Only the member can make payments.')
          const inv = s.invoices.find(x => x.id === invoiceId)
          if (!inv) return fail('Invoice not found.')
          const t = invoiceTotals(inv, s)
          if (t.due <= 0) return fail('This invoice is already settled.')
          // idempotency: ignore a duplicate reference
          if (s.payments.some(x => x.reference === p.reference)) return fail('Duplicate payment reference ignored.')
          const id = nextId(s, 'payment', 'PAY')
          s.payments.push({ id, invoiceId, amount: p.amount, method: `${p.method} (simulated)`, status: p.status, at: nowISO(), reference: p.reference, failureReason: p.failureReason })
          if (p.status === 'success') notify(s, { type: 'payment', title: 'Payment received', body: `₹${p.amount.toLocaleString('en-IN')} for ${inv.number} (simulated).`, link: `/payments/invoices/${inv.id}` })
          if (p.status === 'failed') notify(s, { type: 'payment_due', title: 'Payment failed', body: `${inv.number}: ${p.failureReason}. You can retry.`, link: `/payments/invoices/${inv.id}` })
          return ok(id)
        })
      },
      resolvePayment(paymentId: string, status: 'success' | 'failed') {
        return mutate(s => {
          const p = s.payments.find(x => x.id === paymentId)
          if (!p || p.status !== 'pending') return fail('Payment is not pending.')
          p.status = status
          if (status === 'failed') p.failureReason = 'Bank did not confirm the payment (simulated)'
          const inv = s.invoices.find(x => x.id === p.invoiceId)!
          notify(s, status === 'success'
            ? { type: 'payment', title: 'Payment confirmed', body: `₹${p.amount.toLocaleString('en-IN')} for ${inv.number} (simulated).`, link: `/payments/invoices/${inv.id}` }
            : { type: 'payment_due', title: 'Payment not confirmed', body: `${inv.number} is still due.`, link: `/payments/invoices/${inv.id}` })
          return ok(undefined)
        })
      },
      requestRefund(r: { invoiceId: string; amount: number; reason: string }) {
        return mutate(s => {
          if (!memberOnly(s)) return fail('Not permitted.')
          const inv = s.invoices.find(x => x.id === r.invoiceId)
          if (!inv) return fail('Choose an invoice.')
          const paid = invoiceTotals(inv, s).paid
          if (!(r.amount > 0) || r.amount > paid) return fail(`Amount must be between ₹1 and the paid amount (₹${paid.toLocaleString('en-IN')}).`)
          if (!r.reason.trim()) return fail('Describe why you are requesting a refund.')
          const id = nextId(s, 'refund', 'RF')
          s.refunds.unshift({ id, invoiceId: inv.id, kind: 'invoice', amount: r.amount, reason: r.reason.trim(), status: 'submitted', createdAt: nowISO(), timeline: [event(s, s.member.name, 'Refund requested')] })
          notify(s, { type: 'payment', title: 'Refund request submitted', body: `${id} for ₹${r.amount.toLocaleString('en-IN')} — finance will review it. This is not yet an approved refund.`, link: '/payments?tab=refunds' })
          return ok(id)
        })
      },

      // PRD S20: reports older than 12 months are generated asynchronously.
      queueSpendReport(fromDate: string) {
        const res = mutate(s => {
          notify(s, { type: 'payment', title: 'Report requested', body: `Spend report from ${fmtDate(fromDate)} is being prepared.`, link: '/payments?tab=transactions' })
          return ok(undefined)
        })
        later(3500, s => notify(s, { type: 'payment', title: 'Your spend report is ready', body: 'Available for 7 days from Payments → Transactions (simulated secure link).', link: '/payments?tab=transactions' }))
        return res
      },

      // ================= financial services =================
      createFinanceCase(kind: FinanceCaseKind, data: { beneficiaryId: string; summary: Record<string, string>; consents: string[]; emergency?: boolean }): Result<string> {
        return mutate(s => {
          if (!memberOnly(s)) return fail('Only the member can open financial cases.')
          const id = nextId(s, 'finance', 'FIN')
          const ef = kind === 'emergency_funding'
          const c: FinanceCase = {
            id, kind, title: ef ? (data.emergency ? 'Emergency funding request' : 'Emergency funding readiness profile') : `Estate documentation — ${data.summary['Name of deceased'] ?? 'case'}`,
            status: ef && !data.emergency ? 'documents_pending' : 'submitted', beneficiaryId: data.beneficiaryId,
            partner: ef ? 'Lending partner (simulated)' : 'Asset-tracing partner (simulated)', caseManager: ef ? 'Finance desk' : 'Case manager (to be assigned)',
            createdAt: nowISO(), summary: data.summary, consents: data.consents, infoRequests: [], messages: [],
            checklist: ef
              ? [{ id: 'C1', label: 'PAN card', required: true }, { id: 'C2', label: 'ID proof', required: true }, { id: 'C3', label: 'Bank statements — last 6 months', required: true }, { id: 'C4', label: 'Income proof', required: true }, ...(data.emergency ? [{ id: 'C5', label: 'Emergency evidence (e.g. hospital estimate)', required: true }] : [])]
              : [{ id: 'C1', label: 'Death certificate', required: true }, { id: 'C2', label: 'Legal heir / succession certificate', required: true }, { id: 'C3', label: 'Claimant ID proof', required: true }, { id: 'C4', label: 'Known policy / account details', required: false }],
            charges: ef ? undefined : [],
            timeline: [event(s, s.member.name, ef ? (data.emergency ? 'Emergency request initiated' : 'Readiness profile started') : 'Case opened')],
          }
          s.financeCases.unshift(c)
          notify(s, { type: 'service', title: 'Case created', body: `${c.title} (${id}).`, link: `/financial/${id}` })
          if (c.status === 'submitted') later(3500, st => {
            const cc = st.financeCases.find(x => x.id === id)
            if (cc?.status === 'submitted') {
              cc.status = 'partner_review'
              cc.timeline.push(event(st, cc.partner, 'Received by partner — under review', undefined, 'Simulated partner update'))
              notify(st, { type: 'service', title: 'Partner update', body: `${cc.partner} has started reviewing ${id}.`, link: `/financial/${id}` })
            }
          })
          return ok(id)
        })
      },
      attachFinanceDoc(caseId: string, itemId: string, documentId: string) {
        return mutate(s => {
          const c = s.financeCases.find(x => x.id === caseId)
          const it = c?.checklist.find(x => x.id === itemId)
          if (!c || !it) return fail('Not found.')
          it.documentId = documentId
          c.timeline.push(event(s, s.member.name, `Document attached: ${it.label}`))
          const missing = c.checklist.filter(x => x.required && !x.documentId).length
          if (c.status === 'documents_pending' && missing === 0) c.timeline.push(event(s, 'Finance desk', 'Checklist complete — ready for partner handoff if an emergency occurs'))
          return ok(undefined)
        })
      },
      answerInfoRequest(caseId: string, irId: string, response: string) {
        return mutate(s => {
          const c = s.financeCases.find(x => x.id === caseId)
          const ir = c?.infoRequests.find(x => x.id === irId)
          if (!c || !ir) return fail('Not found.')
          if (!response.trim()) return fail('Add a response.')
          ir.status = 'answered'; ir.response = response.trim()
          c.timeline.push(event(s, s.member.name, 'Information provided', undefined, response.trim()))
          if (c.status === 'info_requested' && c.infoRequests.every(x => x.status === 'answered')) c.status = 'partner_review'
          return ok(undefined)
        })
      },
      triggerEmergency(caseId: string, details: string) {
        return mutate(s => {
          const c = s.financeCases.find(x => x.id === caseId)
          if (!c || c.kind !== 'emergency_funding') return fail('Not found.')
          if (!s.consents.find(x => x.key === 'lender_sharing')?.granted) return fail('Consent to share data with the lending partner is required first.')
          if (!details.trim()) return fail('Describe the emergency.')
          c.status = 'submitted'; c.title = 'Emergency funding request'
          c.summary['Emergency'] = details.trim()
          c.timeline.push(event(s, s.member.name, 'Emergency request initiated', undefined, 'Handed off to lending partner (simulated)'))
          notify(s, { type: 'service', title: 'Emergency request handed to partner', body: 'The lending partner decides eligibility, amount and timing.', link: `/financial/${c.id}` })
          return ok(undefined)
        })
      },
      simulatePartnerUpdate(caseId: string) {
        return mutate(s => {
          const c = s.financeCases.find(x => x.id === caseId)
          if (!c) return fail('Not found.')
          const order: FinanceCase['status'][] = ['submitted', 'partner_review', 'info_requested', 'partner_decision']
          if (c.status === 'documents_pending' || c.status === 'readiness') return fail('Complete the readiness checklist or start an emergency request first.')
          if (c.status === 'partner_decision' || c.status === 'closed') return fail('The partner has already given a decision.')
          let next = order[Math.min(order.indexOf(c.status) + 1, order.length - 1)] ?? 'partner_review'
          if (next === 'info_requested' && c.infoRequests.some(x => x.status === 'answered')) next = 'partner_decision'
          if (c.status === 'info_requested' && c.infoRequests.some(x => x.status === 'open')) return fail('Answer the open information request first.')
          if (next === 'info_requested') {
            c.infoRequests.push({ id: nextId(s, 'event', 'IR'), at: nowISO(), text: c.kind === 'emergency_funding' ? 'Please confirm the hospital estimate and the account for disbursement.' : 'Please confirm the list of known accounts.', status: 'open' })
          }
          c.status = next
          const label = next === 'partner_decision' ? (c.kind === 'emergency_funding' ? 'Partner decision recorded: in-principle offer (simulated) — terms set by the lender' : 'Partner located assets — claim filing in progress (simulated)') : next === 'info_requested' ? 'Partner requested more information' : 'Partner review started'
          c.timeline.push(event(s, c.partner, label, undefined, 'Simulated partner update'))
          notify(s, { type: 'service', title: 'Partner update', body: `${c.id}: ${label}`, link: `/financial/${c.id}` })
          return ok(undefined)
        })
      },
      sendFinanceMessage(caseId: string, text: string) {
        if (!text.trim()) return fail('Write a message first.')
        const res = mutate(s => {
          const c = s.financeCases.find(x => x.id === caseId)
          if (!c) return fail('Not found.')
          c.messages.push(msg(s, 'member', s.member.name, text.trim()))
          return ok(undefined)
        })
        if (res.ok) later(2200, s => { const c = s.financeCases.find(x => x.id === caseId); if (c) c.messages.push(msg(s, 'support', c.caseManager, 'Thank you. I have noted this on your case and will update you after speaking with the partner.')) })
        return res
      },

      // ================= support =================
      createSupportCase(c: { type: SupportType; subject: string; category: string; urgency: SupportCase['urgency']; description: string; relatedRequestId?: string; relatedInvoiceId?: string; attachmentName?: string }): Result<string> {
        return mutate(s => {
          if (!memberOnly(s)) return fail('Only the member can raise support cases.')
          if (!c.subject.trim() || !c.description.trim() || !c.category) return fail('Subject, category and description are required.')
          const prefix = { complaint: 'CMP', billing: 'BIL', escalation: 'ESC', exec_change: 'CHG', general: 'SUP' }[c.type]
          const id = nextId(s, 'support', prefix)
          const slaH = c.urgency === 'high' ? 24 : c.urgency === 'medium' ? 72 : 120
          s.supportCases.unshift({ ...c, subject: c.subject.trim(), description: c.description.trim(), id, status: 'open', createdAt: nowISO(), slaDue: new Date(Date.now() + slaH * 3600000).toISOString(), timeline: [event(s, s.member.name, 'Case raised')], messages: [] })
          if (c.type === 'billing' && c.relatedInvoiceId) { const inv = s.invoices.find(x => x.id === c.relatedInvoiceId); if (inv) inv.disputed = true }
          notify(s, { type: 'service', title: 'Support case created', body: `${id}: ${c.subject}`, link: `/support/${id}` })
          later(3000, st => {
            const sc = st.supportCases.find(x => x.id === id)
            if (sc?.status === 'open') { sc.status = 'in_review'; sc.timeline.push(event(st, c.type === 'billing' ? 'Finance desk' : 'Farah Siddiqui', 'In review — owner assigned')) }
          })
          return ok(id)
        })
      },
      sendSupportMessage(id: string, text: string) {
        if (!text.trim()) return fail('Write a message first.')
        const res = mutate(s => {
          const c = s.supportCases.find(x => x.id === id)
          if (!c) return fail('Not found.')
          if (c.status === 'closed') return fail('This case is closed.')
          c.messages.push(msg(s, 'member', s.member.name, text.trim()))
          return ok(undefined)
        })
        if (res.ok) later(2200, s => { const c = s.supportCases.find(x => x.id === id); if (c) c.messages.push(msg(s, 'support', c.type === 'billing' ? 'Finance desk' : 'Farah Siddiqui', 'Thank you for the update. I’ve added it to the case and will respond within the SLA.')) })
        return res
      },
      escalateSupportCase(id: string, reason: string) {
        return mutate(s => {
          const c = s.supportCases.find(x => x.id === id)
          if (!c) return fail('Not found.')
          if (['resolved', 'closed', 'escalated'].includes(c.status)) return fail('This case cannot be escalated.')
          if (!reason.trim()) return fail('Tell us why you are escalating.')
          c.status = 'escalated'
          c.timeline.push(event(s, s.member.name, 'Escalated to regional head', undefined, reason.trim()))
          notify(s, { type: 'service', title: 'Case escalated', body: `${c.id} is now with the regional head.`, link: `/support/${c.id}` })
          return ok(undefined)
        })
      },
      simulateSupportResolution(id: string) {
        return mutate(s => {
          const c = s.supportCases.find(x => x.id === id)
          if (!c || ['resolved', 'closed'].includes(c.status)) return fail('This case is already resolved.')
          c.status = 'resolved'
          c.timeline.push(event(s, c.type === 'billing' ? 'Finance desk' : 'Farah Siddiqui', 'Resolved', undefined, 'Simulated resolution for review'))
          c.messages.push(msg(s, 'support', c.type === 'billing' ? 'Finance desk' : 'Farah Siddiqui', 'We have resolved this. Please let us know if anything is still not right — you can reopen by replying.'))
          notify(s, { type: 'service', title: 'Case resolved', body: `${c.id}: ${c.subject}`, link: `/support/${c.id}` })
          return ok(undefined)
        })
      },
      closeSupportCase(id: string) {
        return mutate(s => {
          const c = s.supportCases.find(x => x.id === id)
          if (!c || c.status !== 'resolved') return fail('Only resolved cases can be closed.')
          c.status = 'closed'
          c.timeline.push(event(s, s.member.name, 'Closed by member'))
          return ok(undefined)
        })
      },
      submitFeedback(f: { csat: number; nps: number; comment: string; wishlist: string; requestId?: string }) {
        return mutate(s => {
          if (!f.csat) return fail('Choose a satisfaction rating.')
          s.feedback.unshift({ ...f, id: nextId(s, 'event', 'FB'), at: nowISO() })
          return ok(undefined)
        })
      },

      // ================= membership =================
      submitCancellation(snapshot: Record<string, string>, reason: string): Result<string> {
        return mutate(s => {
          if (!memberOnly(s)) return fail('Only the member can request cancellation.')
          if (s.membership.status === 'cancellation_requested') return fail('A cancellation request is already under review.')
          if (!reason) return fail('Select a reason.')
          const id = nextId(s, 'request', 'REQ')
          s.requests.unshift({
            id, kind: 'cancellation', title: 'Membership cancellation & refund review', beneficiaryId: 'BEN-SELF', ownerId: 'member', ownerName: s.member.name,
            assignedTo: 'Membership & finance team', status: 'submitted', priority: 'standard', mode: 'remote', city: s.member.homeCity, address: '—',
            instructions: reason, contactName: s.member.name, contactPhone: s.member.mobile, expectedHours: 0, funding: 'bundle', documentIds: [], approvalIds: [],
            createdAt: nowISO(), slaDue: new Date(Date.now() + 15 * 86400000).toISOString(), meta: snapshot,
            timeline: [event(s, s.member.name, 'Cancellation requested', 'submitted', `Illustrative estimate: ${snapshot['Estimated refund'] ?? '—'}`)], messages: [],
          })
          setStatus(s, s.requests[0], 'under_review', 'Membership team', 'Manual review started', 'Membership stays active during review. No refund is issued until policy validation and approval.')
          s.membership.status = 'cancellation_requested'
          notify(s, { type: 'request', title: 'Cancellation request received', body: 'Your membership remains active while we review it.', link: `/requests/${id}` })
          return ok(id)
        })
      },
      withdrawCancellation(requestId: string) {
        return mutate(s => {
          const r = s.requests.find(x => x.id === requestId)
          if (!r || r.kind !== 'cancellation') return fail('Not found.')
          if (!setStatus(s, r, 'cancelled', s.member.name, 'Withdrawn by member')) return fail('This request can no longer be withdrawn.')
          s.membership.status = 'active'
          return ok(undefined)
        })
      },

      // ================= profile & security =================
      updateMember(patch: Partial<AppState['member']>) {
        return mutate(s => {
          if (!memberOnly(s)) return fail('Not permitted.')
          if (patch.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email)) return fail('Enter a valid email address.')
          if (patch.mobile !== undefined && patch.mobile.replace(/[^\d]/g, '').length < 10) return fail('Enter a valid mobile number with country code.')
          Object.assign(s.member, patch)
          return ok(undefined)
        })
      },
      setConsent(key: string, granted: boolean) {
        return mutate(s => {
          const c = s.consents.find(x => x.key === key)
          if (!c) return fail('Unknown consent.')
          if (c.required && !granted) return fail('This consent is required for an active membership. To withdraw it, request cancellation.')
          c.granted = granted; c.at = nowISO()
          return ok(undefined)
        })
      },
      updateSecurity(patch: Partial<AppState['security']>) {
        return mutate(s => { Object.assign(s.security, patch); return ok(undefined) })
      },
      signOutSession(id: string) {
        return mutate(s => {
          const ss = s.security.sessions.find(x => x.id === id)
          if (!ss || ss.current) return fail('Use Log out to end this session.')
          s.security.sessions = s.security.sessions.filter(x => x.id !== id)
          notify(s, { type: 'security', title: 'Session signed out', body: `${ss.device} (${ss.location}) was signed out.`, link: '/profile?tab=security' })
          return ok(undefined)
        })
      },
      removeDevice(id: string) {
        return mutate(s => {
          const d = s.security.devices.find(x => x.id === id)
          if (!d) return fail('Not found.')
          s.security.devices = s.security.devices.filter(x => x.id !== id)
          notify(s, { type: 'security', title: 'Trusted device removed', body: `${d.name} will need MFA at next sign-in.`, link: '/profile?tab=security' })
          return ok(undefined)
        })
      },
      regenerateBackupCodes(): Result<string[]> {
        const codes = Array.from({ length: 8 }, () => Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase())
        const r = mutate(s => { s.security.backupCodesGeneratedAt = nowISO(); return ok(undefined) })
        return r.ok ? ok(codes) : r
      },

      // ================= AI concierge =================
      addAiMessages(msgs: AppState['aiMessages']) {
        return mutate(s => { s.aiMessages.push(...msgs); return ok(undefined) })
      },
      clearAi() {
        return mutate(s => { s.aiMessages = []; return ok(undefined) })
      },

      // ================= enrollment =================
      saveApplication(app: Application) {
        return mutate(s => {
          const i = s.applications.findIndex(x => x.id === app.id)
          if (i >= 0) s.applications[i] = app
          else s.applications.unshift(app)
          return ok(app.id)
        })
      },
      newApplicationId() {
        return 'APP-' + Date.now().toString(36).toUpperCase()
      },

      resetDemo() {
        const fresh = createSeed()
        ref.current = fresh
        setState(fresh)
        try { localStorage.setItem(KEY, JSON.stringify(fresh)) } catch { /* ignore */ }
      },
    }
  }, [mutate, later])

  return { state, actions, storageError }
}

// Shared by cancelAppointment / cancelRequest / approval rejection.
function cancelApptDraft(s: AppState, id: string, reason: string) {
  const a = s.appointments.find(x => x.id === id)!
  const o = cancellationOutcome(s, a)
  const ref = a.requestId
  if (a.entitlement && ref) {
    const held = heldFor(s, ref, a.entitlement.ent)
    if (held > 0) ledger(s, a.entitlement.ent, 'release', held, 'Hold released — booking cancelled', ref)
    if (o.consume > 0 && a.status !== 'pending_approval') ledger(s, a.entitlement.ent, 'consume', -o.consume, `Late cancellation (< ${POLICY.freeCancelHours} h) — ${o.consume} ${a.entitlement.ent === 'hours' ? 'h' : 'credit'} consumed per policy`, ref)
  }
  if (a.invoiceId && !o.chargeKept) {
    const inv = s.invoices.find(x => x.id === a.invoiceId)
    if (inv) inv.creditApplied = invoiceTotals(inv, s).total - invoiceTotals(inv, s).paid
  }
  a.status = 'cancelled'
  a.history.push({ at: nowISO(), label: `Cancelled${reason ? ` — ${reason}` : ''}${o.late ? ' (late cancellation)' : ''}` })
  s.notifications.unshift({
    id: `N-${(s.counters.notification = (s.counters.notification ?? 0) + 1)}`, type: 'booking', title: 'Booking cancelled',
    body: `${a.title} on ${fmtDate(a.date)}. ${o.late && o.consume ? `${o.consume} ${o.ent === 'hours' ? 'hour' : 'credit'} consumed under the late-cancellation rule.` : 'Any hold has been released in full.'}`,
    at: nowISO(), read: false, link: `/appointments/${a.id}`,
  })
}

type Store = ReturnType<typeof useStoreImpl>
const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const store = useStoreImpl()
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp outside StoreProvider')
  return v
}

export { categoryName }
