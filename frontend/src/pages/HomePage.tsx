import { Link, useNavigate } from 'react-router'
import { ExperienceCard } from '@/components/common/ExperienceCard'
import { SmartImage } from '@/components/common/SmartImage'
import { PhotoCredit } from '@/components/journey/DestinationFeature'
import { Button } from '@/components/ui/button'
import { SectionHeading } from '@/components/ui/primitives'
import { useExperiences } from '@/hooks/useReferenceData'
import { CULTURE_META } from '@/lib/domain'
import type { CultureId } from '@/types/api'

export function HomePage() {
  const experiences = useExperiences()
  const navigate = useNavigate()
  const destinations = experiences.data ?? []
  const cover = destinations.find((exp) => exp.slug === 'grand-pre-national-historic-site' && exp.image_url)
  const featured = destinations.filter((exp) => exp.image_url).slice(0, 3)

  return (
    <div className="container-page space-y-8 py-8">
      <section className="grid items-start gap-5 border border-cream-300 bg-cream-50 p-5 sm:grid-cols-2">
        <div>
          <h1 className="text-2xl font-bold">Plan a farm and food trip in Canada</h1>
          <p className="mt-2 text-ink-soft">
            Find farms, sugar shacks, heritage villages and Indigenous-led sites that match your group’s interests.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild><Link to="/plan">Plan Your Journey</Link></Button>
            <Button asChild variant="outline"><Link to="/destinations">Browse destinations</Link></Button>
          </div>
        </div>
        {cover && (
          <figure>
            <SmartImage src={cover.image_url} alt={cover.image_caption ?? cover.name} className="aspect-[16/9]" />
            <PhotoCredit exp={cover} className="mt-1" />
          </figure>
        )}
      </section>

      <section>
        <SectionHeading title="How it works" />
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-soft">
          <li>Add your travellers and their interests.</li>
          <li>Choose when and how you want to travel.</li>
          <li>Review your stops, itinerary and estimated costs.</li>
        </ol>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionHeading title="Featured destinations" />
          <Link to="/destinations" className="text-sm font-semibold text-forest underline">See all destinations</Link>
        </div>
        {experiences.isPending ? (
          <p className="mt-3 text-sm text-ink-soft">Loading destinations…</p>
        ) : experiences.error ? (
          <p className="mt-3 text-sm text-ink-soft">{experiences.error.message}</p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((exp) => (
              <ExperienceCard key={exp.slug} exp={exp} onOpen={() => navigate(`/destinations?open=${exp.slug}`)} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading title="Browse by culture" />
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {(Object.keys(CULTURE_META) as CultureId[]).map((culture) => (
            <li key={culture}>
              <Link to={`/destinations?culture=${culture}`} className="text-forest underline">
                {CULTURE_META[culture].short}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
