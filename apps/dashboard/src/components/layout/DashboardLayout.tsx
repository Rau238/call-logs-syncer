import { useState } from 'react';
import { Sidebar, type DashboardTab } from './Sidebar';
import { TopHeader } from './TopHeader';
import { PageProgressBar } from '../ui/LoadingOverlay';
import type { DashboardStats } from '../../api';

interface Props {
  tab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  onLogout: () => void;
  onRefresh: () => void;
  lastUpdated: Date | null;
  livePulse: boolean;
  stats: DashboardStats | null;
  refreshing?: boolean;
  fetching?: boolean;
  children: React.ReactNode;
}

export function DashboardLayout({
  tab,
  onTabChange,
  onLogout,
  onRefresh,
  lastUpdated,
  livePulse,
  stats,
  refreshing,
  fetching,
  children,
}: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const showProgress = Boolean(refreshing || fetching);

  return (
    <div className="relative flex min-h-screen bg-slate-950">
      <PageProgressBar active={showProgress} />
      <Sidebar
        tab={tab}
        onTabChange={onTabChange}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={onLogout}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader
          tab={tab}
          lastUpdated={lastUpdated}
          livePulse={livePulse}
          stats={stats}
          refreshing={refreshing}
          onMenuOpen={() => setSidebarOpen(true)}
          onRefresh={onRefresh}
        />

        <main className="scrollbar-thin flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-5">
          <div className="mx-auto w-full max-w-[1680px] space-y-4">{children}</div>
        </main>
      </div>
    </div>
  );
}

export type { DashboardTab };
