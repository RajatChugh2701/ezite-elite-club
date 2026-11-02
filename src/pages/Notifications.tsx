import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check } from 'lucide-react'
import { useApp } from '../data/store'
import type { NotificationType } from '../data/types'
import { Button, Card, EmptyState, PageHeader, Segmented, Select, Toggle } from '../components/ui'
import { cx, fmtDateTime, relTime } from '../lib/format'

const TYPES: Record<NotificationType, string> = {
  booking: 'Bookings', reminder: 'Reminders', request: 'Request updates', approval: 'Approvals', payment_due: 'Payment reminders', payment: 'Payments',
  document: 'Documents', family: 'Family & delegates', message: 'Messages', service: 'Service updates', security: 'Security',
}

export default function Notifications() {
  const { state, actions } = useApp()
  const nav = useNavigate()
  const [show, setShow] = useState<'all' | 'unread'>('all')
  const [type, setType] = useState('all')
  const list = state.notifications.filter(n => (show === 'all' || !n.read) && (type === 'all' || n.type === type))
  const unread = state.notifications.filter(n => !n.read).length
  const p = state.notificationPrefs
  const isMember = state.session.actorId === 'member'
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <PageHeader eyebrow="Notifications" title="Updates" subtitle={unread ? `${unread} unread` : 'You’re all caught up.'}
          actions={<Button variant="secondary" icon={<Check className="size-4" />} disabled={!unread} onClick={() => actions.markAllRead()}>Mark all as read</Button>} />
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Segmented label="Show" value={show} onChange={setShow} options={[{ value: 'all', label: 'All' }, { value: 'unread', label: `Unread (${unread})` }]} />
          <Select aria-label="Type" value={type} onChange={e => setType(e.target.value)} className="w-52"><option value="all">All types</option>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        </div>
        {list.length === 0 ? <EmptyState icon={<Bell className="size-7" />} title="Nothing here" body={show === 'unread' ? 'No unread notifications.' : 'No notifications of this type.'} /> : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-line">
              {list.map(n => (
                <li key={n.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                  <span className={cx('mt-2 size-2 shrink-0 rounded-full', n.read ? 'bg-line2' : 'bg-gold')} aria-hidden />
                  <button className="min-w-0 flex-1 text-left" onClick={() => { actions.markRead(n.id); nav(n.link) }}>
                    <span className={cx('block text-[15px]', n.read ? 'text-mute' : 'text-ivory')}>{n.title}{!n.read && <span className="sr-only"> (unread)</span>}</span>
                    <span className="block text-[13px] text-dim">{n.body}</span>
                    <span className="block text-[12px] text-dim" title={fmtDateTime(n.at)}>{TYPES[n.type]} · {relTime(n.at)}</span>
                  </button>
                  {!n.read && <Button size="sm" variant="ghost" onClick={() => actions.markRead(n.id)} aria-label={`Mark “${n.title}” as read`}>Mark read</Button>}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      {isMember && (
        <aside className="lg:pt-24">
          <Card className="p-5">
            <h2 className="text-[15px]">Email, SMS & WhatsApp alerts</h2>
            <p className="mb-2 text-[12.5px] text-dim">In-app notifications are always shown. Legally required service notices (e.g. payment confirmations, security alerts) are always sent.</p>
            <div className="divide-y divide-line">
              {([['bookings', 'Bookings'], ['reminders', 'Appointment reminders'], ['requests', 'Request updates'], ['payments', 'Payment reminders'], ['documents', 'Document access'], ['family', 'Family & delegates'], ['marketing', 'News & offers']] as const).map(([k, l]) => (
                <Toggle key={k} label={l} checked={p[k]} onChange={v => actions.setNotificationPrefs({ [k]: v })} />
              ))}
            </div>
          </Card>
        </aside>
      )}
    </div>
  )
}
