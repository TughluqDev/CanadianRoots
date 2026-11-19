import { Check } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'

interface ChipProps extends Omit<React.ComponentProps<'button'>, 'onChange'> {
  selected: boolean
  onToggle: () => void
  icon?: React.ComponentType<{ className?: string }>
  tone?: 'forest' | 'terracotta'
}

/** Toggleable preference chip. Exposes aria-pressed for assistive tech and tests. */
export function Chip({ selected, onToggle, icon: Icon, tone = 'forest', className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        'group inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium transition-all duration-200 select-none active:scale-[0.97]',
        selected
          ? tone === 'forest'
            ? 'border-forest bg-forest text-cream shadow-soft'
            : 'border-terracotta bg-terracotta text-cream shadow-soft'
          : 'border-cream-300 bg-white/70 text-ink-soft hover:-translate-y-px hover:border-forest/40 hover:text-forest',
        className,
      )}
      {...props}
    >
      {selected ? <Check className="size-4" aria-hidden /> : Icon && <Icon className="size-4 text-sage transition group-hover:text-forest" aria-hidden />}
      {children}
    </button>
  )
}
