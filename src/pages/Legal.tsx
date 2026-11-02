import { useParams } from 'react-router-dom'
import { PublicHeader } from '../components/Layout'
import { Notice } from '../components/ui'
import NotFound from './NotFound'

const DOCS: Record<string, { title: string; sections: [string, string][] }> = {
  terms: {
    title: 'Membership terms',
    sections: [
      ['Status of this document', 'Draft placeholder for the prototype. Final terms will be issued after legal review and are not represented here.'],
      ['Entitlements', 'Executive hours, consultations and documentation credit are granted per benefit year under the plan configuration in force. Unused hours do not carry forward unless the plan says so.'],
      ['Third-party charges', 'Government fees, stamp duty, partner fees and similar costs are charged at actuals and are not part of the membership.'],
      ['Partner services', 'Emergency funding and asset tracing are provided by independent partners who make their own decisions. EZIT does not guarantee approval, amounts or timelines.'],
      ['Cancellation', 'Cancellation requests are reviewed manually. Any refund estimate shown in the portal is illustrative until validated against your contract.'],
    ],
  },
  privacy: {
    title: 'Privacy notice',
    sections: [
      ['Status of this document', 'Draft placeholder. Obligations under the Digital Personal Data Protection Act and, where applicable, GDPR must be mapped by legal counsel.'],
      ['What we collect', 'Contact details, addresses, family and delegate details, documents you choose to upload, and service records.'],
      ['Separate consents', 'Marketing, WhatsApp, sensitive documents, lender sharing and AI processing each have their own consent, which you can change in Profile & Security.'],
      ['Location', 'An executive’s indicative route is visible only during an authorised active visit window.'],
      ['This prototype', 'All data is fictional and stored only in your browser’s local storage.'],
    ],
  },
}

export default function Legal() {
  const { doc } = useParams()
  const d = DOCS[doc ?? '']
  if (!d) return <NotFound />
  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
        <h1 className="serif mb-6 text-4xl">{d.title}</h1>
        <Notice tone="warn" className="mb-8" title="Draft — not legal advice">Prototype content for review purposes only.</Notice>
        {d.sections.map(([h, b]) => (
          <section key={h} className="mb-6">
            <h2 className="mb-1 text-lg">{h}</h2>
            <p className="text-mute">{b}</p>
          </section>
        ))}
      </main>
    </div>
  )
}
