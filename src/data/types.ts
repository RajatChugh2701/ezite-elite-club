// Domain types for the EZIT ELITE member portal prototype.
// The mock store (store.tsx) is the only module that mutates these records,
// so a real API client can later replace it without touching page components.

export type ID = string
export type ISODate = string // YYYY-MM-DD
export type ISODateTime = string

export type MemberCategory = 'NRI' | 'IND' | 'CORP'
export type CityId = 'hyderabad' | 'mumbai' | 'bengaluru' | 'delhi-ncr'
export type EntitlementKey = 'hours' | 'consult' | 'doc'

export interface Address {
  line1: string
  line2?: string
  city: string
  state?: string
  postcode: string
  country: string
}

export interface Member {
  id: ID
  name: string
  firstName: string
  email: string
  mobile: string
  whatsappOptIn: boolean
  category: MemberCategory
  countryOfResidence: string
  residentialAddress: Address
  serviceAddress: Address
  billingAddress: Address
  homeCity: CityId
  timezone: string
  language: string
  contactWindow: string
  contactChannels: { email: boolean; sms: boolean; whatsapp: boolean; phone: boolean }
  photo?: string
}

export interface MembershipPlan {
  code: string
  name: string
  category: MemberCategory
  audience: string
  termYears: number | null // null = contract-defined
  priceINR: number | null // null = per corporate contract
  execHoursPerYear: number
  consultationsPerYear: number
  docCreditINR: number
  highlights: string[]
  exclusions: string[]
  pricingStatus: 'draft' | 'approved'
}

export type MembershipStatus = 'active' | 'pending' | 'expired' | 'cancellation_requested' | 'suspended'

export interface Membership {
  id: ID
  memberNo: string
  planCode: string
  status: MembershipStatus
  startDate: ISODate
  validUntil: ISODate
  benefitYearStart: ISODate
  benefitYearEnd: ISODate
  amountPaidINR: number // excl. tax
  taxPaidINR: number
  peId: ID
  backupPeId: ID
  supervisorId: ID
}

export type LedgerKind = 'grant' | 'hold' | 'release' | 'consume' | 'reversal' | 'adjustment' | 'expiry'

export interface LedgerEntry {
  id: ID
  ent: EntitlementKey
  kind: LedgerKind
  amount: number // signed: grant/release/reversal positive; hold/consume negative
  at: ISODateTime
  description: string
  refType?: 'request' | 'appointment' | 'financeCase'
  refId?: ID
  actor: string
}

export interface Beneficiary {
  id: ID
  name: string
  relationship: string
  isSelf?: boolean
  dob?: ISODate
  city: CityId
  indiaAddress: Address
  phone: string
  emergencyContact: { name: string; phone: string }
  consent: 'given' | 'pending'
  notes?: string
}

export type InviteStatus = 'draft' | 'sent' | 'accepted' | 'expired' | 'revoked'

export interface DelegatedPermissions {
  serviceCategories: string[]
  documentIds: ID[]
  approvals: boolean
  visits: boolean
  otp: boolean
  beneficiaryIds: ID[] // whose requests they may raise / see
}

export interface Delegate {
  id: ID
  name: string
  email: string
  phone: string
  relationship: string
  status: InviteStatus
  createdAt: ISODateTime
  sentAt?: ISODateTime
  acceptedAt?: ISODateTime
  revokedAt?: ISODateTime
  expiresAt: ISODate
  termsAccepted: boolean
  permissions: DelegatedPermissions
}

export interface Executive {
  id: ID
  name: string
  kind: 'pe' | 'backup' | 'supervisor' | 'pool'
  role: string
  city: CityId
  experienceYears: number
  languages: string[]
  workingHours: string
  workDays: number[] // 0 = Sunday
  shift: [number, number] // hours, 24h
  maxVisitsPerDay: number
  skills: string[]
  bgCheck?: { status: 'verified' | 'pending'; date: ISODate; process: string }
  photo?: string
  contactAlias: string // masked contact handle
}

export interface ServiceCategory {
  id: string
  name: string
  description: string
}

export type FundingRule = 'bundle_hours' | 'consult_credit' | 'doc_credit' | 'chargeable'
export type DeliveryMode = 'in_person' | 'remote'

export interface Service {
  id: string
  categoryId: string
  name: string
  summary: string
  description: string
  whoCanReceive: string
  cities: CityId[]
  delivery: DeliveryMode[]
  duration: string
  slaHours?: number
  responseTime: string
  funding: FundingRule
  expectedHours: number
  rateINR: number // per hour when chargeable or for out-of-bundle hours
  rateUnit: 'hour' | 'flat'
  taxRate: number
  discountPct?: number
  negotiatedNote?: string
  additionalCharges: string[]
  requiredInfo: string[]
  requiredDocs: string[]
  exclusions: string[]
  cancellationPolicy: string
}

export interface Expert {
  id: ID
  name: string
  title: string
  specialty: string
  categoryId: string // consultation type id
  modes: ('online' | 'in_person')[]
  cities: CityId[]
  languages: string[]
  experienceYears: number
  slotTimes: string[]
  workDays: number[]
}

export interface ConsultationType {
  id: string
  name: string
  description: string
  creditEligible: boolean
  feeINR: number
  durationMin: number
  requiredDocs: string[]
}

export type RequestStatus =
  | 'draft'
  | 'submitted'
  | 'awaiting_approval'
  | 'scheduled'
  | 'in_progress'
  | 'on_hold'
  | 'under_review'
  | 'completed'
  | 'cancelled'

export type RequestKind = 'service' | 'consultation' | 'exec_change' | 'cancellation'
export type FundingSource = 'bundle' | 'prepaid' | 'postpaid' | 'consult_credit' | 'doc_credit'

export interface QuoteLine {
  label: string
  amount: number
}

export interface Quote {
  bundleHours: number
  chargeableHours: number
  base: number
  discount: number
  tax: number
  extras: number
  total: number
  lines: QuoteLine[]
}

export interface TimelineEvent {
  id: ID
  at: ISODateTime
  actor: string
  label: string
  detail?: string
  status?: RequestStatus
}

export interface Message {
  id: ID
  at: ISODateTime
  from: 'member' | 'delegate' | 'executive' | 'system' | 'support' | 'partner'
  author: string
  text: string
}

export interface ServiceRequest {
  id: ID
  kind: RequestKind
  serviceId?: string
  title: string
  beneficiaryId: ID
  ownerId: ID // 'member' or delegate id
  ownerName: string
  assignedTo: string
  status: RequestStatus
  priority: 'standard' | 'priority' | 'urgent'
  mode: DeliveryMode
  city: CityId
  address: string
  locationNotes?: string
  preferredDate?: ISODate
  window?: string
  altWindow?: string
  instructions: string
  contactName: string
  contactPhone: string
  expectedHours: number
  funding: FundingSource
  quote?: Quote
  documentIds: ID[]
  appointmentId?: ID
  approvalIds: ID[]
  createdAt: ISODateTime
  slaDue?: ISODateTime
  timeline: TimelineEvent[]
  messages: Message[]
  completion?: { summary: string; hours: number; evidence: string[]; at: ISODateTime }
  meta?: Record<string, string>
}

export type AppointmentStatus = 'held' | 'pending_approval' | 'confirmed' | 'completed' | 'cancelled'
export type VisitStage = 'scheduled' | 'on_the_way' | 'arrived' | 'in_progress' | 'completed'

export interface Visit {
  stage: VisitStage
  etaMin?: number
  delayMin?: number
  startOtpVerified: boolean
  endOtpVerified: boolean
  trackingOverride?: boolean
  events: { id: ID; stage: VisitStage | 'delay' | 'escalation' | 'note'; at: ISODateTime; note: string }[]
}

export interface Appointment {
  id: ID
  kind: 'service' | 'consultation'
  title: string
  requestId?: ID
  serviceId?: string
  expertId?: ID
  consultTypeId?: string
  peId?: ID
  beneficiaryId: ID
  date: ISODate
  start: string // HH:MM
  end: string
  city: CityId | 'online'
  mode: 'in_person' | 'online'
  address?: string
  status: AppointmentStatus
  entitlement?: { ent: EntitlementKey; amount: number }
  chargeINR?: number
  invoiceId?: ID
  meetingLink?: string
  notes?: string
  postNotes?: string
  source: 'assigned_pe' | 'city_pool' | 'expert'
  visit?: Visit
  createdAt: ISODateTime
  history: { at: ISODateTime; label: string }[]
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'clarification_requested'

export interface Approval {
  id: ID
  requestId: ID
  title: string
  reason: string
  requestedBy: string
  amountINR: number
  breakdown: QuoteLine[]
  extraHours?: number
  documentIds: ID[]
  status: ApprovalStatus
  createdAt: ISODateTime
  decidedAt?: ISODateTime
  decidedBy?: string
  note?: string
}

export type DocCategory = 'identity' | 'family' | 'property' | 'financial' | 'consultation' | 'case'

export interface AccessEvent {
  id: ID
  at: ISODateTime
  actor: string
  action: 'uploaded' | 'viewed' | 'downloaded' | 'shared' | 'revoked' | 'renamed' | 'share_expired' | 'accessed_by_recipient'
  detail?: string
}

export interface DocumentShare {
  id: ID
  recipientId: ID
  recipientName: string
  recipientRole: string
  purpose: string
  requestId?: ID
  permission: 'view' | 'view_download'
  createdAt: ISODateTime
  expiresAt: ISODateTime
  revokedAt?: ISODateTime
}

export interface VaultDocument {
  id: ID
  name: string
  fileType: string
  sizeKB: number
  category: DocCategory
  uploadedAt: ISODateTime
  uploadedBy: string
  beneficiaryId?: ID
  relatedRequestId?: ID
  relatedCaseId?: ID
  dataUrl?: string // only small files are kept in browser storage
  scan: 'clean' | 'scanning'
  locked?: boolean // system documents cannot be renamed / deleted
  shares: DocumentShare[]
  accessLog: AccessEvent[]
}

export interface InvoiceLine {
  description: string
  qty: number
  rate: number
  taxRate: number // 0 for pass-through charges
  serviceDate?: ISODate
}

export type InvoiceType = 'membership' | 'service' | 'postpaid' | 'consultation'

export interface Invoice {
  id: ID
  number: string
  type: InvoiceType
  title: string
  issueDate: ISODate
  dueDate: ISODate
  period?: string
  lines: InvoiceLine[]
  requestId?: ID
  billedTo: string
  creditApplied?: number
  disputed?: boolean
}

export type PaymentStatus = 'success' | 'failed' | 'pending'

export interface Payment {
  id: ID
  invoiceId: ID
  amount: number
  method: string
  status: PaymentStatus
  at: ISODateTime
  reference: string
  failureReason?: string
}

export interface RefundRequest {
  id: ID
  invoiceId?: ID
  kind: 'invoice' | 'membership'
  amount: number
  reason: string
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid'
  createdAt: ISODateTime
  timeline: TimelineEvent[]
}

export type FinanceCaseKind = 'emergency_funding' | 'financial_assurance'
export type FinanceCaseStatus =
  | 'readiness'
  | 'documents_pending'
  | 'submitted'
  | 'partner_review'
  | 'info_requested'
  | 'partner_decision'
  | 'in_progress'
  | 'closed'

export interface ChecklistItem {
  id: ID
  label: string
  required: boolean
  documentId?: ID
}

export interface FinanceCase {
  id: ID
  kind: FinanceCaseKind
  title: string
  status: FinanceCaseStatus
  beneficiaryId: ID
  partner: string
  caseManager: string
  createdAt: ISODateTime
  summary: Record<string, string>
  checklist: ChecklistItem[]
  infoRequests: { id: ID; at: ISODateTime; text: string; status: 'open' | 'answered'; response?: string }[]
  charges?: { label: string; amount: number; coveredByCredit: boolean }[]
  timeline: TimelineEvent[]
  messages: Message[]
  consents: string[]
}

export type SupportType = 'complaint' | 'billing' | 'escalation' | 'exec_change' | 'general'

export interface SupportCase {
  id: ID
  type: SupportType
  subject: string
  category: string
  urgency: 'low' | 'medium' | 'high'
  description: string
  relatedRequestId?: ID
  relatedInvoiceId?: ID
  attachmentName?: string
  status: 'open' | 'in_review' | 'escalated' | 'resolved' | 'closed'
  slaDue: ISODateTime
  createdAt: ISODateTime
  timeline: TimelineEvent[]
  messages: Message[]
}

export interface Feedback {
  id: ID
  at: ISODateTime
  csat: number
  nps: number
  comment: string
  wishlist: string
  requestId?: ID
}

export type NotificationType =
  | 'booking'
  | 'reminder'
  | 'request'
  | 'approval'
  | 'payment_due'
  | 'payment'
  | 'document'
  | 'family'
  | 'message'
  | 'service'
  | 'security'

export interface AppNotification {
  id: ID
  type: NotificationType
  title: string
  body: string
  at: ISODateTime
  read: boolean
  link: string
}

export interface ConsentRecord {
  key: string
  label: string
  description: string
  required: boolean
  granted: boolean
  at: ISODateTime
  version: string
}

export interface SecuritySession {
  id: ID
  device: string
  location: string
  lastActive: ISODateTime
  current?: boolean
}

export interface TrustedDevice {
  id: ID
  name: string
  addedAt: ISODateTime
  lastUsed: ISODateTime
}

export interface SecuritySettings {
  mfaMethod: 'sms' | 'email' | 'authenticator'
  stepUpForSensitive: boolean
  recoveryEmail: string
  recoveryPhone: string
  backupCodesGeneratedAt?: ISODateTime
  alerts: { newDevice: boolean; failedLogin: boolean; delegateChanges: boolean; documentAccess: boolean }
  sessions: SecuritySession[]
  devices: TrustedDevice[]
}

export interface NotificationPrefs {
  bookings: boolean
  reminders: boolean
  requests: boolean
  payments: boolean
  documents: boolean
  family: boolean
  marketing: boolean
}

export interface AiMessage {
  id: ID
  at: ISODateTime
  role: 'user' | 'assistant' | 'system'
  text: string
  actions?: { label: string; to: string }[]
}

export interface Application {
  id: ID
  createdAt: ISODateTime
  category: MemberCategory
  planCode: string
  name: string
  email: string
  status: 'pending_payment' | 'payment_pending' | 'active' | 'sponsor_approval_pending' | 'payment_failed'
  memberNo?: string
  audit: TimelineEvent[]
  checkout?: { currency: string; totalINR: number; totalFx?: number; coupon?: string; invoiceNo?: string }
  sponsor?: { org: string; employeeId: string; allocation: string }
  data: Record<string, unknown>
}

export interface SessionState {
  loggedIn: boolean
  actorId: 'member' | ID
  startedAt?: ISODateTime
  lastStepUpAt?: ISODateTime
  expiredNotice?: boolean
}

export interface AppState {
  version: number
  member: Member
  membership: Membership
  ledger: LedgerEntry[]
  beneficiaries: Beneficiary[]
  delegates: Delegate[]
  requests: ServiceRequest[]
  appointments: Appointment[]
  approvals: Approval[]
  documents: VaultDocument[]
  invoices: Invoice[]
  payments: Payment[]
  refunds: RefundRequest[]
  financeCases: FinanceCase[]
  supportCases: SupportCase[]
  feedback: Feedback[]
  notifications: AppNotification[]
  notificationPrefs: NotificationPrefs
  consents: ConsentRecord[]
  security: SecuritySettings
  conciergeMessages: Message[]
  aiMessages: AiMessage[]
  applications: Application[]
  session: SessionState
  counters: Record<string, number>
}

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string }
