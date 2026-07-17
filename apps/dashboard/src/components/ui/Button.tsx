import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm shadow-indigo-900/30 border border-indigo-500/50',
  secondary:
    'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700',
  outline:
    'bg-transparent text-slate-300 hover:bg-slate-800/80 border border-slate-600 hover:border-slate-500',
  danger:
    'bg-red-600 text-white hover:bg-red-500 border border-red-500/50 shadow-sm shadow-red-900/20',
  ghost: 'bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs rounded-lg',
  md: 'px-3.5 py-2 text-sm rounded-lg',
  lg: 'px-4 py-2.5 text-sm rounded-xl',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  disabled,
  children,
  ...props
}: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 disabled:cursor-not-allowed disabled:opacity-45',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export const inputClassName =
  'min-w-0 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25';

export const selectClassName =
  'min-w-0 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25';

export const labelClassName = 'flex flex-col gap-1.5 text-sm font-medium text-slate-300';
