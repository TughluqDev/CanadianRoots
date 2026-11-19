import { Sprout } from 'lucide-react'
import { useEffect, useState } from 'react'

const MESSAGES = [
  'Matching interests to real Canadian destinations…',
  'Checking what’s open in your travel month…',
  'Finding stops the whole party will love…',
  'Mapping a practical route…',
  'Estimating your budget in CAD…',
]

export function GeneratingOverlay() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % MESSAGES.length), 1100)
    return () => clearInterval(t)
  }, [])
  return (
    <div role="status" aria-live="polite" className="animate-fade-in fixed inset-0 z-[1500] flex items-center justify-center bg-cream/95 backdrop-blur-sm">
      <div className="text-center">
        <div className="relative mx-auto mb-8 size-24">
          <span className="absolute inset-0 animate-ping rounded-full bg-gold/30" />
          <span className="relative flex size-24 items-center justify-center rounded-full bg-forest text-gold shadow-lift">
            <Sprout className="size-10" aria-hidden />
          </span>
        </div>
        <p className="font-display text-3xl text-forest-900">Composing your journey</p>
        <p key={i} className="animate-fade-up mt-3 text-ink-soft">{MESSAGES[i]}</p>
      </div>
    </div>
  )
}
