import { CalendarDays, Car, Clock, MapPin, Pencil, Plane, Wallet } from 'lucide-react'
import type * as React from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { CultureBadge, InterestBadge, MemberAvatar } from '@/components/common/badges'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/primitives'
import { REGION_NAMES } from '@/lib/domain'
import { MONTHS } from '@/lib/utils'
import type { City } from '@/types/api'
import type { PartyForm } from './schema'

function Fact({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sage-100 text-forest"><Icon className="size-4" /></span>
      <div>
        <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
        <p className="font-semibold text-forest-900">{value}</p>
      </div>
    </div>
  )
}

export function ReviewStep({ cities, onEdit }: { cities: City[]; onEdit: (step: number) => void }) {
  const { control } = useFormContext<PartyForm>()
  const v = useWatch({ control }) as PartyForm
  const city = cities.find((c) => c.id === v.starting_city_id)
  const when = v.timing === 'date' && v.departure_date
    ? new Date(`${v.departure_date}T12:00:00`).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
    : v.departure_month ? MONTHS[v.departure_month - 1] : 'Not set'

  return (
    <div className="space-y-6">
      <Card className="p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h3 className="text-2xl font-medium">{v.name?.trim() || 'Your journey'}</h3>
          <Button variant="ghost" size="sm" onClick={() => onEdit(0)}><Pencil />Edit</Button>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Fact icon={MapPin} label="Starting from" value={city ? `${city.name}, ${city.province}` : 'Not set'} />
          <Fact icon={v.transportation_method === 'plane' ? Plane : Car} label="Travel" value={v.transportation_method === 'plane' ? 'Fly & drive' : 'Road trip'} />
          <Fact icon={CalendarDays} label="When" value={when} />
          <Fact icon={Clock} label="Length" value="Calculated for you" />
        </div>
        {v.budget_preference && (
          <p className="mt-6 flex items-center gap-2 text-sm text-ink-soft">
            <Wallet className="size-4 text-terracotta" aria-hidden /> <span className="capitalize">{v.budget_preference}</span> budget style
          </p>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="text-xl font-medium">{v.members?.length} traveller{v.members?.length === 1 ? '' : 's'}</h3>
        <Button variant="ghost" size="sm" onClick={() => onEdit(1)}><Pencil />Edit party</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {v.members?.map((m, i) => (
          <Card key={m.key} className="p-5">
            <div className="flex items-center gap-3">
              <MemberAvatar name={m.name} index={i} />
              <div>
                <p className="font-display text-lg font-medium text-forest-900">{m.name}</p>
                <p className="text-xs text-muted">{m.preferred_region ? `Prefers ${REGION_NAMES[m.preferred_region]}` : 'Open to any region'}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {m.cultures.map((c) => <CultureBadge key={c} culture={c} />)}
              {m.interests.map((t) => <InterestBadge key={t} id={t} />)}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
