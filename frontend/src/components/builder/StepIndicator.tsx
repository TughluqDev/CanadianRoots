import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export const STEPS = [
  { title: 'The journey', text: 'Where, when and how' },
  { title: 'Your party', text: 'Who’s travelling' },
  { title: 'Review', text: 'Generate your trip' },
]

export function StepIndicator({ step, onJump }: { step: number; onJump: (s: number) => void }) {
  return (
    <ol className="grid grid-cols-3 gap-2 sm:gap-4" aria-label="Planner progress">
      {STEPS.map((s, i) => {
        const done = i < step
        const current = i === step
        return (
          <li key={s.title}>
            <button
              type="button"
              disabled={!done}
              onClick={() => onJump(i)}
              aria-current={current ? 'step' : undefined}
              className={cn('group flex w-full items-center gap-3 rounded-2xl p-2 text-left transition sm:p-3', done && 'cursor-pointer hover:bg-forest/5')}
            >
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-all',
                  done && 'border-forest bg-forest text-cream',
                  current && 'border-terracotta bg-terracotta text-cream shadow-soft',
                  !done && !current && 'border-cream-300 text-muted',
                )}
              >
                {done ? <Check className="size-4" aria-hidden /> : i + 1}
              </span>
              <span className="hidden min-w-0 sm:block">
                <span className={cn('block truncate text-sm font-semibold', current || done ? 'text-forest-900' : 'text-muted')}>{s.title}</span>
                <span className="block truncate text-xs text-muted">{s.text}</span>
              </span>
            </button>
            <div className="mx-2 mt-1 h-1 overflow-hidden rounded-full bg-cream-300/70">
              <div className={cn('h-full rounded-full bg-forest transition-all duration-500', done ? 'w-full' : current ? 'w-1/2 bg-terracotta' : 'w-0')} />
            </div>
          </li>
        )
      })}
    </ol>
  )
}
