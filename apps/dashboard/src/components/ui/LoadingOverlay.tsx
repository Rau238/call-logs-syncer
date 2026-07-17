import { cn } from '../../lib/cn';

/** Subtle overlay — keeps layout stable while data refetches. */
export function LoadingOverlay({ active, className }: { active: boolean; className?: string }) {
  if (!active) return null;
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-10 rounded-[inherit] bg-slate-950/35 transition-opacity duration-200',
        className
      )}
      aria-hidden
    />
  );
}

export function PageProgressBar({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="absolute inset-x-0 top-0 z-40 h-0.5 overflow-hidden bg-indigo-500/15">
      <div className="page-progress-indeterminate h-full w-1/3 bg-indigo-500" />
    </div>
  );
}
