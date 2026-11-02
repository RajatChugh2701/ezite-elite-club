import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ClipboardList, Search } from 'lucide-react'
import { useApp } from '../data/store'
import { actor, pendingApprovals, visibleRequests } from '../data/selectors'
import { cityName, categoryName, serviceById, execById, expertById } from '../data/config'
import type { RequestStatus } from '../data/types'
import { Button, Card, EmptyState, Input, PageHeader, StatusBadge, Tabs, Badge } from '../components/ui'
import { fmtDate, inr } from '../lib/format'

const GROUPS: { value: string; label: string; match: (s: RequestStatus) => boolean }[] = [
  { value: 'active', label: 'Active', match: s => !['completed', 'cancelled'].includes(s) },
  { value: 'awaiting_approval', label: 'Awaiting approval', match: s => s === 'awaiting_approval' },
  { value: 'scheduled', label: 'Scheduled', match: s => s === 'scheduled' },
  { value: 'in_progress', label: 'In progress', match: s => ['in_progress', 'under_review', 'submitted', 'on_hold'].includes(s) },
  { value: 'completed', label: 'Completed', match: s => s === 'completed' },
  { value: 'cancelled', label: 'Cancelled', match: s => s === 'cancelled' },
  { value: 'all', label: 'All history', match: () => true },
]

export default function Requests() {
  const { state } = useApp()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? 'active'
  const [q, setQ] = useState('')
  const all = visibleRequests(state)
  const group = GROUPS.find(g => g.value === status) ?? GROUPS[0]
  const list = useMemo(() => all.filter(r => group.match(r.status) && (!q.trim() || `${r.id} ${r.title} ${state.beneficiaries.find(b => b.id === r.beneficiaryId)?.name}`.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [all, group, q, state.beneficiaries])
  const approvals = pendingApprovals(state)

  return (
    <div>
      <PageHeader eyebrow="My requests" title="Requests & cases" subtitle="Everything your concierge team is handling, with a full timeline for each."
        actions={actor(state).kind === 'member' || true ? <Button to="/request/new">New request</Button> : null} />
      {approvals.length > 0 && status !== 'awaiting_approval' && (
        <Card className="mb-6 flex flex-wrap items-center gap-3 border-warn/40 p-4">
          <Badge tone="amber">{approvals.length} approval{approvals.length > 1 ? 's' : ''} waiting</Badge>
          <p className="flex-1 text-sm text-mute">{approvals.map(a => a.title).join(' · ')}</p>
          <Button size="sm" variant="secondary" onClick={() => setParams({ status: 'awaiting_approval' })}>Review approvals</Button>
        </Card>
      )}
      <Tabs label="Request status" value={group.value} onChange={v => setParams(v === 'active' ? {} : { status: v })}
        tabs={GROUPS.map(g => ({ value: g.value, label: g.label, count: all.filter(r => g.match(r.status)).length }))} />
      <label className="relative mb-5 block max-w-md">
        <span className="sr-only">Search requests</span>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-dim" aria-hidden />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by ID, title or family member" className="pl-10" />
      </label>
      {list.length === 0 ? (
        <EmptyState icon={<ClipboardList className="size-7" />} title={q ? 'No requests match your search' : `No ${group.label.toLowerCase()} requests`}
          body={q ? 'Try a different term.' : 'When you ask for help, it will appear here with a full timeline.'} action={q ? <Button variant="secondary" onClick={() => setQ('')}>Clear search</Button> : <Button to="/request/new">Request assistance</Button>} />
      ) : (
        <ul className="space-y-3">
          {list.map(r => {
            const who = state.beneficiaries.find(b => b.id === r.beneficiaryId)
            const assignee = execById(r.assignedTo)?.name ?? expertById(r.assignedTo)?.name ?? r.assignedTo
            const cat = r.kind === 'consultation' ? 'Consultation' : r.kind === 'exec_change' ? 'Executive change' : r.kind === 'cancellation' ? 'Membership' : categoryName(serviceById(r.serviceId)?.categoryId)
            return (
              <li key={r.id}>
                <Link to={`/requests/${r.id}`} className="block rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line2 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12px] text-dim">{r.id} · {cat}</p>
                      <p className="mt-0.5 text-[15.5px] text-ivory">{r.title}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-mute">
                    <span>For {who?.name}</span><span>{cityName(r.city)}</span><span>{assignee}</span>
                    {r.preferredDate && <span>{fmtDate(r.preferredDate)}</span>}
                    {r.quote?.total ? <span>{inr(r.quote.total)}</span> : null}
                    <span className="text-dim">Created {fmtDate(r.createdAt)}</span>
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
