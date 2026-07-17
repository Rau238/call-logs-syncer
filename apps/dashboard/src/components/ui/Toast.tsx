import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4500;

const styles: Record<ToastType, { bar: string; icon: string; Icon: typeof CheckCircle2 }> = {
  success: {
    bar: 'border-emerald-800/50 bg-emerald-950/90 text-emerald-100',
    icon: 'text-emerald-400',
    Icon: CheckCircle2,
  },
  error: {
    bar: 'border-red-800/50 bg-red-950/90 text-red-100',
    icon: 'text-red-400',
    Icon: XCircle,
  },
  info: {
    bar: 'border-indigo-800/50 bg-indigo-950/90 text-indigo-100',
    icon: 'text-indigo-400',
    Icon: Info,
  },
};

function ToastBar({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const { bar, icon, Icon } = styles[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-xl shadow-black/30 backdrop-blur-md animate-[toast-in_0.25s_ease-out]',
        bar
      )}
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', icon)} strokeWidth={2} />
      <p className="flex-1 text-sm leading-snug">{toast.message}</p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded-md p-0.5 opacity-70 transition hover:bg-white/10 hover:opacity-100"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((type: ToastType, message: string) => {
    const id = String(++idRef.current);
    setToasts((prev) => [...prev.slice(-4), { id, type, message }]);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-label="Notifications"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(100vw-2rem,24rem)] flex-col gap-2 sm:bottom-5 sm:right-5"
      >
        {toasts.map((toast) => (
          <ToastBar key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
