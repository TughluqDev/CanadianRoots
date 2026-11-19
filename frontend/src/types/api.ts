// Mirrors backend/app/schemas.py. Keep in sync when the API contract changes.

export type InterestId =
  | 'cold_weather' | 'warm_weather' | 'adventure' | 'relaxation' | 'nature' | 'hiking' | 'fishing'
  | 'animals' | 'farming' | 'fruit_picking' | 'cheese' | 'food_tasting' | 'cooking' | 'history'
  | 'photography' | 'indigenous_culture' | 'cultural_festivals' | 'traditional_crafts'
  | 'rural_life' | 'scenic_landscapes'
export type CultureId = 'indigenous' | 'british' | 'french' | 'immigrant'
export type RegionId = 'central' | 'atlantic' | 'prairies' | 'northern' | 'west_coast'
export type TransportMethod = 'car' | 'plane'
export type BudgetPreference = 'economy' | 'moderate' | 'premium'
export type PricingStatus = 'verified' | 'estimate' | 'free' | 'unavailable'

export interface Option<T extends string | number = string> { id: T; label: string }

export interface PreferencesResponse {
  interests: Option<InterestId>[]
  cultures: Option<CultureId>[]
  budget_preferences: Option<BudgetPreference>[]
  months: Option<number>[]
}

export interface Region {
  id: RegionId
  name: string
  provinces: { code: string; name: string }[]
}

export interface City {
  id: string
  name: string
  province: string
  province_name: string
  latitude: number
  longitude: number
  airport: string | null
}

export interface Source { url: string; title: string | null; publisher: string | null; accessed: string | null }

export interface Experience {
  id: number
  slug: string
  name: string
  address: string | null
  city: string
  province: string
  region: RegionId
  latitude: number
  longitude: number
  primary_culture: CultureId
  cultures: CultureId[]
  community: string | null
  tags: InterestId[]
  short_description: string
  description: string
  agricultural_significance: string
  cultural_context: string
  food_spotlight_name: string | null
  food_spotlight_description: string | null
  food_included_in_admission: boolean
  activities: string[]
  visit_duration_hours: number
  available_months: number[]
  season_notes: string | null
  pricing_status: PricingStatus
  adult_price_cad: number | null
  child_price_cad: number | null
  price_basis: 'per_person' | 'per_group'
  pricing_notes: string | null
  pricing_source_url: string | null
  website: string | null
  image_url: string | null
  image_page_url: string | null
  image_author: string | null
  image_license: string | null
  image_caption: string | null
  verified_at: string | null
  sources: Source[]
}

export interface MemberInput {
  name: string
  interests: InterestId[]
  cultures: CultureId[]
  preferred_region: RegionId | null
}

export interface PartyInput {
  name: string | null
  starting_city_id: string
  transportation_method: TransportMethod
  departure_month: number | null
  departure_date: string | null
  budget_preference: BudgetPreference | null
  members: MemberInput[]
}

export interface Member extends MemberInput { id: number }

export interface Party extends Omit<PartyInput, 'members' | 'departure_month'> {
  id: number
  starting_city: string
  starting_province: string
  origin_latitude: number
  origin_longitude: number
  departure_month: number
  created_at: string
  members: Member[]
}

export interface TripStop {
  id: number
  day_number: number
  visit_order: number
  party_activity_cost: number
  travel_km_from_previous: number
  travel_hours_from_previous: number
  previous_label: string | null
  experience: Experience
}

export interface Recommendation {
  member_id: number
  member_name: string
  experience_slug: string | null
  score: number
  explanation: string
  matched_interests: InterestId[]
  matched_cultures: CultureId[]
  region_match: boolean
  unmet: string[]
}

export interface Flight {
  from: { code: string; city: string; province: string }
  to: { code: string; city: string; province: string }
  km: number
  hours: number
  to_airport_hours: number
  /** Slug of the stop this flight leads to; null for the flight home. */
  before_stop: string | null
}

export interface Travel {
  method: TransportMethod
  effective_method: TransportMethod
  origin: { city: string; province: string; latitude: number; longitude: number }
  origin_airport?: { code: string; city: string }
  arrival_airport?: { code: string; city: string; province: string }
  flight_km?: number
  flight_hours?: number
  pre_flight_hours?: number
  no_flight_reason?: string
  regions?: RegionId[]
  flights?: Flight[]
  return_flight?: boolean
  ground_km: number
  outbound_hours: number
  return_hours: number
  return_km: number
  return_label: string
  considerations: string[]
}

export interface Assumptions {
  fuel_price_per_litre: number
  fuel_consumption_l_per_100km: number
  vehicle_capacity: number
  parking_misc_per_vehicle_per_day: number
  airfare_per_person: number
  airport_transfer_per_person: number
  rental_car_per_day: number
  nightly_room_rate: number
  room_occupancy: number
  accommodation_tax_rate: number
  daily_food_per_person: number
  contingency_rate: number
}

export interface ActivityLine {
  slug: string
  name: string
  pricing_status: PricingStatus
  unit_price: number | null
  basis: 'per_person' | 'per_group'
  travellers: number
  subtotal: number
  note: string
}

export interface Budget {
  currency: 'CAD'
  travellers: number
  vehicles: number
  activities: { items: ActivityLine[]; total: number }
  transportation: { method: TransportMethod; items: { label: string; detail: string; amount: number }[]; total: number }
  accommodation: {
    nights: number; rooms: number; occupancy: number; nightly_rate: number
    subtotal_before_tax: number; tax_rate: number; tax: number; total: number
  }
  meals: { days: number; travellers: number; daily_per_person: number; total: number; note: string }
  subtotal: number
  contingency_rate: number
  contingency: number
  total: number
  per_person: number
  tax_note: string
  disclaimer: string
}

export interface Trip {
  id: number
  generated_at: string
  primary_region: RegionId | null
  regions: RegionId[]
  duration_days: number
  currency: 'CAD'
  estimated_total: number
  party: Party
  stops: TripStop[]
  recommendations: Recommendation[]
  travel: Travel
  assumptions: Assumptions
  budget: Budget
  notes: string[]
}

export interface TripSummary {
  id: number
  generated_at: string
  party_id: number
  party_name: string | null
  starting_city: string
  primary_region: RegionId | null
  regions: RegionId[]
  duration_days: number
  transportation_method: TransportMethod
  party_size: number
  estimated_total: number
  stop_count: number
  cover_image_url: string | null
  stop_names: string[]
}
