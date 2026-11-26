export function LandscapeArt({ label }: { label: string }) {
  return (
    <div className="grid h-full min-h-20 place-items-center bg-sage-100 text-sm text-ink-soft" role={label ? 'img' : undefined} aria-label={label || undefined}>
      <span aria-hidden="true">No photo</span>
    </div>
  )
}
