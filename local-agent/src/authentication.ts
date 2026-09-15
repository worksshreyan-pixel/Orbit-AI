// local-agent/src/authentication.ts
/**
 * Pairing and authentication logic for the Local Agent.
 *
 * The flow (as approved in Phase 11):
 * 1. Generate a random deviceId and a short-lived pairing secret.
 * 2. POST to the cloud "pairing/session" endpoint -> receives sessionId, 6-digit code, expiresAt (5 min lifetime).
 * 3. User enters the 6-digit code in the ORBIT UI.
 * 4. Cloud validates the code, binds the device to the user account, and issues a one-time credential.
 * 5. Agent exchanges the one-time credential for a long-lived opaque device token stored securely in %APPDATA%.
 * 6. Secrets/credentials are never exposed to the ORBIT LLM model or normal log outputs.
 */
import { randomBytes } from 'crypto';
import os from 'os';
import { setCredential, clearCredential } from './credentials';
import { startAgent } from './server';

const ORBIT_ENDPOINT = process.env.ORBIT_ENDPOINT || 'http://localhost:3000/api/agent/devices';

/** Generate a random identifier */
function generateId(length = 16): string {
  return randomBytes(length).toString('hex');
}

export interface PairingSession {
  deviceId: string;
  pairingSecret: string;
  sessionId: string;
  code: string;
  expiresAt: string;
}

export async function pairWithCode(code: string): Promise<string> {
  console.log(`[LocalAgent] Pairing with code: ${code}...`);
  const response = await fetch(`${ORBIT_ENDPOINT}/pair/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      hostname: os.hostname(),
      platform: os.platform()
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to complete pairing session');
  }

  const data = (await response.json()) as Record<string, any>;
  
  if (data.success && data.credential && data.deviceId) {
    // Re-pairing rotates/revokes previous credential
    await clearCredential();
    await setCredential(data.credential, data.deviceId);
    console.log('[LocalAgent] Pairing completed successfully. Device credential stored.');
    console.log('[LocalAgent] Starting Local Agent server...');
    
    // Once paired, we can start the agent
    startAgent();
    
    return data.credential;
  }
  
  throw new Error('Invalid response from ORBIT server');
}
