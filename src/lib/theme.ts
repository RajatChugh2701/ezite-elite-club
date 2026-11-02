import { useSyncExternalStore } from 'react'

// Per-viewer appearance preference (browser storage is fine: it's a convenience, not member data).
export type ThemePref = 'system' | 'light' | 'dark'
const KEY = 'ezit-theme'
const media = window.matchMedia('(prefers-color-scheme: light)')
const listeners = new Set<() => void>()

const read = (): ThemePref => {
  try { return (localStorage.getItem(KEY) as ThemePref) || 'system' } catch { return 'system' }
}
let pref = read()
const resolve = (p: ThemePref): 'light' | 'dark' => (p === 'system' ? (media.matches ? 'light' : 'dark') : p)
const apply = () => { document.documentElement.dataset.theme = resolve(pref) }

media.addEventListener('change', () => { if (pref === 'system') transition(apply) })

// Circular reveal from the click point where View Transitions exist; colour cross-fade otherwise.
function transition(update: () => void, origin?: { x: number; y: number }) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } }
  if (reduce) { update(); listeners.forEach(l => l()); return }
  if (doc.startViewTransition) {
    const x = origin?.x ?? innerWidth / 2, y = origin?.y ?? 0
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    const vt = doc.startViewTransition(() => { update(); listeners.forEach(l => l()) })
    vt.ready.then(() => document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 650, easing: 'cubic-bezier(.4,0,.2,1)', pseudoElement: '::view-transition-new(root)' },
    )).catch(() => {})
    return
  }
  const root = document.documentElement
  root.classList.add('theme-fade')
  update(); listeners.forEach(l => l())
  setTimeout(() => root.classList.remove('theme-fade'), 500)
}

export function setTheme(p: ThemePref, origin?: { x: number; y: number }) {
  pref = p
  try { localStorage.setItem(KEY, p) } catch { /* private mode: keep in memory */ }
  transition(apply, origin)
}

export function useTheme() {
  const p = useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb) }, () => pref)
  return { pref: p, resolved: resolve(p) }
}

apply()
