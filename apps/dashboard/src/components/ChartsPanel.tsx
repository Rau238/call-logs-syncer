import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useEffect, useState } from 'react';
import type { Analytics } from '../api';
import { RowActions } from './RowActions';
import { Badge } from './ui/Badge';
import { cn } from '../lib/cn';
import { callTypeLabel, formatDuration } from '../utils/format';

const TYPE_COLORS: Record<string, string> = {
  INCOMING: '#22c55e',
  OUTGOING: '#3b82f6',
  MISSED: '#ef4444',
  REJECTED: '#f59e0b',
  BLOCKED: '#78716c',
  VOICEMAIL: '#a855f7',
  UNKNOWN: '#64748b',
};

const GRID_STROKE = '#1e293b';
const AXIS = { tickLine: false, axisLine: false, stroke: '#64748b', fontSize: 10 };

const tooltipStyle = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 6,
  fontSize: 11,
  padding: '6px 10px',
};

interface Props {
  analytics: Analytics | null;
  onEditContact?: (contact: Analytics['topNumbers'][0]) => void;
  onDeleteContact?: (contact: Analytics['topNumbers'][0]) => void;
  actionDisabled?: boolean;
}

function useChartHeight(): number {
  const [height, setHeight] = useState(200);

  useEffect(() => {
    const sm = window.matchMedia('(min-width: 640px)');
    const lg = window.matchMedia('(min-width: 1024px)');
    const update = () => {
      if (lg.matches) setHeight(240);
      else if (sm.matches) setHeight(220);
      else setHeight(200);
    };
    update();
    sm.addEventListener('change', update);
    lg.addEventListener('change', update);
    return () => {
      sm.removeEventListener('change', update);
      lg.removeEventListener('change', update);
    };
  }, []);

  return height;
}

function ChartCard({
  title,
  hint,
  className,
  children,
}: {
  title: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-slate-800/70 bg-slate-900/40 p-2.5 sm:p-3',
        className
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-slate-200">{title}</h3>
        {hint && <span className="hidden truncate text-[10px] text-slate-500 sm:inline">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function ChartsPanel({
  analytics,
  onEditContact,
  onDeleteContact,
  actionDisabled,
}: Props) {
  const chartHeight = useChartHeight();

  if (!analytics) return null;

  const typeData = analytics.callsByType.map((t) => ({
    name: callTypeLabel(t.callType),
    value: t.count,
    key: t.callType,
  }));

  const dayData = analytics.callsByDay.map((d) => ({
    date: d.date.slice(5),
    calls: d.count,
    deleted: d.deleted,
  }));

  const hourData = Array.from({ length: 24 }, (_, hour) => ({
    hour: hour % 3 === 0 ? `${hour}h` : '',
    count: analytics.callsByHour.find((h) => h.hour === hour)?.count ?? 0,
    fullHour: `${hour}:00`,
  }));

  const deviceData = analytics.deviceActivity.slice(0, 6).map((d) => ({
    name: (d.deviceName || d.deviceId).slice(0, 14),
    calls: d.callCount,
    deleted: d.deletedCount,
  }));

  const legendStyle = { fontSize: 10, paddingTop: 4 };
  const chartMargin = { top: 4, right: 4, left: -18, bottom: 0 };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <ChartCard title="Call volume" hint="Last 14 days" className="sm:col-span-2">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={dayData} margin={chartMargin} barGap={1} barCategoryGap="18%">
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="date" {...AXIS} tickMargin={4} interval="preserveStartEnd" />
            <YAxis {...AXIS} width={28} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(51,65,85,0.25)' }} />
            <Legend wrapperStyle={legendStyle} iconSize={8} />
            <Bar dataKey="calls" fill="#6366f1" name="Calls" radius={[2, 2, 0, 0]} maxBarSize={28} />
            <Bar dataKey="deleted" fill="#ef4444" name="Deleted" radius={[2, 2, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="By type" hint="Distribution">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <Pie
              data={typeData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="46%"
              innerRadius="42%"
              outerRadius="68%"
              paddingAngle={2}
              stroke="none"
            >
              {typeData.map((entry) => (
                <Cell key={entry.key} fill={TYPE_COLORS[entry.key] ?? '#64748b'} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={legendStyle} iconSize={8} layout="horizontal" verticalAlign="bottom" />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Hourly pattern" hint="Last 7 days">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={hourData} margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="hour" {...AXIS} tickMargin={4} interval={0} />
            <YAxis {...AXIS} width={28} allowDecimals={false} />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: 'rgba(51,65,85,0.25)' }}
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload?.fullHour ? String(payload[0].payload.fullHour) : ''
              }
            />
            <Bar dataKey="count" fill="#818cf8" name="Calls" radius={[2, 2, 0, 0]} maxBarSize={12} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Device activity" hint="Synced vs deleted" className="sm:col-span-2">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={deviceData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
            <XAxis type="number" {...AXIS} allowDecimals={false} />
            <YAxis type="category" dataKey="name" {...AXIS} width={72} tickMargin={4} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(51,65,85,0.25)' }} />
            <Legend wrapperStyle={legendStyle} iconSize={8} />
            <Bar dataKey="calls" fill="#6366f1" name="Synced" radius={[0, 2, 2, 0]} maxBarSize={10} />
            <Bar dataKey="deleted" fill="#ef4444" name="Deleted" radius={[0, 2, 2, 0]} maxBarSize={10} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Top contacts" hint="Most active numbers" className="sm:col-span-2 xl:col-span-2">
        <div className="max-h-52 space-y-1.5 overflow-y-auto scrollbar-thin sm:max-h-56">
          {analytics.topNumbers.slice(0, 10).map((n) => (
            <div
              key={n.phoneNumber}
              className="flex items-center justify-between gap-2 rounded-md border border-slate-800/60 bg-slate-950/40 px-2 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-slate-100">
                  {n.contactName || 'Unknown'}
                </div>
                <div className="truncate font-mono text-[10px] text-slate-500">{n.phoneNumber}</div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                <Badge>{n.callCount}</Badge>
                {n.deletedCount > 0 && <Badge variant="danger">{n.deletedCount} del</Badge>}
                {(onEditContact || onDeleteContact) && (
                  <RowActions
                    onEdit={onEditContact ? () => onEditContact(n) : undefined}
                    onDelete={onDeleteContact ? () => onDeleteContact(n) : undefined}
                    disabled={actionDisabled}
                    compact
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </ChartCard>
    </div>
  );
}
