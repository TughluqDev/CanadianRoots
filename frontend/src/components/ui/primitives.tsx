import type * as React from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('rounded border border-cream-300 bg-cream-50 ', className)} {...props} />
}

export function Badge({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded border border-transparent px-2 py-0.5 text-xs font-semibold [&_svg]:size-3', className)}
      {...props}
    />
  )
}

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded border border-cream-300 bg-white px-3 text-sm text-ink placeholder:text-muted transition focus:border-forest aria-[invalid=true]:border-terracotta aria-[invalid=true]:ring-terracotta/10',
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
      {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
      <h2 className="text-2xl font-bold">{title}</h2>
      {children && <p className="mt-2 text-sm text-ink-soft">{children}</p>}
    </div>
  )
}
