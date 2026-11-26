import { CalendarRange, Clock, ExternalLink, Sprout, Landmark, Utensils, BookOpen } from 'lucide-react'
import { CultureBadge, PricingBadge } from '@/components/common/badges'
import { SmartImage } from '@/components/common/SmartImage'
import { cn, hours, money, monthRange } from '@/lib/utils'
import type { Experience } from '@/types/api'

export function PhotoCredit({ exp, className }: { exp: Experience; className?: string }) {
  if (!exp.image_url || !exp.image_author) return null
  return (
    <p className={cn('text-[11px] leading-snug text-ink-soft/80', className)}>
      Photo: {exp.image_page_url ? <a className="underline decoration-dotted hover:text-forest" href={exp.image_page_url} target="_blank" rel="noreferrer">{exp.image_author}</a> : exp.image_author}
      {exp.image_license && <> · {exp.image_license}</>}
      {exp.image_caption && <> · {exp.image_caption}</>}
    </p>
  )
}

export function priceText(exp: Experience): string {
  if (exp.pricing_status === 'free') return 'Free'
  if (exp.adult_price_cad == null) return 'Check with destination'
  return `${money(exp.adult_price_cad, true)}${exp.price_basis === 'per_group' ? ' per group' : ' per adult'}`
}

export function DestinationFeature({ exp, travellers }: { exp: Experience; travellers?: string[] }) {
  return (
    <article className="grid items-start gap-4 border border-cream-300 bg-cream-50 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]" id={`dest-${exp.slug}`}>
      <div>
        <SmartImage src={exp.image_url} alt={exp.image_caption ?? exp.name}
          className="aspect-[4/3] rounded" />
        <PhotoCredit exp={exp} className="mt-3 px-1" />
      </div>
      <div>
        <div className="flex flex-wrap gap-1.5">
          {exp.cultures.map((c) => <CultureBadge key={c} culture={c} />)}
        </div>
        <h3 className="mt-2 text-xl font-bold">{exp.name}</h3>
        <p className="mt-2 text-ink-soft">{exp.address ? `${exp.address} · ` : ''}{exp.city}, {exp.province}</p>
        {travellers && travellers.length > 0 && (
          <p className="mt-3 text-sm font-medium text-terracotta">Recommended for {travellers.join(', ')}</p>
        )}
        <p className="mt-3 text-sm leading-relaxed text-ink">{exp.description}</p>

        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-cream-300 pt-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase"><Clock className="size-3.5" aria-hidden />Visit</dt>
            <dd className="mt-1 font-semibold text-forest-900">≈ {hours(exp.visit_duration_hours)}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase"><CalendarRange className="size-3.5" aria-hidden />Season</dt>
            <dd className="mt-1 font-semibold text-forest-900">{monthRange(exp.available_months)}</dd>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <dt className="text-xs font-semibold tracking-wide text-muted uppercase">Admission</dt>
            <dd className="mt-1 font-semibold text-forest-900">{priceText(exp)}</dd>
            <dd className="mt-1"><PricingBadge status={exp.pricing_status} /></dd>
          </div>
        </dl>
        {(exp.season_notes || exp.pricing_notes) && (
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">{[exp.season_notes, exp.pricing_notes].filter(Boolean).join(' ')}</p>
        )}

        <div className="mt-4 space-y-4 text-sm">
          <section>
            <h4 className="flex items-center gap-2 font-sans text-sm font-bold tracking-wide text-forest uppercase"><Sprout className="size-4 text-sage" aria-hidden />Agricultural heritage</h4>
            <p className="mt-2 leading-relaxed text-ink-soft">{exp.agricultural_significance}</p>
          </section>
          <section>
            <h4 className="flex items-center gap-2 font-sans text-sm font-bold tracking-wide text-forest uppercase"><Landmark className="size-4 text-sage" aria-hidden />Cultural context</h4>
            <p className="mt-2 leading-relaxed text-ink-soft">{exp.cultural_context}</p>
            {exp.community && <p className="mt-2 text-sm text-ink-soft"><span className="font-semibold text-forest-900">Community:</span> {exp.community}</p>}
          </section>
          {exp.activities.length > 0 && (
            <section>
              <h4 className="font-sans text-sm font-bold tracking-wide text-forest uppercase">What you can do</h4>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {exp.activities.map((a) => (
                  <li key={a} className="flex gap-2.5 text-sm leading-relaxed text-ink"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-terracotta" aria-hidden />{a}</li>
                ))}
              </ul>
            </section>
          )}
          {exp.food_spotlight_name && (
            <section className="border-l-2 border-gold bg-gold-100 p-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-forest"><Utensils className="size-4" aria-hidden />Food spotlight</p>
              <p className="mt-1 font-semibold">{exp.food_spotlight_name}</p>
              {exp.food_spotlight_description && <p className="mt-2 leading-relaxed text-ink-soft">{exp.food_spotlight_description}</p>}
              <p className="mt-3 text-xs text-ink-soft">
                {exp.food_included_in_admission ? 'Included with admission.' : 'Tastings and purchases may cost extra.'}
              </p>
            </section>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          {exp.website && (
            <a href={exp.website} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 rounded bg-forest px-3 py-2 text-sm font-semibold text-cream transition hover:bg-forest-900">
              Official website<ExternalLink className="size-4" aria-hidden />
            </a>
          )}
          <details className="group text-sm">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-forest hover:text-terracotta">
              <BookOpen className="size-4" aria-hidden />Sources ({exp.sources.length}){exp.verified_at && <span className="text-muted"> · researched {exp.verified_at}</span>}
            </summary>
            <ul className="mt-3 space-y-1.5">
              {exp.sources.map((s) => (
                <li key={s.url}>
                  <a className="break-all text-ink-soft underline decoration-dotted hover:text-forest" href={s.url} target="_blank" rel="noreferrer">
                    {s.title ?? s.url}
                  </a>
                  {s.publisher && <span className="text-muted"> ({s.publisher})</span>}
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </article>
  )
}
