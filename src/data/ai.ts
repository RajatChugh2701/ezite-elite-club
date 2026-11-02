// Rule-based stand-in for the AI concierge (PRD S19). It reads the same mock state as the
// rest of the app so its answers never contradict the dashboard. It never books, approves or
// reveals vault contents — it only explains and opens the relevant screen for confirmation.

import type { AppState, AiMessage } from './types'
import { balance, nextAppointment, plan, unpaidInvoices, invoiceTotals, visibleAppointments, isUpcoming, apptStart, anniversary } from './selectors'
import { SERVICES, execById, cityName } from './config'
import { fmtDate, fmtTime, inr } from '../lib/format'

type Reply = Pick<AiMessage, 'text' | 'actions'>

const has = (t: string, ...words: string[]) => words.some(w => t.includes(w))

export function aiRespond(input: string, s: AppState): Reply {
  const t = input.toLowerCase()
  const p = plan(s)
  const hrs = balance(s, 'hours')
  const con = balance(s, 'consult')
  const doc = balance(s, 'doc')
  const pe = execById(s.membership.peId)!

  if (has(t, 'executive', 'human', 'person', 'talk to', 'connect', 'anita', 'call me')) {
    return {
      text: `Of course. ${pe.name} is your Personal Executive (${pe.workingHours}). I’ve prepared a handoff — the conversation transcript stays with your account so you won’t need to repeat yourself.`,
      actions: [{ label: `Message ${pe.name.split(' ')[0]}`, to: '/messages' }, { label: 'View my concierge team', to: '/team' }],
    }
  }
  if (has(t, 'credit') && has(t, 'consult') || has(t, 'consultation credit', 'consultations left', 'how many consult')) {
    return {
      text: `You have ${con.available} of ${con.total} included consultation credits available this benefit year${con.held ? ` (${con.held} on hold for an upcoming session)` : ''}. ${con.used} ${con.used === 1 ? 'has' : 'have'} been used. Credits reset on ${fmtDate(anniversary(s))}. After they’re used, eligible sessions show their fee before you confirm.`,
      actions: [{ label: 'Book a consultation', to: '/consultations' }, { label: 'See the ledger', to: '/membership?tab=ledger&ent=consult' }],
    }
  }
  if (has(t, 'hour')) {
    return {
      text: `You have ${hrs.available} of ${hrs.total} executive hours available. ${hrs.used} used, ${hrs.held} on hold for upcoming visits.`,
      actions: [{ label: 'View usage', to: '/membership?tab=ledger&ent=hours' }],
    }
  }
  if (has(t, 'benefit', 'included', 'entitle', 'what do i get', 'membership')) {
    return {
      text: `Your ${p.name} membership includes, each benefit year:\n• ${p.execHoursPerYear} Personal Executive hours — ${hrs.available} available now\n• ${p.consultationsPerYear} expert consultations — ${con.available} available\n• Documentation credit of ${inr(p.docCreditINR)} for eligible events — ${inr(doc.available)} available\n\nNot included: government fees and third-party charges, medical care, and guaranteed outcomes from partners. Allowances are draft plan configuration values.`,
      actions: [{ label: 'View my membership', to: '/membership' }, { label: 'Browse services', to: '/services' }],
    }
  }
  if (has(t, 'parent', 'mother', 'father', 'mom', 'dad', 'elder', 'amma', 'nanna')) {
    const ben = s.beneficiaries.find(b => /mother/i.test(b.relationship))
    const q = new URLSearchParams({ service: 'elder-wellness', ...(ben ? { beneficiary: ben.id } : {}), notes: input.slice(0, 200) })
    return {
      text: `I can help arrange that. Popular options for parents:\n• Elder wellness visit — a warm check-in with a written update (from your bundle hours)\n• Doctor visit accompaniment — pickup, appointment and pharmacy\n\nI’ll open a request with your note prefilled. Nothing is booked until you review the quote and confirm.`,
      actions: [
        { label: 'Start an elder wellness visit', to: `/request/new?${q}` },
        { label: 'Doctor visit accompaniment', to: `/request/new?${new URLSearchParams({ service: 'doctor-accompany', ...(ben ? { beneficiary: ben.id } : {}), notes: input.slice(0, 200) })}` },
      ],
    }
  }
  if (has(t, 'appointment', 'upcoming', 'schedule', 'booking', 'visit')) {
    const ups = visibleAppointments(s).filter(isUpcoming).sort((a, b) => apptStart(a).getTime() - apptStart(b).getTime()).slice(0, 3)
    if (!ups.length) return { text: 'You have no upcoming appointments.', actions: [{ label: 'Request assistance', to: '/request/new' }] }
    return {
      text: 'Your next appointments:\n' + ups.map(a => `• ${a.title} — ${fmtDate(a.date, { weekday: 'short', day: 'numeric', month: 'short' })}, ${fmtTime(a.start)} (${cityName(a.city)})`).join('\n'),
      actions: [{ label: 'Open appointments', to: '/appointments' }, ...(nextAppointment(s) ? [{ label: 'Next appointment details', to: `/appointments/${nextAppointment(s)!.id}` }] : [])],
    }
  }
  if (has(t, 'invoice', 'bill', 'pay', 'due', 'outstanding', 'balance')) {
    const unpaid = unpaidInvoices(s)
    const total = unpaid.reduce((a, i) => a + invoiceTotals(i, s).due, 0)
    return {
      text: unpaid.length
        ? `You have ${unpaid.length} unpaid invoice${unpaid.length > 1 ? 's' : ''} totalling ${inr(total)}:\n` + unpaid.map(i => `• ${i.number} — ${i.title}: ${inr(invoiceTotals(i, s).due)} (due ${fmtDate(i.dueDate)})`).join('\n')
        : 'You have no unpaid invoices. 🎉'.replace(' 🎉', ''),
      actions: [{ label: 'Open invoices', to: '/payments?tab=invoices' }],
    }
  }
  if (has(t, 'document', 'vault', 'upload', 'certificate', 'share')) {
    return {
      text: 'Your secure vault lets you upload documents, share them with your executive or an expert for a specific case, set an expiry and revoke access at any time. For privacy, I can’t read or summarise vault contents.',
      actions: [{ label: 'Open Documents & Vault', to: '/documents' }, { label: 'Request paperwork help', to: '/services?category=claims' }],
    }
  }
  if (has(t, 'loan', 'fund', 'emergency', 'money urgently')) {
    return {
      text: 'Emergency funding is arranged with a lending partner. EZIT can help you prepare documents and hand your request to the partner, but eligibility, amount, pricing and timing are decided only by the partner — approval is never guaranteed. I can’t approve or promise funding.',
      actions: [{ label: 'Financial services', to: '/financial' }],
    }
  }
  if (has(t, 'cancel') && has(t, 'membership')) {
    return { text: 'You can see an illustrative cancellation and refund estimate before deciding. Submitting creates a review request — it doesn’t cancel your membership immediately.', actions: [{ label: 'Open the estimator', to: '/membership/cancel' }] }
  }
  const match = SERVICES.filter(svc => svc.name.toLowerCase().split(/[^a-z]+/).some(w => w.length > 3 && t.includes(w))).slice(0, 3)
  if (match.length) {
    return {
      text: 'These services look relevant:\n' + match.map(m => `• ${m.name} — ${m.summary}`).join('\n'),
      actions: match.map(m => ({ label: m.name, to: `/services/${m.id}` })),
    }
  }
  return {
    text: 'I’m a simulated, rule-based assistant for this prototype, so I may not have understood. I can explain your benefits, check balances and appointments, find invoices, or connect you with your Personal Executive.',
    actions: [{ label: `Talk to ${pe.name.split(' ')[0]}`, to: '/messages' }, { label: 'Browse services', to: '/services' }],
  }
}
