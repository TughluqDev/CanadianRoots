import { cn } from '@/lib/utils'
import type { RegionId } from '@/types/api'

const PALETTES: Record<RegionId | 'default', [string, string, string, string, string]> = {
  // sky, far hills, mid hills, near field, sun
  central: ['#e9dfc9', '#99b6ad', '#2c5f46', '#214b37', '#dbb66a'],
  atlantic: ['#dfe6e3', '#8fb0b8', '#3c6e6b', '#214b37', '#f0d9a6'],
  prairies: ['#f3e6c8', '#dbb66a', '#c49a49', '#8c6a2c', '#b86b45'],
  northern: ['#e1e5ea', '#a9b8c6', '#5f7488', '#2d3e5c', '#f2e2b7'],
  west_coast: ['#e5ebe4', '#99b6ad', '#3f6b5c', '#1d4a46', '#dbb66a'],
  default: ['#efe7d6', '#99b6ad', '#2c5f46', '#214b37', '#dbb66a'],
}

/** Illustrated rolling-farmland scene used as an intentional fallback where no licensed photo exists. */
export function LandscapeArt({ region, className, label }: { region?: RegionId | null; className?: string; label?: string }) {
  const [sky, far, mid, near, sun] = PALETTES[region ?? 'default']
  return (
    <svg
      viewBox="0 0 800 500"
      preserveAspectRatio="xMidYMid slice"
      className={cn('h-full w-full', className)}
      role="img"
      aria-label={label ?? 'Illustrated Canadian countryside'}
    >
      <rect width="800" height="500" fill={sky} />
      <circle cx="590" cy="150" r="58" fill={sun} opacity="0.85" />
      <path d="M0 300 C120 230 220 260 330 235 S560 200 800 250 V500 H0Z" fill={far} opacity="0.9" />
      <path d="M0 360 C150 300 300 340 430 310 S650 270 800 320 V500 H0Z" fill={mid} />
      <path d="M0 420 C180 370 360 410 520 385 S700 360 800 380 V500 H0Z" fill={near} />
      {/* crop rows */}
      <g stroke={sun} strokeOpacity="0.35" strokeWidth="3" fill="none">
        <path d="M60 500 C200 440 320 420 460 410" />
        <path d="M180 500 C290 450 400 430 540 418" />
        <path d="M320 500 C410 460 520 440 640 425" />
      </g>
      {/* barn */}
      <g transform="translate(150 318)">
        <path d="M0 30 L26 8 L52 30 V58 H0Z" fill="#b86b45" />
        <rect x="18" y="36" width="16" height="22" fill="#f5f0e6" opacity="0.9" />
      </g>
      {/* conifers */}
      <g fill={near} opacity="0.95">
        <path d="M660 330 l14 -46 l14 46z" />
        <path d="M684 336 l12 -38 l12 38z" />
        <path d="M640 338 l10 -30 l10 30z" />
      </g>
    </svg>
  )
}
