import { CalendarDays, Car, Plane } from 'lucide-react'
import type * as React from 'react'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { FieldError, Input, Label } from '@/components/ui/primitives'
import { cn, MONTHS } from '@/lib/utils'
import type { City } from '@/types/api'
import { CitySelect } from './CitySelect'
import type { PartyForm } from './schema'

function ChoiceCard({ selected, onSelect, icon: Icon, title, text, name }: {
  selected: boolean; onSelect: () => void; icon: React.ComponentType<{ className?: string }>; title: string; text: string; name: string
}) {
  return (
    <label
      className={cn(
        'relative flex cursor-pointer items-start gap-4 rounded-2xl border p-5 transition-all duration-200 focus-within:ring-4 focus-within:ring-forest/15',
        selected ? 'border-forest bg-forest text-cream shadow-lift' : 'border-cream-300 bg-white/70 hover:-translate-y-0.5 hover:border-forest/40 hover:shadow-soft',
      )}
    >
      <input type="radio" name={name} className="sr-only" checked={selected} onChange={onSelect} />
      <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', selected ? 'bg-cream/15 text-gold' : 'bg-sage-100 text-forest')}>
        <Icon className="size-5" />
      </span>
      <span>
        <span className="block font-display text-lg font-medium">{title}</span>
        <span className={cn('mt-1 block text-sm leading-relaxed', selected ? 'text-cream/80' : 'text-ink-soft')}>{text}</span>
      </span>
    </label>
  )
}

const BUDGETS = [
  { id: 'economy', title: 'Economy', text: 'Simple lodging, casual meals' },
  { id: 'moderate', title: 'Moderate', text: 'Comfortable inns, sit-down dinners' },
  { id: 'premium', title: 'Premium', text: 'Boutique stays, chef-led meals' },
] as const

export function TripDetailsStep({ cities }: { cities: City[] }) {
  const { register, control, setValue, formState: { errors } } = useFormContext<PartyForm>()
  const timing = useWatch({ control, name: 'timing' })
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-10">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <Label htmlFor="trip-name">Trip name <span className="font-normal text-muted">(optional)</span></Label>
          <Input id="trip-name" placeholder="e.g. Harvest Weekend with the Lees" {...register('name')} />
          <FieldError>{errors.name?.message}</FieldError>
        </div>
        <div>
          <Label>Starting city</Label>
          <Controller
            control={control}
            name="starting_city_id"
            render={({ field, fieldState }) => (
              <CitySelect cities={cities} value={field.value} onChange={field.onChange} invalid={!!fieldState.error} describedBy="city-help" />
            )}
          />
          <p id="city-help" className="mt-2 text-xs text-muted">We plan from {cities.length} supported Canadian cities with known coordinates.</p>
          <FieldError>{errors.starting_city_id?.message}</FieldError>
        </div>
      </div>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-forest-900">How will you travel?</legend>
        <Controller
          control={control}
          name="transportation_method"
          render={({ field }) => (
            <div className="grid gap-4 sm:grid-cols-2">
              <ChoiceCard name="transport" selected={field.value === 'car'} onSelect={() => field.onChange('car')} icon={Car}
                title="Road trip" text="One shared vehicle per five travellers; fuel and parking estimated for the whole party." />
              <ChoiceCard name="transport" selected={field.value === 'plane'} onSelect={() => field.onChange('plane')} icon={Plane}
                title="Fly & drive" text="Sample round-trip airfare per traveller, then a rental car from the arrival airport." />
            </div>
          )}
        />
      </fieldset>

      <fieldset>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <legend className="text-sm font-semibold text-forest-900">When are you going?</legend>
          <div className="inline-flex rounded-full border border-cream-300 bg-white/70 p-1 text-sm" role="group" aria-label="Choose month or exact date">
            {(['month', 'date'] as const).map((t) => (
              <button key={t} type="button" aria-pressed={timing === t} onClick={() => setValue('timing', t, { shouldValidate: false })}
                className={cn('cursor-pointer rounded-full px-4 py-1.5 font-medium transition', timing === t ? 'bg-forest text-cream' : 'text-ink-soft hover:text-forest')}>
                {t === 'month' ? 'Month' : 'Exact date'}
              </button>
            ))}
          </div>
        </div>
        {timing === 'month' ? (
          <Controller
            control={control}
            name="departure_month"
            render={({ field }) => (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6" role="radiogroup" aria-label="Travel month">
                {MONTHS.map((m, i) => (
                  <button key={m} type="button" role="radio" aria-checked={field.value === i + 1}
                    onClick={() => field.onChange(i + 1)}
                    className={cn('h-12 cursor-pointer rounded-xl border text-sm font-medium transition-all',
                      field.value === i + 1 ? 'border-terracotta bg-terracotta text-cream shadow-soft' : 'border-cream-300 bg-white/70 text-ink-soft hover:border-terracotta/50 hover:text-terracotta-700')}>
                    {m.slice(0, 3)}
                  </button>
                ))}
              </div>
            )}
          />
        ) : (
          <div className="relative max-w-sm">
            <CalendarDays className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-terracotta" aria-hidden />
            <Input type="date" min={today} aria-label="Departure date" className="pl-12" {...register('departure_date')} />
          </div>
        )}
        <FieldError>{errors.departure_month?.message ?? errors.departure_date?.message}</FieldError>
        <p className="mt-2 text-xs text-muted">We plan around seasonal closures and allow time for visits and travel.</p>
      </fieldset>

      <div>
        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-forest-900">Budget style <span className="font-normal text-muted">(optional)</span></legend>
          <Controller
            control={control}
            name="budget_preference"
            render={({ field }) => (
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Budget style">
                {BUDGETS.map((b) => (
                  <button key={b.id} type="button" role="radio" aria-checked={field.value === b.id}
                    onClick={() => field.onChange(field.value === b.id ? null : b.id)}
                    className={cn('cursor-pointer rounded-xl border px-4 py-3 text-left transition-all',
                      field.value === b.id ? 'border-gold bg-gold-100 shadow-soft' : 'border-cream-300 bg-white/70 hover:border-gold')}>
                    <span className="block text-sm font-semibold text-forest-900">{b.title}</span>
                    <span className="block text-xs text-ink-soft">{b.text}</span>
                  </button>
                ))}
              </div>
            )}
          />
        </fieldset>
      </div>
    </div>
  )
}
