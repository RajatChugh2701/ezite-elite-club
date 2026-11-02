import { useState } from 'react'
import { Phone } from 'lucide-react'
import { useApp } from '../data/store'
import { canAccessArea } from '../data/selectors'
import { execById } from '../data/config'
import { messagingService } from '../data/integrations'
import { AccessDenied, Avatar, Button, PageHeader, SimLabel, useUI } from '../components/ui'
import { ContactModal } from '../components/ContactModal'
import { Conversation } from './RequestDetail'

export default function Messages() {
  const { state, actions } = useApp()
  const { toast } = useUI()
  const [contact, setContact] = useState(false)
  if (!canAccessArea(state, 'messages')) return <AccessDenied what="concierge messages" />
  const pe = execById(state.membership.peId)!
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={{ to: '/team', label: 'My concierge team' }} eyebrow="Concierge conversation"
        title={<span className="flex items-center gap-3"><Avatar name={pe.name} src={pe.photo} size={44} />{pe.name}</span>}
        subtitle={<>{pe.workingHours}. Outside these hours the 24×7 desk replies. <SimLabel>{messagingService.label}</SimLabel></>}
        actions={<Button variant="secondary" icon={<Phone className="size-4" />} onClick={() => setContact(true)}>Call</Button>} />
      <Conversation title="Messages" messages={state.conciergeMessages} placeholder={`Message ${pe.name.split(' ')[0]}`}
        onSend={t => { const r = actions.sendConciergeMessage(t); if (!r.ok) toast({ tone: 'bad', title: r.error }); return r.ok }} />
      <p className="mt-4 text-[12.5px] text-dim">For a new task, <a className="link" href="/request/new">start a request</a> so it gets its own timeline and tracking.</p>
      <ContactModal exec={pe} open={contact} onClose={() => setContact(false)} />
    </div>
  )
}
