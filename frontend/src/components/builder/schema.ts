import { z } from 'zod'
import type { Party, PartyInput } from '@/types/api'

const interestIds = [
  'cold_weather', 'warm_weather', 'adventure', 'relaxation', 'nature', 'hiking', 'fishing', 'animals',
  'farming', 'fruit_picking', 'cheese', 'food_tasting', 'cooking', 'history', 'photography',
  'indigenous_culture', 'cultural_festivals', 'traditional_crafts', 'rural_life', 'scenic_landscapes',
] as const

export const memberSchema = z.object({
  key: z.string(),
  name: z.string().trim().min(1, 'Every traveller needs a name.').max(80, 'Keep names under 80 characters.'),
  interests: z.array(z.enum(interestIds)),
  cultures: z.array(z.enum(['indigenous', 'british', 'french', 'immigrant'])).min(1, 'Choose at least one cultural influence.'),
  preferred_region: z.enum(['central', 'atlantic', 'prairies', 'northern', 'west_coast']).nullable(),
})

const todayIso = () => new Date().toISOString().slice(0, 10)

export const partySchema = z
  .object({
    name: z.string().max(120, 'Keep the trip name under 120 characters.'),
    starting_city_id: z.string().min(1, 'Choose where your journey begins.'),
    transportation_method: z.enum(['car', 'plane']),
    timing: z.enum(['month', 'date']),
    departure_month: z.number().int().min(1).max(12).nullable(),
    departure_date: z.string(),
    budget_preference: z.enum(['economy', 'moderate', 'premium']).nullable(),
    members: z.array(memberSchema).min(1, 'Add at least one traveller.'),
  })
  .superRefine((v, ctx) => {
    if (v.timing === 'month' && !v.departure_month) {
      ctx.addIssue({ code: 'custom', path: ['departure_month'], message: 'Choose a travel month.' })
    }
    if (v.timing === 'date') {
      if (!v.departure_date) ctx.addIssue({ code: 'custom', path: ['departure_date'], message: 'Choose a departure date.' })
      else if (v.departure_date < todayIso()) ctx.addIssue({ code: 'custom', path: ['departure_date'], message: 'Departure date can’t be in the past.' })
    }
  })

export type PartyForm = z.infer<typeof partySchema>
export type MemberForm = z.infer<typeof memberSchema>

let counter = 0
export const newKey = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`

export const emptyMember = (): MemberForm => ({ key: newKey(), name: '', interests: [], cultures: [], preferred_region: null })

export function defaultPartyForm(): PartyForm {
  return {
    name: '',
    starting_city_id: '',
    transportation_method: 'car',
    timing: 'month',
    departure_month: null,
    departure_date: '',
    budget_preference: 'moderate',
    members: [emptyMember()],
  }
}

export function toPartyInput(form: PartyForm): PartyInput {
  return {
    name: form.name.trim() || null,
    starting_city_id: form.starting_city_id,
    transportation_method: form.transportation_method,
    departure_month: form.timing === 'month' ? form.departure_month : null,
    departure_date: form.timing === 'date' ? form.departure_date : null,
    budget_preference: form.budget_preference,
    members: form.members.map(({ name, interests, cultures, preferred_region }) => ({
      name: name.trim(), interests, cultures, preferred_region,
    })),
  }
}

export function fromParty(p: Party): PartyForm {
  const dateStillValid = p.departure_date && p.departure_date >= todayIso()
  return {
    name: p.name ?? '',
    starting_city_id: p.starting_city_id,
    transportation_method: p.transportation_method,
    timing: dateStillValid ? 'date' : 'month',
    departure_month: p.departure_month,
    departure_date: dateStillValid ? p.departure_date! : '',
    budget_preference: p.budget_preference,
    members: p.members.map((m) => ({
      key: newKey(), name: m.name, interests: m.interests, cultures: m.cultures, preferred_region: m.preferred_region,
    })),
  }
}
