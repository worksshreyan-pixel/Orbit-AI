import { ProjectWorkspaceProvider, ProjectInfo, FileTree, SearchResult } from './workspace';
import { CommandProvider, CommandResult, CommandOptions } from './command';
import { getLocalAgentConnection, LocalAgentConnectionManager } from './local-agent-connection';
import { 
  ComputerProvider, 
  SystemInfo, 
  WindowInfo, 
  ProcessInfo, 
  ScreenInfo, 
  ScreenshotResult, 
  AppActionArgs, 
  AppActionResult, 
  UrlActionArgs, 
  UrlActionResult 
} from './computer';

export class LocalAgentWorkspaceProvider implements ProjectWorkspaceProvider, CommandProvider {
  private connection: LocalAgentConnectionManager;

  constructor(wsUrl: string, credential: string) {
    this.connection = getLocalAgentConnection({ wsUrl, credential });
  }

  async getProjectInfo(projectPath: string): Promise<ProjectInfo> {
    try {
      const files = await this.connection.sendRequest<string[]>('list_dir', { path: projectPath }, 10000);
      
      let framework = 'Unknown';
      let language = 'Unknown';
      let packageManager = 'Unknown';
      let projectType = 'Unknown';
      
      if (files.includes('package.json')) {
        language = 'JavaScript';
        packageManager = files.includes('yarn.lock') ? 'yarn' : (files.includes('pnpm-lock.yaml') ? 'pnpm' : 'npm');
        projectType = 'Node.js/Web';
        
        try {
          const pkgRaw = await this.connection.sendRequest<string>('read_file', { path: `${projectPath}/package.json` }, 10000);
          const pkg = JSON.parse(pkgRaw);
          if (pkg.dependencies?.next) framework = 'Next.js';
          else if (pkg.dependencies?.react) framework = 'React';
          if (pkg.devDependencies?.typescript || pkg.dependencies?.typescript) language = 'TypeScript';
        } catch (e) {
          // ignore parsing error
        }
      }

      return {
        name: projectPath.split(/[/\\]/).pop() || 'project',
        framework,
        language,
        packageManager,
        projectType,
        files
      };
    } catch (e: any) {
      throw new Error(`Failed to inspect project: ${e.message}`);
    }
  }

  async listFiles(projectPath: string, directory?: string): Promise<FileTree[]> {
    const targetPath = directory ? `${projectPath}/${directory}` : projectPath;
    try {
      const files = await this.connection.sendRequest<string[]>('list_dir', { path: targetPath }, 15000);
      return files.map(name => ({
        name,
        type: name.includes('.') ? 'file' : 'directory' // Approximation since list_dir returns names only
      }));
    } catch (e: any) {
      throw new Error(`LOCAL_AGENT_CAPABILITY_DENIED: ${e.message}`);
    }
  }

  async readFile(projectPath: string, filePath: string): Promise<string> {
    try {
      const fullPath = `${projectPath}/${filePath}`;
      return await this.connection.sendRequest<string>('read_file', { path: fullPath }, 15000);
    } catch (e: any) {
      throw new Error(`LOCAL_AGENT_CAPABILITY_DENIED: ${e.message}`);
    }
  }

  async searchFiles(projectPath: string, query: string): Promise<SearchResult[]> {
    try {
      const results = await this.connection.sendRequest<SearchResult[]>('search_files', { path: projectPath, query }, 15000);
      return results;
    } catch (e: any) {
      throw new Error(`LOCAL_AGENT_CAPABILITY_DENIED: ${e.message}`);
    }
  }

  async writeFile(projectPath: string, filePath: string, content: string): Promise<void> {
    try {
      const fullPath = `${projectPath}/${filePath}`;
      await this.connection.sendRequest<void>('write_file', { path: fullPath, content }, 15000);
    } catch (e: any) {
      throw new Error(`LOCAL_AGENT_CAPABILITY_DENIED: ${e.message}`);
    }
  }

  async patchFile(projectPath: string, filePath: string, expectedContent: string, newContent: string): Promise<void> {
    try {
      const fullPath = `${projectPath}/${filePath}`;
      await this.connection.sendRequest<void>('patch_file', { path: fullPath, expectedContent, newContent }, 15000);
    } catch (e: any) {
      throw new Error(`LOCAL_AGENT_CAPABILITY_DENIED: ${e.message}`);
    }
  }

  async renameFile(projectPath: string, oldPath: string, newPath: string): Promise<void> {
    try {
      const fullOldPath = `${projectPath}/${oldPath}`;
      const fullNewPath = `${projectPath}/${newPath}`;
      await this.connection.sendRequest<void>('rename_file', { oldPath: fullOldPath, newPath: fullNewPath }, 15000);
    } catch (e: any) {
      throw new Error(`LOCAL_AGENT_CAPABILITY_DENIED: ${e.message}`);
    }
  }

  async deleteFile(projectPath: string, filePath: string): Promise<void> {
    try {
      const fullPath = `${projectPath}/${filePath}`;
      await this.connection.sendRequest<void>('delete_file', { path: fullPath }, 15000);
    } catch (e: any) {
      throw new Error(`LOCAL_AGENT_CAPABILITY_DENIED: ${e.message}`);
    }
  }

  async executeCommand(projectPath: string, commandString: string, options?: CommandOptions): Promise<CommandResult> {
    try {
      const timeoutMs = options?.timeoutMs || 2 * 60 * 1000;
      // Send the request. We assume the response structure from Local Agent matches CommandResult mostly.
      const result = await this.connection.sendRequest<any>('run_project_command', { path: projectPath, command: commandString }, timeoutMs);
      return {
        success: result.success,
        command: commandString,
        exitCode: result.exitCode ?? (result.success ? 0 : -1),
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        durationMs: result.durationMs || 0,
        timedOut: !!result.timedOut,
        truncated: !!result.truncated
      };
    } catch (e: any) {
      return {
        success: false,
        command: commandString,
        exitCode: -1,
        stdout: '',
        stderr: `LOCAL_AGENT_CAPABILITY_DENIED: ${e.message}`,
        durationMs: 0,
        timedOut: false,
        truncated: false
      };
    }
  }

  generateDiff(oldText: string, newText: string): string {
    return 'Diff generation not supported by local agent.';
  }
}

export class LocalAgentComputerProvider implements ComputerProvider {
  private connection: LocalAgentConnectionManager;

  constructor(wsUrl: string, credential: string) {
    this.connection = getLocalAgentConnection({ wsUrl, credential });
  }

  async getSystemInfo(): Promise<SystemInfo> {
    try {
      return await this.connection.sendRequest<SystemInfo>('get_system_info', {}, 10000);
    } catch (e: any) {
      throw new Error(`LOCAL_AGENT_CAPABILITY_DENIED: ${e.message}`);
    }
  }

  async getActiveWindow(): Promise<WindowInfo> {
    try {
      return await this.connection.sendRequest<WindowInfo>('get_active_window', {}, 10000);
    } catch (e: any) {
      throw new Error(`LOCAL_AGENT_CAPABILITY_DENIED: ${e.message}`);
    }
  }

  async getRunningProcesses(): Promise<ProcessInfo[]> {
    try {
      return await this.connection.sendRequest<ProcessInfo[]>('get_running_processes', {}, 15000);
    } catch (e: any) {
      throw new Error(`LOCAL_AGENT_CAPABILITY_DENIED: ${e.message}`);
    }
  }

  async getScreenInfo(): Promise<ScreenInfo> {
    try {
      return await this.connection.sendRequest<ScreenInfo>('get_screen_info', {}, 10000);
    } catch (e: any) {
      throw new Error(`LOCAL_AGENT_CAPABILITY_DENIED: ${e.message}`);
    }
  }

  async takeScreenshot(): Promise<ScreenshotResult> {
    try {
      return await this.connection.sendRequest<ScreenshotResult>('take_screenshot', {}, 30000);
    } catch (e: any) {
      throw new Error(`LOCAL_AGENT_CAPABILITY_DENIED: ${e.message}`);
    }
  }

  async openApp(args: AppActionArgs): Promise<AppActionResult> {
    try {
      return await this.connection.sendRequest<AppActionResult>('open_app', args as any, 15000);
    } catch (e: any) {
      throw new Error(`LOCAL_AGENT_CAPABILITY_DENIED: ${e.message}`);
    }
  }

  async closeApp(args: AppActionArgs): Promise<AppActionResult> {
    try {
      return await this.connection.sendRequest<AppActionResult>('close_app', args as any, 15000);
    } catch (e: any) {
      throw new Error(`LOCAL_AGENT_CAPABILITY_DENIED: ${e.message}`);
    }
  }

  async openUrl(args: UrlActionArgs): Promise<UrlActionResult> {
    try {
      return await this.connection.sendRequest<UrlActionResult>('open_url', args as any, 15000);
    } catch (e: any) {
      throw new Error(`LOCAL_AGENT_CAPABILITY_DENIED: ${e.message}`);
    }
  }
}
