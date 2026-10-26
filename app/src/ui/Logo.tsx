/**
 * The Keystone mark, redrawn from the team's logo: an arch in two parallel lines, open at its
 * crown, where a faceted keystone sits point down. Line art in ink. The line is drawn firmer when
 * the mark is small, so it keeps its weight in the header. The view box leaves room below the
 * keystone's mitred point. The favicon in index.html is a simplified version (heavier line, no top
 * facets) that stays legible at 16 px.
 */
export function Logo({ height = 96, className }: { height?: number; className?: string }) {
  const stroke = height < 48 ? 20 : 14
  return (
    <svg
      width={(height * 520) / 350}
      height={height}
      viewBox="380 380 520 350"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <g stroke="#1c1c1e" strokeWidth={stroke} strokeLinejoin="miter">
        <path d="M540 458.5A243 243 0 0 0 397 680H456A184 184 0 0 1 552 518.4" />
        <path d="M740 458.5A243 243 0 0 1 883 680H824A184 184 0 0 0 728 518.4" />
        <path d="M544 394.5H736L640 694Z" />
        <path d="M556 404L640 452L724 404M640 452V672" />
      </g>
    </svg>
  )
}

/** The name as set in the logo: capitals, widely spaced (the last letter's spacing is trimmed). */
export function Wordmark({ className }: { className?: string }) {
  return <span className={`mr-[-0.34em] font-medium tracking-[0.34em] uppercase ${className ?? ''}`}>Keystone</span>
}
