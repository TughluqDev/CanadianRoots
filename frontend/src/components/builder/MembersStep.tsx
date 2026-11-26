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
        className="flex cursor-pointer items-center gap-2 rounded border border-forest/35 px-3 py-2 text-sm font-semibold text-forest hover:bg-cream-200">
        <span className="flex items-center text-forest">
          <UserPlus className="size-4" aria-hidden />
        </span>
        Add traveller
      </button>
    </div>
  )
}
