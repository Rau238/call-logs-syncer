import { cn } from '../../lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-slate-800/80', className)}
      aria-hidden
    />
  );
}

export function StatCardsSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-800/80 bg-slate-900/70 px-3 py-3">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export function SectionHeadingSkeleton() {
  return (
    <div className="mb-3 flex items-start gap-2.5">
      <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-64 max-w-full" />
      </div>
    </div>
  );
}

export function ChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-lg border border-slate-800/70 bg-slate-900/40 p-3 sm:col-span-2">
        <Skeleton className="mb-2 h-3 w-28" />
        <Skeleton className="h-[200px] w-full rounded-md sm:h-[220px] lg:h-[240px]" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="rounded-lg border border-slate-800/70 bg-slate-900/40 p-3">
          <Skeleton className="mb-2 h-3 w-20" />
          <Skeleton className="h-[200px] w-full rounded-md sm:h-[220px] lg:h-[240px]" />
        </div>
      ))}
      <div className="rounded-lg border border-slate-800/70 bg-slate-900/40 p-3 sm:col-span-2">
        <Skeleton className="mb-2 h-3 w-24" />
        <Skeleton className="h-[200px] w-full rounded-md sm:h-[220px] lg:h-[240px]" />
      </div>
      <div className="rounded-lg border border-slate-800/70 bg-slate-900/40 p-3 sm:col-span-2 xl:col-span-2">
        <Skeleton className="mb-2 h-3 w-24" />
        <div className="space-y-1.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({
  rows = 8,
  columns = 6,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="overflow-x-auto p-1">
      <div className="mb-2 flex gap-3 border-b border-slate-800 px-3 py-2.5">
        <Skeleton className="h-4 w-4 rounded" />
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-20" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex items-center gap-3 border-t border-slate-800/80 px-3 py-3">
          <Skeleton className="h-4 w-4 shrink-0 rounded" />
          {Array.from({ length: columns }).map((_, col) => (
            <Skeleton
              key={col}
              className={cn('h-4', col === 0 ? 'w-28' : col === 1 ? 'w-24' : 'w-16')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ContactsListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-4 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-28" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-5 w-14 rounded-md" />
              <Skeleton className="h-5 w-14 rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DevicesLayoutSkeleton() {
  return (
    <div>
      <SectionHeadingSkeleton />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-2">
          <Skeleton className="mb-2 h-3 w-16" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="mb-1.5 h-[88px] w-full rounded-lg" />
          ))}
        </div>
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PanelSkeleton({ withToolbar = false }: { withToolbar?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/50">
      {withToolbar && (
        <div className="grid grid-cols-1 gap-3 border-b border-slate-800 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
      )}
      <div className="border-b border-slate-800 px-4 py-3">
        <Skeleton className="h-4 w-48" />
      </div>
      <TableSkeleton />
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <>
      <SectionHeadingSkeleton />
      <StatCardsSkeleton />
      <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-900/50">
        <div className="border-b border-slate-800 px-4 py-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-2 h-3 w-64" />
        </div>
        <TableSkeleton rows={6} columns={7} />
      </div>
    </>
  );
}
