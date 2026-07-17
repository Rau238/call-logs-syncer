import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

interface Props {
  open?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showClose?: boolean;
}

const sizeClass: Record<NonNullable<Props['size']>, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
};

export function Modal({
  open = true,
  onClose,
  children,
  className,
  size = 'md',
  showClose = true,
}: Props) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-[2px] sm:items-center sm:p-3"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={cn(
          'relative flex max-h-[min(92dvh,720px)] w-full flex-col overflow-hidden rounded-t-xl border border-slate-700/80 bg-slate-900 shadow-2xl shadow-black/50 sm:max-h-[88vh] sm:rounded-xl',
          sizeClass[size],
          className
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex shrink-0 justify-center pt-2 sm:hidden" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-slate-600" />
        </div>

        {showClose && (
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 sm:right-3 sm:top-3"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        )}

        <div className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)]">{children}</div>
      </div>
    </div>
  );
}

export function ModalHeader({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <div className="shrink-0 border-b border-slate-800 px-4 py-3 pr-12 sm:px-5 sm:py-3.5">
      <h2 className="text-base font-semibold leading-snug text-white sm:text-lg">{title}</h2>
      {subtitle && <div className="mt-1 text-xs leading-relaxed text-slate-400 sm:text-sm">{subtitle}</div>}
    </div>
  );
}

export function ModalBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 sm:py-4',
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:gap-3.5">{children}</div>
    </div>
  );
}

export function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-800 bg-slate-900 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
      {children}
    </div>
  );
}

export function ModalSection({
  title,
  variant = 'default',
  children,
  className,
}: {
  title?: string;
  variant?: 'default' | 'danger';
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3 text-sm',
        variant === 'default' && 'border-slate-800 bg-slate-950/60',
        variant === 'danger' && 'border-red-900/40 bg-red-950/20',
        className
      )}
    >
      {title && (
        <h3
          className={cn(
            'mb-2 text-[10px] font-semibold uppercase tracking-wide',
            variant === 'danger' ? 'text-red-400' : 'text-slate-500'
          )}
        >
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
