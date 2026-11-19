import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { preferences, trip } from '@/test/fixtures'
import { JourneyPage } from './JourneyPage'

vi.mock('@/services/api', async (orig) => {
  const mod = await orig<typeof import('@/services/api')>()
  return {
    ...mod,
    api: {
      ...mod.api,
      trip: vi.fn(async (id: number) => {
        if (id !== 7) throw new mod.ApiError('We couldn’t find that journey.', 404)
        return trip
      }),
      preferences: vi.fn(async () => preferences),
    },
  }
})
// Leaflet needs a real browser; the map is covered by the Playwright tests.
vi.mock('@/components/journey/RouteMap', () => ({ default: () => <div>map</div> }))

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/journey/:tripId" element={<JourneyPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('JourneyPage', () => {
  it('shows a loading state, then personalized recommendations', async () => {
    renderAt('/journey/7')
    expect(screen.getByLabelText('Loading journey')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Harvest Crew' })).toBeInTheDocument()
    expect(screen.getByText('For Lee')).toBeInTheDocument()
    expect(screen.getByText('For Mia')).toBeInTheDocument()
    expect(screen.getByText(/Because Lee enjoys being around animals/)).toBeInTheDocument()
    expect(screen.getAllByText('Heritage Ice Cream').length).toBeGreaterThan(0)
  })

  it('shows the complete budget with total, per-person cost and disclaimer', async () => {
    renderAt('/journey/7')
    expect(await screen.findByTestId('budget-total')).toHaveTextContent('$633')
    expect(screen.getByText(/\$317 per person · 2 travellers/)).toBeInTheDocument()
    for (const s of ['Experiences subtotal', 'Transportation subtotal', 'Accommodation subtotal', 'Lodging taxes (15%)', 'Contingency (10%)']) {
      expect(screen.getByText(s)).toBeInTheDocument()
    }
    expect(screen.getByText(/not live booking quotes/)).toBeInTheDocument()
  })

  it('handles a missing journey gracefully', async () => {
    renderAt('/journey/99')
    expect(await screen.findByRole('heading', { name: 'Journey not found' })).toBeInTheDocument()
  })
})
