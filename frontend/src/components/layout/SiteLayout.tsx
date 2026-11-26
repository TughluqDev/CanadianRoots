import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'

const links = [
  { to: '/plan', label: 'Plan your journey' },
  { to: '/destinations', label: 'Destinations' },
  { to: '/trips', label: 'Saved journeys' },
]

export function SiteLayout() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[2000] focus:bg-cream-50 focus:p-2">
        Skip to content
      </a>
      <header className="no-print bg-forest text-cream">
        <div className="container-page flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4">
          <Link to="/" aria-label="Canadian Roots home" className="text-lg font-bold">Canadian Roots</Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="Main">
            {links.map(({ to, label }) => (
              <NavLink key={to} to={to} className="hover:underline aria-[current=page]:font-semibold aria-[current=page]:underline">
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="no-print mt-12 border-t border-cream-300 bg-cream-200">
        <div className="container-page py-4 text-sm text-ink-soft">
          Prices are estimates. Confirm hours and programs with each destination before visiting.
        </div>
      </footer>
    </div>
  )
}
