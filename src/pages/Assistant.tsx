import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bot, Send, Trash2, UserRound } from 'lucide-react'
import { useApp } from '../data/store'
import { canAccessArea } from '../data/selectors'
import { aiRespond } from '../data/ai'
import { execById } from '../data/config'
import { AccessDenied, Button, Card, Notice, PageHeader, SimLabel } from '../components/ui'
import { cx, fmtTime, nowISO } from '../lib/format'

const SUGGESTIONS = [
  'What benefits are included in my membership?',
  'Help me arrange assistance for my parents.',
  'How many consultation credits do I have left?',
  'Show my upcoming appointments.',
  'I need help with a document.',
  'Connect me to my Personal Executive.',
]

export default function Assistant() {
  const { state, actions } = useApp()
  const nav = useNavigate()
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  const [err, setErr] = useState<string>()
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [state.aiMessages.length, typing])
  if (!canAccessArea(state, 'assistant')) return <AccessDenied what="the AI concierge" />
  const consent = state.consents.find(c => c.key === 'ai_processing')?.granted
  const pe = execById(state.membership.peId)!

  const ask = async (q: string) => {
    const t = q.trim()
    if (!t) return setErr('Type a question first.')
    if (t.length > 500) return setErr('Please keep questions under 500 characters.')
    setErr(undefined); setText('')
    actions.addAiMessages([{ id: 'U' + Date.now(), at: nowISO(), role: 'user', text: t }])
    setTyping(true)
    await new Promise(r => setTimeout(r, 900))
    const reply = aiRespond(t, state)
    setTyping(false)
    actions.addAiMessages([{ id: 'A' + Date.now(), at: nowISO(), role: 'assistant', ...reply }])
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="AI Concierge" title="How can I help?" subtitle={<span className="inline-flex flex-wrap items-center gap-2"><SimLabel>Simulated rule-based assistant</SimLabel> Answers come from your membership data. It never books, approves or reads vault documents on its own.</span>}
        actions={<>
          <Button variant="secondary" icon={<UserRound className="size-4" />} onClick={() => nav('/messages')}>Talk to {pe.name.split(' ')[0]}</Button>
          {state.aiMessages.length > 0 && <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => actions.clearAi()}>Clear</Button>}
        </>} />
      {!consent && <Notice tone="warn" className="mb-5" title="AI processing is turned off">Turn on “AI concierge processing” in <Link className="link" to="/profile?tab=consent">Profile → Consent</Link> to ask account questions, or talk to your executive.</Notice>}
      <Card className="flex min-h-[460px] flex-col p-4 sm:p-6">
        <div className="flex-1 space-y-4" aria-live="polite">
          {state.aiMessages.length === 0 && (
            <div className="py-6 text-center">
              <Bot className="mx-auto mb-3 size-8 text-gold" aria-hidden />
              <p className="serif text-xl">Ask about benefits, balances, bookings or invoices</p>
              <p className="mt-1 text-sm text-dim">Try one of these:</p>
            </div>
          )}
          {state.aiMessages.map(m => (
            <div key={m.id} className={cx('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
              <span className={cx('grid size-8 shrink-0 place-items-center rounded-full', m.role === 'user' ? 'bg-raised text-mute' : 'bg-gold/15 text-gold')} aria-hidden>{m.role === 'user' ? <UserRound className="size-4" /> : <Bot className="size-4" />}</span>
              <div className={cx('max-w-[85%] rounded-2xl px-4 py-3 text-sm', m.role === 'user' ? 'rounded-tr-md bg-gold/15' : 'rounded-tl-md border border-line bg-bg2')}>
                <p className="sr-only">{m.role === 'user' ? 'You said' : 'Assistant said'}</p>
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.actions && m.actions.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{m.actions.map(a => <Button key={a.label} size="sm" variant="secondary" to={a.to}>{a.label}</Button>)}</div>}
                <p className="mt-1.5 text-[11px] text-dim">{fmtTime(new Date(m.at).toTimeString().slice(0, 5))}</p>
              </div>
            </div>
          ))}
          {typing && <div className="flex gap-3" role="status"><span className="grid size-8 place-items-center rounded-full bg-gold/15 text-gold"><Bot className="size-4" /></span><span className="flex items-center gap-1 rounded-2xl border border-line bg-bg2 px-4 py-3"><span className="size-1.5 animate-bounce rounded-full bg-mute" /><span className="size-1.5 animate-bounce rounded-full bg-mute [animation-delay:120ms]" /><span className="size-1.5 animate-bounce rounded-full bg-mute [animation-delay:240ms]" /><span className="sr-only">Assistant is typing</span></span></div>}
          <div ref={end} />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {SUGGESTIONS.map(s => <button key={s} disabled={!consent || typing} onClick={() => ask(s)} className="rounded-full border border-line px-3 py-1.5 text-[12.5px] text-mute transition-colors hover:border-gold/60 hover:text-ivory disabled:opacity-40">{s}</button>)}
        </div>
        <form onSubmit={e => { e.preventDefault(); ask(text) }} className="mt-4 flex gap-2">
          <label htmlFor="ai" className="sr-only">Ask the AI concierge</label>
          <input id="ai" value={text} onChange={e => setText(e.target.value)} disabled={!consent || typing} placeholder="Ask anything about your membership…" maxLength={600}
            aria-invalid={!!err || undefined} className="h-11 min-w-0 flex-1 rounded-full border border-line2 bg-bg2 px-4 text-sm placeholder:text-dim focus:border-gold focus:outline-none disabled:opacity-50" />
          <Button type="submit" disabled={!consent || typing} icon={<Send className="size-4" />} aria-label="Send"><span className="hidden sm:inline">Ask</span></Button>
        </form>
        {err && <p className="mt-2 text-[12.5px] text-bad" role="alert">{err}</p>}
      </Card>
    </div>
  )
}
