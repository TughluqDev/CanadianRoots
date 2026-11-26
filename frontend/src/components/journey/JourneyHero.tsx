import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { regionList } from '@/lib/domain'
import { money, MONTHS } from '@/lib/utils'
import type { Trip } from '@/types/api'

export function JourneyHero({ trip }: { trip: Trip }) {
  const { party, budget, travel } = trip
  const region = regionList(trip.regions, trip.primary_region)
  const when = party.departure_date
    ? new Date(`${party.departure_date}T12:00:00`).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
    : MONTHS[party.departure_month - 1]
  const facts = [
    { label: 'From', value: `${party.starting_city}, ${party.starting_province}` },
    { label: 'When', value: when },
    { label: 'Travellers', value: party.members.length },
    { label: 'Length', value: `${trip.duration_days} day${trip.duration_days === 1 ? '' : 's'}` },
    { label: 'Stops', value: trip.stops.length },
    { label: 'Travel', value: travel.effective_method === 'plane' ? 'Fly and drive' : 'Road trip' },
    { label: 'Estimated total', value: money(budget.total) },
  ]

  return (
    <section className="border-b border-cream-300 bg-cream-200">
      <div className="container-page py-6">
        <h1 className="text-2xl font-bold sm:text-3xl">{party.name || `${party.starting_city} to ${region}`}</h1>
        <p className="mt-1 text-sm text-ink-soft">{region}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-7">
          {facts.map(({ label, value }) => (
            <div key={label}>
              <dt className="text-ink-soft">{label}</dt>
              <dd className="font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="no-print mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link to={`/plan?party=${party.id}`}>Adjust party</Link></Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>Print itinerary</Button>
        </div>
      </div>
    </section>
  )
}
