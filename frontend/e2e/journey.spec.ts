import { expect, test, type Page } from '@playwright/test'

interface M { name: string; cultures: string[]; interests: string[]; region?: string }
interface Opts { name: string; city: string; plane?: boolean; month: string; members: M[] }

const CULTURE_LABEL: Record<string, RegExp> = {
  indigenous: /Indigenous Influences/, british: /British Influences/, french: /French Influences/, immigrant: /Immigrant Influences/,
}

async function buildParty(page: Page, o: Opts) {
  const posts: string[] = []
  page.on('request', (r) => { if (r.method() === 'POST') posts.push(new URL(r.url()).pathname) })
  await page.goto('/plan')
  await page.evaluate(() => sessionStorage.clear())
  await page.reload()
  await page.getByLabel('Trip name').fill(o.name)
  const city = page.getByRole('combobox', { name: 'Starting city' })
  await city.click()
  await city.fill(o.city)
  await page.keyboard.press('Enter')
  if (o.plane) await page.getByText('Fly & drive').click()
  await page.getByRole('radio', { name: o.month, exact: true }).click()
  await page.getByRole('button', { name: 'Continue' }).click()

  for (const [i, m] of o.members.entries()) {
    if (i > 0) await page.getByRole('button', { name: 'Add traveller' }).click()
    await page.getByLabel('Name', { exact: true }).fill(m.name)
    for (const c of m.cultures) await page.getByRole('button', { name: CULTURE_LABEL[c] }).click()
    for (const t of m.interests) await page.getByRole('button', { name: t, exact: true }).click()
    if (m.region) await page.getByRole('radio', { name: m.region }).click()
  }
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible()
  await page.getByRole('button', { name: 'Generate My Journey' }).focus()
  await page.keyboard.press('Enter')
  await page.waitForURL(/\/journey\/\d+$/, { timeout: 30_000 })
  await page.waitForLoadState('networkidle')
  expect(posts).toEqual(['/api/parties', '/api/trips/generate'])
  const id = Number(page.url().split('/').pop())
  const trip = await (await page.request.get(`http://127.0.0.1:8000/api/trips/${id}`)).json()
  return { id, trip }
}

function checkBudget(trip: any) {
  const b = trip.budget
  const acts = b.activities.items.reduce((s: number, i: any) => s + i.subtotal, 0)
  expect(acts).toBeCloseTo(b.activities.total, 2)
  expect(b.subtotal).toBeCloseTo(b.activities.total + b.transportation.total + b.accommodation.total + b.meals.total, 2)
  expect(b.total).toBeCloseTo(b.subtotal + b.contingency, 2)
  expect(b.per_person).toBeCloseTo(b.total / trip.party.members.length, 2)
  const slugs = trip.stops.map((s: any) => s.experience.slug)
  expect(new Set(slugs).size).toBe(slugs.length)
  expect(b.activities.items.length).toBe(slugs.length)
}

test('Scenario A — four mixed travellers drive from Toronto', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  const { trip } = await buildParty(page, {
    name: 'Scenario A', city: 'Toronto', month: 'Jul',
    members: [
      { name: 'Bob', cultures: ['indigenous'], interests: ['Cold Weather', 'Fishing', 'Indigenous Culture'] },
      { name: 'Sarah', cultures: ['french'], interests: ['Cheese', 'Food Tasting'] },
      { name: 'Alex', cultures: ['british'], interests: ['Animals', 'History'] },
      { name: 'Priya', cultures: ['immigrant'], interests: ['Traditional Crafts', 'Rural Life'] },
    ],
  })
  for (const n of ['Bob', 'Sarah', 'Alex', 'Priya']) await expect(page.getByText(`For ${n}`, { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your shared itinerary' })).toBeVisible()
  await expect(page.getByTestId('budget-total')).toBeVisible()
  expect(new Set(trip.stops.map((s: any) => s.experience.region)).size).toBe(1)
  expect(trip.stops.every((s: any) => s.day_number >= 1 && s.day_number <= 3)).toBe(true)
  expect(trip.travel.effective_method).toBe('car')
  expect(trip.budget.vehicles).toBe(1)
  checkBudget(trip)
  expect(errors).toEqual([])
})

test('Scenario B — regional preference with flights', async ({ page }) => {
  const { trip } = await buildParty(page, {
    name: 'Scenario B', city: 'Toronto', plane: true, month: 'Aug',
    members: [
      { name: 'Ana', cultures: ['british', 'french'], interests: ['History', 'Rural Life'], region: 'Atlantic Canada' },
      { name: 'Ben', cultures: ['french'], interests: ['Food Tasting', 'Scenic Landscapes'] },
    ],
  })
  expect(trip.primary_region).toBe('atlantic')
  const ana = trip.recommendations.find((r: any) => r.member_name === 'Ana')
  expect(ana.region_match).toBe(true)
  expect(trip.travel.effective_method).toBe('plane')
  expect(trip.travel.outbound_hours).toBeLessThanOrEqual(6.5)
  const fare = trip.budget.transportation.items.find((i: any) => i.label.includes('airfare'))
  expect(fare.amount).toBeCloseTo(trip.assumptions.airfare_per_person * 2, 2)
  await expect(page.getByText(/Fly YYZ →/)).toBeVisible()
  checkBudget(trip)
})

test('Scenario C — overlapping interests share one destination, charged once', async ({ page }) => {
  const { trip } = await buildParty(page, {
    name: 'Scenario C', city: 'Ottawa', month: 'Sep',
    members: [
      { name: 'Lee', cultures: ['british'], interests: ['Farming', 'Animals'] },
      { name: 'Mia', cultures: ['british'], interests: ['History', 'Farming'] },
      { name: 'Noah', cultures: ['british'], interests: ['Animals', 'Rural Life'] },
    ],
  })
  const slugs = trip.recommendations.map((r: any) => r.experience_slug)
  const shared = slugs.find((s: string, i: number) => slugs.indexOf(s) !== i)
  expect(shared).toBeTruthy()
  const line = trip.budget.activities.items.find((i: any) => i.slug === shared)
  if (line.basis === 'per_person' && line.unit_price != null && line.pricing_status !== 'free') {
    expect(line.subtotal).toBeCloseTo(line.unit_price * 3, 2)
  }
  const texts = trip.recommendations.map((r: any) => r.explanation)
  expect(new Set(texts).size).toBe(3)
  for (const r of trip.recommendations) expect(r.explanation).toContain(r.member_name)
  await expect(page.getByText(/Also recommended for/).first()).toBeVisible()
  checkBudget(trip)

  const before = trip.budget.total
  const food = page.getByRole('spinbutton', { name: 'Food per person / day' })
  await food.scrollIntoViewIfNeeded()
  const patched = page.waitForResponse((r) => r.url().includes(`/api/trips/${trip.id}/assumptions`) && r.request().method() === 'PATCH')
  await food.fill('100')
  expect((await patched).status()).toBe(200)
  const after = (await (await page.request.get(`http://127.0.0.1:8000/api/trips/${trip.id}`)).json()).budget
  expect(after.total).not.toBe(before)
  expect(after.meals.total).toBe(100 * trip.party.members.length * trip.duration_days)
  await expect(page.getByTestId('budget-total')).toHaveText(new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(after.total))
})

test('validation blocks missing details', async ({ page }) => {
  await page.goto('/plan')
  await page.evaluate(() => sessionStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('Choose where your journey begins.')).toBeVisible()
  await expect(page.getByText('Choose a travel month.')).toBeVisible()
})

test('saved journeys reload from SQLite and pages work on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/trips')
  await expect(page.getByRole('heading', { name: 'Your planned trips' })).toBeVisible()
  await page.getByRole('link', { name: 'Open' }).first().click()
  await expect(page.getByRole('heading', { name: 'A highlight for every traveller' })).toBeVisible()
  for (const path of ['/', '/plan', '/destinations', page.url().replace('http://localhost:5173', '')]) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(overflow, `horizontal overflow on ${path}`).toBe(false)
  }
})
