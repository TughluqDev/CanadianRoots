import { Check, ChevronDown, MapPin, Plane, Search } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { City } from '@/types/api'

interface CitySelectProps {
  cities: City[]
  value: string
  onChange: (id: string) => void
  invalid?: boolean
  describedBy?: string
}

export function CitySelect({ cities, value, onChange, invalid, describedBy }: CitySelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const selected = cities.find((c) => c.id === value)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    if (!q) return cities
    return cities.filter((c) =>
      `${c.name} ${c.province} ${c.province_name}`.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(q),
    )
  }, [cities, query])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const choose = (c: City) => {
    onChange(c.id)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <div
        className={cn(
          'flex h-14 items-center gap-3 rounded-xl border bg-white/80 px-4 transition focus-within:border-forest/50 focus-within:ring-4 focus-within:ring-forest/10',
          invalid ? 'border-terracotta' : 'border-cream-300',
        )}
      >
        {open ? <Search className="size-5 text-sage" aria-hidden /> : <MapPin className="size-5 text-terracotta" aria-hidden />}
        <input
          ref={inputRef}
          role="combobox"
          aria-label="Starting city"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-activedescendant={open && results[active] ? `${listId}-${results[active].id}` : undefined}
          className="h-full flex-1 bg-transparent text-[15px] text-ink placeholder:text-muted focus:outline-none"
          placeholder={selected ? `${selected.name}, ${selected.province_name}` : 'Search Canadian cities…'}
          value={open ? query : selected ? `${selected.name}, ${selected.province_name}` : query}
          onFocus={() => { setOpen(true); setActive(0) }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, results.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
            else if (e.key === 'Enter' && open && results[active]) { e.preventDefault(); choose(results[active]) }
            else if (e.key === 'Escape') setOpen(false)
          }}
        />
        <ChevronDown className={cn('size-4 text-muted transition', open && 'rotate-180')} aria-hidden />
      </div>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Supported starting cities"
          className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-cream-300 bg-cream-50 p-1.5"
        >
          {results.length === 0 && (
            <li className="px-3 py-4 text-sm text-ink-soft">
              Choose the nearest city from the list.
            </li>
          )}
          {results.map((c, i) => (
            <li
              key={c.id}
              id={`${listId}-${c.id}`}
              role="option"
              aria-selected={c.id === value}
              onMouseDown={(e) => { e.preventDefault(); choose(c) }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm',
                i === active ? 'bg-forest/8 text-forest' : 'text-ink',
              )}
            >
              <span>
                <span className="font-semibold">{c.name}</span>
                <span className="text-ink-soft">, {c.province_name}</span>
              </span>
              <span className="flex items-center gap-2 text-xs text-muted">
                {c.airport && (<><Plane className="size-3.5" aria-hidden />{c.airport}</>)}
                {c.id === value && <Check className="size-4 text-forest" aria-hidden />}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
