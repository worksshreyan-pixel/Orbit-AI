import WebSocket from 'ws';
import crypto from 'crypto';

export interface LocalAgentConfig {
  wsUrl: string;
  credential: string;
}

export interface AgentRequest {
  type: 'request';
  requestId: string;
  capability: string;
  args?: Record<string, unknown>;
}

export interface AgentResponse {
  type: 'response';
  requestId: string;
  success: boolean;
  data?: any;
  error?: string;
}

export interface AgentEvent {
  type: 'event';
  requestId: string;
  event: string;
  payload: Record<string, unknown>;
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timeout: NodeJS.Timeout;
}

export class LocalAgentConnectionManager {
  private ws: WebSocket | null = null;
  private config: LocalAgentConfig;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private isConnecting: boolean = false;
  private connectionPromise: Promise<void> | null = null;
  private authenticated: boolean = false;

  constructor(config: LocalAgentConfig) {
    this.config = config;
  }

  public async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN && this.authenticated) {
      return; // Already connected and authenticated
    }

    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    this.isConnecting = true;
    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        console.log(`[ORBIT-Connection DEBUG] 3. WebSocket connection URL: ${this.config.wsUrl}`);
        this.ws = new WebSocket(this.config.wsUrl);
        console.log(`[ORBIT-Connection DEBUG] 4. WebSocket connection created`);

        this.ws.on('open', () => {
          console.log(`[ORBIT-Connection DEBUG] 5. WebSocket "open"`);
          // Send authentication message
          this.ws?.send(JSON.stringify({
            type: 'auth',
            event: 'authenticate',
            credential: this.config.credential
          }));
          console.log(`[ORBIT-Connection DEBUG] 6. authentication message sent`);
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const parsed = JSON.parse(data.toString());

            if (parsed.type === 'auth_result') {
              console.log(`[ORBIT-Connection DEBUG] 7. authentication response received: success=${parsed.success}`);
              if (parsed.success) {
                this.authenticated = true;
                this.isConnecting = false;
                resolve();
              } else {
                this.cleanup(new Error('LOCAL_AGENT_AUTH_FAILED'));
                reject(new Error('LOCAL_AGENT_AUTH_FAILED'));
              }
              return;
            }

            if (parsed.type === 'response' && parsed.requestId) {
              console.log(`[ORBIT-Connection DEBUG] 9. response received, including request/correlation ID: ${parsed.requestId}, success: ${parsed.success}`);
              const pending = this.pendingRequests.get(parsed.requestId);
              if (pending) {
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(parsed.requestId);
                if (parsed.success) {
                  pending.resolve(parsed.data);
                } else {
                  pending.reject(new Error(parsed.error || 'LOCAL_AGENT_CAPABILITY_DENIED'));
                }
                console.log(`[ORBIT-Connection DEBUG] 10. pending Promise resolved/rejected`);
              }
            }
          } catch (e) {
            console.error('[LocalAgentConnection] Failed to parse message:', e);
          }
        });

        this.ws.on('error', (err) => {
          console.log(`[ORBIT-Connection DEBUG] 11. WebSocket error: ${err.message}`);
          const error = new Error('LOCAL_AGENT_OFFLINE');
          if (this.isConnecting) {
            reject(error);
          }
          this.cleanup(error);
        });

        this.ws.on('close', () => {
          console.log(`[ORBIT-Connection DEBUG] 11. WebSocket closed`);
          this.cleanup(new Error('LOCAL_AGENT_OFFLINE'));
        });

        // Connection timeout
        setTimeout(() => {
          if (this.isConnecting) {
            console.log(`[ORBIT-Connection DEBUG] 12. connection timeout`);
            this.cleanup(new Error('LOCAL_AGENT_TIMEOUT'));
            reject(new Error('LOCAL_AGENT_TIMEOUT'));
          }
        }, 5000);

      } catch (err) {
        this.isConnecting = false;
        reject(new Error('LOCAL_AGENT_OFFLINE'));
      }
    });

    return this.connectionPromise;
  }

  private cleanup(error: Error) {
    this.authenticated = false;
    this.isConnecting = false;
    if (this.ws) {
      try { this.ws.close(); } catch (e) { }
      this.ws = null;
    }
    // Reject all pending requests
    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeout);
      pending.reject(error);
    });
    this.pendingRequests.clear();
  }

  public disconnect() {
    this.cleanup(new Error('LOCAL_AGENT_DISCONNECTED'));
  }

  public async sendRequest<T>(capability: string, args: Record<string, unknown> = {}, timeoutMs: number = 15000): Promise<T> {
    console.log(`[ORBIT-Connection DEBUG] 1. device lookup started`);
    await this.connect();
    console.log(`[ORBIT-Connection DEBUG] 2. device found (connection initialized)`);

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('LOCAL_AGENT_OFFLINE');
    }

    const requestId = crypto.randomUUID();

    const callerError = new Error();
    const callerStack = callerError.stack ? callerError.stack.split('\n').slice(1, 4).join(' | ').trim() : 'unknown caller';
    console.log(`\n[ORBIT DIAGNOSTIC] Preparing Local Agent capability request:
- capability name: ${capability}
- requestId: ${requestId}
- source/caller: ${callerStack}
- tool arguments: ${JSON.stringify(args)}`);

    if (!capability || capability === 'undefined') {
      throw new Error(`[ORBIT DIAGNOSTIC ERROR] Capability is undefined. Aborting request. requestId: ${requestId}`);
    }

    const request: AgentRequest = {
      type: 'request',
      requestId,
      capability,
      args
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        console.log(`[ORBIT-Connection DEBUG] 12. request timeout [requestId: ${requestId}]`);
        reject(new Error('LOCAL_AGENT_TIMEOUT'));
      }, timeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });
      console.log(`[ORBIT-Connection DEBUG] 8. capability request sent, including request/correlation ID: ${requestId}`);
      this.ws!.send(JSON.stringify(request));
    });
  }

  public async sendEvent(event: string, payload: Record<string, unknown> = {}): Promise<void> {
    await this.connect();

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('LOCAL_AGENT_OFFLINE');
    }

    const eventMessage: AgentEvent = {
      type: 'event',
      requestId: crypto.randomUUID(),
      event,
      payload
    };

    this.ws.send(JSON.stringify(eventMessage));
  }
}

// Global cache for connection multiplexing across Next.js API reloads
const globalForConnection = global as unknown as { localAgentManager: LocalAgentConnectionManager | undefined };

export function getLocalAgentConnection(config: LocalAgentConfig): LocalAgentConnectionManager {
  if (!globalForConnection.localAgentManager) {
    globalForConnection.localAgentManager = new LocalAgentConnectionManager(config);
  }
  return globalForConnection.localAgentManager;
}
