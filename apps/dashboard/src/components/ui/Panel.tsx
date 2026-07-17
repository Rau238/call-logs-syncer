import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

interface Props {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}

export function Panel({ children, className, padding = false }: Props) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/50 shadow-lg shadow-black/10',
        padding && 'p-4 sm:p-5',
        className
      )}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  hint,
  actions,
}: {
  title: ReactNode;
  hint?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-slate-800 bg-slate-900/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-100">{title}</div>
        {hint && <div className="mt-0.5 truncate text-xs text-slate-500">{hint}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PanelToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 border-b border-slate-800 bg-slate-900/60 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
      {children}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="mb-3 flex items-start gap-2.5">
      {Icon && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/25">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
      )}
      <div>
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  accent,
  warn,
  text,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
  warn?: boolean;
  text?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 px-3 py-3 transition hover:border-slate-700">
      <div
        className={cn(
          'font-bold leading-tight tracking-tight text-white',
          text ? 'text-base' : 'text-xl sm:text-2xl',
          accent && 'text-indigo-400',
          warn && 'text-red-400'
        )}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="mt-1 text-xs font-medium text-slate-500">{label}</div>
    </div>
  );
}

export const tableWrapClass = 'overflow-x-auto';
export const tableClass = 'w-full min-w-full border-collapse text-sm';
export const theadClass =
  'border-b border-slate-700/80 bg-slate-900/95 text-left text-xs font-semibold uppercase tracking-wide text-slate-400';
export const thClass = 'whitespace-nowrap px-3 py-2.5 font-semibold sm:px-4';
export const tdClass = 'whitespace-nowrap px-3 py-2.5 align-middle text-slate-300 sm:px-4';
export const trHoverClass = 'border-t border-slate-800/80 transition hover:bg-slate-900/50';
