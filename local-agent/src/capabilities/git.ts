// local-agent/src/capabilities/git.ts
import { execSync } from 'child_process';
import { resolveWorkspacePath } from '../workspaceGuard';
import { logAudit } from '../auditLogger';

/** Run a git command safely in the workspace and return stdout */
function runGit(gitArgs: string[], cwd: string): string {
  const result = execSync(`git ${gitArgs.join(' ')}`, {
    cwd,
    encoding: 'utf8',
    timeout: 15_000,
  });
  return result.trim();
}

/** Git status (read-only) */
export async function gitStatus(args: Record<string, unknown>): Promise<{ branch: string; status: string }> {
  const workspace = String(args.workspace || '.');
  const cwd = await resolveWorkspacePath(workspace);
  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  const status = runGit(['status', '--porcelain'], cwd);
  await logAudit({ capability: 'git_status', status: 'completed', path: cwd });
  return { branch, status };
}

/** Git diff (read-only) */
export async function gitDiff(args: Record<string, unknown>): Promise<string> {
  const workspace = String(args.workspace || '.');
  const cwd = await resolveWorkspacePath(workspace);
  const diff = runGit(['diff', '--stat'], cwd);
  await logAudit({ capability: 'git_diff', status: 'completed', path: cwd });
  return diff;
}

/** Git log (read-only, last N commits) */
export async function gitLog(args: Record<string, unknown>): Promise<string> {
  const workspace = String(args.workspace || '.');
  const count = Number(args.count) || 10;
  const cwd = await resolveWorkspacePath(workspace);
  const log = runGit(['log', '--oneline', '-n', String(count)], cwd);
  await logAudit({ capability: 'git_log', status: 'completed', path: cwd });
  return log;
}

/** Git branches (read-only) */
export async function gitBranches(args: Record<string, unknown>): Promise<string[]> {
  const workspace = String(args.workspace || '.');
  const cwd = await resolveWorkspacePath(workspace);
  const raw = runGit(['branch', '--list'], cwd);
  const branches = raw.split('\n').map((b) => b.replace(/^\*?\s*/, '').trim()).filter(Boolean);
  await logAudit({ capability: 'git_branches', status: 'completed', path: cwd });
  return branches;
}
