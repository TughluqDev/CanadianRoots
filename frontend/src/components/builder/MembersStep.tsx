import { UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { FieldError } from '@/components/ui/primitives'
import type { PreferencesResponse, Region } from '@/types/api'
import { MemberCard } from './MemberCard'
import { emptyMember, type PartyForm } from './schema'

export function MembersStep({ preferences, regions }: { preferences: PreferencesResponse; regions: Region[] }) {
  const { control, formState: { errors } } = useFormContext<PartyForm>()
  const { fields, append, remove } = useFieldArray({ control, name: 'members', keyName: '_id' })
  const [expandedKey, setExpandedKey] = useState<string | null>(fields[0]?.key ?? null)

  const add = () => {
    const m = emptyMember()
    append(m, { shouldFocus: false })
    setExpandedKey(m.key)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-sm text-ink-soft">
          <span className="font-semibold text-forest-900">{fields.length}</span> traveller{fields.length === 1 ? '' : 's'} so far.
        </p>
      </div>
      <div className="space-y-3" aria-live="polite">
        {fields.map((f, i) => (
          <MemberCard
            key={f._id}
            index={i}
            expanded={expandedKey === f.key}
            onToggle={() => setExpandedKey(expandedKey === f.key ? null : f.key)}
            onRemove={fields.length > 1 ? () => remove(i) : undefined}
            preferences={preferences}
            regions={regions}
          />
        ))}
      </div>
      <FieldError>{errors.members?.root?.message ?? errors.members?.message}</FieldError>
      <button type="button" onClick={add}
        className="group flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-forest/25 bg-cream-50/50 py-6 font-semibold text-forest transition hover:border-forest/50 hover:bg-cream-50">
        <span className="flex size-9 items-center justify-center rounded-full bg-forest text-cream transition group-hover:scale-110">
          <UserPlus className="size-4" aria-hidden />
        </span>
        Add traveller
      </button>
    </div>
  )
}
