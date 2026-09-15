"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pairWithCode = pairWithCode;
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
const crypto_1 = require("crypto");
const os_1 = __importDefault(require("os"));
const credentials_1 = require("./credentials");
const server_1 = require("./server");
const ORBIT_ENDPOINT = process.env.ORBIT_ENDPOINT || 'http://localhost:3000/api/agent/devices';
/** Generate a random identifier */
function generateId(length = 16) {
    return (0, crypto_1.randomBytes)(length).toString('hex');
}
async function pairWithCode(code) {
    console.log(`[LocalAgent] Pairing with code: ${code}...`);
    const response = await fetch(`${ORBIT_ENDPOINT}/pair/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            code,
            hostname: os_1.default.hostname(),
            platform: os_1.default.platform()
        }),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to complete pairing session');
    }
    const data = (await response.json());
    if (data.success && data.credential && data.deviceId) {
        // Re-pairing rotates/revokes previous credential
        await (0, credentials_1.clearCredential)();
        await (0, credentials_1.setCredential)(data.credential, data.deviceId);
        console.log('[LocalAgent] Pairing completed successfully. Device credential stored.');
        console.log('[LocalAgent] Starting Local Agent server...');
        // Once paired, we can start the agent
        (0, server_1.startAgent)();
        return data.credential;
    }
    throw new Error('Invalid response from ORBIT server');
}
