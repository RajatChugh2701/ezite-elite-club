import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, FileImage, FileText, Lock, Search, Share2, ShieldCheck, Trash2, Upload, X } from 'lucide-react'
import { useApp } from '../data/store'
import { actor, getDocument, visibleDocuments } from '../data/selectors'
import { EXECUTIVES, EXPERTS, POLICY } from '../data/config'
import type { DocCategory, DocumentShare, VaultDocument } from '../data/types'
import { AccessDenied, Badge, Button, Card, Checkbox, ConfirmDialog, EmptyState, Field, Input, KV, Modal, Notice, PageHeader, Select, SimLabel, Spinner, Tabs, useUI } from '../components/ui'
import { cx, fmtDate, fmtDateTime } from '../lib/format'
import { downloadFile } from '../lib/download'

const CATS: { id: DocCategory; label: string }[] = [
  { id: 'identity', label: 'Identity' }, { id: 'family', label: 'Family' }, { id: 'property', label: 'Property' },
  { id: 'financial', label: 'Financial & insurance' }, { id: 'consultation', label: 'Consultation' }, { id: 'case', label: 'Service case' },
]
const catLabel = (c: DocCategory) => CATS.find(x => x.id === c)?.label ?? c
const shareActive = (s: DocumentShare) => !s.revokedAt && new Date(s.expiresAt).getTime() > Date.now()
const sizeLabel = (kb: number) => (kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`)

export default function Documents() {
  const { state } = useApp()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<DocCategory | 'all'>('all')
  const [upload, setUpload] = useState(false)
  const isMember = actor(state).kind === 'member'
  const docs = visibleDocuments(state)
  const list = useMemo(() => docs.filter(d => (cat === 'all' || d.category === cat) && (!q.trim() || d.name.toLowerCase().includes(q.trim().toLowerCase()))), [docs, cat, q])
  const openId = params.get('doc')

  return (
    <div>
      <PageHeader eyebrow="Documents & vault" title="Secure document vault" subtitle={isMember ? 'Share documents with your executive or an expert for a specific case, for a limited time. Revoke whenever you like.' : 'Documents the member has shared with you.'}
        actions={isMember && <Button icon={<Upload className="size-4" />} onClick={() => setUpload(true)}>Upload</Button>} />
      <Notice tone="warn" className="mb-6" title="Prototype storage">
        Files are kept only in this browser’s local storage, are not encrypted and are not malware-scanned. Files over {POLICY.maxStoredDataUrlKB} KB keep metadata only. Production uses encrypted object storage with signed URLs.
      </Notice>
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Search documents</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-dim" aria-hidden />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search documents" className="pl-10" />
        </label>
        {(q || cat !== 'all') && <Button variant="ghost" onClick={() => { setQ(''); setCat('all') }}>Clear filters</Button>}
      </div>
      <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Category">
        {[{ id: 'all' as const, label: 'All' }, ...CATS].map(c => (
          <button key={c.id} aria-pressed={cat === c.id} onClick={() => setCat(c.id)} className={cx('shrink-0 rounded-full border px-3.5 py-1.5 text-[13px]', cat === c.id ? 'border-gold bg-gold/10 text-gold-soft' : 'border-line text-mute hover:text-ivory')}>{c.label}</button>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<FileText className="size-7" />} title={docs.length ? 'No documents match' : 'No documents yet'} body={docs.length ? 'Try another search or category.' : isMember ? 'Upload identity, property or insurance documents to use them in requests.' : 'Nothing has been shared with you.'}
          action={isMember && !docs.length ? <Button onClick={() => setUpload(true)}>Upload a document</Button> : undefined} />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {list.map(d => {
              const active = d.shares.filter(shareActive)
              return (
                <li key={d.id}>
                  <button onClick={() => setParams({ doc: d.id })} className="flex w-full flex-wrap items-center gap-4 px-5 py-4 text-left hover:bg-raised/40">
                    {d.fileType.startsWith('image') ? <FileImage className="size-5 shrink-0 text-gold" aria-hidden /> : <FileText className="size-5 shrink-0 text-gold" aria-hidden />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] text-ivory">{d.name}</span>
                      <span className="block text-[12.5px] text-dim">{catLabel(d.category)} · {sizeLabel(d.sizeKB)} · uploaded {fmtDate(d.uploadedAt)}{d.relatedRequestId ? ` · ${d.relatedRequestId}` : ''}{d.relatedCaseId ? ` · ${d.relatedCaseId}` : ''}</span>
                    </span>
                    {d.scan === 'scanning' ? <Spinner label="Checking file" /> : active.length ? <Badge tone="gold">Shared with {active.length}</Badge> : <Badge tone="neutral"><Lock className="size-3" aria-hidden />Private</Badge>}
                    {d.locked && <Badge tone="neutral" dot={false}>System</Badge>}
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
      {upload && <UploadModal onClose={() => setUpload(false)} />}
      {openId && <DocModal id={openId} onClose={() => setParams({})} />}
    </div>
  )
}

function UploadModal({ onClose }: { onClose: () => void }) {
  const { state, actions } = useApp()
  const { toast } = useUI()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File>()
  const [category, setCategory] = useState<DocCategory>('identity')
  const [ben, setBen] = useState('')
  const [req, setReq] = useState('')
  const [consent, setConsent] = useState(!!state.consents.find(c => c.key === 'sensitive_docs')?.granted)
  const [err, setErr] = useState<string>()
  const [progress, setProgress] = useState<number>()

  const pick = (f?: File) => {
    setErr(undefined)
    if (!f) return
    if (!POLICY.allowedFileTypes.includes(f.type)) { setFile(undefined); return setErr('Unsupported file type. Upload a PDF, JPG, PNG or WEBP.') }
    if (f.size / 1024 > POLICY.maxUploadKB) { setFile(undefined); return setErr(`This file is ${(f.size / 1048576).toFixed(1)} MB. The limit is ${POLICY.maxUploadKB / 1024} MB.`) }
    setFile(f)
  }
  const go = async () => {
    if (!file) return setErr('Choose a file.')
    if (!consent) return setErr('Please consent to processing this document.')
    setProgress(0)
    const dataUrl = file.size / 1024 <= POLICY.maxStoredDataUrlKB ? await new Promise<string>(res => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(file) }) : undefined
    for (let i = 1; i <= 5; i++) { await new Promise(r => setTimeout(r, 140)); setProgress(i * 20) }
    if (!state.consents.find(c => c.key === 'sensitive_docs')?.granted) actions.setConsent('sensitive_docs', true)
    const r = actions.uploadDocument({ name: file.name, fileType: file.type, sizeKB: Math.max(1, Math.round(file.size / 1024)), category, beneficiaryId: ben || undefined, relatedRequestId: req || undefined, dataUrl })
    if (!r.ok) { setProgress(undefined); return setErr(r.error) }
    toast({ tone: 'ok', title: 'Uploaded', body: file.name })
    onClose()
  }
  return (
    <Modal open onClose={onClose} title="Upload a document" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={go} loading={progress !== undefined} disabled={!file}>Upload</Button></>}>
      <div className="space-y-4">
        <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); pick(e.dataTransfer.files[0]) }}
          className="flex flex-col items-center rounded-xl border border-dashed border-line2 bg-bg2 p-6 text-center">
          <Upload className="mb-2 size-6 text-gold" aria-hidden />
          {file ? <p className="text-sm text-ivory">{file.name} <span className="text-dim">· {sizeLabel(Math.round(file.size / 1024))}</span></p> : <p className="text-sm text-mute">Drag a file here, or</p>}
          <input ref={input} type="file" accept={POLICY.allowedFileTypes.join(',')} className="sr-only" id="file" onChange={e => pick(e.target.files?.[0])} />
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => input.current?.click()}>{file ? 'Choose another file' : 'Choose a file'}</Button>
          <p className="mt-2 text-[12px] text-dim">PDF, JPG, PNG or WEBP · up to {POLICY.maxUploadKB / 1024} MB</p>
        </div>
        {progress !== undefined && <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress" className="h-1 overflow-hidden rounded-full bg-line"><div className="h-full bg-gold transition-all" style={{ width: `${progress}%` }} /></div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="uc"><Select id="uc" value={category} onChange={e => setCategory(e.target.value as DocCategory)}>{CATS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></Field>
          <Field label="Belongs to (optional)" htmlFor="ub"><Select id="ub" value={ben} onChange={e => setBen(e.target.value)}><option value="">—</option>{state.beneficiaries.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
          <Field className="sm:col-span-2" label="Related request (optional)" htmlFor="ur"><Select id="ur" value={req} onChange={e => setReq(e.target.value)}><option value="">—</option>{state.requests.filter(r => (r.kind === 'service' || r.kind === 'consultation') && !['cancelled', 'completed'].includes(r.status)).map(r => <option key={r.id} value={r.id}>{r.id} · {r.title}</option>)}</Select></Field>
        </div>
        <Checkbox checked={consent} onChange={setConsent} label="I consent to EZIT processing this document for my cases" description="Recorded in your consent history. Documents are only visible to people you explicitly share them with." />
        {err && <Notice tone="bad">{err}</Notice>}
      </div>
    </Modal>
  )
}

function DocModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, actions } = useApp()
  const { toast, requireStepUp } = useUI()
  const [tab, setTab] = useState<'preview' | 'sharing' | 'log' | 'details'>('preview')
  const [share, setShare] = useState(false)
  const [del, setDel] = useState(false)
  const [rename, setRename] = useState<string>()
  const logged = useRef(false)
  const g = getDocument(state, id)
  const isMember = actor(state).kind === 'member'
  useEffect(() => {
    if (g.ok && !logged.current) { logged.current = true; actions.logDocAccess(id, 'viewed') }
  }, [g.ok, id, actions])
  if (!g.ok) return <Modal open onClose={onClose} title="Document"><AccessDenied reason={g.reason} what="this document" /></Modal>
  const d = g.data

  const download = () => requireStepUp('Downloading a sensitive document needs verification.', () => {
    const r = actions.logDocAccess(d.id, 'downloaded')
    if (!r.ok) return toast({ tone: 'bad', title: r.error })
    if (d.dataUrl) { const a = document.createElement('a'); a.href = d.dataUrl; a.download = d.name; a.click() }
    else downloadFile(d.name.replace(/\.\w+$/, '') + ' (prototype placeholder).txt', `Prototype placeholder for “${d.name}”.\nThe original file is not stored in this demo.\nDownloaded by ${actor(state).name} on ${new Date().toLocaleString()}.`, 'text/plain')
  })

  return (
    <Modal open onClose={onClose} title={d.name} description={`${catLabel(d.category)} · ${sizeLabel(d.sizeKB)} · uploaded by ${d.uploadedBy} on ${fmtDate(d.uploadedAt)}`} size="lg"
      footer={<>
        {isMember && !d.locked && <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setDel(true)}>Delete</Button>}
        <Button variant="secondary" icon={<Download className="size-4" />} onClick={download}>Download</Button>
        {isMember && <Button icon={<Share2 className="size-4" />} onClick={() => setShare(true)}>Share</Button>}
      </>}>
      <Tabs label="Document" value={tab} onChange={setTab} tabs={[{ value: 'preview', label: 'Preview' }, ...(isMember ? [{ value: 'sharing' as const, label: 'Sharing', count: d.shares.filter(shareActive).length }, { value: 'log' as const, label: 'Access log' }, { value: 'details' as const, label: 'Details' }] : [])]} />
      {tab === 'preview' && (
        <div className="relative overflow-hidden rounded-xl border border-line bg-[#f3efe6]">
          {d.dataUrl && d.fileType.startsWith('image') ? <img src={d.dataUrl} alt={d.name} className="mx-auto max-h-[420px] object-contain" />
            : d.dataUrl && d.fileType === 'application/pdf' ? <iframe src={d.dataUrl} title={d.name} className="h-[420px] w-full" />
              : (
                <div className="space-y-3 p-8 text-[#3a3f3b]">
                  <p className="font-serif text-xl">{d.name.replace(/\.\w+$/, '')}</p>
                  {Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-2.5 rounded bg-[#d9d3c6]" style={{ width: `${90 - i * 9}%` }} />)}
                  <p className="pt-4 text-xs">Placeholder preview — the original file is not stored in this prototype.</p>
                </div>
              )}
          <div className="pointer-events-none absolute inset-0 grid place-items-center"><span className="-rotate-12 select-none text-2xl font-semibold tracking-widest text-[#C8A65D]/30">{actor(state).name.toUpperCase()} · {new Date().toLocaleDateString('en-IN')}</span></div>
        </div>
      )}
      {tab === 'sharing' && (
        <div className="space-y-3">
          {d.shares.length === 0 && <p className="text-sm text-dim">This document is private. Only you can see it.</p>}
          {[...d.shares].reverse().map(s => {
            const active = shareActive(s)
            return (
              <div key={s.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line p-4">
                <div>
                  <p className="text-sm text-ivory">{s.recipientName} <span className="text-dim">· {s.recipientRole}</span></p>
                  <p className="text-[12.5px] text-mute">{s.purpose}{s.requestId && <> · <Link className="link" to={`/requests/${s.requestId}`}>{s.requestId}</Link></>} · {s.permission === 'view' ? 'View only' : 'View & download'}</p>
                  <p className="text-[12px] text-dim">Shared {fmtDate(s.createdAt)} · {s.revokedAt ? `revoked ${fmtDateTime(s.revokedAt)}` : active ? `expires ${fmtDateTime(s.expiresAt)}` : `expired ${fmtDateTime(s.expiresAt)}`}</p>
                </div>
                {active ? <Button size="sm" variant="danger" icon={<X className="size-4" />} onClick={() => { const r = actions.revokeShare(d.id, s.id); toast(r.ok ? { tone: 'ok', title: `Access revoked for ${s.recipientName}` } : { tone: 'bad', title: r.error }) }}>Revoke</Button>
                  : <Badge tone={s.revokedAt ? 'red' : 'neutral'}>{s.revokedAt ? 'Revoked' : 'Expired'}</Badge>}
              </div>
            )
          })}
          <Button variant="secondary" icon={<Share2 className="size-4" />} onClick={() => setShare(true)}>Share with someone</Button>
        </div>
      )}
      {tab === 'log' && (
        <div>
          <ul className="space-y-2 text-sm">{[...d.accessLog].reverse().map(e => <li key={e.id} className="flex flex-wrap gap-x-3"><span className="w-40 shrink-0 text-dim">{fmtDateTime(e.at)}</span><span>{e.actor} — <span className="text-mute">{e.action.replace(/_/g, ' ')}</span>{e.detail && <span className="text-dim"> · {e.detail}</span>}</span></li>)}</ul>
          <Button size="sm" variant="ghost" className="mt-4" icon={<Download className="size-4" />} onClick={() => downloadFile(`${d.id}-access-log.csv`, 'time,actor,action,detail\n' + d.accessLog.map(e => [e.at, e.actor, e.action, e.detail ?? ''].map(x => `"${x.replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv')}>Export audit log (CSV)</Button>
        </div>
      )}
      {tab === 'details' && (
        <div className="space-y-4">
          <KV items={[['File type', d.fileType], ['Belongs to', state.beneficiaries.find(b => b.id === d.beneficiaryId)?.name ?? '—'], ['Related request', d.relatedRequestId ?? '—'], ['Related case', d.relatedCaseId ?? '—'], ['File check', d.scan === 'clean' ? 'Passed (simulated)' : 'Checking…'], ['Consent', 'Sensitive document processing — granted']]} />
          {!d.locked ? (
            <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); const r = actions.renameDocument(d.id, rename ?? d.name); toast(r.ok ? { tone: 'ok', title: 'Renamed' } : { tone: 'bad', title: r.error }); setRename(undefined) }}>
              <Field className="flex-1" label="Rename" htmlFor="rn"><Input id="rn" value={rename ?? d.name} onChange={e => setRename(e.target.value)} /></Field>
              <Button type="submit" variant="secondary" disabled={rename === undefined || rename === d.name}>Save</Button>
            </form>
          ) : <p className="text-[13px] text-dim">System documents can’t be renamed or deleted; they follow the retention schedule.</p>}
        </div>
      )}
      {share && <ShareModal doc={d} onClose={() => { setShare(false); setTab('sharing') }} />}
      <ConfirmDialog open={del} onClose={() => setDel(false)} tone="danger" confirmLabel="Delete document" title="Delete this document?"
        onConfirm={() => { setDel(false); requireStepUp('Deleting a document is permanent.', () => { const r = actions.deleteDocument(d.id); if (r.ok) { toast({ tone: 'ok', title: 'Document deleted' }); onClose() } else toast({ tone: 'bad', title: r.error }) }) }}>
        “{d.name}” will be removed from your vault and from any requests and delegate permissions. Active shares end immediately.
      </ConfirmDialog>
    </Modal>
  )
}

function ShareModal({ doc, onClose }: { doc: VaultDocument; onClose: () => void }) {
  const { state, actions } = useApp()
  const { toast, requireStepUp } = useUI()
  const [recipientId, setRecipient] = useState(state.membership.peId)
  const [purpose, setPurpose] = useState(doc.relatedRequestId ? state.requests.find(r => r.id === doc.relatedRequestId)?.title ?? '' : '')
  const [requestId, setRequestId] = useState(doc.relatedRequestId ?? '')
  const [permission, setPermission] = useState<'view' | 'view_download'>('view')
  const [days, setDays] = useState(POLICY.defaultShareDays)
  const [review, setReview] = useState(false)
  const [err, setErr] = useState<string>()
  const recipients = [...EXECUTIVES.filter(e => e.kind !== 'supervisor').map(e => ({ id: e.id, label: `${e.name} — ${e.role}` })), ...EXPERTS.map(e => ({ id: e.id, label: `${e.name} — ${e.title} (sample expert)` }))]
  const confirm = () => requireStepUp('Sharing a document gives someone else access to it.', () => {
    const r = actions.shareDocument(doc.id, { recipientId, purpose, requestId: requestId || undefined, permission, days })
    if (!r.ok) return setErr(r.error)
    toast({ tone: 'ok', title: 'Shared', body: `Access ends in ${days} day(s).` })
    onClose()
  })
  return (
    <Modal open onClose={onClose} title={review ? 'Review sharing' : 'Share document'} description={doc.name}
      footer={review ? <><Button variant="secondary" onClick={() => setReview(false)}>Back</Button><Button icon={<ShieldCheck className="size-4" />} onClick={confirm}>Confirm & share</Button></>
        : <><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => { if (!purpose.trim()) return setErr('Describe the purpose.'); setErr(undefined); setReview(true) }}>Review</Button></>}>
      {!review ? (
        <div className="grid gap-4">
          <Field label="Share with" htmlFor="sr"><Select id="sr" value={recipientId} onChange={e => setRecipient(e.target.value)}>{recipients.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</Select></Field>
          <Field label="For request (recommended)" htmlFor="sq"><Select id="sq" value={requestId} onChange={e => setRequestId(e.target.value)}><option value="">Not linked to a request</option>{state.requests.filter(r => (r.kind === 'service' || r.kind === 'consultation') && r.status !== 'cancelled').map(r => <option key={r.id} value={r.id}>{r.id} · {r.title}</option>)}</Select></Field>
          <Field label="Purpose" required error={err} htmlFor="sp"><Input id="sp" value={purpose} onChange={e => setPurpose(e.target.value)} invalid={!!err} placeholder="e.g. Property tax filing" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Access" htmlFor="sa"><Select id="sa" value={permission} onChange={e => setPermission(e.target.value as 'view')}><option value="view">View only (watermarked)</option><option value="view_download">View & download</option></Select></Field>
            <Field label="Expires after" htmlFor="sx"><Select id="sx" value={days} onChange={e => setDays(Number(e.target.value))}>{[1, 3, 7, 14, 30].map(n => <option key={n} value={n}>{n} day{n > 1 ? 's' : ''}</option>)}</Select></Field>
          </div>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <KV items={[['Recipient', recipients.find(r => r.id === recipientId)?.label], ['Purpose', purpose], ['Request', requestId || '—'], ['Access', permission === 'view' ? 'View only, watermarked' : 'View & download, watermarked'], ['Ends', fmtDateTime(new Date(Date.now() + days * 86400000).toISOString())]]} />
          <p className="text-mute">Every view and download is logged. You can revoke access at any time. <SimLabel>Simulated access</SimLabel></p>
          {err && <Notice tone="bad">{err}</Notice>}
        </div>
      )}
    </Modal>
  )
}
