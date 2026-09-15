import { z } from 'zod';
import type { ToolDefinition } from '@/lib/types/agent';
import {
  getGitStatus,
  getGitDiff,
  getGitLog,
  listGitBranches,
  getGitRemote,
  createGitBranch,
  checkoutGitBranch,
  stageGitFiles,
  commitGitChanges,
  pushGitBranch,
} from '../providers/git';

// ─── Read Tools (Level 1) ─────────────────────────────────────────────────────

export const get_git_status: ToolDefinition = {
  name: 'get_git_status',
  description: 'Get the current git status of the project workspace.',
  permissionLevel: 'L1',
  parameters: {
    projectPath: { type: 'string', description: 'Absolute path to the project root', required: true },
  },
  execute: async (params) => {
    const schema = z.object({ projectPath: z.string().min(1) });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    try {
      const result = await getGitStatus(parsed.data.projectPath);
      return { success: result.success, data: { stdout: result.stdout, stderr: result.stderr } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const get_git_diff: ToolDefinition = {
  name: 'get_git_diff',
  description: 'Get a diff of working tree changes or staged changes.',
  permissionLevel: 'L1',
  parameters: {
    projectPath: { type: 'string', description: 'Absolute path to the project root', required: true },
    cached: { type: 'boolean', description: 'If true, shows staged (cached) diff instead of working tree diff', required: false },
  },
  execute: async (params) => {
    const schema = z.object({
      projectPath: z.string().min(1),
      cached: z.boolean().optional().default(false),
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    try {
      const { stat, diff } = await getGitDiff(parsed.data.projectPath, parsed.data.cached);
      return {
        success: diff.success,
        data: {
          stat: stat.stdout,
          diff: diff.stdout,
          truncated: diff.truncated || stat.truncated,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const get_git_log: ToolDefinition = {
  name: 'get_git_log',
  description: 'Get recent git commit history.',
  permissionLevel: 'L1',
  parameters: {
    projectPath: { type: 'string', description: 'Absolute path to the project root', required: true },
    count: { type: 'number', description: 'Number of commits to show (max 50)', required: false },
  },
  execute: async (params) => {
    const schema = z.object({
      projectPath: z.string().min(1),
      count: z.number().min(1).max(50).optional().default(20),
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    try {
      const result = await getGitLog(parsed.data.projectPath, parsed.data.count);
      return { success: result.success, data: { log: result.stdout } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const list_git_branches: ToolDefinition = {
  name: 'list_git_branches',
  description: 'List all local and remote git branches.',
  permissionLevel: 'L1',
  parameters: {
    projectPath: { type: 'string', description: 'Absolute path to the project root', required: true },
  },
  execute: async (params) => {
    const schema = z.object({ projectPath: z.string().min(1) });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    try {
      const result = await listGitBranches(parsed.data.projectPath);
      return { success: result.success, data: { branches: result.stdout } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const get_git_remote: ToolDefinition = {
  name: 'get_git_remote',
  description: 'List configured git remotes.',
  permissionLevel: 'L1',
  parameters: {
    projectPath: { type: 'string', description: 'Absolute path to the project root', required: true },
  },
  execute: async (params) => {
    const schema = z.object({ projectPath: z.string().min(1) });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    try {
      const result = await getGitRemote(parsed.data.projectPath);
      return { success: result.success, data: { remotes: result.stdout } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

// ─── Write Tools (Level 2) ────────────────────────────────────────────────────

export const create_git_branch: ToolDefinition = {
  name: 'create_git_branch',
  description: 'Create and checkout a new git branch. Will not overwrite existing branches.',
  permissionLevel: 'L2',
  parameters: {
    projectPath: { type: 'string', description: 'Absolute path to the project root', required: true },
    branchName: { type: 'string', description: 'Name for the new branch (e.g. feature/auth-fix)', required: true },
    reason: { type: 'string', description: 'Reason for creating this branch', required: true },
  },
  execute: async (params) => {
    const schema = z.object({
      projectPath: z.string().min(1),
      branchName: z.string().min(1),
      reason: z.string().min(1),
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    try {
      const result = await createGitBranch(parsed.data.projectPath, parsed.data.branchName);
      return { success: result.success, data: { branch: parsed.data.branchName, output: result.stdout || result.stderr }, error: result.success ? undefined : result.stderr };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const checkout_git_branch: ToolDefinition = {
  name: 'checkout_git_branch',
  description: 'Checkout an existing git branch.',
  permissionLevel: 'L2',
  parameters: {
    projectPath: { type: 'string', description: 'Absolute path to the project root', required: true },
    branchName: { type: 'string', description: 'Name of the branch to checkout', required: true },
    reason: { type: 'string', description: 'Reason for switching branches', required: true },
  },
  execute: async (params) => {
    const schema = z.object({
      projectPath: z.string().min(1),
      branchName: z.string().min(1),
      reason: z.string().min(1),
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    try {
      const result = await checkoutGitBranch(parsed.data.projectPath, parsed.data.branchName);
      return { success: result.success, data: { branch: parsed.data.branchName, output: result.stdout || result.stderr }, error: result.success ? undefined : result.stderr };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const stage_git_files: ToolDefinition = {
  name: 'stage_git_files',
  description: 'Stage specific files for commit. git add . is NOT supported. All paths must be explicit.',
  permissionLevel: 'L2',
  parameters: {
    projectPath: { type: 'string', description: 'Absolute path to the project root', required: true },
    files: { type: 'array', description: 'Array of relative file paths to stage', required: true },
    reason: { type: 'string', description: 'Reason for staging these files', required: true },
  },
  execute: async (params) => {
    const schema = z.object({
      projectPath: z.string().min(1),
      files: z.array(z.string().min(1)).min(1),
      reason: z.string().min(1),
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    try {
      const result = await stageGitFiles(parsed.data.projectPath, parsed.data.files);
      return { success: result.success, data: { staged: parsed.data.files }, error: result.success ? undefined : result.stderr };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const commit_git_changes: ToolDefinition = {
  name: 'commit_git_changes',
  description: 'Commit currently staged changes with a descriptive message.',
  permissionLevel: 'L2',
  parameters: {
    projectPath: { type: 'string', description: 'Absolute path to the project root', required: true },
    message: { type: 'string', description: 'Commit message (required, non-empty)', required: true },
    reason: { type: 'string', description: 'Reason for this commit', required: true },
  },
  execute: async (params) => {
    const schema = z.object({
      projectPath: z.string().min(1),
      message: z.string().min(1),
      reason: z.string().min(1),
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    try {
      const result = await commitGitChanges(parsed.data.projectPath, parsed.data.message);
      return { success: result.success, data: { message: parsed.data.message, output: result.stdout || result.stderr }, error: result.success ? undefined : result.stderr };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const push_git_branch: ToolDefinition = {
  name: 'push_git_branch',
  description: 'Push the current branch to the remote. Force-push is never permitted. Protected branches (main/master) are blocked.',
  permissionLevel: 'L2',
  parameters: {
    projectPath: { type: 'string', description: 'Absolute path to the project root', required: true },
    remote: { type: 'string', description: 'Remote name (default: origin)', required: false },
    reason: { type: 'string', description: 'Reason for pushing', required: true },
  },
  execute: async (params) => {
    const schema = z.object({
      projectPath: z.string().min(1),
      remote: z.string().optional().default('origin'),
      reason: z.string().min(1),
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    try {
      const result = await pushGitBranch(parsed.data.projectPath, parsed.data.remote);
      return { success: result.success, data: { remote: parsed.data.remote, output: result.stdout || result.stderr }, error: result.success ? undefined : result.stderr };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

