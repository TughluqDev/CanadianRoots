import { ArrowRight, Map, Sparkles, Users } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { ExperienceCard } from '@/components/common/ExperienceCard'
import { SmartImage } from '@/components/common/SmartImage'
import { PhotoCredit } from '@/components/journey/DestinationFeature'
import { Button } from '@/components/ui/button'
import { Card, SectionHeading, Skeleton } from '@/components/ui/primitives'
import { useExperiences } from '@/hooks/useReferenceData'
import { CULTURE_META, REGION_NAMES } from '@/lib/domain'
import type { CultureId, Experience, RegionId } from '@/types/api'

const HERO_SLUG = 'grand-pre-national-historic-site'
const REGION_ORDER: RegionId[] = ['central', 'atlantic', 'prairies', 'west_coast', 'northern']

/** One photographed destination per region first, then fill to six. Deterministic. */
function featured(list: Experience[]): Experience[] {
  const withImg = list.filter((e) => e.image_url)
  const picks: Experience[] = []
  for (const r of REGION_ORDER) {
    const e = withImg.find((x) => x.region === r && !picks.includes(x))
    if (e) picks.push(e)
  }
  for (const e of withImg) if (picks.length < 6 && !picks.includes(e)) picks.push(e)
  return picks.slice(0, 6)
}

const STEPS = [
  { icon: Users, title: 'Build your party', text: 'Add every traveller with their interests, the heritages they’re curious about, and an optional favourite region.' },
  { icon: Sparkles, title: 'We match & route', text: 'A transparent scoring engine finds real destinations that satisfy the group — open in your month and reachable in your timeframe.' },
  { icon: Map, title: 'Explore & budget', text: 'Get a day-by-day plan, food spotlights, cultural context and an itemized CAD budget you can fine-tune.' },
]

export function HomePage() {
  const experiences = useExperiences()
  const navigate = useNavigate()
  const hero = experiences.data?.find((e) => e.slug === HERO_SLUG && e.image_url) ?? experiences.data?.find((e) => e.image_url)
  const picks = useMemo(() => featured(experiences.data ?? []), [experiences.data])
  const count = experiences.data?.length

  return (
    <>
      <section className="relative isolate flex min-h-[92vh] items-end overflow-hidden bg-forest-900 pt-32 pb-16 sm:pb-24">
        <SmartImage src={hero?.image_url} alt={hero?.image_caption ?? 'Canadian countryside'} region="atlantic" eager
          className="absolute inset-0 -z-20" imgClassName="scale-105 animate-[fade-in_1.2s_ease_both]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-forest-900 via-forest-900/55 to-forest-900/20" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-forest-900/60 to-transparent" />
        <div className="container-page">
          <div className="max-w-3xl animate-fade-up">
            <p className="eyebrow mb-5 text-gold">Agritourism across Canada</p>
            <h1 className="text-5xl leading-[1.02] font-medium text-cream sm:text-7xl">
              Discover Canada through its land, food, and cultures.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-cream/85">
              Plan a shared journey to real farms, sugar shacks, heritage villages and Indigenous-led experiences —
              personalized for every member of your party.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="gold"><Link to="/plan">Plan Your Journey<ArrowRight /></Link></Button>
              <Button asChild size="lg" variant="glass"><Link to="/destinations">Browse destinations</Link></Button>
            </div>
          </div>
          <div className="mt-16 flex flex-wrap items-end justify-between gap-6">
            <dl className="flex flex-wrap gap-x-10 gap-y-4 text-cream">
              <div><dt className="text-xs tracking-[0.16em] text-cream/60 uppercase">Researched destinations</dt><dd className="font-display text-3xl">{count ?? '—'}</dd></div>
              <div><dt className="text-xs tracking-[0.16em] text-cream/60 uppercase">Regions</dt><dd className="font-display text-3xl">5</dd></div>
              <div><dt className="text-xs tracking-[0.16em] text-cream/60 uppercase">Cultural heritages</dt><dd className="font-display text-3xl">4</dd></div>
            </dl>
            {hero && (
              <div className="max-w-xs text-right text-xs text-cream/60">
                <p>{hero.name}, {hero.province}</p>
                <PhotoCredit exp={hero} className="text-cream/50 [&_a]:hover:text-gold" />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="container-page py-24">
        <SectionHeading eyebrow="How it works" title="One trip, shaped around everyone" />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Card key={s.title} className="paper-grain relative p-7">
              <span className="absolute top-6 right-7 font-display text-5xl text-cream-300">{i + 1}</span>
              <span className="flex size-12 items-center justify-center rounded-2xl bg-forest text-gold"><s.icon className="size-5" aria-hidden /></span>
              <h3 className="mt-6 text-2xl font-medium">{s.title}</h3>
              <p className="mt-3 leading-relaxed text-ink-soft">{s.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-cream-200/60 py-24">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading eyebrow="Featured destinations" title="Real places with deep roots">
              Every destination is sourced from official and heritage organizations, with seasons and prices labelled honestly.
            </SectionHeading>
            <Button asChild variant="outline"><Link to="/destinations">See all {count ?? ''}<ArrowRight /></Link></Button>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {experiences.isPending
              ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[420px]" />)
              : experiences.error
                ? <p className="text-ink-soft">{experiences.error.message}</p>
                : picks.map((e) => <ExperienceCard key={e.slug} exp={e} onOpen={() => navigate(`/destinations?open=${e.slug}`)} />)}
          </div>
        </div>
      </section>

      <section className="container-page py-24">
        <SectionHeading eyebrow="Four threads of heritage" title="Taste the cultures that shaped Canadian farming" />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(CULTURE_META) as CultureId[]).map((c) => (
            <Card key={c} className="p-6 transition hover:-translate-y-1 hover:shadow-lift">
              <span className={`block h-1.5 w-12 rounded-full ${CULTURE_META[c].dot}`} />
              <h3 className="mt-5 text-xl font-medium">{CULTURE_META[c].short} influences</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{CULTURE_META[c].blurb}</p>
              <p className="mt-4 text-xs font-semibold text-forest">{experiences.data?.filter((e) => e.cultures.includes(c)).length ?? '—'} destinations</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="container-page">
        <div className="relative overflow-hidden rounded-3xl bg-forest px-8 py-14 text-cream sm:px-14">
          <div className="absolute -top-24 -right-24 size-80 rounded-full bg-gold/15" aria-hidden />
          <div className="absolute -bottom-32 right-40 size-72 rounded-full bg-terracotta/20" aria-hidden />
          <div className="relative max-w-2xl">
            <h2 className="text-3xl leading-tight font-medium text-cream sm:text-5xl">From {REGION_NAMES.atlantic} dykelands to Okanagan vineyards.</h2>
            <p className="mt-4 text-lg text-cream/80">Start with who’s coming. We’ll handle the matching, the route and the math.</p>
            <Button asChild size="lg" variant="gold" className="mt-8"><Link to="/plan">Plan Your Journey<ArrowRight /></Link></Button>
          </div>
        </div>
      </section>
    </>
  )
}
