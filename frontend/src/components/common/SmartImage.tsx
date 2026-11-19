import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { RegionId } from '@/types/api'
import { LandscapeArt } from './LandscapeArt'

interface SmartImageProps {
  src: string | null | undefined
  alt: string
  region?: RegionId | null
  className?: string
  imgClassName?: string
  eager?: boolean
}

/** Image with a shimmer while loading and a designed illustration if missing or broken. */
export function SmartImage({ src, alt, region, className, imgClassName, eager }: SmartImageProps) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const showFallback = !src || failed
  return (
    <div className={cn('relative overflow-hidden bg-cream-200', className)}>
      {showFallback ? (
        <LandscapeArt region={region} label={alt} />
      ) : (
        <>
          {!loaded && <div className="absolute inset-0 animate-pulse bg-cream-200" aria-hidden />}
          <img
            src={src}
            alt={alt}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={cn('h-full w-full object-cover transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0', imgClassName)}
          />
        </>
      )}
    </div>
  )
}
