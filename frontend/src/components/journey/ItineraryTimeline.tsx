import { Car, Clock, Home, Landmark, Plane, Utensils } from 'lucide-react'
import { MemberAvatar } from '@/components/common/badges'
import { SmartImage } from '@/components/common/SmartImage'
import { Card } from '@/components/ui/primitives'
import { hours, money } from '@/lib/utils'
import type { Flight, Member, Recommendation, TravelSegment, Trip, TripStop } from '@/types/api'

function FlightLeg({ flight, first }: { flight: Flight; first: boolean }) {
  return (
    <p className="mt-2 flex items-center gap-2 py-1 text-sm text-ink-soft">
      <Plane className="size-4 text-terracotta" aria-hidden />
      Fly {flight.from.code} → {flight.to.code} (≈ {hours(flight.hours)} incl. airport time)
      {first ? ', pick up the rental car.' : `, continuing to ${flight.to.city}.`}
    </p>
  )
}

function TravelLeg({ km, h, from }: { km: number; h: number; from: string | null }) {
  return (
    <div className="flex items-center gap-2 py-3 pl-1 text-sm text-ink-soft">
      <Car className="size-4 text-sage" aria-hidden />
      <span>Total drive: ≈ {Math.round(km)} km · about {hours(h)}{from ? ` from ${from}` : ''}</span>
    </div>
  )
}

function StopCard({ stop, members, recs }: { stop: TripStop; members: Member[]; recs: Recommendation[] }) {
  const exp = stop.experience
  const forWhom = recs.filter((r) => r.experience_slug === exp.slug)
  return (
    <Card className="grid overflow-hidden sm:grid-cols-[200px_1fr]">
      <SmartImage src={exp.image_url} alt={exp.name} className="aspect-[16/9] sm:aspect-auto sm:h-full" />
      <div className="p-5">
        <a href={`#dest-${exp.slug}`} className="text-xl font-medium text-forest-900 hover:text-terracotta">{exp.name}</a>
        <p className="text-sm text-ink-soft">{exp.city}, {exp.province}</p>
        <p className="mt-3 text-sm leading-relaxed text-ink">
          <span className="font-semibold">Main activity:</span> {exp.activities[0] ?? exp.short_description}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
          <span className="flex items-center gap-1.5"><Clock className="size-4 text-sage" aria-hidden />≈ {hours(exp.visit_duration_hours)}</span>
          {exp.food_spotlight_name && <span className="flex items-center gap-1.5"><Utensils className="size-4 text-sage" aria-hidden />{exp.food_spotlight_name}</span>}
          <span className="flex items-center gap-1.5 font-semibold text-forest-900">{money(stop.party_activity_cost)} for the party</span>
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-sm leading-relaxed text-ink-soft">
          <Landmark className="mt-0.5 size-4 shrink-0 text-sage" aria-hidden />{exp.short_description}
        </p>
        {forWhom.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <div className="flex -space-x-2">
              {forWhom.map((r) => {
                const idx = members.findIndex((m) => m.id === r.member_id)
                return <MemberAvatar key={r.member_id} name={r.member_name} index={idx} size="sm" />
              })}
            </div>
            <span className="text-xs text-ink-soft">Top pick for {forWhom.map((r) => r.member_name).join(', ')}</span>
          </div>
        )}
      </div>
    </Card>
  )
}

function ScheduledTravel({ segment, trip }: { segment: TravelSegment; trip: Trip }) {
  const stop = trip.stops.find((item) => item.experience.slug === segment.before_stop)
  const destination = stop?.experience.name ?? trip.travel.origin.city
  const arrives = !trip.travel.segments?.some((later) =>
    later.before_stop === segment.before_stop && later.day > segment.day,
  )
  const flight = segment.flight
  const usesFlight = trip.travel.flights?.some((item) => item.before_stop === segment.before_stop)
  const verb = usesFlight ? 'Travel' : 'Drive'
  const label = arrives && !stop ? verb + ' home' : verb + (arrives ? ' to ' : ' toward ') + destination
  const Icon = flight ? Plane : arrives && !stop ? Home : usesFlight ? Clock : Car

  return (
    <p className="flex items-center gap-2 py-3 pl-1 text-sm text-ink-soft">
      <Icon className="size-4 shrink-0 text-sage" aria-hidden />
      <span>
        {flight ? <>Fly {flight.from} → {flight.to}, travelling {arrives ? 'to' : 'toward'} {destination}</> : label}
        {' · '}about {hours(segment.hours)} today
      </span>
    </p>
  )
}

export function ItineraryTimeline({ trip }: { trip: Trip }) {
  const days = Array.from({ length: trip.duration_days }, (_, i) => i + 1)
  const flights = trip.travel.flights ?? []
  const flightTo = (slug: string) => flights.find((f) => f.before_stop === slug)
  const legacyFlight = trip.travel.effective_method === 'plane' && flights.length === 0 && trip.travel.origin_airport
  const flyHome = trip.travel.return_flight ?? trip.travel.effective_method === 'plane'
  const segments = trip.travel.segments
  const stopCard = (stop: TripStop) => <StopCard stop={stop} members={trip.party.members} recs={trip.recommendations} />
  return (
    <ol className="space-y-5">
      {days.map((day) => {
        const stops = trip.stops.filter((s) => s.day_number === day)
        const travelToday = segments?.filter((segment) => segment.day === day) ?? []
        const nextStop = trip.stops.find((stop) => stop.day_number > day)
        const isFirst = day === 1
        const isLast = day === trip.duration_days
        return (
          <li key={day} className="border border-cream-300 bg-cream-50 p-3">
            <h3 className="border-b border-cream-300 pb-2 text-lg font-bold">Day {day}</h3>
            {!segments && isFirst && legacyFlight && (
              <p className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
                <Plane className="size-4 text-terracotta" aria-hidden />
                Fly {trip.travel.origin_airport!.code} → {trip.travel.arrival_airport?.code} (≈ {hours(trip.travel.flight_hours ?? 0)} incl. airport time), pick up the rental car.
              </p>
            )}
            <div className="mt-1 space-y-1">
              {!segments && stops.length === 0 && !isLast && (
                <p className="py-2 text-sm text-ink-soft">
                  Travel day. {nextStop ? <>Heading toward {nextStop.experience.name}.</> : <>Heading home to {trip.travel.origin.city}.</>}
                </p>
              )}
              {travelToday.filter((segment) => !stops.some((stop) => stop.experience.slug === segment.before_stop)
                && segment.before_stop !== null).map((segment) => (
                <ScheduledTravel key={segment.before_stop} segment={segment} trip={trip} />
              ))}
              {stops.map((stop) => {
                const flight = flightTo(stop.experience.slug)
                const arrival = travelToday.find((segment) => segment.before_stop === stop.experience.slug)
                return (
                  <div key={stop.id}>
                    {arrival && <ScheduledTravel segment={arrival} trip={trip} />}
                    {!segments && (
                      <>
                        {flight && <FlightLeg flight={flight} first={flight === flights[0]} />}
                        <TravelLeg km={stop.travel_km_from_previous} h={stop.travel_hours_from_previous} from={stop.previous_label} />
                      </>
                    )}
                    {stopCard(stop)}
                  </div>
                )
              })}
              {travelToday.filter((segment) => segment.before_stop === null).map((segment) => (
                <ScheduledTravel key="return" segment={segment} trip={trip} />
              ))}
              {!segments && isLast && (
                <div className="flex items-center gap-2 pt-4 text-sm text-ink-soft">
                  <Home className="size-4 text-terracotta" aria-hidden />
                  Return trip total: ≈ {Math.round(trip.travel.return_km)} km to {trip.travel.return_label}
                  {flyHome ? `, then fly back to ${trip.travel.origin_airport?.city}` : ''} (about {hours(trip.travel.return_hours)} total).
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
