import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { cities, preferences, regions } from '@/test/fixtures'
import { PartyBuilder } from './PartyBuilder'
import { defaultPartyForm, toPartyInput, type PartyForm } from './schema'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

function setup(initial: PartyForm = defaultPartyForm(), initialStep = 0) {
  const onSubmit = vi.fn()
  const qc = new QueryClient()
  render(
    <QueryClientProvider client={qc}>
      <PartyBuilder cities={cities} preferences={preferences} regions={regions} initialValues={initial}
        initialStep={initialStep} submitting={false} submitError={null} onSubmit={onSubmit} />
    </QueryClientProvider>,
  )
  return { onSubmit, user: userEvent.setup() }
}

const ready = (): PartyForm => ({ ...defaultPartyForm(), starting_city_id: 'toronto', departure_month: 7 })

describe('PartyBuilder', () => {
  it('requires a starting city and month before continuing', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText('Choose where your journey begins.')).toBeInTheDocument()
    expect(screen.getByText('Choose a travel month.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'The journey' })).toBeInTheDocument()
  })

  it('selects a city from the searchable list and keeps data when going back', async () => {
    const { user } = setup()
    const combo = screen.getByRole('combobox', { name: 'Starting city' })
    await user.click(combo)
    await user.type(combo, 'otta')
    await user.click(screen.getByRole('option', { name: /Ottawa/ }))
    await user.click(screen.getByRole('radio', { name: 'Jul' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByRole('heading', { name: 'Your party' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('combobox', { name: 'Starting city' })).toHaveValue('Ottawa, Ontario')
    expect(screen.getByRole('radio', { name: 'Jul' })).toHaveAttribute('aria-checked', 'true')
  })

  it('adds and removes travellers', async () => {
    const { user } = setup(ready(), 1)
    // A lone traveller can't be removed
    expect(screen.queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add traveller' }))
    await user.click(screen.getByRole('button', { name: 'Add traveller' }))
    expect(screen.getAllByRole('button', { name: /^Remove Traveller/ })).toHaveLength(3)
    await user.click(screen.getByRole('button', { name: 'Remove Traveller 2' }))
    expect(screen.getAllByRole('button', { name: /^Remove Traveller/ })).toHaveLength(2)
  })

  it('toggles interest and culture chips on and off', async () => {
    const { user } = setup(ready(), 1)
    const cheese = screen.getByRole('button', { name: 'Cheese' })
    await user.click(cheese)
    expect(cheese).toHaveAttribute('aria-pressed', 'true')
    await user.click(cheese)
    expect(cheese).toHaveAttribute('aria-pressed', 'false')
    const french = screen.getByRole('button', { name: /French Influences/ })
    await user.click(french)
    expect(french).toHaveAttribute('aria-pressed', 'true')
  })

  it('blocks members without a name or cultural preference', async () => {
    const { user } = setup(ready(), 1)
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText('Every traveller needs a name.')).toBeInTheDocument()
    expect(screen.getByText('Choose at least one cultural influence.')).toBeInTheDocument()
  })

  it('submits a complete party once from the review step', async () => {
    const { user, onSubmit } = setup(ready(), 1)
    await user.type(screen.getByLabelText('Name'), 'Bob')
    await user.click(screen.getByRole('button', { name: /Indigenous Influences/ }))
    await user.click(screen.getByRole('button', { name: 'Fishing' }))
    await user.click(screen.getByRole('radio', { name: 'Atlantic Canada' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    const review = await screen.findByRole('heading', { name: 'Review' })
    expect(review).toBeInTheDocument()
    // Clicking Continue must not submit by itself (regression: button type swap mid-click)
    expect(onSubmit).not.toHaveBeenCalled()
    expect(within(document.body).getByText('Bob')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Generate My Journey' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const input = toPartyInput(onSubmit.mock.calls[0][0])
    expect(input).toMatchObject({
      starting_city_id: 'toronto', transportation_method: 'car', departure_month: 7,
      members: [{ name: 'Bob', cultures: ['indigenous'], interests: ['fishing'], preferred_region: 'atlantic' }],
    })
  })
})
