// local-agent/src/server.ts
import http from 'http';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import { AgentRequest, AgentResponse, AgentEvent } from './protocol/messages';
import { getCredential } from './credentials';
import { capabilityRegistry } from './capabilities';
import { checkPermission } from './permissions';
import { logAudit } from './auditLogger';

const PORT = process.env.LOCAL_AGENT_PORT ? parseInt(process.env.LOCAL_AGENT_PORT) : 3001;

export function startAgent() {
  const server = http.createServer();
  const wss = new WebSocketServer({ noServer: true });

  // Replay protection cache (store last 1000 requestIds)
  const seenRequests = new Set<string>();
  const requestHistory: string[] = [];
  
  function checkReplay(requestId: string): boolean {
    if (!requestId) return false;
    if (seenRequests.has(requestId)) return true;
    seenRequests.add(requestId);
    requestHistory.push(requestId);
    if (requestHistory.length > 1000) {
      const old = requestHistory.shift();
      if (old) seenRequests.delete(old);
    }
    return false;
  }

  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
      wss.emit('connection', ws, request);
    });
  });

  // Heartbeat interval
  const interval = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  wss.on('connection', (ws: any, req: any) => {
    console.log(`[LocalAgent-Server DEBUG] 2. WebSocket connection accepted from ${req.socket.remoteAddress}`);
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    const credential = getCredential();
    let authenticated = false;

    ws.once('message', (msg: RawData) => {
      try {
        console.log(`[LocalAgent-Server DEBUG] 3. Initial message received`);
        const parsed = JSON.parse(msg.toString()) as any;
        if (parsed.type !== 'auth' && parsed.event !== 'authenticate') {
          console.log(`[LocalAgent-Server DEBUG] 4. Authentication failed: invalid type`);
          ws.close(1008, 'Authentication required');
          return;
        }
        const token = parsed.credential || parsed.token;
        const crypto = require('crypto');
        const expectedFp = credential ? crypto.createHash('sha256').update(credential).digest('hex').substring(0, 8) : 'none';
        const receivedFp = token ? crypto.createHash('sha256').update(token).digest('hex').substring(0, 8) : 'none';
        console.log(`[LocalAgent-Server DEBUG] Expected fingerprint: ${expectedFp}, Received fingerprint: ${receivedFp}`);

        if (!token || token !== credential) {
          console.log(`[LocalAgent-Server DEBUG] 4. Authentication failed: invalid token`);
          ws.close(1008, 'Invalid token');
          return;
        }
        
        authenticated = true;
        console.log(`[LocalAgent-Server DEBUG] 4. Authentication succeeded`);
        ws.send(JSON.stringify({ type: 'auth_result', success: true } as any));
        
        ws.on('message', async (message: RawData) => {
          if (!authenticated) return;
          try {
            const request = JSON.parse(message.toString()) as any;
            if (request.type === 'auth') return; // Ignore duplicate auth

            const capability = request.capability;
            const args = request.args;
            const requestId = request.requestId;
            
            console.log(`[LocalAgent-Server DEBUG] 5. Capability request received: ${capability} [requestId: ${requestId}]`);

            if (checkReplay(requestId)) {
               const response: AgentResponse = { type: 'response', requestId, success: false, error: 'Replay detected' };
               ws.send(JSON.stringify(response));
               await logAudit({ capability, requestId, status: 'error', permissionLevel: 1, error: 'Replay detected' });
               return;
            }

            try {
              console.log(`[LocalAgent-Server DEBUG] 6. ${capability} started`);
              await checkPermission(capability, args);
              const handler = capabilityRegistry[capability];
              if (!handler) throw new Error(`Capability not found: ${capability}`);
              const data = await handler(args);
              console.log(`[LocalAgent-Server DEBUG] 7. ${capability} completed`);
              const response: AgentResponse = { type: 'response', requestId, success: true, data };
              ws.send(JSON.stringify(response));
              console.log(`[LocalAgent-Server DEBUG] 8. Response sent [requestId: ${requestId}]`);
              await logAudit({ capability, requestId, status: 'completed', permissionLevel: 1, path: (args && (args as any).path) || null });
            } catch (e: any) {
              console.log(`[LocalAgent-Server DEBUG] 7. ${capability} failed: ${e.message}`);
              const response: AgentResponse = { type: 'response', requestId, success: false, error: e.message };
              ws.send(JSON.stringify(response));
              console.log(`[LocalAgent-Server DEBUG] 8. Error response sent [requestId: ${requestId}]`);
              await logAudit({ capability, requestId, status: 'error', permissionLevel: 1, error: e.message });
            }
          } catch (_) {
            // Ignore parse errors on secondary messages
          }
        });
      } catch (_) {
        console.log(`[LocalAgent-Server DEBUG] 4. Authentication failed: invalid format`);
        ws.close(1008, 'Invalid authentication message');
      }
    });

    ws.on('close', () => {
      console.log(`[LocalAgent-Server DEBUG] 9. WebSocket closed`);
    });
    ws.on('error', (err: any) => {
      console.log(`[LocalAgent-Server DEBUG] 9. WebSocket error: ${err.message}`);
    });
  });

  server.on('error', (e: any) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`\n[LocalAgent] Error: Local Agent is already running on port ${PORT}. Stop the existing process or use the existing server.\n`);
      process.exit(1);
    } else {
      console.error(`[LocalAgent] Server error:`, e);
      process.exit(1);
    }
  });

  server.listen(PORT, () => {
    console.log(`[LocalAgent] Listening on http://localhost:${PORT}`);
    console.log(`[LocalAgent] WebSocket endpoint: ws://localhost:${PORT}/ws`);
  });
}
