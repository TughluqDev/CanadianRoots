import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { api } from '@/services/api'
import type { CultureId, InterestId } from '@/types/api'

const STATIC = { staleTime: Infinity, gcTime: Infinity }

export const usePreferences = () => useQuery({ queryKey: ['preferences'], queryFn: api.preferences, ...STATIC })
export const useRegions = () => useQuery({ queryKey: ['regions'], queryFn: api.regions, ...STATIC })
export const useCities = () => useQuery({ queryKey: ['cities'], queryFn: api.cities, ...STATIC })
export const useExperiences = () => useQuery({ queryKey: ['experiences'], queryFn: api.experiences, staleTime: 5 * 60_000 })

export function usePreferenceLabels() {
  const { data } = usePreferences()
  const interestLabel = useCallback(
    (id: InterestId) => data?.interests.find((i) => i.id === id)?.label ?? id.replace(/_/g, ' '),
    [data],
  )
  const cultureLabel = useCallback(
    (id: CultureId) => data?.cultures.find((c) => c.id === id)?.label ?? id,
    [data],
  )
  return { interestLabel, cultureLabel }
}
