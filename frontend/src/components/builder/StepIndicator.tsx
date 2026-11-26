import { cn } from '@/lib/utils'

export const STEPS = [
  { title: 'The journey' },
  { title: 'Your party' },
  { title: 'Review' },
]

export function StepIndicator({ step, onJump }: { step: number; onJump: (s: number) => void }) {
  return (
    <ol className="grid grid-cols-3 gap-1" aria-label="Planner progress">
      {STEPS.map(({ title }, i) => (
        <li key={title}>
          <button
            type="button"
            disabled={i >= step}
            onClick={() => onJump(i)}
            aria-current={i === step ? 'step' : undefined}
            className={cn(
              'w-full border px-2 py-2 text-left text-xs sm:text-sm',
              i === step ? 'border-forest bg-forest text-cream' : 'border-cream-300 bg-cream-50 text-ink-soft',
              i < step && 'cursor-pointer hover:underline',
            )}
          >
            {i + 1}. {title}
          </button>
        </li>
      ))}
    </ol>
  )
}
