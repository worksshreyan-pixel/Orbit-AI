import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export function getLocalCredential(): { source: string, credential?: string, length?: number, fingerprint?: string } {
  let source = 'none';
  let cred: string | undefined = undefined;

  // Prefer environment if it's a valid 64-char hex string
  if (process.env.LOCAL_AGENT_CREDENTIAL && process.env.LOCAL_AGENT_CREDENTIAL.length > 30) {
    source = 'environment';
    cred = process.env.LOCAL_AGENT_CREDENTIAL;
  } else {
    try {
      const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config');
      const credPath = path.join(appData, 'orbit', 'local-agent', 'credential.json');
      if (fs.existsSync(credPath)) {
        const raw = fs.readFileSync(credPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.token) {
          source = 'file';
          cred = parsed.token;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  const length = cred ? cred.length : 0;
  const fingerprint = cred ? crypto.createHash('sha256').update(cred).digest('hex').substring(0, 8) : 'none';

  return { source, credential: cred, length, fingerprint };
}

export function getCredentialFingerprint(cred: string | undefined): string {
  if (!cred) return 'none';
  return crypto.createHash('sha256').update(cred).digest('hex').substring(0, 8);
}
