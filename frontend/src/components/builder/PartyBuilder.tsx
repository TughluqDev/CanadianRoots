import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, Sparkles, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { FormProvider, useForm, type FieldPath } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/primitives'
import type { City, PreferencesResponse, Region } from '@/types/api'
import { MembersStep } from './MembersStep'
import { ReviewStep } from './ReviewStep'
import { partySchema, type PartyForm } from './schema'
import { StepIndicator, STEPS } from './StepIndicator'
import { TripDetailsStep } from './TripDetailsStep'

const STEP_FIELDS: FieldPath<PartyForm>[][] = [
  ['name', 'starting_city_id', 'transportation_method', 'departure_month', 'departure_date', 'budget_preference'],
  ['members'],
]

interface PartyBuilderProps {
  cities: City[]
  preferences: PreferencesResponse
  regions: Region[]
  initialValues: PartyForm
  initialStep?: number
  submitting: boolean
  submitError: string | null
  onSubmit: (values: PartyForm) => void
  onDraftChange?: (values: PartyForm, step: number) => void
}

export function PartyBuilder({
  cities, preferences, regions, initialValues, initialStep = 0, submitting, submitError, onSubmit, onDraftChange,
}: PartyBuilderProps) {
  const form = useForm<PartyForm>({ resolver: zodResolver(partySchema), defaultValues: initialValues, mode: 'onTouched' })
  const [step, setStep] = useState(initialStep)
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!onDraftChange) return
    const sub = form.watch((values) => onDraftChange(values as PartyForm, step))
    onDraftChange(form.getValues(), step)
    return () => sub.unsubscribe()
  }, [form, onDraftChange, step])

  const goTo = (s: number) => {
    setStep(s)
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const timingValid = () => {
    const v = form.getValues()
    if (v.timing === 'month' && !v.departure_month) {
      form.setError('departure_month', { message: 'Choose a travel month.' })
      return false
    }
    if (v.timing === 'date') {
      const today = new Date().toISOString().slice(0, 10)
      if (!v.departure_date) { form.setError('departure_date', { message: 'Choose a departure date.' }); return false }
      if (v.departure_date < today) { form.setError('departure_date', { message: 'Departure date can’t be in the past.' }); return false }
    }
    form.clearErrors(['departure_month', 'departure_date'])
    return true
  }

  const next = async () => {
    const ok = await form.trigger(STEP_FIELDS[step])
    const timingOk = step === 0 ? timingValid() : true
    if (ok && timingOk) goTo(step + 1)
  }

  const submit = form.handleSubmit(onSubmit, () => {
    const e = form.formState.errors
    if (e.starting_city_id || e.departure_month || e.departure_date) goTo(0)
    else if (e.members) goTo(1)
  })

  return (
    <FormProvider {...form}>
      <div ref={topRef} className="scroll-mt-4" />
      <StepIndicator step={step} onJump={goTo} />
      <form noValidate onSubmit={(e) => { e.preventDefault(); if (step === 2) void submit() }} className="mt-3">
        <Card className="p-4 sm:p-5">
          <div className="mb-4">
            <h2 className="text-xl font-bold">{STEPS[step].title}</h2>
          </div>
          <div key={step}>
            {step === 0 && <TripDetailsStep cities={cities} />}
            {step === 1 && <MembersStep preferences={preferences} regions={regions} />}
            {step === 2 && <ReviewStep cities={cities} onEdit={goTo} />}
          </div>

          {submitError && step === 2 && (
            <div role="alert" className="mt-8 flex gap-3 rounded-xl border border-terracotta/40 bg-terracotta-100/60 p-4 text-sm text-terracotta-700">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
              <p>{submitError}</p>
            </div>
          )}

          <div className="mt-5 flex flex-col-reverse gap-3 border-t border-cream-300 pt-4 sm:flex-row sm:items-center sm:justify-between">
            {step > 0 ? (
              <Button type="button" variant="outline" onClick={() => goTo(step - 1)}><ArrowLeft />Back</Button>
            ) : <span />}
            {step < 2 ? (
              <Button key="continue" type="button" onClick={next}>Continue<ArrowRight /></Button>
            ) : (
              <Button key="generate" type="submit" variant="accent" size="lg" disabled={submitting}>
                <Sparkles />{submitting ? 'Generating…' : 'Generate My Journey'}
              </Button>
            )}
          </div>
        </Card>
      </form>
    </FormProvider>
  )
}
