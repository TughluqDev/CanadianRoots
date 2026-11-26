import { ChevronDown, Info, MapPin, Utensils } from 'lucide-react'
import { useState } from 'react'
import { CultureBadge, InterestBadge, MemberAvatar } from '@/components/common/badges'
import { Card } from '@/components/ui/primitives'
import { cn, money } from '@/lib/utils'
import type { Member, Recommendation, TripStop } from '@/types/api'

interface Props {
  member: Member
  index: number
  rec: Recommendation
  stop: TripStop | undefined
}

export function RecommendationCard({ member, index, rec, stop }: Props) {
  const [showNotes, setShowNotes] = useState(false)
  const exp = stop?.experience
  const matched = new Set<string>(rec.matched_interests)

  return (
    <Card className="flex h-full flex-col p-4">
      <div className="mb-2 flex items-center gap-2 text-sm">
        <MemberAvatar name={member.name} index={index} size="sm" />
        <span className="font-semibold text-forest">For {member.name}</span>
        {stop && <span className="ml-auto text-ink-soft">Day {stop.day_number}</span>}
      </div>
      <div className="flex flex-1 flex-col">
        <h3 className="text-lg font-semibold">{exp ? exp.name : 'No close match on this route'}</h3>
        {exp && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
            <MapPin className="size-3.5" aria-hidden />{exp.city}, {exp.province}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {member.cultures.map((c) => <CultureBadge key={c} culture={c} className={cn(!rec.matched_cultures.includes(c) && 'opacity-50')} />)}
          {member.interests.slice(0, 6).map((t) => <InterestBadge key={t} id={t} highlighted={matched.has(t)} />)}
        </div>
        <p className="mt-3 text-sm text-ink">{rec.explanation}</p>

        {exp?.food_spotlight_name && (
          <div className="mt-4 rounded-xl bg-gold-100/70 p-3.5">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[#7a5a17] uppercase">
              <Utensils className="size-3.5" aria-hidden />Food spotlight
            </p>
            <p className="mt-1 text-sm font-semibold text-forest-900">{exp.food_spotlight_name}</p>
          </div>
        )}

        <div className="mt-auto pt-5">
          {stop && (
            <div className="flex items-center justify-between border-t border-cream-300/70 pt-4 text-sm">
              <span className="text-ink-soft">Shared activity cost</span>
              <span className="font-semibold text-forest-900">{money(stop.party_activity_cost)}</span>
            </div>
          )}
          {rec.unmet.length > 0 && (
            <div className="mt-3">
              <button type="button" onClick={() => setShowNotes((s) => !s)} aria-expanded={showNotes}
                className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-forest hover:text-terracotta">
                <Info className="size-4" aria-hidden />
                {rec.unmet.length} planning note{rec.unmet.length > 1 ? 's' : ''}
                <ChevronDown className={cn('size-4 transition', showNotes && 'rotate-180')} aria-hidden />
              </button>
              {showNotes && (
                <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-ink-soft">
                  {rec.unmet.map((u) => <li key={u} className="border-l-2 border-gold pl-3">{u}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
