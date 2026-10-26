/**
 * The keystone: an arch drawn in one line whose two ends meet a solid wedge set at its crown.
 * Ink only. The line is finer when the mark is large (lock screen) and firmer when it is small
 * (header, favicon), so it reads the same at every size. The favicon in index.html is this drawing.
 */
export function Logo({ size = 96, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" className={className}>
      <path
        d="M8 44V28A16 16 0 0 1 18.3 13.05M29.7 13.05A16 16 0 0 1 40 28v16"
        stroke="#1c1c1e"
        strokeWidth={size >= 64 ? 2 : 3}
        strokeLinecap="round"
      />
      <path d="M18 7h12l-3 12h-6z" fill="#1c1c1e" />
    </svg>
  )
}
