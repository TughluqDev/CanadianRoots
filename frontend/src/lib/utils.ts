import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const cad = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })
const cadCents = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 })

export function money(value: number, exact = false): string {
  return (exact ? cadCents : cad).format(value)
}

export function hours(h: number): string {
  if (h < 1) return `${Math.max(5, Math.round((h * 60) / 5) * 5)} min`
  const whole = Math.floor(h)
  const mins = Math.round((h - whole) * 60 / 15) * 15
  if (mins === 60) return `${whole + 1} h`
  return mins ? `${whole} h ${mins} min` : `${whole} h`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December']
const SHORT = MONTHS.map((m) => m.slice(0, 3))

export function monthRange(months: number[]): string {
  if (!months.length) return 'Season unknown'
  if (months.length === 12) return 'Year-round'
  const set = new Set(months)
  const next = (m: number) => (m === 12 ? 1 : m + 1)
  const prev = (m: number) => (m === 1 ? 12 : m - 1)
  const start = [...set].sort((a, b) => a - b).find((m) => !set.has(prev(m))) ?? months[0]
  const runs: [number, number][] = []
  let m = start
  for (let i = 0; i < 12; i++, m = next(m)) {
    if (!set.has(m)) continue
    if (runs.length && runs[runs.length - 1][1] === prev(m)) runs[runs.length - 1][1] = m
    else runs.push([m, m])
  }
  return runs.map(([a, b]) => (a === b ? SHORT[a - 1] : `${SHORT[a - 1]} – ${SHORT[b - 1]}`)).join(', ')
}
