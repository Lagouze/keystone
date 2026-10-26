import { cx } from './cx.ts'

/** A shimmering placeholder with the final size of what it stands for, so nothing jumps when data lands. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx('skeleton rounded-full', className)} />
}

/**
 * The landing's shape (a chip, two headline bars, a thin line, two buttons), shown while the
 * keeper's configuration loads. Same footprint as the real hero, so nothing jumps.
 */
export function HeroSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="mx-auto flex h-svh min-h-[34rem] max-w-3xl pt-16 flex-col items-center justify-center gap-7 px-6">
      <div className="glass flex h-12 w-56 items-center gap-3 rounded-full px-4">
        <span className="size-2.5 shrink-0 rounded-full bg-ink/70" aria-hidden="true" />
        <Skeleton className="h-3 flex-1" />
      </div>
      <div className="grid w-full justify-items-center gap-5">
        <Skeleton className="h-10 w-full sm:h-14" />
        <Skeleton className="h-10 w-2/3 sm:h-14" />
      </div>
      <Skeleton className="h-3.5 w-5/6" />
      <div className="mt-2 flex gap-4">
        <div className="h-14 w-44 rounded-full bg-ink/85" aria-hidden="true" />
        <div className="glass h-14 w-44 rounded-full" aria-hidden="true" />
      </div>
    </div>
  )
}
