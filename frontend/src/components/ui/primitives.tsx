import type * as React from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('rounded-2xl border border-cream-300/70 bg-cream-50 shadow-soft', className)} {...props} />
}

export function Badge({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold [&_svg]:size-3', className)}
      {...props}
    />
  )
}

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-12 w-full rounded-xl border border-cream-300 bg-white/80 px-4 text-[15px] text-ink placeholder:text-muted shadow-[inset_0_1px_2px_rgb(0_0_0/0.03)] transition focus:border-forest/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-forest/10 aria-[invalid=true]:border-terracotta aria-[invalid=true]:ring-terracotta/10',
        className,
      )}
      {...props}
    />
  )
}

export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return <label className={cn('mb-2 block text-sm font-semibold text-forest-900', className)} {...props} />
}

export function FieldError({ children, id }: { children?: React.ReactNode; id?: string }) {
  if (!children) return null
  return (
    <p id={id} role="alert" className="mt-2 text-sm font-medium text-terracotta-700">
      {children}
    </p>
  )
}

export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('animate-pulse rounded-xl bg-cream-200', className)} {...props} />
}

export function SectionHeading({ eyebrow, title, children, className }: {
  eyebrow?: string; title: string; children?: React.ReactNode; className?: string
}) {
  return (
    <div className={cn('max-w-2xl', className)}>
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <h2 className="text-3xl leading-tight font-medium sm:text-4xl">{title}</h2>
      {children && <p className="mt-3 text-base leading-relaxed text-ink-soft">{children}</p>}
    </div>
  )
}
