import { Menu, RefreshCw, PhoneCall, Trash2, Activity } from 'lucide-react';
import { Button } from '../ui/Button';
import { tabTitle, type DashboardTab } from './Sidebar';
import type { DashboardStats } from '../../api';
import { cn } from '../../lib/cn';

interface Props {
  tab: DashboardTab;
  title?: string;
  lastUpdated: Date | null;
  livePulse: boolean;
  stats: DashboardStats | null;
  refreshing?: boolean;
  onMenuOpen: () => void;
  onRefresh: () => void;
}

function StatPill({
  icon: Icon,
  value,
  label,
  valueClass,
}: {
  icon: typeof PhoneCall;
  value: number;
  label: string;
  valueClass?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/80 px-2.5 py-1.5 text-xs text-slate-400">
      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" strokeWidth={2} />
      <strong className={valueClass ?? 'font-semibold text-slate-200'}>{value.toLocaleString()}</strong>
      <span>{label}</span>
    </span>
  );
}

export function TopHeader({
  tab,
  title,
  lastUpdated,
  livePulse,
  stats,
  refreshing,
  onMenuOpen,
  onRefresh,
}: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-label="Open menu"
            onClick={onMenuOpen}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-300 transition hover:bg-slate-800 lg:hidden"
          >
            <Menu className="h-5 w-5" strokeWidth={2} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold tracking-tight text-white sm:text-lg">
              {title ?? tabTitle(tab)}
            </h1>
            {lastUpdated && (
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <span
                  className={`inline-block h-2 w-2 rounded-full bg-emerald-400 ${livePulse ? 'animate-pulse-dot' : ''}`}
                />
                Last updated {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {stats && (
            <div className="hidden items-center gap-2 lg:flex">
              <StatPill icon={PhoneCall} value={stats.callsToday} label="today" />
              <StatPill icon={Trash2} value={stats.deletedCalls} label="deleted" valueClass="font-semibold text-red-400" />
              <StatPill icon={Activity} value={stats.syncBatchesToday} label="syncs" />
            </div>
          )}
          <Button variant="outline" size="md" onClick={onRefresh} disabled={refreshing} className="shrink-0">
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} strokeWidth={2} />
            <span className="hidden sm:inline">{refreshing ? 'Refreshing…' : 'Refresh'}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
