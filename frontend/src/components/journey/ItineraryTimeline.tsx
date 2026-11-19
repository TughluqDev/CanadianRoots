import { Car, Clock, Home, Landmark, Plane, Utensils } from 'lucide-react'
import { MemberAvatar } from '@/components/common/badges'
import { SmartImage } from '@/components/common/SmartImage'
import { Card } from '@/components/ui/primitives'
import { hours, money } from '@/lib/utils'
import type { Member, Recommendation, Trip, TripStop } from '@/types/api'

function TravelLeg({ km, h, from }: { km: number; h: number; from: string | null }) {
  return (
    <div className="flex items-center gap-2 py-3 pl-1 text-sm text-ink-soft">
      <Car className="size-4 text-sage" aria-hidden />
      <span>≈ {Math.round(km)} km · about {hours(h)}{from ? ` from ${from}` : ''}</span>
    </div>
  )
}

function StopCard({ stop, members, recs }: { stop: TripStop; members: Member[]; recs: Recommendation[] }) {
  const exp = stop.experience
  const forWhom = recs.filter((r) => r.experience_slug === exp.slug)
  return (
    <Card className="grid overflow-hidden sm:grid-cols-[200px_1fr]">
      <SmartImage src={exp.image_url} alt={exp.name} region={exp.region} className="aspect-[16/9] sm:aspect-auto sm:h-full" />
      <div className="p-5">
        <a href={`#dest-${exp.slug}`} className="font-display text-xl font-medium text-forest-900 hover:text-terracotta">{exp.name}</a>
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

export function ItineraryTimeline({ trip }: { trip: Trip }) {
  const days = Array.from({ length: trip.party.trip_duration_days }, (_, i) => i + 1)
  const plane = trip.travel.effective_method === 'plane'
  return (
    <ol className="relative space-y-10 border-l-2 border-dashed border-sage/60 pl-6 sm:pl-10">
      {days.map((day) => {
        const stops = trip.stops.filter((s) => s.day_number === day)
        const isFirst = day === 1
        const isLast = day === trip.party.trip_duration_days
        return (
          <li key={day} className="relative">
            <span className="absolute top-0 -left-[35px] flex size-12 items-center justify-center rounded-full bg-forest font-display text-lg text-gold ring-8 ring-cream sm:-left-[51px]">
              {day}
            </span>
            <h3 className="pt-2 text-2xl font-medium">Day {day}</h3>
            {isFirst && plane && trip.travel.origin_airport && (
              <p className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
                <Plane className="size-4 text-terracotta" aria-hidden />
                Fly {trip.travel.origin_airport.code} → {trip.travel.arrival_airport?.code} (≈ {hours(trip.travel.flight_hours ?? 0)} incl. airport time), pick up the rental car.
              </p>
            )}
            <div className="mt-4 space-y-1">
              {stops.length === 0 && (
                <p className="rounded-xl border border-dashed border-cream-300 p-4 text-sm text-ink-soft">
                  Unscheduled time — linger at local markets, revisit a favourite, or rest before the drive.
                </p>
              )}
              {stops.map((s) => (
                <div key={s.id}>
                  <TravelLeg km={s.travel_km_from_previous} h={s.travel_hours_from_previous} from={s.previous_label} />
                  <StopCard stop={s} members={trip.party.members} recs={trip.recommendations} />
                </div>
              ))}
              {isLast && (
                <div className="flex items-center gap-2 pt-4 text-sm text-ink-soft">
                  <Home className="size-4 text-terracotta" aria-hidden />
                  Head home: ≈ {Math.round(trip.travel.return_km)} km to {trip.travel.return_label}
                  {plane ? `, then fly back to ${trip.travel.origin_airport?.city}` : ''} (about {hours(trip.travel.return_hours)} total).
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
