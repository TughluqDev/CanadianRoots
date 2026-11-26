export function GeneratingOverlay() {
  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-[1500] grid place-items-center bg-cream/90">
      <p className="border border-cream-300 bg-cream-50 p-5 font-semibold text-forest">Planning your trip…</p>
    </div>
  )
}
