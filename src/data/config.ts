// Versioned, configurable catalogue + policy inputs.
// PRD §2: hour allotments, documentation credit, anniversary, corporate duration and
// cancellation rules are unresolved policy decisions. Every value here is a DRAFT demo
// input that the product team can edit in one place — none of it is a final commercial policy.

import type { CityId, ConsultationType, Executive, Expert, MembershipPlan, Service, ServiceCategory } from './types'

export const CONFIG_VERSION = 'plan-config v0.3 (draft, prototype)'

export const CITIES: { id: CityId; name: string }[] = [
  { id: 'hyderabad', name: 'Hyderabad' },
  { id: 'mumbai', name: 'Mumbai' },
  { id: 'bengaluru', name: 'Bengaluru' },
  { id: 'delhi-ncr', name: 'Delhi-NCR' },
]
export const cityName = (id?: string) => CITIES.find(c => c.id === id)?.name ?? (id === 'online' ? 'Online' : id ?? '—')

export const GST_RATE = 0.18

export const POLICY = {
  // Postpaid (PRD §6) — demo values, pending finance sign-off
  postpaidCreditLimitINR: 50000,
  approvalThresholdINR: 10000,
  outOfBundleHourlyINR: 2000,
  // Booking (PRD §11 / §6)
  freeCancelHours: 24, // cancel ≥ 24h before: hold released in full
  lateCancelConsumesHours: 1, // < 24h: 1 hour consumed (demo rule)
  lateCancelConsumesConsultation: true, // < 24h: consultation credit consumed
  rescheduleFreeHours: 12,
  travelBufferMin: 60,
  slotHoldMinutes: 15,
  // Visit tracking window (PRD §13)
  trackingWindowBeforeMin: 90,
  // Step-up auth (PRD §6 S06)
  stepUpValidityMin: 5,
  sessionMaxHours: 12,
  // Vault
  maxUploadKB: 5120,
  maxStoredDataUrlKB: 400,
  allowedFileTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
  defaultShareDays: 7,
}

// Cancellation & refund engine inputs (PRD §6 refund model). The formula itself is from the PRD;
// numeric values are illustrative and flagged in the UI. Set `configured: false` to show the
// estimate as unavailable.
export const CANCELLATION_POLICY = {
  configured: true,
  label: 'Illustrative example policy — not a contractual commitment',
  annualReferenceINR: { 'ELITE10-IND': 180000, 'ELITE25-IND': 150000, 'ELITE10-NRI': 210000, 'ELITE25-NRI': 175000 } as Record<string, number>,
  prorationUnit: 'month' as const,
  nonRefundableFeeINR: 25000,
  coolingOffDays: 30,
  reviewSlaDays: 15,
}

export const EXCHANGE_RATES: { code: string; symbol: string; perINR: number; label: string }[] = [
  { code: 'INR', symbol: '₹', perINR: 1, label: 'Indian Rupee' },
  { code: 'USD', symbol: '$', perINR: 1 / 84.2, label: 'US Dollar' },
  { code: 'GBP', symbol: '£', perINR: 1 / 109.5, label: 'British Pound' },
  { code: 'AED', symbol: 'AED ', perINR: 1 / 22.9, label: 'UAE Dirham' },
  { code: 'SGD', symbol: 'S$', perINR: 1 / 63.4, label: 'Singapore Dollar' },
]
export const FX_NOTE = 'Indicative demo exchange rates, fixed for this prototype. Foreign-currency acceptance is subject to merchant approval.'

export const COUPONS: Record<string, { type: 'pct' | 'flat'; value: number; label: string }> = {
  FOUNDER5: { type: 'pct', value: 5, label: 'Founding member 5% (demo coupon)' },
  WELCOME10K: { type: 'flat', value: 10000, label: '₹10,000 welcome credit (demo coupon)' },
}

export const PLANS: MembershipPlan[] = [
  {
    code: 'ELITE10-NRI', name: 'Elite 10 NRI', category: 'NRI', termYears: 10, priceINR: 1200000,
    audience: 'Overseas members with family, representatives or assets in India',
    execHoursPerYear: 20, consultationsPerYear: 5, docCreditINR: 100000,
    highlights: ['Dedicated Personal Executive in your India home city', 'Care for parents and family in India', 'INR and international payments'],
    exclusions: ['Government fees, stamp duty and third-party charges', 'Medical treatment or clinical care', 'Guaranteed outcomes from partner institutions'],
    pricingStatus: 'draft',
  },
  {
    code: 'ELITE25-NRI', name: 'Elite 25 NRI', category: 'NRI', termYears: 25, priceINR: 2500000,
    audience: 'Long-horizon membership for overseas families',
    execHoursPerYear: 30, consultationsPerYear: 5, docCreditINR: 100000,
    highlights: ['Everything in Elite 10 NRI', 'Higher annual executive-hour allotment', 'Priority scheduling'],
    exclusions: ['Government fees, stamp duty and third-party charges', 'Medical treatment or clinical care', 'Guaranteed outcomes from partner institutions'],
    pricingStatus: 'draft',
  },
  {
    code: 'ELITE10-IND', name: 'Elite 10 IND', category: 'IND', termYears: 10, priceINR: 1000000,
    audience: 'India-based professionals (self-declared income above ₹50 lakh p.a.)',
    execHoursPerYear: 30, consultationsPerYear: 5, docCreditINR: 75000,
    highlights: ['Personal Executive for errands, paperwork and family', 'Five expert consultations each benefit year', 'Documentation credit for eligible events'],
    exclusions: ['Government fees, stamp duty and third-party charges', 'Medical treatment or clinical care', 'Guaranteed outcomes from partner institutions'],
    pricingStatus: 'draft',
  },
  {
    code: 'ELITE25-IND', name: 'Elite 25 IND', category: 'IND', termYears: 25, priceINR: 2100000,
    audience: 'India-based families planning for the long term',
    execHoursPerYear: 30, consultationsPerYear: 5, docCreditINR: 100000,
    highlights: ['Everything in Elite 10 IND', 'Higher documentation credit', 'Priority scheduling'],
    exclusions: ['Government fees, stamp duty and third-party charges', 'Medical treatment or clinical care', 'Guaranteed outcomes from partner institutions'],
    pricingStatus: 'draft',
  },
  {
    code: 'ELITE1-CORP', name: 'Elite 1 CORP IND', category: 'CORP', termYears: null, priceINR: null,
    audience: 'Employer-sponsored executives and leaders',
    execHoursPerYear: 15, consultationsPerYear: 5, docCreditINR: 50000,
    highlights: ['Sponsored by your employer', 'Personal Executive support across Phase 1 cities', 'Separately priced add-ons'],
    exclusions: ['Personal sensitive records are never shared with your sponsor', 'Add-ons outside sponsor allocation are billed to you'],
    pricingStatus: 'draft',
  },
]
export const planByCode = (code: string) => PLANS.find(p => p.code === code)

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  { id: 'personal', name: 'Personal Executive', description: 'Errands, visits and everyday matters handled in person.' },
  { id: 'elderly', name: 'Elderly Support', description: 'Accompaniment, wellness visits and care coordination for parents.' },
  { id: 'property', name: 'Property Assistance', description: 'Inspections, tax, tenancy and registration paperwork.' },
  { id: 'travel', name: 'Airport & Travel Assistance', description: 'Arrival and departure support for family members.' },
  { id: 'consult', name: 'Financial, Tax & Legal Consultations', description: 'Sessions with vetted experts.' },
  { id: 'claims', name: 'Claims & Paperwork', description: 'Insurance claims, KYC, certificates and official documents.' },
  { id: 'corporate', name: 'Corporate Visitor Concierge', description: 'Dedicated support for visiting executives.' },
]
export const categoryName = (id?: string) => SERVICE_CATEGORIES.find(c => c.id === id)?.name ?? '—'

const ALL: CityId[] = ['hyderabad', 'mumbai', 'bengaluru', 'delhi-ncr']
const STD_CANCEL = `Free cancellation up to ${24} hours before the visit. Later cancellations consume 1 executive hour (demo rule). Rescheduling is free up to 12 hours before.`

export const SERVICES: Service[] = [
  {
    id: 'pe-visit', categoryId: 'personal', name: 'Personal Executive visit',
    summary: 'Your executive handles an errand, appointment or task in person.',
    description: 'A scheduled visit by your Personal Executive for errands, bank or office visits, home coordination or anything that needs a trusted person on the ground.',
    whoCanReceive: 'You, registered beneficiaries, and delegates with permission for Personal Executive services.',
    cities: ALL, delivery: ['in_person', 'remote'], duration: '2–4 hours typical', slaHours: 48, responseTime: 'Confirmation within 4 working hours',
    funding: 'bundle_hours', expectedHours: 2, rateINR: 2000, rateUnit: 'hour', taxRate: 0.18,
    additionalCharges: ['Hours beyond your remaining allotment at ₹2,000/hour + GST', 'Travel outside city limits at actuals'],
    requiredInfo: ['Task description', 'Contact person on site'], requiredDocs: [],
    exclusions: ['Driving a member’s personal vehicle', 'Handling cash above ₹10,000'],
    cancellationPolicy: STD_CANCEL,
  },
  {
    id: 'elder-wellness', categoryId: 'elderly', name: 'Elder wellness visit',
    summary: 'A warm, unhurried check-in with your parents, with a written update for you.',
    description: 'Your executive visits, checks on day-to-day needs, coordinates household help, and sends you a written summary with photos where permitted.',
    whoCanReceive: 'Parents and elderly family registered as beneficiaries.',
    cities: ALL, delivery: ['in_person'], duration: '2–3 hours', slaHours: 72, responseTime: 'Confirmation within 4 working hours',
    funding: 'bundle_hours', expectedHours: 2, rateINR: 2000, rateUnit: 'hour', taxRate: 0.18,
    additionalCharges: ['Groceries or medicines purchased at actuals'],
    requiredInfo: ['Beneficiary’s routine and preferences', 'Emergency contact'], requiredDocs: [],
    exclusions: ['Medical or nursing care', 'Overnight stays'],
    cancellationPolicy: STD_CANCEL,
  },
  {
    id: 'doctor-accompany', categoryId: 'elderly', name: 'Doctor visit accompaniment',
    summary: 'Your executive accompanies a family member to a medical appointment.',
    description: 'Pickup coordination, accompaniment during the appointment, note-taking, pharmacy pickup and a summary to you after the visit.',
    whoCanReceive: 'Registered beneficiaries. Delegates with Elderly Support permission may request on their behalf.',
    cities: ALL, delivery: ['in_person'], duration: '3–4 hours', slaHours: 48, responseTime: 'Confirmation within 4 working hours',
    funding: 'bundle_hours', expectedHours: 3, rateINR: 2000, rateUnit: 'hour', taxRate: 0.18,
    additionalCharges: ['Cab fares at actuals', 'Consultation and pharmacy bills at actuals'],
    requiredInfo: ['Hospital / clinic and doctor', 'Appointment time'], requiredDocs: ['Prior prescriptions (optional)'],
    exclusions: ['Medical decisions on behalf of the patient', 'Clinical care'],
    cancellationPolicy: STD_CANCEL,
  },
  {
    id: 'property-inspection', categoryId: 'property', name: 'Property inspection & report',
    summary: 'A documented inspection of your home, flat or plot.',
    description: 'Visual inspection, photographs, meter readings, tenant check-in and a written report shared in your secure vault.',
    whoCanReceive: 'Members and delegates with Property permission.',
    cities: ALL, delivery: ['in_person'], duration: '2–3 hours', slaHours: 96, responseTime: 'Confirmation within 1 working day',
    funding: 'bundle_hours', expectedHours: 3, rateINR: 2000, rateUnit: 'hour', taxRate: 0.18,
    additionalCharges: ['Third-party surveyor or engineer fees, if requested'],
    requiredInfo: ['Property address and access arrangements'], requiredDocs: ['Proof of ownership or authorisation'],
    exclusions: ['Structural engineering certification'],
    cancellationPolicy: STD_CANCEL,
  },
  {
    id: 'property-tax', categoryId: 'property', name: 'Property tax & mutation paperwork',
    summary: 'Property tax filing, khata / mutation and municipal follow-ups.',
    description: 'Your executive prepares, files and follows up on municipal paperwork. Government fees are charged at actuals.',
    whoCanReceive: 'Property owners and authorised representatives.',
    cities: ALL, delivery: ['in_person', 'remote'], duration: '1–3 weeks elapsed', slaHours: 240, responseTime: 'Case manager assigned within 1 working day',
    funding: 'chargeable', expectedHours: 4, rateINR: 7500, rateUnit: 'flat', taxRate: 0.18, discountPct: 10,
    negotiatedNote: 'Member rate: 10% off the standard ₹7,500 fee.',
    additionalCharges: ['Municipal fees and penalties at actuals (no GST)', 'Courier and notary charges'],
    requiredInfo: ['Property identifier / assessment number'], requiredDocs: ['Sale deed', 'Previous tax receipt', 'Owner ID proof'],
    exclusions: ['Legal disputes over title'],
    cancellationPolicy: 'Cancellable free of charge before filing. After filing, the service fee is payable and government fees are non-refundable.',
  },
  {
    id: 'airport-assist', categoryId: 'travel', name: 'Airport arrival & departure assistance',
    summary: 'Meet-and-assist for a parent or family member at the airport.',
    description: 'Executive meets your family member, assists with baggage and wheelchair coordination, and sees them safely home or to check-in.',
    whoCanReceive: 'Registered beneficiaries.',
    cities: ALL, delivery: ['in_person'], duration: '3–5 hours', slaHours: 72, responseTime: 'Confirmation within 4 working hours',
    funding: 'chargeable', expectedHours: 3, rateINR: 3000, rateUnit: 'flat', taxRate: 0.18,
    additionalCharges: ['Airport meet-and-assist fees at actuals', 'Parking and cab fares at actuals', 'Waiting beyond 2 hours: ₹500/hour'],
    requiredInfo: ['Flight number and time', 'Passenger details'], requiredDocs: [],
    exclusions: ['Ticketing and travel planning'],
    cancellationPolicy: 'Free cancellation up to 24 hours before the flight. Later cancellations incur the full service fee.',
  },
  {
    id: 'insurance-claim', categoryId: 'claims', name: 'Insurance claim filing',
    summary: 'End-to-end help with health or life insurance claims.',
    description: 'Collation of documents, claim filing, insurer follow-ups and status updates in your case timeline.',
    whoCanReceive: 'Policyholders and their registered beneficiaries.',
    cities: ALL, delivery: ['in_person', 'remote'], duration: '2–6 weeks elapsed', slaHours: 168, responseTime: 'Case manager assigned within 1 working day',
    funding: 'bundle_hours', expectedHours: 4, rateINR: 2000, rateUnit: 'hour', taxRate: 0.18,
    additionalCharges: ['Specialist claim filing (complex cases): ₹3,500 + GST, with your approval'],
    requiredInfo: ['Policy number and insurer'], requiredDocs: ['Policy document', 'Hospital bills / discharge summary'],
    exclusions: ['Guarantee of claim approval or amount'],
    cancellationPolicy: STD_CANCEL,
  },
  {
    id: 'kyc-certificates', categoryId: 'claims', name: 'Bank KYC & certificates',
    summary: 'KYC updates, life certificates, and official document collection.',
    description: 'Bank and pension KYC, life certificate submission, and collection of certificates from government offices.',
    whoCanReceive: 'Members and beneficiaries.',
    cities: ALL, delivery: ['in_person', 'remote'], duration: '2–3 hours', slaHours: 72, responseTime: 'Confirmation within 4 working hours',
    funding: 'bundle_hours', expectedHours: 2, rateINR: 2000, rateUnit: 'hour', taxRate: 0.18,
    additionalCharges: ['Government fees at actuals'],
    requiredInfo: ['Institution and branch'], requiredDocs: ['ID proof of the account holder'],
    exclusions: ['Signing on behalf of the account holder'],
    cancellationPolicy: STD_CANCEL,
  },
  {
    id: 'legal-drafting', categoryId: 'claims', name: 'Legal drafting & notarisation',
    summary: 'Gift deeds, rental agreements and affidavits drafted and notarised.',
    description: 'A partner advocate drafts the document; your executive coordinates stamp paper, notarisation and registration appointments.',
    whoCanReceive: 'Members and authorised representatives.',
    cities: ALL, delivery: ['in_person', 'remote'], duration: '1–2 weeks elapsed', slaHours: 168, responseTime: 'Case manager assigned within 1 working day',
    funding: 'chargeable', expectedHours: 3, rateINR: 7500, rateUnit: 'flat', taxRate: 0.18,
    additionalCharges: ['Stamp duty and registration fees at actuals'],
    requiredInfo: ['Type of document and parties'], requiredDocs: ['ID proofs of all parties'],
    exclusions: ['Litigation and court representation'],
    cancellationPolicy: 'Free cancellation before drafting begins; drafting fee payable thereafter.',
  },
  {
    id: 'corporate-visitor', categoryId: 'corporate', name: 'Corporate visitor week',
    summary: 'Dedicated or fractional executive support for a visiting leader.',
    description: 'A week-long dedicated or fractional executive for a visiting executive — local coordination, meetings logistics and on-ground support. Sponsor-approved pricing applies.',
    whoCanReceive: 'Corporate members and sponsor-approved visitors.',
    cities: ALL, delivery: ['in_person'], duration: '1 week', slaHours: 120, responseTime: 'Proposal within 2 working days',
    funding: 'chargeable', expectedHours: 40, rateINR: 1800, rateUnit: 'hour', taxRate: 0.18,
    negotiatedNote: 'Corporate negotiated rate shown; final scope requires sponsor budget approval.',
    additionalCharges: ['Transport and venue costs at actuals'],
    requiredInfo: ['Visitor itinerary', 'Confidentiality requirements'], requiredDocs: [],
    exclusions: ['Personal security services'],
    cancellationPolicy: 'Per sponsor contract.',
  },
]
export const serviceById = (id?: string) => SERVICES.find(s => s.id === id)

export const CONSULTATION_TYPES: ConsultationType[] = [
  { id: 'tax', name: 'Income tax & filing', description: 'Returns, notices, capital gains and planning.', creditEligible: true, feeINR: 3000, durationMin: 60, requiredDocs: ['Previous year ITR (if available)', 'Form 16 / 26AS'] },
  { id: 'legal', name: 'Succession & family law', description: 'Wills, succession certificates and family settlements.', creditEligible: true, feeINR: 3500, durationMin: 60, requiredDocs: ['Relevant deeds or certificates'] },
  { id: 'financial', name: 'Financial planning', description: 'Goals, investments review and retirement planning for parents.', creditEligible: true, feeINR: 3000, durationMin: 60, requiredDocs: [] },
  { id: 'property-law', name: 'Property law', description: 'Title checks, sale and purchase, tenancy.', creditEligible: true, feeINR: 3500, durationMin: 60, requiredDocs: ['Sale deed or agreement'] },
  { id: 'cross-border', name: 'Cross-border tax (specialist)', description: 'NRI taxation, DTAA and repatriation. Specialist sessions are not covered by included credits.', creditEligible: false, feeINR: 6500, durationMin: 60, requiredDocs: ['Residency details', 'Foreign income summary'] },
]
export const consultTypeById = (id?: string) => CONSULTATION_TYPES.find(c => c.id === id)
export const CONSULT_EXTRA_FEE_NOTE = 'After your included credits are used, eligible consultations are charged at the listed fee + GST, shown before you confirm.'

export const EXPERTS: Expert[] = [
  { id: 'EXP-01', name: 'Neha Kapoor', title: 'Chartered Accountant', specialty: 'Personal taxation & capital gains', categoryId: 'tax', modes: ['online', 'in_person'], cities: ['hyderabad', 'bengaluru'], languages: ['English', 'Hindi'], experienceYears: 14, slotTimes: ['10:00', '11:30', '15:00', '17:00'], workDays: [1, 2, 3, 4, 5] },
  { id: 'EXP-02', name: 'Sameer Joshi', title: 'Advocate', specialty: 'Wills, succession & family settlements', categoryId: 'legal', modes: ['online', 'in_person'], cities: ['hyderabad', 'mumbai'], languages: ['English', 'Hindi', 'Marathi'], experienceYears: 18, slotTimes: ['10:00', '12:00', '16:00'], workDays: [1, 2, 3, 4, 5, 6] },
  { id: 'EXP-03', name: 'Vikram Rao', title: 'Certified Financial Planner', specialty: 'Retirement and family financial planning', categoryId: 'financial', modes: ['online'], cities: [], languages: ['English', 'Telugu', 'Kannada'], experienceYears: 11, slotTimes: ['09:30', '11:00', '14:00', '18:00'], workDays: [1, 2, 3, 4, 5] },
  { id: 'EXP-04', name: 'Rekha Nair', title: 'Advocate', specialty: 'Property title, registration and tenancy', categoryId: 'property-law', modes: ['online', 'in_person'], cities: ['bengaluru', 'delhi-ncr'], languages: ['English', 'Malayalam'], experienceYears: 16, slotTimes: ['11:00', '14:30', '16:30'], workDays: [1, 3, 5, 6] },
  { id: 'EXP-05', name: 'Arvind Mehta', title: 'Chartered Accountant (NRI desk)', specialty: 'DTAA, repatriation and NRI compliance', categoryId: 'cross-border', modes: ['online'], cities: [], languages: ['English', 'Hindi', 'Gujarati'], experienceYears: 20, slotTimes: ['08:00', '19:00', '20:30'], workDays: [1, 2, 3, 4, 5, 6] },
]
export const expertById = (id?: string) => EXPERTS.find(e => e.id === id)

export const EXECUTIVES: Executive[] = [
  {
    id: 'PE-ANITA', name: 'Anita Sharma', kind: 'pe', role: 'Personal Executive', city: 'hyderabad', experienceYears: 8,
    languages: ['English', 'Hindi', 'Telugu'], workingHours: 'Mon–Sat, 9:00 AM – 6:00 PM IST', workDays: [1, 2, 3, 4, 5, 6], shift: [9, 18], maxVisitsPerDay: 3,
    skills: ['Elderly support', 'Property paperwork', 'Banking & KYC', 'Hospital coordination'],
    bgCheck: { status: 'verified', date: '2026-01-14', process: 'Third-party identity, address & employment verification' },
    photo: '/pe-anita.jpg', contactAlias: 'anita.pe@ezit-elite.example',
  },
  {
    id: 'PE-RAHUL', name: 'Rahul Menon', kind: 'backup', role: 'Backup Personal Executive', city: 'hyderabad', experienceYears: 5,
    languages: ['English', 'Hindi', 'Malayalam'], workingHours: 'Mon–Sat, 10:00 AM – 7:00 PM IST', workDays: [1, 2, 3, 4, 5, 6], shift: [10, 19], maxVisitsPerDay: 3,
    skills: ['Airport assistance', 'Property inspections', 'Errands'],
    bgCheck: { status: 'verified', date: '2025-11-02', process: 'Third-party identity, address & employment verification' },
    contactAlias: 'rahul.pe@ezit-elite.example',
  },
  {
    id: 'SUP-FARAH', name: 'Farah Siddiqui', kind: 'supervisor', role: 'City Supervisor, Hyderabad', city: 'hyderabad', experienceYears: 12,
    languages: ['English', 'Hindi', 'Urdu'], workingHours: 'Mon–Sat, 9:00 AM – 8:00 PM IST', workDays: [1, 2, 3, 4, 5, 6], shift: [9, 20], maxVisitsPerDay: 0,
    skills: ['Escalations', 'Service quality'], contactAlias: 'hyd.supervisor@ezit-elite.example',
  },
  {
    id: 'POOL-BLR', name: 'Karthik Iyer', kind: 'pool', role: 'Personal Executive, Bengaluru city pool', city: 'bengaluru', experienceYears: 6,
    languages: ['English', 'Kannada', 'Tamil'], workingHours: 'Mon–Sat, 9:00 AM – 6:00 PM IST', workDays: [1, 2, 3, 4, 5, 6], shift: [9, 18], maxVisitsPerDay: 3,
    skills: ['Property handovers', 'Tenant coordination'],
    bgCheck: { status: 'verified', date: '2026-03-20', process: 'Third-party identity, address & employment verification' },
    contactAlias: 'blr.pool@ezit-elite.example',
  },
  {
    id: 'POOL-MUM', name: 'Sana Kulkarni', kind: 'pool', role: 'Personal Executive, Mumbai city pool', city: 'mumbai', experienceYears: 7,
    languages: ['English', 'Hindi', 'Marathi'], workingHours: 'Mon–Sat, 9:00 AM – 6:00 PM IST', workDays: [1, 2, 3, 4, 5, 6], shift: [9, 18], maxVisitsPerDay: 3,
    skills: ['Banking', 'Hospital coordination'], contactAlias: 'mum.pool@ezit-elite.example',
  },
  {
    id: 'POOL-DEL', name: 'Aman Bhatia', kind: 'pool', role: 'Personal Executive, Delhi-NCR city pool', city: 'delhi-ncr', experienceYears: 9,
    languages: ['English', 'Hindi', 'Punjabi'], workingHours: 'Mon–Sat, 9:00 AM – 6:00 PM IST', workDays: [1, 2, 3, 4, 5, 6], shift: [9, 18], maxVisitsPerDay: 3,
    skills: ['Property paperwork', 'Airport assistance'], contactAlias: 'del.pool@ezit-elite.example',
  },
]
export const execById = (id?: string) => EXECUTIVES.find(e => e.id === id)

export const DEV_OTP = '246810'

export const FAQ: { q: string; a: string }[] = [
  { q: 'What is a Personal Executive?', a: 'A dedicated, background-verified professional in your India home city who handles errands, paperwork, visits and family matters on your behalf.' },
  { q: 'How do executive hours work?', a: 'Each benefit year includes a configured allotment of executive hours. Bookings place a hold on hours; actual time is settled after the visit and unused holds are released.' },
  { q: 'What happens after my five consultations?', a: 'Further eligible consultations are charged at the listed fee plus GST. You always see the charge before you confirm.' },
  { q: 'Can my parents or siblings use the service?', a: 'Yes. Add family as beneficiaries, and invite authorised delegates with precisely scoped permissions that you can revoke at any time.' },
  { q: 'Is emergency funding guaranteed?', a: 'No. Funding eligibility, approval, pricing and disbursement are decided exclusively by the lending partner. EZIT helps you prepare and coordinates the process.' },
  { q: 'Which cities are covered?', a: 'Phase 1 covers Hyderabad, Mumbai, Bengaluru and Delhi-NCR. You can request service in any covered city, not only your home city.' },
]
