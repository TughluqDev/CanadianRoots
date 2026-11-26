import { BadgeCheck, CircleDollarSign, Gift, HelpCircle } from 'lucide-react'
import { Badge } from '@/components/ui/primitives'
import { CULTURE_META, INTEREST_ICONS, MEMBER_COLORS, PRICING_META } from '@/lib/domain'
import { cn, initials } from '@/lib/utils'
import type { CultureId, InterestId, PricingStatus } from '@/types/api'
import { usePreferenceLabels } from '@/hooks/useReferenceData'

export function CultureBadge({ culture, className }: { culture: CultureId; className?: string }) {
  const meta = CULTURE_META[culture]
  return (
    <Badge className={cn('border', meta.className, className)}>
      <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden />
      {meta.short}
    </Badge>
  )
}

export function InterestBadge({ id, highlighted }: { id: InterestId; highlighted?: boolean }) {
  const { interestLabel } = usePreferenceLabels()
  const Icon = INTEREST_ICONS[id]
  return (
    <Badge className={cn(highlighted ? 'bg-forest text-cream' : 'bg-cream-200/80 text-ink-soft')}>
      <Icon aria-hidden />
      {interestLabel(id)}
    </Badge>
  )
}

const PRICE_ICONS = { verified: BadgeCheck, estimate: CircleDollarSign, free: Gift, unavailable: HelpCircle }

export function PricingBadge({ status }: { status: PricingStatus }) {
  const meta = PRICING_META[status]
  const Icon = PRICE_ICONS[status]
  return (
    <Badge className={meta.className} title={meta.help}>
      <Icon aria-hidden />
      {meta.label}
    </Badge>
  )
}

export function MemberAvatar({ name, index, size = 'md' }: { name: string; index: number; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-4 ring-cream-50',
        MEMBER_COLORS[index % MEMBER_COLORS.length],
        size === 'sm' && 'size-8 text-xs',
        size === 'md' && 'size-11 text-sm',
        size === 'lg' && 'size-14 text-lg',
      )}
    >
      {initials(name)}
    </span>
  )
}
