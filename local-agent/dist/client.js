"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalAgentClient = void 0;
// local-agent/src/client.ts
const ws_1 = __importDefault(require("ws"));
const credentials_1 = require("./credentials");
const capabilities_1 = require("./capabilities");
const permissions_1 = require("./permissions");
const auditLogger_1 = require("./auditLogger");
const BACKOFF_STEPS_MS = [1000, 2000, 5000, 10000, 30000, 60000];
class LocalAgentClient {
    serverUrl;
    ws = null;
    retryCount = 0;
    isStopped = false;
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
    }
    start() {
        this.isStopped = false;
        this.connect();
    }
    stop() {
        this.isStopped = true;
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
    connect() {
        if (this.isStopped)
            return;
        try {
            this.ws = new ws_1.default(this.serverUrl);
            this.ws.on('open', () => {
                console.log(`[LocalAgentClient] Connected to ${this.serverUrl}, authenticating...`);
                this.retryCount = 0;
                const credential = (0, credentials_1.getCredential)();
                const authEvent = {
                    type: 'event',
                    requestId: `auth-${Date.now()}`,
                    event: 'authenticate',
                    token: credential,
                    payload: {},
                };
                this.ws?.send(JSON.stringify(authEvent));
            });
            this.ws.on('message', async (data) => {
                try {
                    const parsed = JSON.parse(data.toString());
                    if (parsed.type === 'event' && parsed.event === 'authenticated') {
                        console.log('[LocalAgentClient] Successfully authenticated with cloud orchestrator.');
                        return;
                    }
                    if (parsed.type === 'event' && parsed.event === 'notification') {
                        const { title, message, priority, speak } = parsed.payload;
                        console.log(`\n🔔 [ORBIT Notification] ${title}`);
                        if (message)
                            console.log(`   ${message}`);
                        // Use node-notifier for desktop notifications
                        try {
                            const notifier = require('node-notifier');
                            notifier.notify({
                                title: title || 'ORBIT Notification',
                                message: message || '',
                                sound: priority === 'high' || priority === 'critical',
                                wait: true
                            });
                        }
                        catch (err) {
                            console.log('[LocalAgentClient] (node-notifier not installed, skipping desktop UI alert)');
                        }
                        return;
                    }
                    if (parsed.type === 'request') {
                        const request = parsed;
                        const { capability, args, requestId } = request;
                        try {
                            const level = await (0, permissions_1.checkPermission)(capability, args);
                            const handler = capabilities_1.capabilityRegistry[capability];
                            if (!handler) {
                                throw new Error(`Capability '${capability}' not found.`);
                            }
                            const result = await handler(args);
                            const response = {
                                type: 'response',
                                requestId,
                                success: true,
                                data: result,
                            };
                            this.ws?.send(JSON.stringify(response));
                            await (0, auditLogger_1.logAudit)({
                                capability,
                                requestId,
                                permissionLevel: level,
                                status: 'completed',
                                path: (args && args.path) || null,
                            });
                        }
                        catch (err) {
                            const response = {
                                type: 'response',
                                requestId,
                                success: false,
                                error: err.message,
                            };
                            this.ws?.send(JSON.stringify(response));
                            await (0, auditLogger_1.logAudit)({
                                capability,
                                requestId,
                                status: 'error',
                                error: err.message,
                            });
                        }
                    }
                }
                catch (e) {
                    console.error('[LocalAgentClient] Error handling message:', e);
                }
            });
            this.ws.on('close', () => {
                console.log('[LocalAgentClient] Connection lost.');
                this.scheduleReconnect();
            });
            this.ws.on('error', (err) => {
                console.error('[LocalAgentClient] Connection error:', err.message);
            });
        }
        catch (e) {
            console.error('[LocalAgentClient] Failed to establish connection:', e.message);
            this.scheduleReconnect();
        }
    }
    scheduleReconnect() {
        if (this.isStopped)
            return;
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
exports.LocalAgentClient = LocalAgentClient;
