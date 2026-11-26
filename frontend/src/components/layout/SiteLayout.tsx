import { Menu, Sprout, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/destinations', label: 'Destinations' },
  { to: '/trips', label: 'Saved journeys' },
]

export function Logo({ light }: { light?: boolean }) {
  return (
    <Link to="/" className="group flex items-center gap-2.5" aria-label="Canadian Roots home">
      <span className={cn('flex size-9 items-center justify-center rounded-xl transition group-hover:rotate-[-6deg]', light ? 'bg-cream/15 text-gold ring-1 ring-cream/30' : 'bg-forest text-gold')}>
        <Sprout className="size-5" aria-hidden />
      </span>
      <span className={cn('font-display text-xl font-semibold tracking-tight', light ? 'text-cream' : 'text-forest-900')}>
        Canadian Roots
      </span>
    </Link>
  )
}

function SiteHeader() {
  const { pathname } = useLocation()
  const overHero = pathname === '/'
  const [scrolled, setScrolled] = useState(false)
  const [openFor, setOpenFor] = useState<string | null>(null)
  const open = openFor === pathname
  const setOpen = (next: (o: boolean) => boolean) => setOpenFor(next(open) ? pathname : null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const light = overHero && !scrolled && !open
  return (
    <header
      className={cn(
        'no-print fixed inset-x-0 top-0 z-[1000] transition-all duration-300',
        light ? 'bg-transparent' : 'border-b border-cream-300/60 bg-cream/90 backdrop-blur-lg',
      )}
    >
      <div className="container-page flex h-18 items-center justify-between py-3">
        <Logo light={light} />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  'rounded-full px-4 py-2 text-sm font-medium transition',
                  light ? 'text-cream/90 hover:bg-white/10 hover:text-white' : 'text-ink-soft hover:bg-forest/5 hover:text-forest',
                  isActive && (light ? 'text-white' : 'bg-forest/5 text-forest'),
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
          <Button asChild size="sm" variant={light ? 'gold' : 'primary'} className="ml-2">
            <Link to="/plan">Plan your journey</Link>
          </Button>
        </nav>
        <Button
          variant={light ? 'glass' : 'ghost'}
          size="icon"
          className="md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      {open && (
        <nav className="container-page animate-fade-in flex flex-col gap-1 pb-5 md:hidden" aria-label="Mobile">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className="rounded-xl px-4 py-3 font-medium text-forest hover:bg-forest/5">
              {n.label}
            </NavLink>
          ))}
          <Button asChild className="mt-2">
            <Link to="/plan">Plan your journey</Link>
          </Button>
        </nav>
      )}
    </header>
  )
}

function SiteFooter() {
  return (
    <footer className="no-print mt-24 bg-forest-900 text-cream/80">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-cream/70">
            Plan trips to Canadian farms and heritage sites.
          </p>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-semibold text-cream">Plan</p>
          <ul className="space-y-2">
            <li><Link className="hover:text-gold" to="/plan">Build your party</Link></li>
            <li><Link className="hover:text-gold" to="/destinations">Browse destinations</Link></li>
            <li><Link className="hover:text-gold" to="/trips">Saved journeys</Link></li>
          </ul>
        </div>
        <div className="text-sm leading-relaxed text-cream/60">
          <p className="mb-3 font-semibold text-cream">Good to know</p>
          Prices are for planning. Confirm hours and programs before visiting. Photo credits appear on each card.
        </div>
      </div>
    </footer>
  )
}

export function SiteLayout() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[2000] focus:rounded-full focus:bg-forest focus:px-4 focus:py-2 focus:text-cream">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
