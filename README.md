# EZIT ELITE — Member Portal (reference prototype)

A clickable, stateful reference implementation of the member-facing experience described in the
*EZIT ELITE Membership & Concierge Portal PRD v1.0*. All data is fictional and every external
integration (payments, OTP, maps, messaging, partners, AI) is **simulated**.

## Run

```bash
npm install
npm run dev        # http://localhost:5180
npm run build      # type-check + production build
```

Sign in with **Demo member — Ravi Teja** on `/login` (or email `ravi.teja@example.com`, then the
development OTP `246810`). **Demo delegate — Arjun Rao** previews limited delegate access.
Use the account menu → *View portal as* to switch roles, and *Reset demo data* to start over.

## Themes

Dark and light themes share one token set (`src/index.css`; light overrides under
`:root[data-theme='light']`). Toggle in the header (sun/moon) or Profile → Communication →
Appearance (Match device / Light / Dark). Switching uses a circular View Transition reveal from the
click point, a colour cross-fade where View Transitions aren't supported, and no animation under
`prefers-reduced-motion`. Preference is stored per device (`ezit-theme`) and applied before first
paint to avoid a flash. Logic: `src/lib/theme.ts`.

## Stack

React 18 + TypeScript + Vite 6, Tailwind CSS 4, React Router 6, Lucide icons. Fonts: Inter and
Playfair Display (both SIL OFL, Google Fonts). No backend — state lives in `localStorage`
(`ezit-elite-portal`, versioned schema).

## Where things live

| Path | Purpose |
|---|---|
| `src/data/config.ts` | **All configurable/draft policy**: plans, prices, hour allotments, doc credit, catalogue, experts, executives, booking/cancellation rules, FX, coupons, refund policy |
| `src/data/seed.ts` | Demo account and records (dates generated relative to first load) |
| `src/data/types.ts` | Domain model |
| `src/data/selectors.ts` | Derived balances (from the append-only ledger), invoice totals, slot availability, permission checks |
| `src/data/store.tsx` | The only module that mutates data — swap for an API client later |
| `src/data/integrations.ts` | Simulated payment gateway, OTP, maps, messaging adapters |
| `src/data/ai.ts` | Rule-based AI concierge using live member data |
| `src/pages/*` | Screens |

## PRD → screen map (member-facing)

| PRD | Route(s) |
|---|---|
| S01 Landing & plan explorer | `/` |
| S02 Sign-up & verification, S03 Eligibility & corporate invite | `/apply` (corporate demo code `ACME-7F3K`) |
| S05 Checkout | `/checkout?app=…` (coupons `FOUNDER5`, `WELCOME10K`) |
| S06 Login, MFA, security | `/login`, `/profile?tab=security`, step-up dialog on sensitive actions |
| S07 Dashboard | `/home` |
| S08 Concierge team | `/team`, `/messages` |
| S09 Catalogue | `/services`, `/services/:id` |
| S10 Request wizard | `/request/new` |
| S11 Availability & booking | wizard step 4, `/appointments`, `/appointments/:id` (reschedule/cancel) |
| S12 Requests & timeline, approvals | `/requests`, `/requests/:id` |
| S13 Live visit | `/requests/:id/visit` |
| S04 Family & delegation | `/family` |
| S15 Consultations | `/consultations` |
| S16 Emergency funding, S17 Financial assurance | `/financial`, `/financial/:id` |
| S18 Vault | `/documents` |
| S19 AI concierge | `/assistant` |
| S20 Wallet & utilisation, S21 Invoices & payments | `/payments`, `/payments/invoices/:id` |
| S22 Support & complaints | `/support`, `/support/:id` |
| S23 Cancellation estimator | `/membership/cancel` |
| Notifications | bell menu, `/notifications` |

Internal screens (S14 PE app, S24–S27 ops/admin/reporting) are intentionally out of scope.

## Unresolved policies (configurable, not final)

Executive-hour allotment, documentation credit, anniversary/reset, plan prices, late-cancel and
reschedule rules, postpaid credit limit/approval threshold, consultation fees after credits, and the
cancellation/refund example values are all in `config.ts` and labelled *draft* or *illustrative* in
the UI. Set `CANCELLATION_POLICY.configured = false` to show the estimate as unavailable.

Note: the suggested validity date (8 Nov 2036) conflicts with a 10-year plan that is already active
today, so the demo membership starts ~8.5 months before first load and validity is derived from it.

## Journeys verified in the browser

A (apply → checkout → confirmation), C (wizard → scheduled request, hours held), D (consultation
with included credit; cancel releases hold), E (approval → status, count, notification), F (accept
invitation, revoke with step-up), G (upload, share, revoke, access log), H (payment failure → retry
→ success, unpaid balance updated), I (visit on the way → arrived → start/end OTP → completed,
hours settled), J (estimate → request under review, membership stays active), K (complaint → ID →
timeline → message), L (state survives reload), M (delegate denied unauthorised request, document
and payments), N (all routes render at 375 px with no horizontal overflow). No automated test
suite is included.

Not production-grade: no real authentication, authorisation, encryption, malware scanning,
payment processing or compliance.
