import { Check } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'

interface ChipProps extends Omit<React.ComponentProps<'button'>, 'onChange'> {
  selected: boolean
  onToggle: () => void
  icon?: React.ComponentType<{ className?: string }>
  tone?: 'forest' | 'terracotta'
}

export function Chip({ selected, onToggle, icon: Icon, tone = 'forest', className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        'group inline-flex h-9 cursor-pointer items-center gap-2 rounded border px-3 text-sm font-medium select-none ',
        selected
          ? tone === 'forest'
            ? 'border-forest bg-forest text-cream '
            : 'border-terracotta bg-terracotta text-cream '
          : 'border-cream-300 bg-white/70 text-ink-soft hover:border-forest/40 hover:text-forest',
        className,
      )}
      {...props}
    >
      {selected ? <Check className="size-4" aria-hidden /> : Icon && <Icon className="size-4 text-sage transition group-hover:text-forest" aria-hidden />}
      {children}
    </button>
  )
}
