import { Compass } from 'lucide-react'
import { PublicHeader } from '../components/Layout'
import { Button, EmptyState } from '../components/ui'

export default function NotFound({ inApp }: { inApp?: boolean }) {
  const body = (
    <EmptyState className="my-16" icon={<Compass className="size-8" />} title="This page doesn’t exist"
      body="The link may be out of date. Everything you need is a click away."
      action={<div className="flex gap-2"><Button to={inApp ? '/home' : '/'}>Go home</Button><Button variant="secondary" to="/support">Get help</Button></div>} />
  )
  if (inApp) return body
  return <div className="min-h-dvh"><PublicHeader /><main className="mx-auto max-w-2xl px-4">{body}</main></div>
}
