// local-agent/src/capabilities/apps.ts
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { logAudit } from '../auditLogger';

// Configured allowed application paths
const ALLOWED_APPS: Record<string, string[]> = {
  code: [
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'Code.exe'),
    'C:\\Program Files\\Microsoft VS Code\\Code.exe',
  ],
  chrome: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ],
  notepad: [
    'C:\\Windows\\System32\\notepad.exe',
    'C:\\Windows\\notepad.exe',
  ],
};

/** Verify and open an allowed application */
export async function openApp(args: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
  const appName = String(args.app || '').toLowerCase().trim();
  const candidates = ALLOWED_APPS[appName];
  
  if (!candidates) {
    throw new Error(`Application '${appName}' is not in the allowed apps registry.`);
  }

  let executablePath = '';
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      executablePath = candidate;
      break;
    }
  }

  if (!executablePath) {
    throw new Error(`Executable for application '${appName}' was not found on this system.`);
  }

  return new Promise((resolve, reject) => {
    // Explicitly use spawn with shell: false
    const child = spawn(executablePath, [], { shell: false, detached: true, stdio: 'ignore' });
    
    child.on('error', (error) => {
      logAudit({ capability: 'open_app', status: 'error', app: appName, error: error.message });
      reject(error);
    });

    child.unref(); // allow the parent process to exit independently
    logAudit({ capability: 'open_app', status: 'completed', app: appName, path: executablePath });
    resolve({ success: true, message: `Successfully launched ${appName}` });
  });
}

/** Open a URL in the user's default browser safely */
export async function openUrl(args: Record<string, unknown>): Promise<{ success: boolean; url: string }> {
  const targetUrl = String(args.url || '').trim();
  
  if (!/^https?:\/\//i.test(targetUrl)) {
    throw new Error('Only http:// and https:// URLs can be opened.');
  }

  try {
    // Use the safe 'open' library which avoids naive shell injections
    const openLib = (await import('open')).default;
    await openLib(targetUrl);
    logAudit({ capability: 'open_url', status: 'completed', url: targetUrl });
    return { success: true, url: targetUrl };
  } catch (error: any) {
    logAudit({ capability: 'open_url', status: 'error', url: targetUrl, error: error.message });
    throw error;
  }
}

/** Close an allowed application safely */
export async function closeApp(args: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
  const appName = String(args.app || '').toLowerCase().trim();
  const candidates = ALLOWED_APPS[appName];
  
  if (!candidates) {
    throw new Error(`Application '${appName}' is not in the allowed apps registry.`);
  }

  const executableName = path.basename(candidates[0]); // e.g. "Code.exe"

  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    // Use taskkill with exactly the executable name.
    // /F forcefully terminates, /IM specifies image name.
    await execAsync(`taskkill /F /IM "${executableName}"`);
    
    logAudit({ capability: 'close_app', status: 'completed', app: appName, executable: executableName });
    return { success: true, message: `Successfully closed ${appName}` };
  } catch (error: any) {
    logAudit({ capability: 'close_app', status: 'error', app: appName, error: error.message });
    throw new Error(`Failed to close ${appName}: ` + error.message);
  }
}
