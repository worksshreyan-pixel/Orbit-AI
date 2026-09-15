// local-agent/src/auditLogger.ts
import { promises as fs } from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.env.APPDATA || '', 'orbit', 'local-agent', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'audit.jsonl');

/** Ensure the log directory exists */
async function ensureLogDir() {
  await fs.mkdir(LOG_DIR, { recursive: true });
}

/** Write a structured audit entry */
export async function logAudit(entry: Record<string, unknown>): Promise<void> {
  await ensureLogDir();
  const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + '\n';
  await fs.appendFile(LOG_FILE, line, { encoding: 'utf8' });
}
