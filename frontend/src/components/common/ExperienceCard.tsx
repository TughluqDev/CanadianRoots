import { CalendarRange, MapPin, Utensils } from 'lucide-react'
import { CultureBadge, PricingBadge } from '@/components/common/badges'
import { SmartImage } from '@/components/common/SmartImage'
import { Card } from '@/components/ui/primitives'
import { REGION_NAMES } from '@/lib/domain'
import { monthRange } from '@/lib/utils'
import type { Experience } from '@/types/api'

export function ExperienceCard({ exp, onOpen }: { exp: Experience; onOpen?: () => void }) {
  const Wrapper = onOpen ? 'button' : 'div'
  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
      <Wrapper {...(onOpen ? { type: 'button' as const, onClick: onOpen } : {})} className="block w-full cursor-pointer text-left">
        <div className="relative">
          <SmartImage src={exp.image_url} alt={exp.image_caption ?? exp.name} region={exp.region} className="aspect-[4/3]"
            imgClassName="transition-transform duration-700 group-hover:scale-105" />
          <span className="absolute top-4 left-4 rounded-full bg-cream/95 px-3 py-1 text-xs font-semibold text-forest shadow-soft">
            {REGION_NAMES[exp.region]}
          </span>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap gap-1.5">{exp.cultures.map((c) => <CultureBadge key={c} culture={c} />)}</div>
          <h3 className="mt-3 text-xl leading-snug font-medium group-hover:text-terracotta-700">{exp.name}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft"><MapPin className="size-3.5" aria-hidden />{exp.city}, {exp.province}</p>
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink-soft">{exp.short_description}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-cream-300/70 pt-4 text-xs text-ink-soft">
            <span className="flex items-center gap-1.5"><CalendarRange className="size-3.5 text-sage" aria-hidden />{monthRange(exp.available_months)}</span>
            {exp.food_spotlight_name && <span className="flex min-w-0 items-center gap-1.5"><Utensils className="size-3.5 shrink-0 text-sage" aria-hidden /><span className="truncate">{exp.food_spotlight_name}</span></span>}
            <PricingBadge status={exp.pricing_status} />
          </div>
        </div>
      </Wrapper>
    </Card>
  )
}
