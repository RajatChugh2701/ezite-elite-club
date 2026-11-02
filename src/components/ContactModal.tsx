import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, MessageSquare, Phone, PhoneCall } from 'lucide-react'
import { Avatar, Button, Modal, SimLabel } from './ui'
import type { Executive } from '../data/types'
import { cityName } from '../data/config'

export function ContactModal({ exec, open, onClose }: { exec: Executive; open: boolean; onClose: () => void }) {
  const nav = useNavigate()
  const [calling, setCalling] = useState(false)
  return (
    <Modal open={open} onClose={() => { setCalling(false); onClose() }} title={`Contact ${exec.name.split(' ')[0]}`} size="sm">
      <div className="mb-5 flex items-center gap-3">
        <Avatar name={exec.name} src={exec.photo} size={52} />
        <div>
          <p className="text-ivory">{exec.name}</p>
          <p className="text-[13px] text-dim">{exec.role} · {cityName(exec.city)} · {exec.workingHours}</p>
        </div>
      </div>
      {calling ? (
        <div className="rounded-xl border border-line bg-bg2 p-5 text-center" role="status">
          <PhoneCall className="mx-auto mb-3 size-7 animate-pulse text-gold" aria-hidden />
          <p className="text-ivory">Connecting a masked call…</p>
          <p className="mt-1 text-sm text-mute">Neither number is revealed to the other party.</p>
          <p className="mt-3"><SimLabel>Simulated call — no phone call is placed</SimLabel></p>
          <Button className="mt-4" variant="secondary" size="sm" onClick={() => setCalling(false)}>End</Button>
        </div>
      ) : (
        <div className="grid gap-2">
          <Button variant="quiet" className="justify-start" icon={<MessageSquare className="size-4 text-gold" />} onClick={() => nav('/messages')}>Message in the app</Button>
          <Button variant="quiet" className="justify-start" icon={<Phone className="size-4 text-gold" />} onClick={() => setCalling(true)}>Call (masked number)</Button>
          <a href={`mailto:${exec.contactAlias}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-raised px-4 text-sm hover:bg-line">
            <Mail className="size-4 text-gold" aria-hidden />Email {exec.contactAlias}
          </a>
          <p className="mt-2 text-[12.5px] text-dim">Outside working hours, messages go to the 24×7 central concierge desk. Personal phone numbers of staff are never shared.</p>
        </div>
      )}
    </Modal>
  )
}
