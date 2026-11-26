import { X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ExperienceCard } from '@/components/common/ExperienceCard'
import { EmptyState, ErrorState } from '@/components/common/StateViews'
import { DestinationFeature } from '@/components/journey/DestinationFeature'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/primitives'
import { useExperiences } from '@/hooks/useReferenceData'
import { CULTURE_META, REGION_NAMES } from '@/lib/domain'
import { MONTHS } from '@/lib/utils'
import type { CultureId, RegionId } from '@/types/api'

export function DestinationsPage() {
  const experiences = useExperiences()
  const [params, setParams] = useSearchParams()
  const region = params.get('region') as RegionId | null
  const culture = params.get('culture') as CultureId | null
  const month = Number(params.get('month')) || null
  const openSlug = params.get('open')

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value === null) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const filtered = useMemo(() => (experiences.data ?? []).filter((e) =>
    (!region || e.region === region) && (!culture || e.cultures.includes(culture)) && (!month || e.available_months.includes(month)),
  ), [experiences.data, region, culture, month])
  const open = experiences.data?.find((e) => e.slug === openSlug)

  return (
    <div className="pt-6">
      <div className="container-page">
        <header className="max-w-2xl">
          <h1 className="text-2xl font-bold">Destinations</h1>
          <p className="mt-2 text-ink-soft">Find farms and heritage sites by region, culture or season.</p>
        </header>

        <div className="mt-4 flex flex-wrap items-end gap-3 border border-cream-300 bg-cream-50 p-3">
          <div className="text-sm">
            <label htmlFor="region-filter" className="mb-1 block font-semibold">Region</label>
            <select id="region-filter" value={region ?? ''} onChange={(e) => set('region', e.target.value || null)}
              className="filter-select">
              <option value="">All regions</option>
              {(Object.keys(REGION_NAMES) as RegionId[]).map((r) => (
                <option key={r} value={r}>{REGION_NAMES[r]}</option>
              ))}
            </select>
          </div>
          <div className="text-sm">
            <label htmlFor="culture-filter" className="mb-1 block font-semibold">Heritage</label>
            <select id="culture-filter" value={culture ?? ''} onChange={(e) => set('culture', e.target.value || null)}
              className="filter-select">
              <option value="">All cultures</option>
              {(Object.keys(CULTURE_META) as CultureId[]).map((c) => (
                <option key={c} value={c}>{CULTURE_META[c].short}</option>
              ))}
            </select>
          </div>
          <div className="text-sm">
            <label htmlFor="month-filter" className="mb-1 block font-semibold">Open in</label>
            <select id="month-filter" value={month ?? ''} onChange={(e) => set('month', e.target.value || null)}
              className="filter-select">
              <option value="">Any month</option>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          {(region || culture || month) && <Button variant="outline" size="sm" onClick={() => setParams({}, { replace: true })}>Clear filters</Button>}
        </div>

        <p className="mt-6 text-sm text-ink-soft" aria-live="polite">{experiences.data ? `${filtered.length} destination${filtered.length === 1 ? '' : 's'}` : ''}</p>
        <div className="mt-4">
          {experiences.error ? (
            <ErrorState message={experiences.error.message} onRetry={() => void experiences.refetch()} />
          ) : experiences.isPending ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[420px]" />)}</div>
          ) : experiences.data.length === 0 ? (
            <EmptyState title="No destinations yet" message="The database is empty. Run python scripts/seed_database.py to import the researched destinations." />
          ) : filtered.length === 0 ? (
            <EmptyState title="Nothing matches those filters" message="Try another month or region."
              action={<Button variant="outline" onClick={() => setParams({}, { replace: true })}>Clear filters</Button>} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((e) => <ExperienceCard key={e.slug} exp={e} onOpen={() => set('open', e.slug)} />)}
            </div>
          )}
        </div>
      </div>

      <Dialog.Root open={!!open} onOpenChange={(o) => { if (!o) set('open', null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[1600] bg-forest-900/60" />
          <Dialog.Content className="fixed inset-x-3 top-[4vh] bottom-[4vh] z-[1700] mx-auto max-w-4xl overflow-y-auto rounded bg-cream p-4 focus:outline-none sm:inset-x-6 sm:p-6">
            {open && (
              <>
                <div className="mb-6 flex items-center justify-between gap-4">
                  <Dialog.Title className="font-sans text-sm font-semibold tracking-wide text-terracotta uppercase">{REGION_NAMES[open.region]}</Dialog.Title>
                  <Dialog.Close asChild><Button variant="outline" size="icon" aria-label="Close"><X /></Button></Dialog.Close>
                </div>
                <Dialog.Description className="sr-only">Details for {open.name}</Dialog.Description>
                <DestinationFeature exp={open} />
                <div className="mt-10 flex justify-center"><Button asChild variant="accent" size="lg"><Link to="/plan">Plan a journey</Link></Button></div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
