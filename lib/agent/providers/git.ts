import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const MAX_OUTPUT_BYTES = 50 * 1024; // 50KB

// Destructive flags that are explicitly forbidden regardless of context
const FORBIDDEN_FLAGS = [
  '--force', '-f', '--force-with-lease',
  '--hard', '--mixed', '--soft', // reset modes
  '-D',            // branch force-delete
  '--amend',       // commit amend
  '-A', '--all',   // git add all
  'clean',         // git clean
  'rebase',        // git rebase
];

// The only Git verbs we allow
const ALLOWED_GIT_VERBS = [
  'status', 'diff', 'log', 'branch', 'remote',
  'checkout', 'add', 'commit', 'push', 'rev-parse', 'show',
];

const SENSITIVE_FILE_PATTERNS = [
  /^\.env/i,
  /\.pem$/i,
  /\.key$/i,
  /credentials/i,
  /service-account/i,
  /private_key/i,
];

function isSensitiveFile(filePath: string): boolean {
  const base = path.basename(filePath);
  return SENSITIVE_FILE_PATTERNS.some(p => p.test(base));
}

/** Sanitise env for child process — strip all secret-looking vars */
function sanitizeEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    const upper = key.toUpperCase();
    if (
      upper.includes('SUPABASE') ||
      upper.includes('DATABASE') ||
      upper.includes('SECRET') ||
      upper.includes('TOKEN') ||
      upper.includes('PASSWORD') ||
      upper.includes('PRIVATE') ||
      upper.includes('API_KEY')
    ) {
      delete env[key];
    }
  }
  return env;
}

export interface GitResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  truncated: boolean;
}

/** Low-level: Run an allowlisted git command inside an authorized workspace. */
export async function runGitCommand(
  projectPath: string,
  args: string[],
  timeoutMs = 30_000,
): Promise<GitResult> {
  // --- 1. Workspace boundary check ---
  const allowedWorkspaces = [process.cwd()];
  if (process.env.ALLOWED_WORKSPACES) {
    allowedWorkspaces.push(...process.env.ALLOWED_WORKSPACES.split(',').map(p => path.resolve(p.trim())));
  }
  const resolvedRoot = path.resolve(projectPath);
  const isAllowed = allowedWorkspaces.some(ws =>
    resolvedRoot.startsWith(ws) || ws.startsWith(resolvedRoot),
  );
  if (!isAllowed) {
    return errResult(`Access denied: '${projectPath}' is not an authorized workspace.`);
  }

  // --- 2. Verify it's actually a Git repo ---
  const gitDir = path.join(resolvedRoot, '.git');
  try {
    await fs.promises.stat(gitDir);
  } catch {
    return errResult(`Not a Git repository: ${resolvedRoot}`);
  }

  // --- 3. Allowlist check on verb ---
  const verb = args[0]?.toLowerCase();
  if (!verb || !ALLOWED_GIT_VERBS.includes(verb)) {
    return errResult(`Git operation '${verb}' is not permitted.`);
  }

  // --- 4. Forbidden flag check ---
  const forbidden = args.slice(1).find(a =>
    FORBIDDEN_FLAGS.some(f => a === f || a.startsWith(f + '=')),
  );
  if (forbidden) {
    return errResult(`Rejected: flag '${forbidden}' is not permitted.`);
  }

  // --- 5. Execute ---
  const gitExe = 'git';
  const startTime = Date.now();
  let stdout = '';
  let stderr = '';
  let truncated = false;

  return new Promise(resolve => {
    let timedOut = false;
    const child = spawn(gitExe, args, {
      cwd: resolvedRoot,
      env: sanitizeEnv(),
      shell: false,
      windowsHide: true,
    });

    const tid = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (d: Buffer) => {
      if (stdout.length < MAX_OUTPUT_BYTES) {
        stdout += d.toString();
        if (stdout.length >= MAX_OUTPUT_BYTES) {
          stdout = stdout.substring(0, MAX_OUTPUT_BYTES) + '\n[STDOUT TRUNCATED]';
          truncated = true;
        }
      }
    });

    child.stderr.on('data', (d: Buffer) => {
      if (stderr.length < MAX_OUTPUT_BYTES) {
        stderr += d.toString();
        if (stderr.length >= MAX_OUTPUT_BYTES) {
          stderr = stderr.substring(0, MAX_OUTPUT_BYTES) + '\n[STDERR TRUNCATED]';
          truncated = true;
        }
      }
    });

    child.on('error', err => {
      clearTimeout(tid);
      resolve({ success: false, stdout, stderr: err.message, exitCode: -1, timedOut: false, truncated });
    });

    child.on('close', code => {
      clearTimeout(tid);
      resolve({
        success: code === 0 && !timedOut,
        stdout,
        stderr,
        exitCode: code,
        timedOut,
        truncated,
      });
    });
  });
}

function errResult(msg: string): GitResult {
  return { success: false, stdout: '', stderr: msg, exitCode: -1, timedOut: false, truncated: false };
}

/** Higher-level helpers used by tools */
export async function getGitStatus(projectPath: string) {
  return runGitCommand(projectPath, ['status', '--short', '--branch']);
}

export async function getGitDiff(projectPath: string, cached = false) {
  const args = cached ? ['diff', '--cached', '--stat'] : ['diff', '--stat'];
  const stat = await runGitCommand(projectPath, args);
  const diffArgs = cached ? ['diff', '--cached'] : ['diff'];
  const diff = await runGitCommand(projectPath, diffArgs);
  return { stat, diff };
}

export async function getGitLog(projectPath: string, n = 20) {
  return runGitCommand(projectPath, ['log', `--max-count=${n}`, '--oneline', '--decorate']);
}

export async function listGitBranches(projectPath: string) {
  return runGitCommand(projectPath, ['branch', '-a', '-v']);
}

export async function getGitRemote(projectPath: string) {
  return runGitCommand(projectPath, ['remote', '-v']);
}

export async function getCurrentBranch(projectPath: string) {
  return runGitCommand(projectPath, ['rev-parse', '--abbrev-ref', 'HEAD']);
}

export async function createGitBranch(projectPath: string, branchName: string) {
  // Reject branch names that look dangerous
  if (!/^[\w\-./]+$/.test(branchName) || branchName.includes('..')) {
    return errResult(`Invalid branch name: '${branchName}'`);
  }
  // Check branch doesn't already exist
  const existing = await runGitCommand(projectPath, ['branch', '--list', branchName]);
  if (existing.success && existing.stdout.trim().length > 0) {
    return errResult(`Branch '${branchName}' already exists. Choose a different name.`);
  }
  return runGitCommand(projectPath, ['checkout', '-b', branchName]);
}

export async function checkoutGitBranch(projectPath: string, branchName: string) {
  if (!/^[\w\-./]+$/.test(branchName) || branchName.includes('..')) {
    return errResult(`Invalid branch name: '${branchName}'`);
  }
  return runGitCommand(projectPath, ['checkout', branchName]);
}

export async function stageGitFiles(projectPath: string, files: string[]) {
  if (!files || files.length === 0) {
    return errResult('No files specified. You must provide explicit file paths — git add . is not permitted.');
  }

  // Validate every file
  for (const f of files) {
    if (isSensitiveFile(f)) {
      return errResult(`Rejected: '${f}' is a sensitive file and cannot be staged.`);
    }
    // Workspace boundary
    const resolved = path.resolve(projectPath, f);
    if (!resolved.startsWith(path.resolve(projectPath))) {
      return errResult(`Rejected: path traversal attempt detected for '${f}'.`);
    }
  }

  // Stage each file individually so one failure doesn't silently take down the rest
  const results: GitResult[] = [];
  for (const f of files) {
    const r = await runGitCommand(projectPath, ['add', '--', f]);
    results.push(r);
    if (!r.success) {
      return errResult(`Failed to stage '${f}': ${r.stderr}`);
    }
  }
  return { ...results[results.length - 1], success: true };
}

export async function commitGitChanges(projectPath: string, message: string) {
  if (!message || message.trim().length === 0) {
    return errResult('Commit message cannot be empty.');
  }
  // Verify no secret files are staged
  const cachedDiff = await runGitCommand(projectPath, ['diff', '--cached', '--name-only']);
  if (cachedDiff.success) {
    const staged = cachedDiff.stdout.split('\n').map(l => l.trim()).filter(Boolean);
    const secretFile = staged.find(f => isSensitiveFile(f));
    if (secretFile) {
      return errResult(`Rejected: sensitive file '${secretFile}' is staged. Unstage it before committing.`);
    }
  }
  return runGitCommand(projectPath, ['commit', '-m', message]);
}

export async function pushGitBranch(projectPath: string, remote = 'origin', branch?: string) {
  const currentBranch = branch || (await getCurrentBranch(projectPath)).stdout.trim();
  if (!currentBranch || currentBranch === 'HEAD') {
    return errResult('Cannot determine current branch. Are you in a detached HEAD state?');
  }
  // Block pushing directly to protected branches without explicit override
  if (currentBranch === 'main' || currentBranch === 'master') {
    return errResult(
      `Pushing directly to '${currentBranch}' is blocked. Create a feature branch first.`,
    );
  }
  return runGitCommand(projectPath, ['push', remote, currentBranch]);
}
