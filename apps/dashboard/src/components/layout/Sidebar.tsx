import {
  BarChart3,
  LayoutDashboard,
  LogOut,
  Phone,
  RefreshCw,
  Smartphone,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

export type DashboardTab =
  | 'overview'
  | 'analytics'
  | 'calls'
  | 'contacts'
  | 'devices'
  | 'sync';

interface NavItem {
  id: DashboardTab;
  label: string;
  icon: LucideIcon;
}

/** Primary day-to-day views — shown first in the sidebar. */
const PRIMARY_NAV: NavItem[] = [
  { id: 'calls', label: 'Call Logs', icon: Phone },
  { id: 'devices', label: 'Devices & Debug', icon: Smartphone },
];

const SECONDARY_NAV: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'sync', label: 'Sync Activity', icon: RefreshCw },
];

export const NAV_ITEMS: NavItem[] = [...PRIMARY_NAV, ...SECONDARY_NAV];

export function tabTitle(tab: DashboardTab): string {
  return NAV_ITEMS.find((n) => n.id === tab)?.label ?? 'Dashboard';
}

interface SidebarProps {
  tab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export function Sidebar({ tab, onTabChange, open, onClose, onLogout }: SidebarProps) {
  const renderNavItem = (item: NavItem) => {
    const active = tab === item.id;
    const Icon = item.icon;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => {
          onTabChange(item.id);
          onClose();
        }}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition',
          active
            ? 'bg-indigo-600/20 text-indigo-300 ring-1 ring-inset ring-indigo-500/40'
            : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
        <span className="truncate">{item.label}</span>
      </button>
    );
  };

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-slate-800/80 bg-slate-900/95 backdrop-blur-xl transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 lg:bg-slate-900/70',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/30">
            <Phone className="h-5 w-5 text-white" strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-white">Call Log Sync</div>
            <div className="text-xs text-slate-500">Enterprise Admin</div>
          </div>
        </div>

        <nav className="scrollbar-thin flex-1 overflow-y-auto p-3" aria-label="Main navigation">
          <div className="space-y-1">{PRIMARY_NAV.map(renderNavItem)}</div>
          <div className="my-3 border-t border-slate-800/80" aria-hidden />
          <div className="space-y-1">{SECONDARY_NAV.map(renderNavItem)}</div>
        </nav>

        <div className="border-t border-slate-800 p-3">
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
