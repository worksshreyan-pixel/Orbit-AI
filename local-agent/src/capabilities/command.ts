// local-agent/src/capabilities/command.ts
import { spawn } from 'child_process';
import { resolveWorkspacePath } from '../workspaceGuard';
import { logAudit } from '../auditLogger';

// Whitelisted npm scripts (approved commands)
const allowedCommands = new Set<string>([
  'npm run build',
  'npm run test',
  'npm run lint',
  'npm run typecheck',
]);

/** Execute a permitted npm script within the project workspace safely */
export async function runProjectCommand(args: Record<string, unknown>): Promise<{ stdout: string; stderr: string }> {
  const commandArg = String(args.command || '').trim();
  
  if (!allowedCommands.has(commandArg)) {
    throw new Error(`Command not allowed: ${commandArg}`);
  }
  
  const workspaceRoot = await resolveWorkspacePath('.');
  
  return new Promise((resolve, reject) => {
    const parts = commandArg.split(' ');
    const cmd = parts[0];
    const cmdArgs = parts.slice(1);
    
    // Explicitly set shell: false to prevent command injection
    const child = spawn(cmd, cmdArgs, { cwd: workspaceRoot, shell: false });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('error', (error) => {
      logAudit({ capability: 'run_project_command', status: 'error', command: commandArg, error: error.message });
      reject(error);
    });
    
    child.on('close', (code) => {
      if (code !== 0) {
        const err = new Error(`Command exited with code ${code}\nStderr: ${stderr}`);
        logAudit({ capability: 'run_project_command', status: 'error', command: commandArg, error: err.message });
        return reject(err);
      }
      logAudit({ capability: 'run_project_command', status: 'completed', command: commandArg, path: workspaceRoot });
      resolve({ stdout, stderr });
    });
  });
}
