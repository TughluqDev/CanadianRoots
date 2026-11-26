import { CloudOff, Compass } from 'lucide-react'
import type * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/primitives'

export function ErrorState({ title = 'Something went wrong', message, onRetry, action }: {
  title?: string; message: string; onRetry?: () => void; action?: React.ReactNode
}) {
  return (
    <Card role="alert" className="mx-auto max-w-xl p-8 text-center sm:p-10">
      <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-terracotta-100 text-terracotta">
        <CloudOff className="size-6" aria-hidden />
      </div>
      <h2 className="text-2xl font-medium">{title}</h2>
      <p className="mt-3 leading-relaxed text-ink-soft">{message}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {onRetry && <Button onClick={onRetry}>Try again</Button>}
        {action}
      </div>
    </Card>
  )
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: React.ReactNode }) {
  return (
    <Card className="mx-auto max-w-xl p-10 text-center">
      <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-sage-100 text-forest">
        <Compass className="size-6" aria-hidden />
      </div>
      <h2 className="text-2xl font-medium">{title}</h2>
      <p className="mt-3 leading-relaxed text-ink-soft">{message}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </Card>
  )
}
