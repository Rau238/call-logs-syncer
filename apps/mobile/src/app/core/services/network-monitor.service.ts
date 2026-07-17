import { Injectable } from '@angular/core';
import { Network } from '@capacitor/network';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * NetworkMonitorService — Detects internet ON/OFF using Capacitor Network.
 * Triggers sync when connectivity is restored.
 */
@Injectable({
  providedIn: 'root',
})
export class NetworkMonitorService {
  private connected$ = new BehaviorSubject<boolean>(true);
  private listenerHandle: { remove: () => Promise<void> } | null = null;

  async initialize(onReconnect: () => void): Promise<void> {
    const status = await Network.getStatus();
    this.connected$.next(status.connected);

    this.listenerHandle = await Network.addListener(
      'networkStatusChange',
      (newStatus) => {
        const wasOffline = !this.connected$.value;
        this.connected$.next(newStatus.connected);

        if (wasOffline && newStatus.connected) {
          onReconnect();
        }
      }
    );
  }

  isConnected(): boolean {
    return this.connected$.value;
  }

  get connected(): Observable<boolean> {
    return this.connected$.asObservable();
  }

  async destroy(): Promise<void> {
    await this.listenerHandle?.remove();
    this.listenerHandle = null;
  }
}
