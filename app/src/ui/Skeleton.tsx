import { cx } from './cx.ts'

/** A shimmering placeholder with the final size of what it stands for, so nothing jumps when data lands. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx('skeleton rounded-full', className)} />
}

/** The dashboard's shape, shown while the keeper's configuration loads. */
export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="mx-auto grid max-w-6xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid content-start gap-4">
        <div className="glass min-h-44 rounded-card p-7 shadow-card">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="mt-4 h-4 w-1/2" />
          <Skeleton className="mt-8 h-11 w-44" />
        </div>
        <div className="glass min-h-72 rounded-card p-7 shadow-card">
          <Skeleton className="h-4 w-28" />
          <div className="mt-8 grid grid-cols-3 gap-6">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
          <Skeleton className="mt-10 h-2 w-full" />
        </div>
        <div className="glass min-h-44 rounded-card p-7 shadow-card">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-6 h-11 w-full" />
        </div>
      </div>
      <div className="grid content-start gap-4">
        <div className="glass min-h-56 rounded-card p-7 shadow-card">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-6 h-8 w-3/4" />
          <Skeleton className="mt-4 h-8 w-1/2" />
        </div>
        <div className="glass min-h-64 rounded-card p-7 shadow-card">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-6 h-5 w-full" />
          <Skeleton className="mt-4 h-5 w-5/6" />
        </div>
      </div>
    </div>
  )
}
