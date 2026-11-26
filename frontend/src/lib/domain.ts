import {
  Apple, Camera, CookingPot, Fish, Footprints, Landmark, Leaf, Milk, Mountain, PartyPopper, PawPrint,
  Scissors, Snowflake, Sparkles, Sprout, Sun, Tent, Tractor, Trees, Utensils, type LucideIcon,
} from 'lucide-react'
import type { CultureId, InterestId, PricingStatus, RegionId } from '@/types/api'

export const INTEREST_ICONS: Record<InterestId, LucideIcon> = {
  cold_weather: Snowflake,
  warm_weather: Sun,
  adventure: Tent,
  relaxation: Leaf,
  nature: Trees,
  hiking: Footprints,
  fishing: Fish,
  animals: PawPrint,
  farming: Tractor,
  fruit_picking: Apple,
  cheese: Milk,
  food_tasting: Utensils,
  cooking: CookingPot,
  history: Landmark,
  photography: Camera,
  indigenous_culture: Sprout,
  cultural_festivals: PartyPopper,
  traditional_crafts: Scissors,
  rural_life: Sparkles,
  scenic_landscapes: Mountain,
}

export const CULTURE_META: Record<CultureId, { short: string; blurb: string; className: string; dot: string }> = {
  indigenous: {
    short: 'Indigenous',
    blurb: 'First Nations, Métis and Inuit food ways, land stewardship and agriculture.',
    className: 'bg-terracotta-100 text-terracotta-700 border-terracotta/30',
    dot: 'bg-terracotta',
  },
  british: {
    short: 'British',
    blurb: 'English, Scottish, Irish and Loyalist settler farms and rural traditions.',
    className: 'bg-forest-100 text-forest border-forest/20',
    dot: 'bg-forest',
  },
  french: {
    short: 'French',
    blurb: 'Québécois and Acadian dairies, sugar bushes and farming heritage.',
    className: 'bg-sage-100 text-forest-700 border-sage/50',
    dot: 'bg-sage',
  },
  immigrant: {
    short: 'Immigrant',
    blurb: 'Ukrainian, Mennonite, Japanese and other communities who shaped Canadian farming.',
    className: 'bg-gold-100 text-[#7a5a17] border-gold/50',
    dot: 'bg-gold',
  },
}

export const REGION_META: Record<RegionId, { short: string; tint: string }> = {
  central: { short: 'Ontario & Quebec', tint: 'from-forest/80' },
  atlantic: { short: 'PE · NL · NS · NB', tint: 'from-[#1f4a5c]/80' },
  prairies: { short: 'MB · SK · AB', tint: 'from-[#7a5a17]/80' },
  northern: { short: 'YT · NT · NU', tint: 'from-[#2d3e5c]/80' },
  west_coast: { short: 'British Columbia', tint: 'from-[#1d4a46]/80' },
}

export function regionList(regions: RegionId[] | undefined, fallback: RegionId | null): string {
  const ids = regions && regions.length ? regions : fallback ? [fallback] : []
  return ids.length ? ids.map((r) => REGION_NAMES[r]).join(' & ') : 'Canada'
}

export const REGION_NAMES: Record<RegionId, string> = {
  central: 'Central Canada',
  atlantic: 'Atlantic Canada',
  prairies: 'Prairies',
  northern: 'Northern Canada',
  west_coast: 'West Coast',
}

export const PRICING_META: Record<PricingStatus, { label: string; className: string; help: string }> = {
  verified: { label: 'Published price', className: 'bg-forest-100 text-forest', help: 'Taken from the destination’s published rates.' },
  estimate: { label: 'Demo estimate', className: 'bg-gold-100 text-[#7a5a17]', help: 'Estimated for planning.' },
  free: { label: 'Free admission', className: 'bg-sage-100 text-forest-700', help: 'Admission is free. Purchases cost extra.' },
  unavailable: { label: 'Price unavailable', className: 'bg-cream-200 text-ink-soft', help: 'Check with the destination for prices. The budget excludes this stop’s admission.' },
}

export const MEMBER_COLORS = [
  'bg-forest text-cream',
  'bg-terracotta text-cream',
  'bg-gold text-forest-900',
  'bg-sage text-forest-900',
  'bg-forest-700 text-gold',
  'bg-terracotta-700 text-cream',
]
