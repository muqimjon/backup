import { Injectable, signal } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import { RunBroadcast, TestResult } from './models';

@Injectable({ providedIn: 'root' })
export class Live {
  private connection?: HubConnection;

  readonly connected = signal(false);
  readonly last = signal<RunBroadcast | null>(null);
  readonly lastTest = signal<TestResult | null>(null);

  start(): void {
    if (this.connection) return;

    this.connection = new HubConnectionBuilder()
      .withUrl('/hubs/runs')
      .withAutomaticReconnect()
      .build();

    this.connection.on('run', (run: RunBroadcast) => this.last.set(run));
    this.connection.on('testResult', (r: TestResult) => this.lastTest.set(r));
    this.connection.onreconnected(() => this.connected.set(true));
    this.connection.onclose(() => this.connected.set(false));

    this.connection.start()
      .then(() => this.connected.set(true))
      .catch(() => this.connected.set(false));
  }

  stop(): void {
    if (this.connection?.state === HubConnectionState.Connected) this.connection.stop();
    this.connection = undefined;
    this.connected.set(false);
  }
}
