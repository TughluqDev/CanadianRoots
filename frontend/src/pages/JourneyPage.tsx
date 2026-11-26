import { useQuery } from '@tanstack/react-query'
import { Lightbulb, RefreshCw } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { Link, useParams } from 'react-router'
import { ErrorState } from '@/components/common/StateViews'
import { BudgetPanel } from '@/components/journey/BudgetPanel'
import { DestinationFeature } from '@/components/journey/DestinationFeature'
import { ItineraryTimeline } from '@/components/journey/ItineraryTimeline'
import { JourneyHero } from '@/components/journey/JourneyHero'
import { RecommendationCard } from '@/components/journey/RecommendationCard'
import { Button } from '@/components/ui/button'
import { Card, SectionHeading, Skeleton } from '@/components/ui/primitives'
import { api, ApiError } from '@/services/api'
import type { Trip } from '@/types/api'

const RouteMap = lazy(() => import('@/components/journey/RouteMap'))

const SECTIONS = [
  { id: 'for-you', label: 'For each traveller' },
  { id: 'destinations', label: 'Destinations' },
  { id: 'map', label: 'Map' },
  { id: 'itinerary', label: 'Itinerary' },
  { id: 'budget', label: 'Budget' },
]

function JourneySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading journey">
      <div className="h-[460px] animate-pulse bg-forest-900/90" />
      <div className="container-page mt-12 grid gap-6 md:grid-cols-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-96" />)}
      </div>
    </div>
  )
}

function JourneyContent({ trip }: { trip: Trip }) {
  const stopBySlug = new Map(trip.stops.map((s) => [s.experience.slug, s]))
  const travellersFor = (slug: string) => trip.recommendations.filter((r) => r.experience_slug === slug).map((r) => r.member_name)

  return (
    <>
      <JourneyHero trip={trip} />
      <nav aria-label="Journey sections" className="no-print sticky top-[72px] z-[900] border-b border-cream-300/60 bg-cream/90 backdrop-blur-lg">
        <div className="container-page flex gap-1 overflow-x-auto py-2.5 [scrollbar-width:none]">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="shrink-0 rounded-full px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-forest/5 hover:text-forest">
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      <section id="for-you" className="container-page scroll-mt-36 pt-16">
        <SectionHeading eyebrow="Personalized for your party" title="A highlight for every traveller">
          Recommendations reflect each traveller’s preferences. The itinerary lists shared stops once.
        </SectionHeading>
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {trip.recommendations.map((r) => {
            const idx = trip.party.members.findIndex((m) => m.id === r.member_id)
            return <RecommendationCard key={r.member_id} rec={r} member={trip.party.members[idx]} index={idx}
              stop={r.experience_slug ? stopBySlug.get(r.experience_slug) : undefined} />
          })}
        </div>
      </section>

      <section id="destinations" className="scroll-mt-36 pt-24">
        <div className="container-page">
          <SectionHeading eyebrow="Explore your stops" title="Destinations">
            Check seasonal hours and programs before you visit.
          </SectionHeading>
          <div className="mt-14 space-y-24">
            {trip.stops.map((s, i) => (
              <DestinationFeature key={s.id} exp={s.experience} reverse={i % 2 === 1} travellers={travellersFor(s.experience.slug)} />
            ))}
          </div>
        </div>
      </section>

      <section id="map" className="container-page no-print scroll-mt-36 pt-24">
        <SectionHeading eyebrow="Where you’ll be" title="Your stops on the map">
          The map shows stop locations. The itinerary estimates driving distances from straight-line distances.
        </SectionHeading>
        <div className="mt-10">
          <Suspense fallback={<Skeleton className="h-[520px] rounded-3xl" />}>
            <RouteMap stops={trip.stops} travel={trip.travel} />
          </Suspense>
        </div>
      </section>

      <section id="itinerary" className="container-page scroll-mt-36 pt-24">
        <div className="grid gap-12 lg:grid-cols-[1fr_340px]">
          <div>
            <SectionHeading eyebrow="Day by day" title="Your shared itinerary" />
            <div className="mt-10 pl-6">
              <ItineraryTimeline trip={trip} />
            </div>
          </div>
          <aside className="space-y-4 lg:pt-24">
            <Card className="p-6">
              <h3 className="flex items-center gap-2 font-sans text-sm font-bold tracking-wide text-forest uppercase">
                <Lightbulb className="size-4 text-gold" aria-hidden />Travel considerations
              </h3>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink-soft">
                {trip.travel.considerations.map((c) => <li key={c} className="border-l-2 border-sage pl-3">{c}</li>)}
              </ul>
            </Card>
            {trip.notes.length > 0 && (
              <Card className="p-6">
                <h3 className="font-sans text-sm font-bold tracking-wide text-forest uppercase">Planning notes</h3>
                <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink-soft">
                  {trip.notes.map((n) => <li key={n} className="border-l-2 border-gold pl-3">{n}</li>)}
                </ul>
              </Card>
            )}
          </aside>
        </div>
      </section>

      <section id="budget" className="container-page scroll-mt-36 pt-24">
        <SectionHeading eyebrow="Trip budget" title="What it’s likely to cost">
          Adjust the estimates below. All amounts are in Canadian dollars.
        </SectionHeading>
        <div className="mt-10"><BudgetPanel trip={trip} /></div>
      </section>

      <section className="container-page no-print pt-20">
        <Card className="paper-grain flex flex-col items-start justify-between gap-6 p-8 sm:flex-row sm:items-center sm:p-10">
          <div>
            <h2 className="text-2xl font-medium sm:text-3xl">Want a different mix?</h2>
            <p className="mt-2 text-ink-soft">Edit your group or travel dates to plan a new trip.</p>
          </div>
          <Button asChild size="lg"><Link to={`/plan?party=${trip.party.id}`}><RefreshCw />Edit party & regenerate</Link></Button>
        </Card>
      </section>
    </>
  )
}

export function JourneyPage() {
  const { tripId } = useParams()
  const id = Number(tripId)
  const trip = useQuery({ queryKey: ['trip', id], queryFn: () => api.trip(id), enabled: Number.isInteger(id) && id > 0 })

  if (!Number.isInteger(id) || id <= 0 || (trip.error instanceof ApiError && trip.error.status === 404)) {
    return (
      <div className="container-page pt-36">
        <ErrorState title="Journey not found" message="This journey doesn’t exist or was deleted."
          action={<Button asChild variant="outline"><Link to="/plan">Plan a new journey</Link></Button>} />
      </div>
    )
  }
  if (trip.error) return <div className="container-page pt-36"><ErrorState message={trip.error.message} onRetry={() => void trip.refetch()} /></div>
  if (trip.isPending) return <JourneySkeleton />
  return <JourneyContent trip={trip.data} />
}
