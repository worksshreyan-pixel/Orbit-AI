// local-agent/src/credentials.ts
/**
 * Secure credential storage for ORBIT Local Agent on Windows.
 * Manages long-lived opaque device credentials in user-isolated AppData storage.
 * Device credentials are completely separate from short-lived pairing tokens.
 */
import fs from 'fs';
import path from 'path';

const CRED_DIR = path.join(process.env.APPDATA || osTempDir(), 'orbit', 'local-agent');
const CRED_PATH = path.join(CRED_DIR, 'credential.json');

function osTempDir(): string {
  return process.env.TEMP || process.env.TMP || 'C:\\Windows\\Temp';
}

export interface CredentialStore {
  deviceId?: string;
  token: string;
  createdAt: string;
  updatedAt: string;
}

/** Store the long-lived device credential with restricted file permissions */
export async function setCredential(token: string, deviceId?: string): Promise<void> {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token provided to setCredential');
  }

  await fs.promises.mkdir(CRED_DIR, { recursive: true });

  const payload: CredentialStore = {
    deviceId,
    token,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Write file with restricted permissions (0o600 - owner read/write only)
  await fs.promises.writeFile(CRED_PATH, JSON.stringify(payload, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
}

/** Retrieve the stored device token synchronously without require.cache pollution */
export function getCredential(): string {
  try {
    if (!fs.existsSync(CRED_PATH)) {
      return '';
    }
    const raw = fs.readFileSync(CRED_PATH, 'utf8');
    const parsed = JSON.parse(raw) as CredentialStore;
    return parsed && typeof parsed.token === 'string' ? parsed.token : '';
  } catch (_) {
    return '';
  }
}

/** Check if a valid credential exists */
export function hasCredential(): boolean {
  return Boolean(getCredential());
}

/** Revoke/remove the stored device credential on re-pairing or logout */
export async function clearCredential(): Promise<void> {
  try {
    if (fs.existsSync(CRED_PATH)) {
      await fs.promises.unlink(CRED_PATH);
    }
  } catch (_) {
    // Silently ignore if already removed
  }
}
