/**
 * The keystone: the wedge that locks an arch. Fine-line mark with a glass wedge, drawn once and
 * reused by the lock screen (large) and the header (small).
 */
export function Logo({ size = 96, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="ks-glass" x1="30" y1="14" x2="66" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      {/* the arch, in a fine line */}
      <path d="M10 84V52C10 28 26 12 48 12s38 16 38 40v32" stroke="#1c1c1e" strokeOpacity="0.55" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M22 84V54c0-18 11-30 26-30s26 12 26 30v30" stroke="#1c1c1e" strokeOpacity="0.25" strokeWidth="1.25" strokeLinecap="round" />
      {/* the keystone, a glass wedge */}
      <path d="M36 10h24l7 30H29z" fill="url(#ks-glass)" stroke="#1c1c1e" strokeOpacity="0.8" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M40 17h16" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
