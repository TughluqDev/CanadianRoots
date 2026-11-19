import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer',
  {
    variants: {
      variant: {
        primary: 'bg-forest text-cream shadow-soft hover:bg-forest-900 hover:shadow-lift hover:-translate-y-px',
        accent: 'bg-terracotta text-cream shadow-soft hover:bg-terracotta-700 hover:shadow-lift hover:-translate-y-px',
        gold: 'bg-gold text-forest-900 shadow-soft hover:brightness-105 hover:shadow-lift hover:-translate-y-px',
        outline: 'border border-forest/25 bg-cream-50/70 text-forest hover:border-forest/50 hover:bg-cream-50',
        ghost: 'text-forest hover:bg-forest/5',
        glass: 'bg-white/15 text-white backdrop-blur-md border border-white/30 hover:bg-white/25',
        danger: 'text-terracotta-700 hover:bg-terracotta-100',
      },
      size: {
        sm: 'h-9 px-4 text-sm',
        md: 'h-11 px-6 text-sm',
        lg: 'h-14 px-8 text-base',
        icon: 'size-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
