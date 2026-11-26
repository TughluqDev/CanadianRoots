import { useState } from 'react'
import { cn } from '@/lib/utils'
import { LandscapeArt } from './LandscapeArt'

interface SmartImageProps {
  src: string | null | undefined
  alt: string
  className?: string
}

export function SmartImage({ src, alt, className }: SmartImageProps) {
  const [failedSrc, setFailedSrc] = useState<string>()
  return (
    <div className={cn('overflow-hidden bg-cream-200', className)}>
      {src && src !== failedSrc ? (
        <img src={src} alt={alt} loading="lazy" decoding="async"
          onError={() => setFailedSrc(src)} className="h-full w-full object-cover" />
      ) : <LandscapeArt label={alt} />}
    </div>
  )
}
