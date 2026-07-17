import { Injectable } from '@angular/core';
import { Network, ConnectionStatus } from '@capacitor/network';
import { CallLogSync, NetworkInfo } from 'call-log-sync';
import { BehaviorSubject, Observable } from 'rxjs';

export interface NetworkDetails {
  connected: boolean;
  connectionType: NetworkInfo['connectionType'];
  networkName: string;
}

/**
 * NetworkMonitorService — connectivity, type (Wi‑Fi/mobile), and network name.
 */
@Injectable({
  providedIn: 'root',
})
export class NetworkMonitorService {
  private connected$ = new BehaviorSubject<boolean>(true);
  private details$ = new BehaviorSubject<NetworkDetails>({
    connected: true,
    connectionType: 'unknown',
    networkName: '',
  });
  private listenerHandle: { remove: () => Promise<void> } | null = null;

  async initialize(onReconnect: () => void): Promise<void> {
    await this.refreshDetails();

    this.listenerHandle = await Network.addListener(
      'networkStatusChange',
      async (newStatus: ConnectionStatus) => {
        const wasOffline = !this.connected$.value;
        await this.refreshDetails(newStatus);
        if (wasOffline && newStatus.connected) {
          onReconnect();
        }
      }
    );
  }

  private async refreshDetails(capStatus?: ConnectionStatus): Promise<void> {
    try {
      const native = await CallLogSync.getNetworkInfo();
      const details: NetworkDetails = {
        connected: native.connected,
        connectionType: native.connectionType,
        networkName: native.networkName,
      };
      this.connected$.next(details.connected);
      this.details$.next(details);
    } catch {
      const status = capStatus ?? (await Network.getStatus());
      const fallbackType =
        status.connectionType === 'wifi' || status.connectionType === 'cellular'
          ? status.connectionType
          : status.connected
            ? 'unknown'
            : 'none';
      const details: NetworkDetails = {
        connected: status.connected,
        connectionType: fallbackType,
        networkName: fallbackType === 'wifi' ? 'Wi‑Fi' : fallbackType === 'cellular' ? 'Mobile network' : '',
      };
      this.connected$.next(details.connected);
      this.details$.next(details);
    }
  }

  isConnected(): boolean {
    return this.connected$.value;
  }

  getDetails(): NetworkDetails {
    return this.details$.value;
  }

  async refresh(): Promise<NetworkDetails> {
    await this.refreshDetails();
    return this.details$.value;
  }

  get connected(): Observable<boolean> {
    return this.connected$.asObservable();
  }

  get details(): Observable<NetworkDetails> {
    return this.details$.asObservable();
  }

  async destroy(): Promise<void> {
    await this.listenerHandle?.remove();
    this.listenerHandle = null;
  }
}
