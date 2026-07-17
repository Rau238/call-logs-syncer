import {
  Area,
  AreaChart,
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
import type { Analytics } from '../api';
import { RowActions } from './RowActions';
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

interface Props {
  analytics: Analytics | null;
  onEditContact?: (contact: Analytics['topNumbers'][0]) => void;
  onDeleteContact?: (contact: Analytics['topNumbers'][0]) => void;
  actionDisabled?: boolean;
}

export function ChartsPanel({
  analytics,
  onEditContact,
  onDeleteContact,
  actionDisabled,
}: Props) {
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

  const hourData = Array.from({ length: 24 }, (_, hour) => {
    const found = analytics.callsByHour.find((h) => h.hour === hour);
    return { hour: `${hour}:00`, count: found?.count ?? 0 };
  });

  const deviceData = analytics.deviceActivity.slice(0, 8).map((d) => ({
    name: d.deviceName || d.deviceId.slice(0, 8),
    calls: d.callCount,
    deleted: d.deletedCount,
  }));

  return (
    <div className="charts-grid">
      <div className="chart-card chart-wide">
        <h3>Calls — last 14 days</h3>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={dayData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
            <YAxis stroke="#94a3b8" fontSize={11} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="calls"
              stackId="1"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.35}
              name="Total calls"
            />
            <Area
              type="monotone"
              dataKey="deleted"
              stackId="2"
              stroke="#ef4444"
              fill="#ef4444"
              fillOpacity={0.4}
              name="Deleted from phone"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>By call type</h3>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={typeData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={2}
            >
              {typeData.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={TYPE_COLORS[entry.key] ?? '#64748b'}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Hourly pattern (7 days)</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={hourData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="hour" stroke="#94a3b8" fontSize={9} interval={3} />
            <YAxis stroke="#94a3b8" fontSize={11} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
            />
            <Bar dataKey="count" fill="#6366f1" name="Calls" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card chart-wide">
        <h3>Device activity</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={deviceData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis type="number" stroke="#94a3b8" fontSize={11} />
            <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={100} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
            />
            <Legend />
            <Bar dataKey="calls" fill="#3b82f6" name="Synced calls" radius={[0, 4, 4, 0]} />
            <Bar dataKey="deleted" fill="#ef4444" name="Deleted" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card chart-wide">
        <h3>Top numbers (multiple calls)</h3>
        <div className="top-numbers-list">
          {analytics.topNumbers.slice(0, 12).map((n) => (
            <div key={n.phoneNumber} className="top-number-row">
              <div>
                <div className="cell-primary">{n.contactName || 'Unknown'}</div>
                <div className="cell-sub mono">{n.phoneNumber}</div>
              </div>
              <div className="top-number-stats">
                <span className="pill">{n.callCount} calls</span>
                <span className="pill muted">{formatDuration(n.totalDuration)}</span>
                {n.deletedCount > 0 && (
                  <span className="pill danger">{n.deletedCount} deleted</span>
                )}
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
      </div>
    </div>
  );
}
