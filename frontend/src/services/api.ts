import type {
  Assumptions, City, Experience, Party, PartyInput, PreferencesResponse, Region, Trip, TripSummary,
} from '@/types/api'

const BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').trim().replace(/\/+$/, '')
if (import.meta.env.PROD && !BASE) {
  console.error('VITE_API_BASE_URL is not set; API requests will go to this site instead of the backend.')
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
  } catch {
    throw new ApiError(
      import.meta.env.DEV
        ? "We can't reach the Canadian Roots server. Is the backend running on port 8000?"
        : "We can't reach the Canadian Roots server right now. Please try again in a moment.",
      0,
    )
  }
  if (res.status === 204) return undefined as T
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
  }
  if (!res.ok) {
    const detail = (body as { detail?: unknown } | null)?.detail
    const message = typeof detail === 'string' ? detail : 'Something went wrong. Please try again.'
    throw new ApiError(message, res.status)
  }
  return body as T
}

export const api = {
  health: () => request<{ status: string; experiences: number }>('/api/health'),
  preferences: () => request<PreferencesResponse>('/api/preferences'),
  regions: () => request<Region[]>('/api/regions'),
  cities: () => request<City[]>('/api/cities'),
  experiences: () => request<Experience[]>('/api/experiences'),
  experience: (slug: string) => request<Experience>(`/api/experiences/${encodeURIComponent(slug)}`),
  createParty: (data: PartyInput) => request<Party>('/api/parties', { method: 'POST', body: JSON.stringify(data) }),
  party: (id: number) => request<Party>(`/api/parties/${id}`),
  generateTrip: (partyId: number) =>
    request<Trip>('/api/trips/generate', { method: 'POST', body: JSON.stringify({ party_id: partyId }) }),
  trip: (id: number) => request<Trip>(`/api/trips/${id}`),
  trips: () => request<TripSummary[]>('/api/trips'),
  deleteTrip: (id: number) => request<void>(`/api/trips/${id}`, { method: 'DELETE' }),
  updateAssumptions: (id: number, patch: Partial<Assumptions>) =>
    request<Trip>(`/api/trips/${id}/assumptions`, { method: 'PATCH', body: JSON.stringify(patch) }),
}
