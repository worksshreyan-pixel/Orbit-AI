import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { defaultWorkspaceProvider } from './workspace';
import { createServerClient } from '@/lib/supabase/server';

export interface CommandResult {
  success: boolean;
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  truncated: boolean;
}

export interface CommandOptions {
  timeoutMs?: number;
}

const MAX_OUTPUT_BYTES = 50 * 1024; // 50KB

const ALLOWED_EXECUTABLES = ['npm', 'npx', 'yarn', 'pnpm', 'bun'];
const ALLOWED_NPM_COMMANDS = ['run', 'test', 'lint', 'build', 'dev', 'start', 'install', 'add', 'check', 'typecheck'];

export const defaultCommandProvider = {
  async executeCommand(projectPath: string, commandString: string, options: CommandOptions = {}): Promise<CommandResult> {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let truncated = false;
    
    // Resolve secure workspace path (reusing Phase 6 boundary protection implicitly)
    // We can just verify it resolves properly by trying to get info.
    let resolvedRoot = '';
    try {
      const info = await defaultWorkspaceProvider.getProjectInfo(projectPath);
      // We need to resolve the path securely again to get the absolute path
      resolvedRoot = path.resolve(projectPath);
    } catch (e: any) {
      return { success: false, command: commandString, exitCode: -1, stdout: '', stderr: `Workspace Error: ${e.message}`, durationMs: 0, timedOut: false, truncated: false };
    }

    const args = commandString.trim().split(/\s+/);
    if (args.length === 0 || !args[0]) {
      return { success: false, command: commandString, exitCode: -1, stdout: '', stderr: 'Empty command', durationMs: 0, timedOut: false, truncated: false };
    }

    const executable = args[0].toLowerCase();
    
    // Explicit security: No shell chaining, injection operators
    if (args.some(a => ['&&', '||', ';', '|', '>', '>>', '<', '$(', '`'].some(op => a.includes(op)))) {
      return { success: false, command: commandString, exitCode: -1, stdout: '', stderr: 'Command rejected: Shell operators are not permitted.', durationMs: 0, timedOut: false, truncated: false };
    }

    // Explicit security: Whitelist executables
    if (!ALLOWED_EXECUTABLES.includes(executable)) {
      return { success: false, command: commandString, exitCode: -1, stdout: '', stderr: `Command rejected: Executable '${executable}' is not permitted. Only package manager commands are allowed.`, durationMs: 0, timedOut: false, truncated: false };
    }

    // Explicit security: Whitelist NPM arguments
    if (args.length > 1) {
      const subCommand = args[1].toLowerCase();
      if (!ALLOWED_NPM_COMMANDS.includes(subCommand)) {
        return { success: false, command: commandString, exitCode: -1, stdout: '', stderr: `Command rejected: Subcommand '${subCommand}' is not permitted.`, durationMs: 0, timedOut: false, truncated: false };
      }
    }

    // Explicit security: Validate package.json scripts before running `npm run X`
    if (executable === 'npm' && args[1] === 'run' && args.length > 2) {
      const scriptName = args[2];
      try {
        const pkgContent = await fs.promises.readFile(path.join(resolvedRoot, 'package.json'), 'utf8');
        const pkg = JSON.parse(pkgContent);
        if (!pkg.scripts || !pkg.scripts[scriptName]) {
          return { success: false, command: commandString, exitCode: -1, stdout: '', stderr: `Command rejected: Script '${scriptName}' does not exist in package.json.`, durationMs: 0, timedOut: false, truncated: false };
        }
      } catch (e) {
        return { success: false, command: commandString, exitCode: -1, stdout: '', stderr: 'Command rejected: Could not read package.json to verify script.', durationMs: 0, timedOut: false, truncated: false };
      }
    }

    // Environment Sanitation
    const sanitizedEnv = { ...process.env };
    for (const key of Object.keys(sanitizedEnv)) {
      const upperKey = key.toUpperCase();
      if (
        upperKey.includes('DATABASE') || 
        upperKey.includes('SUPABASE') || 
        upperKey.includes('KEY') || 
        upperKey.includes('SECRET') || 
        upperKey.includes('TOKEN') || 
        upperKey.includes('PASSWORD')
      ) {
        delete sanitizedEnv[key];
      }
    }

    const timeoutMs = options.timeoutMs || 2 * 60 * 1000; // default 2 mins

    return new Promise((resolve) => {
      let isTimedOut = false;
      const cmdExecutable = process.platform === 'win32' ? `${executable}.cmd` : executable;

      const child = spawn(cmdExecutable, args.slice(1), {
        cwd: resolvedRoot,
        env: sanitizedEnv,
        shell: false, // Critical: Enforce isolation
        windowsHide: true,
      });

      const timeoutId = setTimeout(() => {
        isTimedOut = true;
        child.kill('SIGKILL');
      }, timeoutMs);

      child.stdout.on('data', (data) => {
        if (stdout.length < MAX_OUTPUT_BYTES) {
          stdout += data.toString();
          if (stdout.length >= MAX_OUTPUT_BYTES) {
            stdout = stdout.substring(0, MAX_OUTPUT_BYTES) + '\n\n[STDOUT TRUNCATED]';
            truncated = true;
          }
        }
      });

      child.stderr.on('data', (data) => {
        if (stderr.length < MAX_OUTPUT_BYTES) {
          stderr += data.toString();
          if (stderr.length >= MAX_OUTPUT_BYTES) {
            stderr = stderr.substring(0, MAX_OUTPUT_BYTES) + '\n\n[STDERR TRUNCATED]';
            truncated = true;
          }
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          command: commandString,
          exitCode: -1,
          stdout,
          stderr: stderr + `\nFailed to start process: ${err.message}`,
          durationMs: Date.now() - startTime,
          timedOut: false,
          truncated
        });
      });

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        resolve({
          success: code === 0 && !isTimedOut,
          command: commandString,
          exitCode: code,
          stdout,
          stderr,
          durationMs: Date.now() - startTime,
          timedOut: isTimedOut,
          truncated
        });
      });
    });
  }
};

export interface CommandProvider {
  executeCommand(projectPath: string, commandString: string, options?: CommandOptions): Promise<CommandResult>;
}

let cachedLocalCommandProvider: CommandProvider | null = null;

export async function getCommandProvider(executionTarget: 'cloud' | 'local-agent', userId: string): Promise<CommandProvider> {
  if (executionTarget === 'local-agent') {
    if (!cachedLocalCommandProvider) {
      const supabase = createServerClient();
      const { data: devices, error } = await supabase
        .from('devices')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

      if (error || !devices || devices.length === 0) {
        throw new Error('LOCAL_AGENT_OFFLINE: No paired ORBIT Local Agent is currently online.');
      }
      
      const { LocalAgentWorkspaceProvider } = require('./local-agent-provider');
      const { getLocalCredential } = require('./local-credentials');
      cachedLocalCommandProvider = new LocalAgentWorkspaceProvider(
        process.env.LOCAL_AGENT_WS_URL || 'ws://localhost:3001/ws',
        getLocalCredential().credential || ''
      );
    }
    return cachedLocalCommandProvider!;
  }
  return defaultCommandProvider;
}
