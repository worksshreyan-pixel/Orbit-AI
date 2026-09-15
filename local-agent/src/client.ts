// local-agent/src/client.ts
import WebSocket from 'ws';
import { AgentEvent, AgentRequest, AgentResponse } from './protocol/messages';
import { getCredential } from './credentials';
import { capabilityRegistry } from './capabilities';
import { checkPermission } from './permissions';
import { logAudit } from './auditLogger';

const BACKOFF_STEPS_MS = [1000, 2000, 5000, 10000, 30000, 60000];

export class LocalAgentClient {
  private serverUrl: string;
  private ws: WebSocket | null = null;
  private retryCount = 0;
  private isStopped = false;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  public start(): void {
    this.isStopped = false;
    this.connect();
  }

  public stop(): void {
    this.isStopped = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private connect(): void {
    if (this.isStopped) return;

    try {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.on('open', () => {
        console.log(`[LocalAgentClient] Connected to ${this.serverUrl}, authenticating...`);
        this.retryCount = 0;
        const credential = getCredential();
        const authEvent: AgentEvent & { token?: string } = {
          type: 'event',
          requestId: `auth-${Date.now()}`,
          event: 'authenticate',
          token: credential,
          payload: {},
        };
        this.ws?.send(JSON.stringify(authEvent));
      });

      this.ws.on('message', async (data: WebSocket.RawData) => {
        try {
          const parsed = JSON.parse(data.toString());
          
          if (parsed.type === 'event' && parsed.event === 'authenticated') {
            console.log('[LocalAgentClient] Successfully authenticated with cloud orchestrator.');
            return;
          }

          if (parsed.type === 'event' && parsed.event === 'notification') {
            const { title, message, priority, speak } = parsed.payload;
            console.log(`\n🔔 [ORBIT Notification] ${title}`);
            if (message) console.log(`   ${message}`);
            // Use node-notifier for desktop notifications
            try {
              const notifier = require('node-notifier');
              notifier.notify({
                title: title || 'ORBIT Notification',
                message: message || '',
                sound: priority === 'high' || priority === 'critical',
                wait: true
              });
            } catch (err) {
              console.log('[LocalAgentClient] (node-notifier not installed, skipping desktop UI alert)');
            }
            return;
          }

          if (parsed.type === 'request') {
            const request = parsed as AgentRequest;
            const { capability, args, requestId } = request;
            try {
              const level = await checkPermission(capability, args);
              const handler = capabilityRegistry[capability];
              if (!handler) {
                throw new Error(`Capability '${capability}' not found.`);
              }
              const result = await handler(args);
              const response: AgentResponse = {
                type: 'response',
                requestId,
                success: true,
                data: result,
              };
              this.ws?.send(JSON.stringify(response));
              await logAudit({
                capability,
                requestId,
                permissionLevel: level,
                status: 'completed',
                path: (args && (args as any).path) || null,
              });
            } catch (err: any) {
              const response: AgentResponse = {
                type: 'response',
                requestId,
                success: false,
                error: err.message,
              };
              this.ws?.send(JSON.stringify(response));
              await logAudit({
                capability,
                requestId,
                status: 'error',
                error: err.message,
              });
            }
          }
        } catch (e) {
          console.error('[LocalAgentClient] Error handling message:', e);
        }
      });

      this.ws.on('close', () => {
        console.log('[LocalAgentClient] Connection lost.');
        this.scheduleReconnect();
      });

      this.ws.on('error', (err: Error) => {
        console.error('[LocalAgentClient] Connection error:', err.message);
      });
    } catch (e: any) {
      console.error('[LocalAgentClient] Failed to establish connection:', e.message);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.isStopped) return;

    const baseDelay = BACKOFF_STEPS_MS[Math.min(this.retryCount, BACKOFF_STEPS_MS.length - 1)];
    const jitter = (Math.random() - 0.5) * 0.4 * baseDelay;
    const delay = Math.max(500, Math.round(baseDelay + jitter));

    this.retryCount++;
    console.log(`[LocalAgentClient] Reconnecting in ${delay}ms (attempt #${this.retryCount})...`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }
}
