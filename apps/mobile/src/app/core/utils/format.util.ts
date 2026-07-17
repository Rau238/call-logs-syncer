const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const TIME_FMT = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
});

export function formatCallDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) {
    return `Today, ${TIME_FMT.format(date)}`;
  }
  if (isSameDay(date, yesterday)) {
    return `Yesterday, ${TIME_FMT.format(date)}`;
  }
  return `${DATE_FMT.format(date)} · ${TIME_FMT.format(date)}`;
}

export function formatCallDateGroup(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return DATE_FMT.format(date);
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

export function callTypeLabel(type: string): string {
  switch (type) {
    case 'INCOMING':
      return 'Incoming';
    case 'OUTGOING':
      return 'Outgoing';
    case 'MISSED':
      return 'Missed';
    case 'REJECTED':
      return 'Rejected';
    case 'BLOCKED':
      return 'Blocked';
    case 'VOICEMAIL':
      return 'Voicemail';
    default:
      return type;
  }
}

export function callTypeIcon(type: string): string {
  switch (type) {
    case 'INCOMING':
      return 'arrow-down-circle';
    case 'OUTGOING':
      return 'arrow-up-circle';
    case 'MISSED':
      return 'close-circle';
    case 'REJECTED':
      return 'ban';
    case 'BLOCKED':
      return 'hand-left';
    case 'VOICEMAIL':
      return 'recording';
    default:
      return 'call';
  }
}

export function callTypeColor(type: string): string {
  switch (type) {
    case 'INCOMING':
      return 'success';
    case 'OUTGOING':
      return 'primary';
    case 'MISSED':
    case 'REJECTED':
    case 'BLOCKED':
      return 'danger';
    case 'VOICEMAIL':
      return 'tertiary';
    default:
      return 'medium';
  }
}
