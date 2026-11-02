// Demo data — fictional records only. Dates are generated relative to the first load so the
// prototype always has an upcoming visit, an overdue invoice, etc. Change the demo account here.

import type { AppState, Appointment, LedgerEntry, ServiceRequest, TimelineEvent } from './types'
import { addDays, pad, toISODate } from '../lib/format'

export const STATE_VERSION = 3

export function createSeed(): AppState {
  const now = new Date()
  const today = toISODate(now)
  const day = (n: number) => toISODate(addDays(now, n))
  const at = (n: number, h = 10, m = 0) => {
    const d = addDays(now, n)
    d.setHours(h, m, 0, 0)
    return d.toISOString()
  }

  // Membership timeline: active for ~8.5 months of the first benefit year.
  const start = addDays(now, -263)
  const startISO = toISODate(start)
  const byEnd = toISODate(addDays(start, 364))
  const valid = new Date(start)
  valid.setFullYear(valid.getFullYear() + 10)
  const validISO = toISODate(addDays(valid, -1))

  // Today's visit: next full hour + 1 (moved to tomorrow morning if it is late in the day).
  let visitDay = 0
  let visitHour = now.getHours() + 1
  if (visitHour < 9) visitHour = 9
  if (visitHour > 19) { visitDay = 1; visitHour = 10 }
  const visitStart = `${pad(visitHour)}:00`
  const visitEnd = `${pad(visitHour + 3)}:00`

  const ev = (n: number, actor: string, label: string, status?: TimelineEvent['status'], detail?: string, h = 10): TimelineEvent => ({
    id: `EV-${Math.random().toString(36).slice(2, 9)}`, at: at(n, h), actor, label, status, detail,
  })
  const L = (id: string, ent: LedgerEntry['ent'], kind: LedgerEntry['kind'], amount: number, n: number, description: string, refId?: string, refType: LedgerEntry['refType'] = 'request', actor = 'System'): LedgerEntry =>
    ({ id, ent, kind, amount, at: at(n, 9), description, refId, refType: refId ? refType : undefined, actor })

  const startOffset = -263
  const ledger: LedgerEntry[] = [
    L('LG-001', 'hours', 'grant', 30, startOffset, 'Benefit-year grant — Elite 10 IND (30 executive hours)'),
    L('LG-002', 'consult', 'grant', 5, startOffset, 'Benefit-year grant — 5 included consultations'),
    L('LG-003', 'doc', 'grant', 75000, startOffset, 'Documentation credit allowance — Elite 10 IND (demo value)'),
    L('LG-010', 'hours', 'hold', -2, -125, 'Hold for property inspection visit', 'REQ-24006'),
    L('LG-011', 'hours', 'release', 2, -120, 'Hold released on visit completion', 'REQ-24006'),
    L('LG-012', 'hours', 'consume', -2, -120, 'Property inspection & report — 2 h settled', 'REQ-24006', 'request', 'Karthik Iyer'),
    L('LG-020', 'hours', 'consume', -3, -45, 'Bank KYC & life certificate — 3 h settled', 'REQ-24014', 'request', 'Anita Sharma'),
    L('LG-021', 'hours', 'reversal', 1, -43, 'Goodwill reversal — late arrival (complaint CMP-3001)', 'REQ-24014', 'request', 'Farah Siddiqui'),
    L('LG-030', 'consult', 'hold', -1, -44, 'Credit hold — income tax consultation', 'REQ-24008'),
    L('LG-031', 'consult', 'release', 1, -40, 'Hold released on session completion', 'REQ-24008'),
    L('LG-032', 'consult', 'consume', -1, -40, 'Income tax consultation completed', 'REQ-24008', 'request', 'Neha Kapoor'),
    L('LG-040', 'hours', 'hold', -3, -22, 'Hold for elder wellness visit', 'REQ-24011'),
    L('LG-041', 'hours', 'release', 3, -20, 'Hold released on visit completion', 'REQ-24011'),
    L('LG-042', 'hours', 'consume', -3, -20, 'Elder wellness visit — 3 h settled', 'REQ-24011', 'request', 'Anita Sharma'),
    L('LG-050', 'doc', 'consume', -12500, -30, 'Applied to approved estate paperwork charges', 'FIN-2002', 'financeCase', 'Case manager'),
    L('LG-060', 'consult', 'hold', -1, -6, 'Credit hold — succession consultation', 'REQ-24030'),
    L('LG-070', 'hours', 'hold', -2, -5, 'Hold for rental flat handover visit', 'REQ-24029'),
    L('LG-080', 'hours', 'hold', -3, -2, 'Hold for doctor visit accompaniment', 'REQ-24031'),
  ]

  const req = (r: Partial<ServiceRequest> & Pick<ServiceRequest, 'id' | 'title' | 'status' | 'createdAt'>): ServiceRequest => ({
    kind: 'service', beneficiaryId: 'BEN-SELF', ownerId: 'member', ownerName: 'Ravi Teja', assignedTo: 'PE-ANITA',
    priority: 'standard', mode: 'in_person', city: 'hyderabad', address: '', instructions: '', contactName: 'Ravi Teja',
    contactPhone: '+91 98480 12345', expectedHours: 0, funding: 'bundle', documentIds: [], approvalIds: [], timeline: [], messages: [], ...r,
  })

  const requests: ServiceRequest[] = [
    req({
      id: 'REQ-24031', serviceId: 'doctor-accompany', title: 'Doctor visit accompaniment', status: 'scheduled', createdAt: at(-2, 11),
      beneficiaryId: 'BEN-MOTHER', address: 'Plot 22, Road No. 3, Banjara Hills, Hyderabad 500034', locationNotes: 'Gate code with security; ground floor',
      instructions: 'Cardiology follow-up at Lotus Heart Clinic. Please carry the last two prescriptions and note the doctor’s advice on diet.',
      contactName: 'Lakshmi Teja', contactPhone: '+91 98490 22110', expectedHours: 3, appointmentId: 'APT-1002', preferredDate: visitDay ? day(1) : today,
      window: `${visitStart}–${visitEnd}`, slaDue: at(visitDay, visitHour + 3),
      quote: { bundleHours: 3, chargeableHours: 0, base: 0, discount: 0, tax: 0, extras: 0, total: 0, lines: [{ label: '3 executive hours from bundle', amount: 0 }, { label: 'Cab fares at actuals (billed later)', amount: 0 }] },
      timeline: [
        ev(-2, 'Ravi Teja', 'Request submitted', 'submitted', undefined, 11),
        ev(-2, 'System', '3 executive hours placed on hold', undefined, undefined, 11),
        ev(-2, 'Anita Sharma', 'Visit confirmed', 'scheduled', 'Anita will pick up Mrs. Teja from home.', 12),
      ],
      messages: [
        { id: 'M-1', at: at(-2, 12), from: 'executive', author: 'Anita Sharma', text: 'I have confirmed the appointment with the clinic. I’ll reach your mother’s home 30 minutes early.' },
      ],
    }),
    req({
      id: 'REQ-24030', kind: 'consultation', title: 'Succession & family law consultation', status: 'scheduled', createdAt: at(-6, 15),
      assignedTo: 'EXP-02', funding: 'consult_credit', appointmentId: 'APT-1001', mode: 'in_person', address: 'EZIT Lounge, Jubilee Hills, Hyderabad',
      instructions: 'Will drafting for parents and nomination updates.', preferredDate: day(1), window: '10:00–11:00',
      timeline: [ev(-6, 'Ravi Teja', 'Consultation booked', 'scheduled', 'Included credit placed on hold', 15)],
    }),
    req({
      id: 'REQ-24029', serviceId: 'pe-visit', title: 'Rental flat handover — Whitefield', status: 'scheduled', createdAt: at(-5, 16), city: 'bengaluru', assignedTo: 'POOL-BLR',
      address: 'Flat 1204, Prestige Lakeside, Whitefield, Bengaluru 560066', instructions: 'Hand over keys to the new tenant, record meter readings and photograph the flat.',
      contactName: 'Ravi Teja', expectedHours: 2, appointmentId: 'APT-1003', preferredDate: day(13), window: '14:00–16:00',
      quote: { bundleHours: 2, chargeableHours: 0, base: 0, discount: 0, tax: 0, extras: 0, total: 0, lines: [{ label: '2 executive hours from bundle', amount: 0 }] },
      timeline: [
        ev(-5, 'Ravi Teja', 'Request submitted', 'submitted', 'Cross-city request: home city Hyderabad, service city Bengaluru', 16),
        ev(-5, 'City dispatch', 'Assigned to Bengaluru city pool — Karthik Iyer', undefined, 'Your Personal Executive Anita has been notified.', 17),
        ev(-5, 'System', 'Visit confirmed', 'scheduled', undefined, 17),
      ],
    }),
    req({
      id: 'REQ-24025', serviceId: 'insurance-claim', title: 'Health insurance claim — father’s hospitalisation', status: 'awaiting_approval', createdAt: at(-9, 10),
      beneficiaryId: 'BEN-FATHER', mode: 'remote', address: 'Remote / insurer office', expectedHours: 4, approvalIds: ['APR-02'], documentIds: ['DOC-05'],
      instructions: 'Reimbursement claim for 4-day hospitalisation in August.', slaDue: at(20, 18),
      timeline: [
        ev(-9, 'Ravi Teja', 'Request submitted', 'submitted'),
        ev(-8, 'Anita Sharma', 'Claim documents collected', 'in_progress'),
        ev(-2, 'Anita Sharma', 'Insurer asked for re-submission with itemised bills', undefined, 'Specialist filing recommended'),
        ev(-2, 'Anita Sharma', 'Approval requested: specialist claim filing', 'awaiting_approval', undefined, 15),
      ],
      messages: [{ id: 'M-2', at: at(-2, 15), from: 'executive', author: 'Anita Sharma', text: 'The insurer has asked for a re-submission. I recommend specialist filing — I’ve sent the charge for your approval.' }],
    }),
    req({
      id: 'REQ-24018', serviceId: 'property-tax', title: 'Property tax arrears & mutation — Banjara Hills flat', status: 'awaiting_approval', createdAt: at(-14, 12),
      funding: 'postpaid', mode: 'in_person', address: 'Flat 3B, Banjara Residency, Road No. 12, Banjara Hills, Hyderabad', expectedHours: 4,
      approvalIds: ['APR-01'], documentIds: ['DOC-04', 'DOC-03'], slaDue: at(6, 18),
      quote: { bundleHours: 0, chargeableHours: 0, base: 7500, discount: 750, tax: 1215, extras: 0, total: 7965, lines: [{ label: 'Service fee', amount: 7500 }, { label: 'Member discount (10%)', amount: -750 }, { label: 'GST 18%', amount: 1215 }] },
      timeline: [
        ev(-14, 'Ravi Teja', 'Request submitted', 'submitted', undefined, 12),
        ev(-13, 'Anita Sharma', 'Work started — assessment records requested', 'in_progress'),
        ev(-1, 'Anita Sharma', 'Approval requested: arrears and additional visits', 'awaiting_approval', undefined, 16),
      ],
      messages: [{ id: 'M-3', at: at(-1, 16), from: 'executive', author: 'Anita Sharma', text: 'The GHMC assessment shows two years of arrears. Details are in the approval request.' }],
    }),
    req({
      id: 'REQ-24019', serviceId: 'legal-drafting', title: 'Gift deed drafting & notarisation', status: 'completed', createdAt: at(-30, 11), funding: 'postpaid', mode: 'remote', address: 'Remote',
      quote: { bundleHours: 0, chargeableHours: 0, base: 7500, discount: 0, tax: 1350, extras: 0, total: 8850, lines: [{ label: 'Drafting fee', amount: 7500 }, { label: 'GST 18%', amount: 1350 }] },
      completion: { summary: 'Gift deed drafted, reviewed with you and notarised. Registered copy uploaded to your vault.', hours: 0, evidence: ['Notarised deed (scan)', 'Stamp paper receipt'], at: at(-16, 17) },
      timeline: [ev(-30, 'Ravi Teja', 'Request submitted', 'submitted'), ev(-28, 'Partner advocate', 'Drafting started', 'in_progress'), ev(-16, 'Anita Sharma', 'Completed', 'completed', 'Invoice issued')],
    }),
    req({
      id: 'REQ-24014', serviceId: 'kyc-certificates', title: 'Bank KYC & life certificate', status: 'completed', createdAt: at(-50, 10), beneficiaryId: 'BEN-FATHER', expectedHours: 3,
      address: 'SBI, Banjara Hills branch', completion: { summary: 'KYC updated and life certificate submitted. Acknowledgement uploaded.', hours: 3, evidence: ['Bank acknowledgement slip', 'Check-in / check-out OTP log'], at: at(-45, 14) },
      timeline: [ev(-50, 'Ravi Teja', 'Request submitted', 'submitted'), ev(-45, 'Anita Sharma', 'Visit started (OTP verified)', 'in_progress'), ev(-45, 'Anita Sharma', 'Completed — 3 h', 'completed', undefined, 14), ev(-43, 'Farah Siddiqui', '1 h reversed as goodwill (late arrival)')],
    }),
    req({
      id: 'REQ-24011', serviceId: 'elder-wellness', title: 'Elder wellness visit', status: 'completed', createdAt: at(-24, 10), beneficiaryId: 'BEN-MOTHER', expectedHours: 3,
      address: 'Plot 22, Road No. 3, Banjara Hills, Hyderabad 500034', appointmentId: 'APT-0995',
      completion: { summary: 'Spent the morning with Mrs. Teja, reorganised the medicine schedule and arranged a new cook. All well.', hours: 3, evidence: ['Visit notes', '2 photos (shared with consent)'], at: at(-20, 13) },
      timeline: [ev(-24, 'Ravi Teja', 'Request submitted', 'submitted'), ev(-20, 'Anita Sharma', 'Visit started (OTP verified)', 'in_progress'), ev(-20, 'Anita Sharma', 'Completed — 3 h', 'completed', undefined, 13)],
    }),
    req({
      id: 'REQ-24008', kind: 'consultation', title: 'Income tax consultation', status: 'completed', createdAt: at(-44, 9), assignedTo: 'EXP-01', funding: 'consult_credit', mode: 'remote', address: 'Online', appointmentId: 'APT-0990',
      completion: { summary: 'Session notes uploaded to your vault.', hours: 0, evidence: ['Consultation notes'], at: at(-40, 12) },
      timeline: [ev(-44, 'Ravi Teja', 'Consultation booked', 'scheduled'), ev(-40, 'Neha Kapoor', 'Session completed', 'completed', undefined, 12)],
    }),
    req({
      id: 'REQ-24006', serviceId: 'property-inspection', title: 'Property inspection & report — Whitefield', status: 'completed', createdAt: at(-130, 10), city: 'bengaluru', assignedTo: 'POOL-BLR', expectedHours: 2,
      address: 'Flat 1204, Prestige Lakeside, Whitefield, Bengaluru 560066',
      completion: { summary: 'Inspection completed; minor seepage noted in the guest bathroom. Report and photos in your vault.', hours: 2, evidence: ['Inspection report', '14 photos'], at: at(-120, 13) },
      timeline: [ev(-130, 'Ravi Teja', 'Request submitted', 'submitted'), ev(-120, 'Karthik Iyer', 'Completed — 2 h', 'completed', undefined, 13)],
    }),
    req({
      id: 'REQ-24027', serviceId: 'airport-assist', title: 'Airport assistance — parents’ arrival', status: 'cancelled', createdAt: at(-16, 10), beneficiaryId: 'BEN-FATHER', funding: 'postpaid', appointmentId: 'APT-0998',
      address: 'Rajiv Gandhi International Airport, Hyderabad',
      timeline: [ev(-16, 'Ravi Teja', 'Request submitted', 'submitted'), ev(-15, 'System', 'Visit confirmed', 'scheduled'), ev(-12, 'Ravi Teja', 'Cancelled — travel postponed', 'cancelled', 'Cancelled more than 24 h before; no charge')],
    }),
  ]

  const appt = (a: Partial<Appointment> & Pick<Appointment, 'id' | 'title' | 'date' | 'start' | 'end' | 'status'>): Appointment => ({
    kind: 'service', beneficiaryId: 'BEN-SELF', city: 'hyderabad', mode: 'in_person', source: 'assigned_pe', createdAt: at(-5), history: [], ...a,
  })

  const appointments: Appointment[] = [
    appt({
      id: 'APT-1002', title: 'Doctor visit accompaniment', requestId: 'REQ-24031', serviceId: 'doctor-accompany', peId: 'PE-ANITA', beneficiaryId: 'BEN-MOTHER',
      date: visitDay ? day(1) : today, start: visitStart, end: visitEnd, status: 'confirmed', address: 'Plot 22, Road No. 3, Banjara Hills, Hyderabad 500034',
      entitlement: { ent: 'hours', amount: 3 }, createdAt: at(-2, 11), history: [{ at: at(-2, 12), label: 'Confirmed with Anita Sharma' }],
      visit: { stage: 'scheduled', startOtpVerified: false, endOtpVerified: false, events: [{ id: 'VE-1', stage: 'scheduled', at: at(-2, 12), note: 'Visit scheduled' }] },
    }),
    appt({
      id: 'APT-1001', kind: 'consultation', title: 'Succession & family law consultation', requestId: 'REQ-24030', expertId: 'EXP-02', consultTypeId: 'legal',
      date: day(1), start: '10:00', end: '11:00', status: 'confirmed', address: 'EZIT Lounge, Jubilee Hills, Hyderabad', source: 'expert',
      entitlement: { ent: 'consult', amount: 1 }, createdAt: at(-6, 15), notes: 'Will drafting for parents and nomination updates.', history: [{ at: at(-6, 15), label: 'Booked using an included credit' }],
    }),
    appt({
      id: 'APT-1003', title: 'Rental flat handover — Whitefield', requestId: 'REQ-24029', serviceId: 'pe-visit', peId: 'POOL-BLR', city: 'bengaluru', source: 'city_pool',
      date: day(13), start: '14:00', end: '16:00', status: 'confirmed', address: 'Flat 1204, Prestige Lakeside, Whitefield, Bengaluru 560066',
      entitlement: { ent: 'hours', amount: 2 }, createdAt: at(-5, 17), history: [{ at: at(-5, 17), label: 'Confirmed — Bengaluru city pool' }],
      visit: { stage: 'scheduled', startOtpVerified: false, endOtpVerified: false, events: [] },
    }),
    appt({
      id: 'APT-1004', title: 'Quarterly membership review with Anita', peId: 'PE-ANITA', city: 'online', mode: 'online',
      date: day(36), start: '11:00', end: '11:45', status: 'confirmed', meetingLink: 'https://meet.example/ezit-review', createdAt: at(-3),
      notes: 'No entitlement used — included courtesy call.', history: [{ at: at(-3), label: 'Scheduled by Anita Sharma' }],
    }),
    appt({
      id: 'APT-0990', kind: 'consultation', title: 'Income tax consultation', requestId: 'REQ-24008', expertId: 'EXP-01', consultTypeId: 'tax', city: 'online', mode: 'online', source: 'expert',
      date: day(-40), start: '11:30', end: '12:30', status: 'completed', entitlement: { ent: 'consult', amount: 1 }, createdAt: at(-44),
      postNotes: 'Discussed capital gains on the Whitefield flat and advance tax for Q3. Notes uploaded.', history: [{ at: at(-40, 12), label: 'Completed — credit consumed' }],
    }),
    appt({
      id: 'APT-0995', title: 'Elder wellness visit', requestId: 'REQ-24011', serviceId: 'elder-wellness', peId: 'PE-ANITA', beneficiaryId: 'BEN-MOTHER',
      date: day(-20), start: '10:00', end: '13:00', status: 'completed', address: 'Plot 22, Road No. 3, Banjara Hills, Hyderabad 500034', entitlement: { ent: 'hours', amount: 3 }, createdAt: at(-24),
      history: [{ at: at(-20, 13), label: 'Completed — 3 h settled' }],
      visit: { stage: 'completed', startOtpVerified: true, endOtpVerified: true, events: [{ id: 'VE-2', stage: 'arrived', at: at(-20, 10), note: 'Arrived; start OTP verified by Lakshmi Teja' }, { id: 'VE-3', stage: 'completed', at: at(-20, 13), note: 'Completed; end OTP verified' }] },
    }),
    appt({
      id: 'APT-0998', title: 'Airport assistance — parents’ arrival', requestId: 'REQ-24027', serviceId: 'airport-assist', peId: 'PE-RAHUL', beneficiaryId: 'BEN-FATHER', source: 'assigned_pe',
      date: day(-10), start: '06:00', end: '09:00', status: 'cancelled', address: 'Rajiv Gandhi International Airport', createdAt: at(-16),
      history: [{ at: at(-12), label: 'Cancelled by Ravi Teja — no charge (more than 24 h notice)' }],
    }),
  ]

  return {
    version: STATE_VERSION,
    member: {
      id: 'MBR-100134', name: 'Ravi Teja', firstName: 'Ravi', email: 'ravi.teja@example.com', mobile: '+91 98480 12345', whatsappOptIn: true,
      category: 'IND', countryOfResidence: 'India',
      residentialAddress: { line1: 'Villa 14, Aditya Enclave', line2: 'Road No. 36, Jubilee Hills', city: 'Hyderabad', state: 'Telangana', postcode: '500033', country: 'India' },
      serviceAddress: { line1: 'Plot 22, Road No. 3', line2: 'Banjara Hills', city: 'Hyderabad', state: 'Telangana', postcode: '500034', country: 'India' },
      billingAddress: { line1: 'Villa 14, Aditya Enclave', line2: 'Road No. 36, Jubilee Hills', city: 'Hyderabad', state: 'Telangana', postcode: '500033', country: 'India' },
      homeCity: 'hyderabad', timezone: 'Asia/Kolkata', language: 'English', contactWindow: '9:00 AM – 8:00 PM',
      contactChannels: { email: true, sms: true, whatsapp: true, phone: true }, photo: '/member-ravi.jpg',
    },
    membership: {
      id: 'MS-0001', memberNo: 'EZITE100134', planCode: 'ELITE10-IND', status: 'active', startDate: startISO, validUntil: validISO,
      benefitYearStart: startISO, benefitYearEnd: byEnd, amountPaidINR: 1000000, taxPaidINR: 180000,
      peId: 'PE-ANITA', backupPeId: 'PE-RAHUL', supervisorId: 'SUP-FARAH',
    },
    ledger,
    beneficiaries: [
      { id: 'BEN-SELF', name: 'Ravi Teja', relationship: 'Self', isSelf: true, dob: '1984-06-12', city: 'hyderabad', indiaAddress: { line1: 'Villa 14, Aditya Enclave', line2: 'Jubilee Hills', city: 'Hyderabad', postcode: '500033', country: 'India' }, phone: '+91 98480 12345', emergencyContact: { name: 'Sneha Teja', phone: '+91 98480 54321' }, consent: 'given' },
      { id: 'BEN-MOTHER', name: 'Lakshmi Teja', relationship: 'Mother', dob: '1958-03-04', city: 'hyderabad', indiaAddress: { line1: 'Plot 22, Road No. 3', line2: 'Banjara Hills', city: 'Hyderabad', postcode: '500034', country: 'India' }, phone: '+91 98490 22110', emergencyContact: { name: 'Arjun Rao', phone: '+91 99890 77665' }, consent: 'given', notes: 'Prefers Telugu. Cardiology follow-ups every quarter.' },
      { id: 'BEN-FATHER', name: 'Venkat Teja', relationship: 'Father', dob: '1954-11-21', city: 'hyderabad', indiaAddress: { line1: 'Plot 22, Road No. 3', line2: 'Banjara Hills', city: 'Hyderabad', postcode: '500034', country: 'India' }, phone: '+91 98490 22111', emergencyContact: { name: 'Arjun Rao', phone: '+91 99890 77665' }, consent: 'given' },
      { id: 'BEN-DAUGHTER', name: 'Ananya Teja', relationship: 'Daughter', dob: '2017-08-19', city: 'hyderabad', indiaAddress: { line1: 'Villa 14, Aditya Enclave', line2: 'Jubilee Hills', city: 'Hyderabad', postcode: '500033', country: 'India' }, phone: '—', emergencyContact: { name: 'Sneha Teja', phone: '+91 98480 54321' }, consent: 'pending', notes: 'Minor — consent recorded by parent.' },
    ],
    delegates: [
      {
        id: 'DLG-01', name: 'Arjun Rao', email: 'arjun.rao@example.com', phone: '+91 99890 77665', relationship: 'Brother-in-law (lives near parents)',
        status: 'accepted', createdAt: at(-90), sentAt: at(-90), acceptedAt: at(-89), expiresAt: day(150), termsAccepted: true,
        permissions: { serviceCategories: ['elderly'], documentIds: ['DOC-02'], approvals: false, visits: true, otp: true, beneficiaryIds: ['BEN-MOTHER', 'BEN-FATHER'] },
      },
      {
        id: 'DLG-02', name: 'Priya Teja', email: 'priya.teja@example.com', phone: '+91 99000 11223', relationship: 'Sister',
        status: 'sent', createdAt: at(-3), sentAt: at(-3), expiresAt: day(362), termsAccepted: false,
        permissions: { serviceCategories: ['property'], documentIds: ['DOC-03'], approvals: true, visits: false, otp: false, beneficiaryIds: ['BEN-SELF'] },
      },
      {
        id: 'DLG-03', name: 'Kiran Teja', email: 'kiran.t@example.com', phone: '+91 90000 33445', relationship: 'Cousin',
        status: 'expired', createdAt: at(-60), sentAt: at(-60), expiresAt: day(300), termsAccepted: false,
        permissions: { serviceCategories: ['travel'], documentIds: [], approvals: false, visits: false, otp: false, beneficiaryIds: ['BEN-FATHER'] },
      },
    ],
    requests,
    appointments,
    approvals: [
      {
        id: 'APR-01', requestId: 'REQ-24018', title: 'Property tax arrears and two additional municipal visits', requestedBy: 'Anita Sharma', status: 'pending', createdAt: at(-1, 16),
        reason: 'The municipal assessment shows two years of unpaid arrears. Paying them is required before mutation can proceed, and two extra visits to the ward office are needed.',
        amountINR: 7120, extraHours: 2, documentIds: ['DOC-04'],
        breakdown: [{ label: 'Municipal arrears & penalty (at actuals, no GST)', amount: 2400 }, { label: '2 additional executive hours × ₹2,000', amount: 4000 }, { label: 'GST 18% on executive hours', amount: 720 }],
      },
      {
        id: 'APR-02', requestId: 'REQ-24025', title: 'Specialist claim filing', requestedBy: 'Anita Sharma', status: 'pending', createdAt: at(-2, 15),
        reason: 'The insurer has asked for re-submission with itemised bills. Specialist filing improves completeness of the re-submission; it does not guarantee claim approval.',
        amountINR: 4130, documentIds: ['DOC-05'],
        breakdown: [{ label: 'Specialist claim filing fee', amount: 3500 }, { label: 'GST 18%', amount: 630 }],
      },
    ],
    documents: [
      { id: 'DOC-01', name: 'Passport — Ravi Teja.pdf', fileType: 'application/pdf', sizeKB: 842, category: 'identity', uploadedAt: at(-250), uploadedBy: 'Ravi Teja', beneficiaryId: 'BEN-SELF', scan: 'clean', shares: [], accessLog: [{ id: 'AE-1', at: at(-250), actor: 'Ravi Teja', action: 'uploaded' }] },
      { id: 'DOC-02', name: 'Aadhaar — Lakshmi Teja.pdf', fileType: 'application/pdf', sizeKB: 310, category: 'identity', uploadedAt: at(-200), uploadedBy: 'Ravi Teja', beneficiaryId: 'BEN-MOTHER', scan: 'clean', shares: [], accessLog: [{ id: 'AE-2', at: at(-200), actor: 'Ravi Teja', action: 'uploaded' }, { id: 'AE-3', at: at(-21), actor: 'Arjun Rao (delegate)', action: 'viewed' }] },
      { id: 'DOC-03', name: 'Sale deed — Banjara Residency 3B.pdf', fileType: 'application/pdf', sizeKB: 2210, category: 'property', uploadedAt: at(-180), uploadedBy: 'Ravi Teja', scan: 'clean', shares: [], accessLog: [{ id: 'AE-4', at: at(-180), actor: 'Ravi Teja', action: 'uploaded' }] },
      {
        id: 'DOC-04', name: 'Property tax receipt 2024-25.pdf', fileType: 'application/pdf', sizeKB: 188, category: 'property', uploadedAt: at(-14), uploadedBy: 'Ravi Teja', relatedRequestId: 'REQ-24018', scan: 'clean',
        shares: [{ id: 'SH-01', recipientId: 'PE-ANITA', recipientName: 'Anita Sharma', recipientRole: 'Personal Executive', purpose: 'Property tax arrears & mutation', requestId: 'REQ-24018', permission: 'view', createdAt: at(-14), expiresAt: at(6, 23, 59) }],
        accessLog: [{ id: 'AE-5', at: at(-14), actor: 'Ravi Teja', action: 'uploaded' }, { id: 'AE-6', at: at(-14), actor: 'Ravi Teja', action: 'shared', detail: 'With Anita Sharma for REQ-24018, view only, 21 days' }, { id: 'AE-7', at: at(-2), actor: 'Anita Sharma', action: 'accessed_by_recipient', detail: 'Viewed (watermarked)' }],
      },
      {
        id: 'DOC-05', name: 'Health policy — Venkat Teja.pdf', fileType: 'application/pdf', sizeKB: 1240, category: 'financial', uploadedAt: at(-9), uploadedBy: 'Ravi Teja', beneficiaryId: 'BEN-FATHER', relatedRequestId: 'REQ-24025', scan: 'clean',
        shares: [{ id: 'SH-02', recipientId: 'PE-ANITA', recipientName: 'Anita Sharma', recipientRole: 'Personal Executive', purpose: 'Insurance claim filing', requestId: 'REQ-24025', permission: 'view_download', createdAt: at(-9), expiresAt: at(-2), revokedAt: undefined }],
        accessLog: [{ id: 'AE-8', at: at(-9), actor: 'Ravi Teja', action: 'uploaded' }, { id: 'AE-9', at: at(-9), actor: 'Ravi Teja', action: 'shared', detail: 'With Anita Sharma for REQ-24025, 7 days' }, { id: 'AE-10', at: at(-8), actor: 'Anita Sharma', action: 'accessed_by_recipient', detail: 'Downloaded (watermarked)' }, { id: 'AE-11', at: at(-2), actor: 'System', action: 'share_expired', detail: 'Access for Anita Sharma expired' }],
      },
      { id: 'DOC-06', name: 'Consultation notes — Income tax.pdf', fileType: 'application/pdf', sizeKB: 96, category: 'consultation', uploadedAt: at(-40, 13), uploadedBy: 'Neha Kapoor (expert)', relatedRequestId: 'REQ-24008', scan: 'clean', locked: true, shares: [], accessLog: [{ id: 'AE-12', at: at(-40, 13), actor: 'Neha Kapoor (expert)', action: 'uploaded' }] },
      { id: 'DOC-07', name: 'Death certificate — Late Sri Ramaiah Teja.pdf', fileType: 'application/pdf', sizeKB: 420, category: 'family', uploadedAt: at(-35), uploadedBy: 'Ravi Teja', relatedCaseId: 'FIN-2002', scan: 'clean', shares: [], accessLog: [{ id: 'AE-13', at: at(-35), actor: 'Ravi Teja', action: 'uploaded' }] },
    ],
    invoices: [
      {
        id: 'INV-A', number: 'EZ/26-27/0142', type: 'postpaid', title: 'Postpaid statement — previous cycle', issueDate: day(-10), dueDate: day(5), period: 'Previous monthly cycle', billedTo: 'Ravi Teja',
        lines: [
          { description: 'Executive hours beyond estimate — REQ-24011 (2 h × ₹2,000)', qty: 2, rate: 2000, taxRate: 0.18, serviceDate: day(-20) },
          { description: 'Government fees at actuals — REQ-24014', qty: 1, rate: 1280, taxRate: 0, serviceDate: day(-45) },
        ],
      },
      {
        id: 'INV-B', number: 'EZ/26-27/0137', type: 'service', title: 'Gift deed drafting & notarisation', issueDate: day(-16), dueDate: day(-2), requestId: 'REQ-24019', billedTo: 'Ravi Teja',
        lines: [{ description: 'Legal drafting & notarisation — REQ-24019', qty: 1, rate: 7500, taxRate: 0.18, serviceDate: day(-16) }],
      },
      {
        id: 'INV-C', number: 'EZ/25-26/0009', type: 'membership', title: 'Membership — Elite 10 IND (10 years)', issueDate: startISO, dueDate: startISO, billedTo: 'Ravi Teja',
        lines: [{ description: 'Elite 10 IND membership, 10-year prepaid (draft price)', qty: 1, rate: 1000000, taxRate: 0.18 }],
      },
      {
        id: 'INV-D', number: 'EZ/26-27/0061', type: 'service', title: 'Airport assistance', issueDate: day(-62), dueDate: day(-55), billedTo: 'Ravi Teja',
        lines: [{ description: 'Airport arrival assistance', qty: 1, rate: 3000, taxRate: 0.18, serviceDate: day(-63) }],
      },
    ],
    payments: [
      { id: 'PAY-01', invoiceId: 'INV-C', amount: 1180000, method: 'Netbanking (simulated)', status: 'success', at: at(startOffset, 12), reference: 'SIM-PAY-8812' },
      { id: 'PAY-02', invoiceId: 'INV-D', amount: 3540, method: 'Card (simulated)', status: 'failed', at: at(-60, 18), reference: 'SIM-PAY-9021', failureReason: 'Bank declined (simulated)' },
      { id: 'PAY-03', invoiceId: 'INV-D', amount: 3540, method: 'UPI (simulated)', status: 'success', at: at(-60, 18, 6), reference: 'SIM-PAY-9022' },
    ],
    refunds: [
      { id: 'RF-01', invoiceId: 'INV-D', kind: 'invoice', amount: 590, reason: 'Waiting charge applied although the flight landed on time.', status: 'under_review', createdAt: at(-50), timeline: [ev(-50, 'Ravi Teja', 'Refund requested', undefined), ev(-48, 'Finance team', 'Under review', undefined, 'Checking airport logs')] },
    ],
    financeCases: [
      {
        id: 'FIN-2001', kind: 'emergency_funding', title: 'Emergency funding readiness profile', status: 'documents_pending', beneficiaryId: 'BEN-SELF', partner: 'Lending partner (simulated)', caseManager: 'Finance desk',
        createdAt: at(-60), summary: { 'Purpose': 'Readiness for a medical emergency in the family', 'Indicative need (self-declared)': '₹5,00,000 – ₹8,00,000', 'Employment': 'Salaried' },
        checklist: [
          { id: 'CK-1', label: 'PAN card', required: true },
          { id: 'CK-2', label: 'Passport / Aadhaar (ID proof)', required: true, documentId: 'DOC-01' },
          { id: 'CK-3', label: 'Bank statements — last 6 months', required: true },
          { id: 'CK-4', label: 'Latest salary slips / income proof', required: true },
        ],
        infoRequests: [], consents: ['Share KYC with the lending partner (given)'],
        timeline: [ev(-60, 'Ravi Teja', 'Readiness profile started'), ev(-59, 'Finance desk', 'Checklist issued — 3 documents pending')],
        messages: [],
      },
      {
        id: 'FIN-2002', kind: 'financial_assurance', title: 'Estate documentation — Late Sri Ramaiah Teja', status: 'info_requested', beneficiaryId: 'BEN-SELF', partner: 'Asset-tracing partner (simulated)', caseManager: 'Meenakshi Iyer (case manager)',
        createdAt: at(-36), summary: { 'Relationship to deceased': 'Grandson (legal heir)', 'Claimant authority': 'Pending: legal heir certificate', 'Assets to trace': 'Bank deposits, one LIC policy' },
        checklist: [
          { id: 'CK-5', label: 'Death certificate', required: true, documentId: 'DOC-07' },
          { id: 'CK-6', label: 'Legal heir / succession certificate', required: true },
          { id: 'CK-7', label: 'Claimant ID proof', required: true, documentId: 'DOC-01' },
          { id: 'CK-8', label: 'Known policy / account details', required: false },
        ],
        infoRequests: [{ id: 'IR-1', at: at(-3), text: 'Please upload the legal heir certificate so the partner can verify claimant authority.', status: 'open' }],
        charges: [
          { label: 'Succession petition drafting', amount: 7500, coveredByCredit: true },
          { label: 'Certified copies & affidavits', amount: 2000, coveredByCredit: true },
          { label: 'Court fee stamps (at actuals)', amount: 3000, coveredByCredit: true },
        ],
        consents: ['Share case documents with asset-tracing partner (given)'],
        timeline: [ev(-36, 'Ravi Teja', 'Case opened'), ev(-35, 'Meenakshi Iyer', 'Eligibility verified — death event & relationship'), ev(-30, 'Finance', '₹12,500 documentation credit applied to approved charges'), ev(-3, 'Partner', 'Information requested', undefined, 'Legal heir certificate')],
        messages: [{ id: 'M-4', at: at(-3), from: 'partner', author: 'Asset-tracing partner (simulated)', text: 'We have located one fixed deposit. Verification of claimant authority is required before we can proceed.' }],
      },
    ],
    supportCases: [
      {
        id: 'CMP-3001', type: 'complaint', subject: 'Executive arrived 45 minutes late', category: 'Punctuality', urgency: 'medium', relatedRequestId: 'REQ-24014', status: 'resolved',
        description: 'Executive arrived 45 minutes late for the bank KYC visit; my father waited at the branch.', slaDue: at(-41), createdAt: at(-45, 16),
        timeline: [ev(-45, 'Ravi Teja', 'Complaint raised', undefined, undefined, 16), ev(-44, 'Farah Siddiqui', 'In review'), ev(-43, 'Farah Siddiqui', 'Resolved', undefined, '1 executive hour reversed as goodwill')],
        messages: [{ id: 'M-5', at: at(-43), from: 'support', author: 'Farah Siddiqui', text: 'My apologies. Traffic routing was missed; we have reversed one hour to your balance.' }],
      },
      {
        id: 'BIL-3004', type: 'billing', subject: 'Clarify government fee line on statement', category: 'Invoice query', urgency: 'low', relatedInvoiceId: 'INV-A', status: 'in_review',
        description: 'Please share the receipt for the ₹1,280 government fee.', slaDue: at(2), createdAt: at(-4),
        timeline: [ev(-4, 'Ravi Teja', 'Billing query raised'), ev(-3, 'Finance desk', 'In review')], messages: [],
      },
    ],
    feedback: [],
    notifications: [
      { id: 'N-01', type: 'approval', title: 'Approval needed: property tax arrears', body: '₹7,120 in arrears and additional visits for REQ-24018.', at: at(-1, 16), read: false, link: '/requests/REQ-24018' },
      { id: 'N-02', type: 'approval', title: 'Approval needed: specialist claim filing', body: '₹4,130 for REQ-24025.', at: at(-2, 15), read: false, link: '/requests/REQ-24025' },
      { id: 'N-03', type: 'payment_due', title: 'Invoice overdue', body: 'EZ/26-27/0137 for ₹8,850 was due 2 days ago.', at: at(-1, 9), read: false, link: '/payments/invoices/INV-B' },
      { id: 'N-04', type: 'reminder', title: 'Upcoming: Succession consultation', body: 'With Sameer Joshi (sample expert), tomorrow at 10:00 AM.', at: at(0, 8), read: false, link: '/appointments/APT-1001' },
      { id: 'N-05', type: 'request', title: 'Anita is preparing for your mother’s visit', body: 'Live tracking opens 90 minutes before the visit.', at: at(-1, 18), read: true, link: '/requests/REQ-24031/visit' },
      { id: 'N-06', type: 'document', title: 'Document accessed', body: 'Anita Sharma viewed “Property tax receipt 2024-25.pdf”.', at: at(-2, 11), read: true, link: '/documents?doc=DOC-04' },
      { id: 'N-07', type: 'family', title: 'Invitation awaiting acceptance', body: 'Priya Teja has not yet accepted your delegate invitation.', at: at(-1, 10), read: true, link: '/family' },
      { id: 'N-08', type: 'payment', title: 'Payment received', body: '₹3,540 for EZ/26-27/0061 (simulated).', at: at(-60, 18), read: true, link: '/payments/invoices/INV-D' },
    ],
    notificationPrefs: { bookings: true, reminders: true, requests: true, payments: true, documents: true, family: true, marketing: false },
    consents: [
      { key: 'terms', label: 'Membership terms', description: 'Required to hold a membership.', required: true, granted: true, at: at(startOffset), version: 'v1.0-draft' },
      { key: 'privacy', label: 'Privacy notice', description: 'How we process your personal data (DPDP Act notice).', required: true, granted: true, at: at(startOffset), version: 'v1.0-draft' },
      { key: 'sensitive_docs', label: 'Sensitive document processing', description: 'Store and share identity, property and health documents for your cases.', required: false, granted: true, at: at(startOffset), version: 'v1.0' },
      { key: 'visit_location', label: 'Executive location during active visits', description: 'Show the executive’s indicative route only during an authorised active visit window.', required: false, granted: true, at: at(startOffset), version: 'v1.0' },
      { key: 'ai_processing', label: 'AI concierge processing', description: 'Allow the assistant to use your membership data to answer questions. Vault contents are never shared with it.', required: false, granted: true, at: at(startOffset), version: 'v1.0' },
      { key: 'lender_sharing', label: 'Share data with lending partners', description: 'Only used if you start an emergency funding application.', required: false, granted: false, at: at(startOffset), version: 'v1.0' },
      { key: 'marketing', label: 'Offers and newsletters', description: 'Occasional updates about new services.', required: false, granted: false, at: at(startOffset), version: 'v1.0' },
    ],
    security: {
      mfaMethod: 'sms', stepUpForSensitive: true, recoveryEmail: 'r.teja.recovery@example.com', recoveryPhone: '+91 98480 12345', backupCodesGeneratedAt: at(-200),
      alerts: { newDevice: true, failedLogin: true, delegateChanges: true, documentAccess: true },
      sessions: [
        { id: 'SS-1', device: 'This browser', location: 'Hyderabad, IN', lastActive: at(0, now.getHours()), current: true },
        { id: 'SS-2', device: 'EZIT app · iPhone 15', location: 'Hyderabad, IN', lastActive: at(-1, 21) },
        { id: 'SS-3', device: 'Safari · MacBook Air', location: 'Bengaluru, IN', lastActive: at(-12, 19) },
      ],
      devices: [
        { id: 'TD-1', name: 'iPhone 15 (EZIT app)', addedAt: at(-250), lastUsed: at(-1, 21) },
        { id: 'TD-2', name: 'Windows laptop · Chrome', addedAt: at(-120), lastUsed: at(0, 9) },
      ],
    },
    conciergeMessages: [
      { id: 'CM-1', at: at(-3, 10), from: 'executive', author: 'Anita Sharma', text: 'Good morning, Mr. Teja. I’ve booked your mother’s cardiology follow-up and will accompany her.' },
      { id: 'CM-2', at: at(-3, 11), from: 'member', author: 'Ravi Teja', text: 'Thank you, Anita. Please make sure she carries the old reports.' },
      { id: 'CM-3', at: at(-1, 17), from: 'executive', author: 'Anita Sharma', text: 'Noted. Also, the property tax approval is waiting for you whenever convenient.' },
    ],
    aiMessages: [],
    applications: [],
    session: { loggedIn: false, actorId: 'member' },
    counters: { request: 24040, appointment: 1010, notification: 100, document: 20, invoice: 150, payment: 10, support: 3010, approval: 10, delegate: 10, beneficiary: 10, finance: 2010, event: 1, ledger: 100, refund: 5, share: 10, msg: 10, app: 1 },
  }
}
