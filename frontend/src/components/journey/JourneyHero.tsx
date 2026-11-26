import { CalendarDays, Car, Clock, MapPin, Pencil, Plane, Printer, Users } from 'lucide-react'
import type * as React from 'react'
import { Link } from 'react-router'
import { SmartImage } from '@/components/common/SmartImage'
import { Button } from '@/components/ui/button'
import { regionList } from '@/lib/domain'
import { money, MONTHS } from '@/lib/utils'
import type { Trip } from '@/types/api'

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="size-5 text-gold" aria-hidden />
      <div>
        <p className="text-[11px] font-semibold tracking-[0.14em] text-cream/60 uppercase">{label}</p>
        <p className="font-semibold text-cream">{value}</p>
      </div>
    </div>
  )
}

export function JourneyHero({ trip }: { trip: Trip }) {
  const { party, budget, travel } = trip
  const cover = trip.stops.find((s) => s.experience.image_url)?.experience
  const region = regionList(trip.regions, trip.primary_region)
  const flights = travel.flights ?? []
  const when = party.departure_date
    ? new Date(`${party.departure_date}T12:00:00`).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
    : MONTHS[party.departure_month - 1]

  return (
    <section className="relative isolate overflow-hidden bg-forest-900 pt-28 pb-14 text-cream sm:pb-20">
      <SmartImage src={cover?.image_url} alt="" region={trip.primary_region} eager className="absolute inset-0 -z-20 h-full w-full" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-forest-900 via-forest-900/75 to-forest-900/30" />
      <div className="container-page">
        <div className="no-print mb-10 flex flex-wrap gap-2">
          <Button asChild variant="glass" size="sm"><Link to={`/plan?party=${party.id}`}><Pencil />Adjust party</Link></Button>
          <Button variant="glass" size="sm" onClick={() => window.print()}><Printer />Print itinerary</Button>
        </div>
        <p className="eyebrow mb-4 text-gold">Your journey · {region}</p>
        <h1 className="max-w-4xl text-4xl leading-[1.05] font-medium text-cream sm:text-6xl">
          {party.name || `${party.starting_city} to ${region}`}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-cream/80">
          {trip.stops.length} stop{trip.stops.length === 1 ? '' : 's'} across {trip.duration_days} day
          {trip.duration_days === 1 ? '' : 's'}.
        </p>
        <div className="mt-10 grid gap-6 rounded-2xl border border-white/15 bg-white/8 p-6 backdrop-blur-md sm:grid-cols-3 lg:grid-cols-[repeat(5,auto)_1fr] lg:items-center lg:gap-10">
          <Stat icon={MapPin} label="From" value={`${party.starting_city}, ${party.starting_province}`} />
          <Stat icon={Users} label="Party" value={`${party.members.length} traveller${party.members.length === 1 ? '' : 's'}`} />
          <Stat icon={Clock} label="Length" value={`${trip.duration_days} day${trip.duration_days === 1 ? '' : 's'}`} />
          <Stat icon={CalendarDays} label="When" value={when} />
          <Stat icon={travel.effective_method === 'plane' ? Plane : Car} label="Travel"
            value={travel.effective_method !== 'plane' ? 'Road trip' : flights.length > 2 ? `${flights.length} flights` : `Fly to ${travel.arrival_airport?.code}`} />
          <div className="lg:text-right">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-cream/60 uppercase">Estimated total</p>
            <p className="font-display text-3xl font-medium text-gold">{money(budget.total)}</p>
            <p className="text-xs text-cream/60">{money(budget.per_person)} per person · CAD</p>
          </div>
        </div>
      </div>
    </section>
  )
}
