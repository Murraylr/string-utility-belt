import React, { Suspense, lazy, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import BackgroundFX from '@/components/BackgroundFX'
import { getRoute, onRouteChange, type Route } from '@/lib/router'
import { ToolProvider } from './ToolContext'
import ToolPage from './tool/ToolPage'
import SharedPipeline from './share/SharedPipeline'
import ThemeToggle from './theme/ThemeToggle'
import CommandPalette from './commands/CommandPalette'
import ShortcutsHelp from './commands/ShortcutsHelp'
import { EVENT_OPEN_PALETTE } from './commands/commands'
import UpdateBanner from './pwa/UpdateBanner'
import InstallButton from './pwa/InstallButton'
import { useShareTarget } from './pwa/useShareTarget'
import { useT } from './i18n/useT'

// Only the tool ships in the entry chunk; every other route is fetched on first visit.
const BlogIndex = lazy(() => import('@/components/BlogIndex'))
const BlogPost = lazy(() => import('@/components/BlogPost'))
const UtilitiesIndexPage = lazy(() => import('./pages/UtilitiesIndexPage'))
const UtilityDocPage = lazy(() => import('./pages/UtilityDocPage'))
const EmbedPage = lazy(() => import('./pages/EmbedPage'))
const ChangelogPage = lazy(() => import('./pages/ChangelogPage'))
const Docs = lazy(() => import('@/components/Docs'))

const PageLoading = () => <div className="muted" role="status">Loading…</div>

const NAV = [
  { href: '/#/', key: 'nav.tool', routes: ['home', 'pipeline', 'notFound'] },
  { href: '/#/docs', key: 'nav.docs', routes: ['docs'] },
  { href: '/#/utilities', key: 'nav.utilities', routes: ['utilities', 'utility'] },
  { href: '/#/blog', key: 'nav.blog', routes: ['blogIndex', 'blogPost'] },
  { href: '/#/changelog', key: 'nav.changelog', routes: ['changelog'] },
] as const satisfies ReadonlyArray<{ href: string; key: string; routes: ReadonlyArray<Route['name']> }>

/** `current` (the active route's name) marks its nav link with `aria-current="page"`. */
export function Header({ children, current }: { children?: React.ReactNode; current?: Route['name'] }) {
  const { t } = useT()
  return (
    <header className="sticky top-0 backdrop-blur bg-surface/60 border-b z-10">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <a href="/#/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-primary-600 text-white grid place-content-center font-bold shadow-glow" aria-hidden>S</div>
          <div>
            <div className="font-semibold leading-tight">String Utility Belt</div>
            <div className="text-xs text-muted hidden sm:block">build a chain of string utilities</div>
          </div>
        </a>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <nav className="flex items-center gap-3 sm:gap-4 text-sm" aria-label="main">
            {NAV.map(n => {
              const active = !!current && (n.routes as ReadonlyArray<string>).includes(current)
              return (
                <a key={n.href} href={n.href} aria-current={active ? 'page' : undefined}
                  className={`hover:underline ${active ? 'underline underline-offset-4 decoration-2' : ''}`}>{t(n.key)}</a>
              )
            })}
          </nav>
          {children}
        </div>
      </div>
    </header>
  )
}

function isFramed(): boolean {
  try { return window.self !== window.top } catch { return true } // cross-origin parent: definitely framed
}

function FramedNotice() {
  return (
    <main className="min-h-screen grid place-content-center p-6 text-center gap-3 text-fg">
      <p>String Utility Belt can't be used inside another page.</p>
      <p><a className="btn" href={location.href} target="_blank" rel="noopener noreferrer">Open it in a new tab</a></p>
    </main>
  )
}

/** Opens the command palette; the visible counterpart of Ctrl+K. */
function PaletteButton() {
  return (
    <button type="button" className="btn" aria-label="Open command palette (Ctrl+K)"
      onClick={() => window.dispatchEvent(new CustomEvent(EVENT_OPEN_PALETTE))}>
      <Search size={16} />
      <kbd className="hidden md:inline text-xs text-muted font-mono">Ctrl K</kbd>
    </button>
  )
}

export default function AppShell() {
  const [route, setRoute] = useState<Route>(getRoute())
  useEffect(() => onRouteChange(setRoute), [])
  // text shared into the installed app from the OS share sheet (?text= / ?url=)
  const sharedInput = useShareTarget()

  // embeds render without the site chrome so they fit an iframe
  if (route.name === 'embed') return <Suspense fallback={<PageLoading />}><EmbedPage payload={route.params.payload} /></Suspense>
  // Everything except the embed refuses to run framed by another page: the full app
  // has destructive actions (clear, delete from library) a framing site could trick
  // a user into clicking. A script check is enough — without scripts nothing renders.
  if (isFramed()) return <FramedNotice />

  return (
    <div className="relative min-h-screen text-fg">
      <BackgroundFX />
      {/* focus, don't navigate: with hash routing, href="#main" would route to an unknown page */}
      <a href="#main" className="sr-only-focusable absolute left-2 top-2 z-50 btn"
        onClick={e => { e.preventDefault(); document.getElementById('main')?.focus() }}>Skip to content</a>
      <Header current={route.name}>
        <PaletteButton />
        <InstallButton />
        <ThemeToggle />
      </Header>
      <UpdateBanner />
      <main id="main" tabIndex={-1} className="max-w-7xl mx-auto px-4 py-8 grid gap-8 outline-none">
        <Suspense fallback={<PageLoading />}>
          {route.name === 'blogIndex' && <BlogIndex />}
          {route.name === 'blogPost' && <BlogPost slug={route.params.slug} />}
          {route.name === 'utilities' && <UtilitiesIndexPage />}
          {route.name === 'utility' && <UtilityDocPage id={route.params.id} />}
          {route.name === 'changelog' && <ChangelogPage />}
          {route.name === 'docs' && <Docs />}
        </Suspense>
        {route.name === 'pipeline' && <SharedPipeline payload={route.params.payload} />}
        {(route.name === 'home' || route.name === 'notFound') && (
          <ToolProvider initialInput={sharedInput}><ToolPage /></ToolProvider>
        )}
      </main>
      <CommandPalette />
      <ShortcutsHelp />
    </div>
  )
}
