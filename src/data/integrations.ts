// Simulated external integrations (PRD §7). Each adapter has the shape a real client would
// have, so Razorpay / SMS / Maps / partner APIs can replace them without UI changes.
// NOTHING here contacts a real service.

import { DEV_OTP } from './config'

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

export type SimOutcome = 'success' | 'failure' | 'pending'

export const paymentGateway = {
  label: 'Simulated payment gateway (no real money moves)',
  methods: ['UPI', 'Card', 'Netbanking', 'International card'] as const,
  async charge(amount: number, method: string, outcome: SimOutcome) {
    await wait(1400)
    const reference = 'SIM-PAY-' + Math.floor(100000 + Math.random() * 899999)
    if (outcome === 'failure') return { status: 'failed' as const, reference, failureReason: method === 'UPI' ? 'UPI request timed out (simulated)' : 'Issuer declined the transaction (simulated)' }
    if (outcome === 'pending') return { status: 'pending' as const, reference }
    return { status: 'success' as const, reference }
  },
  // Stands in for a webhook-verified status poll.
  async poll(_reference: string, outcome: 'success' | 'failure') {
    await wait(1000)
    return outcome === 'success' ? ('success' as const) : ('failed' as const)
  },
}

export const otpService = {
  label: 'Development OTP — no SMS or email is sent',
  async send(_destination: string) {
    await wait(600)
    return { devCode: DEV_OTP, expiresInSec: 300 }
  },
  verify: (code: string) => code.trim() === DEV_OTP,
}

export const mapsService = {
  label: 'Simulated route — not live location',
  // Returns an illustrative route for the SVG map.
  route(stage: string) {
    const progress = stage === 'scheduled' ? 0 : stage === 'on_the_way' ? 0.55 : 1
    return { progress, distanceKm: 6.4, baseEtaMin: 24 }
  },
}

export const partnerService = {
  label: 'Simulated partner integration',
}

const PE_REPLIES = [
  'Thank you — noted. I’ll update you here shortly.',
  'Received. I’m on it and will confirm the details within the hour.',
  'Understood. I’ve added this to the case notes.',
]
export const messagingService = {
  label: 'Simulated messaging — replies are automated for the prototype',
  autoReply: () => PE_REPLIES[Math.floor(Math.random() * PE_REPLIES.length)],
}
