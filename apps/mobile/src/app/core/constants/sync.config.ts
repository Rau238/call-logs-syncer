import { environment } from '../../../environments/environment';

/** Only import/sync calls from this many days back. */
export const SYNC_WINDOW_DAYS = environment.syncWindowDays ?? 7;

export function getSyncWindowStartMs(now = Date.now()): number {
  return now - SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export function isWithinSyncWindow(callTime: number, now = Date.now()): boolean {
  return callTime >= getSyncWindowStartMs(now);
}
