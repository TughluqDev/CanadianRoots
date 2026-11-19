import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Car, Plane, Trash2, Users } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState, ErrorState } from '@/components/common/StateViews'
import { SmartImage } from '@/components/common/SmartImage'
import { Button } from '@/components/ui/button'
import { Card, Skeleton } from '@/components/ui/primitives'
import { regionList } from '@/lib/domain'
import { money } from '@/lib/utils'
import { api } from '@/services/api'

export function SavedTripsPage() {
  const qc = useQueryClient()
  const trips = useQuery({ queryKey: ['trips'], queryFn: api.trips })
  const remove = useMutation({
    mutationFn: api.deleteTrip,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['trips'] }),
  })

  return (
    <div className="container-page pt-28">
      <header className="mb-10 max-w-2xl">
        <p className="eyebrow mb-3">Saved journeys</p>
        <h1 className="text-4xl leading-tight font-medium sm:text-5xl">Your planned trips</h1>
        <p className="mt-4 text-lg text-ink-soft">Every journey you generate is stored locally in SQLite and can be reopened any time.</p>
      </header>
      {trips.error ? (
        <ErrorState message={trips.error.message} onRetry={() => void trips.refetch()} />
      ) : trips.isPending ? (
        <div className="grid gap-6 md:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-64" />)}</div>
      ) : trips.data.length === 0 ? (
        <EmptyState title="No journeys yet" message="Build a party and generate your first Canadian Roots journey."
          action={<Button asChild><Link to="/plan">Plan your journey</Link></Button>} />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {trips.data.map((t) => (
            <Card key={t.id} className="group grid overflow-hidden transition hover:shadow-lift sm:grid-cols-[180px_1fr]">
              <SmartImage src={t.cover_image_url} alt="" region={t.primary_region} className="aspect-[16/9] sm:aspect-auto sm:h-full" />
              <div className="flex flex-col p-5">
                <p className="text-xs font-semibold text-terracotta">
                  {regionList(t.regions, t.primary_region)} · {new Date(t.generated_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <h2 className="mt-1 text-xl font-medium">{t.party_name || `From ${t.starting_city}`}</h2>
                <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{t.stop_names.join(' · ')}</p>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-ink-soft">
                  <span className="flex items-center gap-1.5"><Users className="size-4 text-sage" aria-hidden />{t.party_size}</span>
                  <span className="flex items-center gap-1.5">{t.transportation_method === 'plane' ? <Plane className="size-4 text-sage" aria-hidden /> : <Car className="size-4 text-sage" aria-hidden />}{t.duration_days} day{t.duration_days > 1 ? 's' : ''}</span>
                  <span className="font-semibold text-forest-900">{money(t.estimated_total)}</span>
                </div>
                <div className="mt-auto flex items-center justify-between pt-4">
                  <Button asChild size="sm"><Link to={`/journey/${t.id}`}>Open<ArrowRight /></Link></Button>
                  <Button variant="danger" size="icon" aria-label={`Delete ${t.party_name || 'journey'}`} disabled={remove.isPending}
                    onClick={() => { if (window.confirm('Delete this saved journey?')) remove.mutate(t.id) }}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
