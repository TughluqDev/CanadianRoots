import { AlertCircle, ChevronDown, Trash2 } from 'lucide-react'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { MemberAvatar } from '@/components/common/badges'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Card, FieldError, Input, Label } from '@/components/ui/primitives'
import { CULTURE_META, INTEREST_ICONS, REGION_META } from '@/lib/domain'
import { cn } from '@/lib/utils'
import type { CultureId, InterestId, PreferencesResponse, Region, RegionId } from '@/types/api'
import type { PartyForm } from './schema'

interface MemberCardProps {
  index: number
  expanded: boolean
  onToggle: () => void
  onRemove?: () => void
  preferences: PreferencesResponse
  regions: Region[]
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function MemberCard({ index, expanded, onToggle, onRemove, preferences, regions }: MemberCardProps) {
  const { register, control, formState: { errors } } = useFormContext<PartyForm>()
  const member = useWatch({ control, name: `members.${index}` })
  const err = errors.members?.[index]
  const displayName = member?.name?.trim() || `Traveller ${index + 1}`
  const hasError = !!(err?.name || err?.cultures)
  const panelId = `member-panel-${index}`

  return (
    <Card className={cn('overflow-hidden ', hasError && 'border-terracotta/60')}>
      <div className="flex items-center gap-4 p-4 sm:p-5">
        <MemberAvatar name={member?.name || `${index + 1}`} index={index} />
        <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={panelId}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lg font-medium text-forest-900">{displayName}</span>
            <span className="block truncate text-sm text-ink-soft">
              {hasError ? (
                <span className="inline-flex items-center gap-1 text-terracotta-700"><AlertCircle className="size-3.5" aria-hidden />Needs attention</span>
              ) : (
                [
                  member?.cultures?.length ? member.cultures.map((c) => CULTURE_META[c].short).join(' · ') : 'No cultural preference yet',
                  member?.interests?.length ? `${member.interests.length} interest${member.interests.length > 1 ? 's' : ''}` : null,
                  member?.preferred_region ? regions.find((r) => r.id === member.preferred_region)?.name : null,
                ].filter(Boolean).join('  ·  ')
              )}
            </span>
          </span>
          <ChevronDown className={cn('size-5 shrink-0 text-muted transition', expanded && 'rotate-180')} aria-hidden />
        </button>
        {onRemove && (
          <Button type="button" variant="danger" size="icon" onClick={onRemove} aria-label={`Remove ${displayName}`}>
            <Trash2 />
          </Button>
        )}
      </div>

      {expanded && (
        <div id={panelId} className="space-y-8 border-t border-cream-300/70 bg-white/40 p-5 sm:p-7">
          <div className="max-w-md">
            <Label htmlFor={`member-${index}-name`}>Name</Label>
            <Input id={`member-${index}-name`} placeholder="Who’s coming along?" aria-invalid={!!err?.name || undefined}
              autoComplete="off" {...register(`members.${index}.name`)} />
            <FieldError>{err?.name?.message}</FieldError>
          </div>

          <fieldset>
            <legend className="mb-1 text-sm font-semibold text-forest-900">Cultural influences <span className="text-terracotta">*</span></legend>
            <p className="mb-3 text-xs text-muted">Choose at least one heritage you’d love to experience.</p>
            <Controller
              control={control}
              name={`members.${index}.cultures`}
              render={({ field }) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  {preferences.cultures.map((c) => {
                    const on = field.value.includes(c.id)
                    const meta = CULTURE_META[c.id as CultureId]
                    return (
                      <button key={c.id} type="button" aria-pressed={on} onClick={() => field.onChange(toggle(field.value, c.id))}
                        className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-left ',
                          on ? 'border-forest bg-forest-100/70 ' : 'border-cream-300 bg-white/70 hover:border-forest/40')}>
                        <span className={cn('mt-1 size-3 shrink-0 rounded-full ring-4', meta.dot, on ? 'ring-forest/15' : 'ring-transparent')} aria-hidden />
                        <span>
                          <span className="block text-sm font-semibold text-forest-900">{c.label}</span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">{meta.blurb}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            />
            <FieldError>{err?.cultures?.message}</FieldError>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-forest-900">Interests</legend>
            <Controller
              control={control}
              name={`members.${index}.interests`}
              render={({ field }) => (
                <div className="flex flex-wrap gap-2">
                  {preferences.interests.map((i) => (
                    <Chip key={i.id} selected={field.value.includes(i.id)} icon={INTEREST_ICONS[i.id as InterestId]}
                      onToggle={() => field.onChange(toggle(field.value, i.id))}>
                      {i.label}
                    </Chip>
                  ))}
                </div>
              )}
            />
          </fieldset>

          <fieldset>
            <legend className="mb-1 text-sm font-semibold text-forest-900">Preferred region <span className="font-normal text-muted">(optional)</span></legend>
            <p className="mb-3 text-xs text-muted">Optional. Choose a region this traveller would like to visit.</p>
            <Controller
              control={control}
              name={`members.${index}.preferred_region`}
              render={({ field }) => (
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Preferred region">
                  <Chip selected={field.value === null} onToggle={() => field.onChange(null)} role="radio" aria-checked={field.value === null} tone="terracotta">
                    No preference
                  </Chip>
                  {regions.map((r) => (
                    <Chip key={r.id} selected={field.value === r.id} role="radio" aria-checked={field.value === r.id} tone="terracotta"
                      onToggle={() => field.onChange(r.id as RegionId)} title={REGION_META[r.id].short}>
                      {r.name}
                    </Chip>
                  ))}
                </div>
              )}
            />
          </fieldset>
        </div>
      )}
    </Card>
  )
}
