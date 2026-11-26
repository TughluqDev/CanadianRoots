import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Info, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PricingBadge } from '@/components/common/badges'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/primitives'
import { cn, money } from '@/lib/utils'
import { api } from '@/services/api'
import type { Assumptions, Trip } from '@/types/api'

function ShareBars({ rows, total }: { rows: { label: string; value: number }[]; total: number }) {
  return (
    <div className="space-y-3.5" role="list" aria-label="Share of estimated total by category">
      {rows.map((r) => {
        const pct = total > 0 ? (r.value / total) * 100 : 0
        return (
          <div key={r.label} role="listitem" className="group" title={`${r.label}: ${money(r.value, true)} (${pct.toFixed(1)}%)`}>
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="font-medium text-ink">{r.label}</span>
              <span className="text-ink-soft"><span className="font-semibold text-forest-900">{money(r.value)}</span> · {pct.toFixed(0)}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-cream-200">
              <div className="h-full rounded-full bg-forest transition-all duration-700 group-hover:bg-terracotta" style={{ width: `${Math.max(pct, r.value > 0 ? 1.5 : 0)}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Line({ label, detail, amount, strong }: { label: string; detail?: string; amount: number; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div>
        <p className={cn('text-sm', strong ? 'font-semibold text-forest-900' : 'text-ink')}>{label}</p>
        {detail && <p className="mt-0.5 text-xs leading-relaxed text-muted">{detail}</p>}
      </div>
      <p className={cn('shrink-0 text-sm tabular-nums', strong ? 'font-semibold text-forest-900' : 'text-ink')}>{money(amount, true)}</p>
    </div>
  )
}

type Field = { key: keyof Assumptions; label: string; step: number; prefix?: string; suffix?: string; percent?: boolean; show?: (t: Trip) => boolean }
const FIELDS: Field[] = [
  { key: 'nightly_room_rate', label: 'Nightly room rate', step: 5, prefix: '$', show: (t) => t.budget.accommodation.nights > 0 },
  { key: 'room_occupancy', label: 'Travellers per room', step: 1, show: (t) => t.budget.accommodation.nights > 0 },
  { key: 'daily_food_per_person', label: 'Food per person / day', step: 5, prefix: '$' },
  { key: 'fuel_price_per_litre', label: 'Fuel price', step: 0.05, prefix: '$', suffix: '/L' },
  { key: 'airfare_per_person', label: 'Round-trip airfare / person', step: 10, prefix: '$', show: (t) => t.travel.effective_method === 'plane' },
  { key: 'rental_car_per_day', label: 'Rental car / day', step: 5, prefix: '$', show: (t) => t.travel.effective_method === 'plane' },
  { key: 'contingency_rate', label: 'Contingency', step: 1, suffix: '%', percent: true },
]

function AssumptionsEditor({ trip }: { trip: Trip }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<Partial<Record<keyof Assumptions, string>>>({})
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const original = useRef(trip.assumptions)
  const mutation = useMutation({
    mutationFn: (patch: Partial<Assumptions>) => api.updateAssumptions(trip.id, patch),
    onSuccess: (t) => qc.setQueryData(['trip', t.id], t),
  })
  useEffect(() => () => clearTimeout(timer.current), [])

  const display = (f: Field) => draft[f.key] ?? String(f.percent ? Math.round(trip.assumptions[f.key] * 100) : trip.assumptions[f.key])

  const change = (f: Field, raw: string) => {
    setDraft((d) => ({ ...d, [f.key]: raw }))
    const n = Number(raw)
    if (raw === '' || !Number.isFinite(n)) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => mutation.mutate({ [f.key]: f.percent ? n / 100 : n }), 350)
  }

  const reset = () => {
    setDraft({})
    const o = original.current
    mutation.mutate(Object.fromEntries(FIELDS.map((f) => [f.key, o[f.key]])) as Partial<Assumptions>)
  }

  return (
    <Card className="no-print p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-xl font-medium"><SlidersHorizontal className="size-5 text-terracotta" aria-hidden />Tune the estimate</h3>
        <Button variant="ghost" size="sm" onClick={reset}><RotateCcw />Reset</Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.filter((f) => !f.show || f.show(trip)).map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1.5 block text-xs font-semibold tracking-wide text-ink-soft uppercase">{f.label}</span>
            <span className="flex h-11 items-center rounded-xl border border-cream-300 bg-white/80 px-3 focus-within:border-forest/50 focus-within:ring-4 focus-within:ring-forest/10">
              {f.prefix && <span className="text-sm text-muted">{f.prefix}</span>}
              <input type="number" inputMode="decimal" step={f.step} min={0} value={display(f)} onChange={(e) => change(f, e.target.value)}
                className="h-full w-full bg-transparent px-1.5 text-[15px] tabular-nums focus:outline-none" aria-label={f.label} />
              {f.suffix && <span className="text-sm text-muted">{f.suffix}</span>}
            </span>
          </label>
        ))}
      </div>
      <p className="mt-4 min-h-5 text-xs text-muted" aria-live="polite">
        {mutation.isPending ? 'Recalculating…' : mutation.error ? <span className="text-terracotta-700">{mutation.error.message}</span> : 'Changes recalculate instantly and are saved with this journey.'}
      </p>
    </Card>
  )
}

export function BudgetPanel({ trip }: { trip: Trip }) {
  const b = trip.budget
  const rows = [
    { label: 'Experiences', value: b.activities.total },
    { label: 'Transportation', value: b.transportation.total },
    { label: 'Accommodation', value: b.accommodation.total },
    { label: 'Meals', value: b.meals.total },
    { label: 'Contingency', value: b.contingency },
  ]
  const acc = b.accommodation
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr]">
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <div className="bg-forest p-7 text-cream">
            <p className="text-xs font-semibold tracking-[0.16em] text-gold uppercase">Estimated party total</p>
            <p className="mt-2 font-display text-5xl font-medium sm:text-6xl" data-testid="budget-total">{money(b.total)}</p>
            <p className="mt-2 text-cream/75">{money(b.per_person)} per person · {b.travellers} traveller{b.travellers > 1 ? 's' : ''} · CAD</p>
          </div>
          <div className="p-7"><ShareBars rows={rows} total={b.total} /></div>
        </Card>
        <AssumptionsEditor trip={trip} />
      </div>

      <Card className="p-6 sm:p-8">
        <h3 className="text-xl font-medium">Itemized breakdown</h3>
        <section className="mt-5">
          <p className="eyebrow mb-1">Experiences</p>
          <div className="divide-y divide-cream-300/70">
            {b.activities.items.map((i) => (
              <div key={i.slug} className="flex items-start justify-between gap-4 py-2.5">
                <div>
                  <p className="text-sm text-ink">{i.name}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <PricingBadge status={i.pricing_status} />
                    {i.unit_price != null && i.pricing_status !== 'free' && (i.basis === 'per_group' ? 'Group price' : `${money(i.unit_price, true)} × ${i.travellers}`)}
                  </p>
                </div>
                <p className="shrink-0 text-sm tabular-nums">{money(i.subtotal, true)}</p>
              </div>
            ))}
            <Line label="Experiences subtotal" amount={b.activities.total} strong />
          </div>
        </section>
        <section className="mt-5">
          <p className="eyebrow mb-1">Transportation · {b.transportation.method === 'plane' ? 'fly & drive' : 'road trip'}</p>
          <div className="divide-y divide-cream-300/70">
            {b.transportation.items.map((i) => <Line key={i.label} label={i.label} detail={i.detail} amount={i.amount} />)}
            <Line label="Transportation subtotal" amount={b.transportation.total} strong />
          </div>
        </section>
        <section className="mt-5">
          <p className="eyebrow mb-1">Accommodation</p>
          <div className="divide-y divide-cream-300/70">
            {acc.nights === 0 ? (
              <Line label="No overnight stay" amount={0} />
            ) : (
              <>
                <Line label={`${acc.rooms} room${acc.rooms > 1 ? 's' : ''} × ${acc.nights} night${acc.nights > 1 ? 's' : ''}`}
                  detail={`${money(acc.nightly_rate)} average nightly rate (estimate) · up to ${acc.occupancy} per room`} amount={acc.subtotal_before_tax} />
                <Line label={`Lodging taxes (${Math.round(acc.tax_rate * 100)}%)`} amount={acc.tax} />
              </>
            )}
            <Line label="Accommodation subtotal" amount={acc.total} strong />
          </div>
        </section>
        <section className="mt-5">
          <p className="eyebrow mb-1">Meals</p>
          <div className="divide-y divide-cream-300/70">
            <Line label={`${b.meals.travellers} × ${b.meals.days} day${b.meals.days > 1 ? 's' : ''} × ${money(b.meals.daily_per_person)}`} detail={b.meals.note} amount={b.meals.total} strong />
          </div>
        </section>
        <div className="mt-5 divide-y divide-cream-300/70 border-t-2 border-forest/20 pt-2">
          <Line label="Subtotal" amount={b.subtotal} />
          <Line label={`Contingency (${Math.round(b.contingency_rate * 100)}%)`} detail="Buffer for incidentals and price changes." amount={b.contingency} />
          <div className="flex items-center justify-between py-3">
            <p className="font-display text-lg text-forest-900">Estimated total</p>
            <p className="font-display text-2xl text-forest-900 tabular-nums">{money(b.total, true)}</p>
          </div>
        </div>
        <div className="mt-4 space-y-2 rounded-xl bg-cream-200/60 p-4 text-xs leading-relaxed text-ink-soft">
          <p className="flex gap-2"><Info className="size-4 shrink-0 text-terracotta" aria-hidden /><strong className="text-forest-900">{b.disclaimer}</strong></p>
          <p>{b.tax_note} All travellers are priced at the adult rate.</p>
        </div>
      </Card>
    </div>
  )
}
