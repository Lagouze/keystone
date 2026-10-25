// Inline stand-ins for the four hugeicons glyphs used by Stepper and SwipeToast, so the app does
// not pull in @hugeicons/react and @hugeicons/core-free-icons for them (Keystone adaptation).
interface IconProps {
  size?: number
  strokeWidth?: number
}

function Svg({ size = 16, strokeWidth = 2, d }: IconProps & { d: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

export const TickIcon = (p: IconProps) => <Svg {...p} d="M5 12.5 10 17.5 19 7" />
export const ArrowLeftIcon = (p: IconProps) => <Svg {...p} d="M15 6 9 12 15 18" />
export const ArrowRightIcon = (p: IconProps) => <Svg {...p} d="M9 6 15 12 9 18" />
export const CloseIcon = (p: IconProps) => <Svg {...p} d="M6 6 18 18M18 6 6 18" />
