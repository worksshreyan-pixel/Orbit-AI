// Computer provider - connects to Local Agent via env-configured WebSocket

export interface SystemInfo {
  platform: string;
  arch: string;
  hostname: string;
  cpus: number;
  totalMemoryMB: number;
  freeMemoryMB: number;
  uptimeSeconds: number;
  agentVersion: string;
}

export interface WindowInfo {
  title: string;
  processName: string;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  memoryMB: number;
}

export interface ScreenInfo {
  width: number;
  height: number;
}

export interface ScreenshotResult {
  data: string;
  mimeType: string;
}

export interface AppActionArgs {
  app: string;
}

export interface AppActionResult {
  success: boolean;
  message: string;
}

export interface UrlActionArgs {
  url: string;
}

export interface UrlActionResult {
  success: boolean;
  url: string;
}

export interface ComputerProvider {
  getSystemInfo(): Promise<SystemInfo>;
  getActiveWindow(): Promise<WindowInfo>;
  getRunningProcesses(): Promise<ProcessInfo[]>;
  getScreenInfo(): Promise<ScreenInfo>;
  takeScreenshot(): Promise<ScreenshotResult>;
  openApp(args: AppActionArgs): Promise<AppActionResult>;
  closeApp(args: AppActionArgs): Promise<AppActionResult>;
  openUrl(args: UrlActionArgs): Promise<UrlActionResult>;
}

export class DefaultComputerProvider implements ComputerProvider {
  async getSystemInfo(): Promise<SystemInfo> {
    throw new Error('COMPUTER_CAPABILITY_DENIED: Computer capabilities are only supported via local-agent.');
  }
  async getActiveWindow(): Promise<WindowInfo> {
    throw new Error('COMPUTER_CAPABILITY_DENIED: Computer capabilities are only supported via local-agent.');
  }
  async getRunningProcesses(): Promise<ProcessInfo[]> {
    throw new Error('COMPUTER_CAPABILITY_DENIED: Computer capabilities are only supported via local-agent.');
  }
  async getScreenInfo(): Promise<ScreenInfo> {
    throw new Error('COMPUTER_CAPABILITY_DENIED: Computer capabilities are only supported via local-agent.');
  }
  async takeScreenshot(): Promise<ScreenshotResult> {
    throw new Error('COMPUTER_CAPABILITY_DENIED: Computer capabilities are only supported via local-agent.');
  }
  async openApp(args: AppActionArgs): Promise<AppActionResult> {
    throw new Error('COMPUTER_CAPABILITY_DENIED: Computer capabilities are only supported via local-agent.');
  }
  async closeApp(args: AppActionArgs): Promise<AppActionResult> {
    throw new Error('COMPUTER_CAPABILITY_DENIED: Computer capabilities are only supported via local-agent.');
  }
  async openUrl(args: UrlActionArgs): Promise<UrlActionResult> {
    throw new Error('COMPUTER_CAPABILITY_DENIED: Computer capabilities are only supported via local-agent.');
  }
}

export const defaultComputerProvider = new DefaultComputerProvider();

// Global cache for local computer provider to avoid reconnects
const globalForComputer = global as unknown as { cachedLocalComputerProvider?: ComputerProvider };
let cachedLocalComputerProvider = globalForComputer.cachedLocalComputerProvider;

export async function getComputerProvider(executionTarget: 'cloud' | 'local-agent', userId: string): Promise<ComputerProvider> {
  if (executionTarget === 'local-agent') {
    if (!cachedLocalComputerProvider) {
      const { getLocalCredential } = await import('./local-credentials');
      const credInfo = getLocalCredential();
      
      const wsUrl = process.env.LOCAL_AGENT_WS_URL || 'ws://localhost:3001/ws';
      const credential = credInfo.credential;

      if (!credential) {
        throw new Error(`LOCAL_AGENT_OFFLINE: LOCAL_AGENT_CREDENTIAL is not configured. (Source checked: ${credInfo.source})`);
      }

      console.log(`[ORBIT-Connection DEBUG] ORBIT resolving credential from ${credInfo.source}, length=${credInfo.length}, fingerprint=${credInfo.fingerprint}`);

      // Dynamic import to avoid circular dependency
      const { LocalAgentComputerProvider } = await import('./local-agent-provider');
      cachedLocalComputerProvider = new LocalAgentComputerProvider(wsUrl, credential);
      globalForComputer.cachedLocalComputerProvider = cachedLocalComputerProvider;
    }
    return cachedLocalComputerProvider;
  }

  return defaultComputerProvider;
}
