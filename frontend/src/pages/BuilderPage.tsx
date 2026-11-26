import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { GeneratingOverlay } from '@/components/builder/GeneratingOverlay'
import { PartyBuilder } from '@/components/builder/PartyBuilder'
import { defaultPartyForm, fromParty, toPartyInput, type PartyForm } from '@/components/builder/schema'
import { ErrorState } from '@/components/common/StateViews'
import { Skeleton } from '@/components/ui/primitives'
import { useCities, usePreferences, useRegions } from '@/hooks/useReferenceData'
import { api } from '@/services/api'

const DRAFT_KEY = 'canadian-roots:draft'

function readDraft(): { values: PartyForm; step: number } | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as { values: PartyForm; step: number }) : null
  } catch {
    return null
  }
}

export function BuilderPage() {
  const [params] = useSearchParams()
  const partyId = Number(params.get('party')) || null
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const prefs = usePreferences()
  const regions = useRegions()
  const cities = useCities()
  const party = useQuery({ queryKey: ['party', partyId], queryFn: () => api.party(partyId!), enabled: !!partyId })

  const generate = useMutation({
    mutationFn: async (values: PartyForm) => {
      const created = await api.createParty(toPartyInput(values))
      return api.generateTrip(created.id)
    },
    onSuccess: (trip) => {
      queryClient.setQueryData(['trip', trip.id], trip)
      void queryClient.invalidateQueries({ queryKey: ['trips'] })
      try { sessionStorage.removeItem(DRAFT_KEY) } catch {}
      navigate(`/journey/${trip.id}`)
    },
  })

  const saveDraft = useCallback((values: PartyForm, step: number) => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ values, step })) } catch {}
  }, [])

  const initial = useMemo(() => {
    if (partyId) return party.data ? { values: fromParty(party.data), step: 1 } : null
    return readDraft() ?? { values: defaultPartyForm(), step: 0 }
  }, [partyId, party.data])

  const loading = prefs.isPending || regions.isPending || cities.isPending || (!!partyId && party.isPending)
  const error = prefs.error ?? regions.error ?? cities.error ?? party.error

  return (
    <div className="py-6">
      <div className="container-page max-w-5xl">
        <header className="mb-5">
          <h1 className="text-2xl font-bold">Plan a journey</h1>
        </header>
        {error ? (
          <ErrorState message={error.message} onRetry={() => { void prefs.refetch(); void regions.refetch(); void cities.refetch(); void party.refetch() }} />
        ) : loading || !initial ? (
          <div className="space-y-4" aria-busy="true" aria-label="Loading planner">
            <Skeleton className="h-16" />
            <Skeleton className="h-[480px]" />
          </div>
        ) : (
          <PartyBuilder
            key={partyId ?? 'new'}
            cities={cities.data!}
            preferences={prefs.data!}
            regions={regions.data!}
            initialValues={initial.values}
            initialStep={initial.step}
            submitting={generate.isPending}
            submitError={generate.error?.message ?? null}
            onSubmit={(v) => generate.mutate(v)}
            onDraftChange={partyId ? undefined : saveDraft}
          />
        )}
      </div>
      {generate.isPending && <GeneratingOverlay />}
    </div>
  )
}
