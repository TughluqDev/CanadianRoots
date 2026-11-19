import type { City, Experience, PreferencesResponse, Region, Trip } from '@/types/api'

export const preferences: PreferencesResponse = {
  interests: [
    { id: 'cheese', label: 'Cheese' }, { id: 'history', label: 'History' },
    { id: 'animals', label: 'Animals' }, { id: 'fishing', label: 'Fishing' },
  ],
  cultures: [
    { id: 'indigenous', label: 'Indigenous Influences' }, { id: 'british', label: 'British Influences' },
    { id: 'french', label: 'French Influences' }, { id: 'immigrant', label: 'Immigrant Influences' },
  ],
  budget_preferences: [{ id: 'moderate', label: 'Moderate' }],
  months: [],
}

export const regions: Region[] = [
  { id: 'central', name: 'Central Canada', provinces: [] },
  { id: 'atlantic', name: 'Atlantic Canada', provinces: [] },
]

export const cities: City[] = [
  { id: 'toronto', name: 'Toronto', province: 'ON', province_name: 'Ontario', latitude: 43.65, longitude: -79.38, airport: 'YYZ' },
  { id: 'ottawa', name: 'Ottawa', province: 'ON', province_name: 'Ontario', latitude: 45.42, longitude: -75.7, airport: 'YOW' },
]

const exp = (slug: string, name: string): Experience => ({
  id: 1, slug, name, address: '1 Farm Rd', city: 'Ottawa', province: 'ON', region: 'central',
  latitude: 45.38, longitude: -75.71, primary_culture: 'british', cultures: ['british'], community: null,
  tags: ['animals', 'history'], short_description: 'A working farm.', description: 'Long description.',
  agricultural_significance: 'Ag significance.', cultural_context: 'Cultural context.',
  food_spotlight_name: 'Heritage Ice Cream', food_spotlight_description: 'Made on site.',
  food_included_in_admission: false, activities: ['Barn tour'], visit_duration_hours: 2.5,
  available_months: [5, 6, 7, 8, 9], season_notes: null, pricing_status: 'verified', adult_price_cad: 15,
  child_price_cad: null, price_basis: 'per_person', pricing_notes: null, pricing_source_url: 'https://example.org',
  website: 'https://example.org', image_url: null, image_page_url: null, image_author: null, image_license: null,
  image_caption: null, verified_at: '2026-11-18', sources: [{ url: 'https://example.org', title: 'Official', publisher: null, accessed: null }],
})

export const trip: Trip = {
  id: 7, generated_at: '2026-11-18T12:00:00', primary_region: 'central', currency: 'CAD', estimated_total: 1234.5,
  party: {
    id: 3, name: 'Harvest Crew', starting_city_id: 'ottawa', starting_city: 'Ottawa', starting_province: 'ON',
    origin_latitude: 45.42, origin_longitude: -75.7, transportation_method: 'car', departure_month: 7,
    departure_date: null, trip_duration_days: 2, budget_preference: 'moderate', created_at: '2026-11-18T12:00:00',
    members: [
      { id: 1, name: 'Lee', interests: ['animals'], cultures: ['british'], preferred_region: null },
      { id: 2, name: 'Mia', interests: ['history'], cultures: ['british'], preferred_region: 'central' },
    ],
  },
  stops: [{
    id: 11, day_number: 1, visit_order: 1, party_activity_cost: 30, travel_km_from_previous: 5,
    travel_hours_from_previous: 0.1, previous_label: 'Ottawa, ON', experience: exp('ag-museum', 'Test Agriculture Museum'),
  }],
  recommendations: [
    { member_id: 1, member_name: 'Lee', experience_slug: 'ag-museum', score: 60, explanation: 'Because Lee enjoys being around animals, Test Agriculture Museum is a natural fit.', matched_interests: ['animals'], matched_cultures: ['british'], region_match: false, unmet: [] },
    { member_id: 2, member_name: 'Mia', experience_slug: 'ag-museum', score: 85, explanation: 'Mia’s love of history points straight to Test Agriculture Museum.', matched_interests: ['history'], matched_cultures: ['british'], region_match: true, unmet: ['Interests not covered on this route: Fishing.'] },
  ],
  travel: {
    method: 'car', effective_method: 'car', origin: { city: 'Ottawa', province: 'ON', latitude: 45.42, longitude: -75.7 },
    ground_km: 20, outbound_hours: 0.1, return_hours: 0.1, return_km: 6, return_label: 'Ottawa, ON', considerations: ['Distances are approximate.'],
  },
  assumptions: {
    fuel_price_per_litre: 1.6, fuel_consumption_l_per_100km: 9, vehicle_capacity: 5, parking_misc_per_vehicle_per_day: 15,
    airfare_per_person: 0, airport_transfer_per_person: 40, rental_car_per_day: 80, nightly_room_rate: 185,
    room_occupancy: 2, accommodation_tax_rate: 0.15, daily_food_per_person: 75, contingency_rate: 0.1,
  },
  budget: {
    currency: 'CAD', travellers: 2, vehicles: 1,
    activities: { items: [{ slug: 'ag-museum', name: 'Test Agriculture Museum', pricing_status: 'verified', unit_price: 15, basis: 'per_person', travellers: 2, subtotal: 30, note: '' }], total: 30 },
    transportation: { method: 'car', items: [{ label: 'Fuel (round trip)', detail: '≈20 km', amount: 2.88 }, { label: 'Parking & incidentals', detail: '', amount: 30 }], total: 32.88 },
    accommodation: { nights: 1, rooms: 1, occupancy: 2, nightly_rate: 185, subtotal_before_tax: 185, tax_rate: 0.15, tax: 27.75, total: 212.75 },
    meals: { days: 2, travellers: 2, daily_per_person: 75, total: 300, note: 'Allowance.' },
    subtotal: 575.63, contingency_rate: 0.1, contingency: 57.56, total: 633.19, per_person: 316.6,
    tax_note: 'Tax note.', disclaimer: 'Prices are estimates for trip-planning purposes and are not live booking quotes.',
  },
  notes: ['Confirm hours before visiting.'],
}
