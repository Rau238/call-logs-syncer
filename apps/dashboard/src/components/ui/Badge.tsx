import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type BadgeVariant =
  | 'default'
  | 'success'
  | 'danger'
  | 'warning'
  | 'muted'
  | 'incoming'
  | 'outgoing'
  | 'missed'
  | 'rejected'
  | 'blocked'
  | 'voicemail'
  | 'unknown';

const variants: Record<BadgeVariant, string> = {
  default: 'bg-slate-700/60 text-slate-200 ring-slate-600/50',
  success: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30',
  danger: 'bg-red-500/15 text-red-400 ring-red-500/30',
  warning: 'bg-amber-500/15 text-amber-400 ring-amber-500/30',
  muted: 'bg-slate-800 text-slate-400 ring-slate-700/50',
  incoming: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30',
  outgoing: 'bg-blue-500/15 text-blue-400 ring-blue-500/30',
  missed: 'bg-red-500/15 text-red-400 ring-red-500/30',
  rejected: 'bg-amber-500/15 text-amber-400 ring-amber-500/30',
  blocked: 'bg-stone-500/15 text-stone-300 ring-stone-500/30',
  voicemail: 'bg-violet-500/15 text-violet-400 ring-violet-500/30',
  unknown: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
};

interface Props {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'default', className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold leading-tight ring-1 ring-inset whitespace-nowrap',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function callTypeToBadgeVariant(type: string): BadgeVariant {
  const key = type.toLowerCase() as BadgeVariant;
  if (key in variants) return key;
  return 'unknown';
}
