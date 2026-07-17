import { Loader2, LogIn, Phone, Mail, Lock } from 'lucide-react';
import { Button, inputClassName, labelClassName } from './ui/Button';

interface Props {
  email: string;
  password: string;
  error: string;
  loading?: boolean;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function LoginPage({
  email,
  password,
  error,
  loading,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: Props) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-violet-600/15 blur-3xl" />
      </div>

      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-md rounded-2xl border border-slate-800/80 bg-slate-900/80 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl"
      >
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/30">
            <Phone className="h-6 w-6 text-white" strokeWidth={2.25} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Call Log Sync</h1>
            <p className="text-sm text-slate-400">Enterprise Admin Dashboard</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2.5 text-sm text-red-200">
            {error}
          </div>
        )}

        <label className={labelClassName}>
          Email address
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" strokeWidth={2} />
            <input
              type="email"
              className={`${inputClassName} pl-10`}
              placeholder="admin@enterprise.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              autoComplete="username"
            />
          </div>
        </label>

        <label className={`${labelClassName} mt-4`}>
          Password
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" strokeWidth={2} />
            <input
              type="password"
              className={`${inputClassName} pl-10`}
              placeholder="••••••••"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              autoComplete="current-password"
            />
          </div>
        </label>

        <Button type="submit" variant="primary" size="lg" className="mt-6 w-full" disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : (
            <LogIn className="h-4 w-4" strokeWidth={2} />
          )}
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
