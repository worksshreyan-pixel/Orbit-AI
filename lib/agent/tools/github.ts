import { z } from 'zod';
import type { ToolDefinition } from '@/lib/types/agent';
import {
  getRepository,
  listIssues,
  getIssue,
  listPullRequests,
  getPullRequest,
  getFileContents,
  createIssue,
  createPullRequest,
} from '../providers/github';

// ─── Read Tools (Level 1) ─────────────────────────────────────────────────────

export const get_github_repository: ToolDefinition = {
  name: 'get_github_repository',
  description: 'Fetch metadata about a GitHub repository.',
  permissionLevel: 'L1',
  parameters: {
    owner: { type: 'string', description: 'Repository owner (username or org)', required: true },
    repo: { type: 'string', description: 'Repository name', required: true },
  },
  execute: async (params) => {
    const schema = z.object({ owner: z.string().min(1), repo: z.string().min(1) });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    try {
      const data = await getRepository(parsed.data.owner, parsed.data.repo);
      return { success: true, data: { name: data.name, full_name: data.full_name, description: data.description, default_branch: data.default_branch, private: data.private, html_url: data.html_url, stars: data.stargazers_count, open_issues: data.open_issues_count } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const list_github_issues: ToolDefinition = {
  name: 'list_github_issues',
  description: 'List GitHub issues for a repository.',
  permissionLevel: 'L1',
  parameters: {
    owner: { type: 'string', description: 'Repository owner', required: true },
    repo: { type: 'string', description: 'Repository name', required: true },
    state: { type: 'string', description: 'Issue state: open, closed, or all (default: open)', required: false },
    limit: { type: 'number', description: 'Maximum number of issues to return (max 50)', required: false },
  },
  execute: async (params) => {
    const schema = z.object({
      owner: z.string().min(1),
      repo: z.string().min(1),
      state: z.enum(['open', 'closed', 'all']).optional().default('open'),
      limit: z.number().min(1).max(50).optional().default(20),
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    try {
      const issues = await listIssues(parsed.data.owner, parsed.data.repo, parsed.data.state, parsed.data.limit);
      // Return only safe fields — no internal GitHub IDs that could clutter context
      return { success: true, data: { issues: issues.map(i => ({ number: i.number, title: i.title, state: i.state, labels: i.labels.map(l => l.name), html_url: i.html_url, updated_at: i.updated_at })) } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const get_github_issue: ToolDefinition = {
  name: 'get_github_issue',
  description: 'Get the full details of a specific GitHub issue including its body.',
  permissionLevel: 'L1',
  parameters: {
    owner: { type: 'string', description: 'Repository owner', required: true },
    repo: { type: 'string', description: 'Repository name', required: true },
    issue_number: { type: 'number', description: 'Issue number', required: true },
  },
  execute: async (params) => {
    const schema = z.object({
      owner: z.string().min(1),
      repo: z.string().min(1),
      issue_number: z.number().int().positive(),
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    try {
      const issue = await getIssue(parsed.data.owner, parsed.data.repo, parsed.data.issue_number);
      return { success: true, data: { number: issue.number, title: issue.title, body: issue.body, state: issue.state, labels: issue.labels.map(l => l.name), assignees: issue.assignees.map(a => a.login), html_url: issue.html_url } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const list_github_pull_requests: ToolDefinition = {
  name: 'list_github_pull_requests',
  description: 'List pull requests for a GitHub repository.',
  permissionLevel: 'L1',
  parameters: {
    owner: { type: 'string', description: 'Repository owner', required: true },
    repo: { type: 'string', description: 'Repository name', required: true },
    state: { type: 'string', description: 'PR state: open, closed, or all (default: open)', required: false },
    limit: { type: 'number', description: 'Maximum number of PRs to return (max 50)', required: false },
  },
  execute: async (params) => {
    const schema = z.object({
      owner: z.string().min(1),
      repo: z.string().min(1),
      state: z.enum(['open', 'closed', 'all']).optional().default('open'),
      limit: z.number().min(1).max(50).optional().default(20),
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    try {
      const prs = await listPullRequests(parsed.data.owner, parsed.data.repo, parsed.data.state, parsed.data.limit);
      return { success: true, data: { pull_requests: prs.map(pr => ({ number: pr.number, title: pr.title, state: pr.state, head: pr.head.ref, base: pr.base.ref, draft: pr.draft, html_url: pr.html_url })) } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const get_github_pull_request: ToolDefinition = {
  name: 'get_github_pull_request',
  description: 'Get the full details of a specific GitHub pull request.',
  permissionLevel: 'L1',
  parameters: {
    owner: { type: 'string', description: 'Repository owner', required: true },
    repo: { type: 'string', description: 'Repository name', required: true },
    pr_number: { type: 'number', description: 'Pull request number', required: true },
  },
  execute: async (params) => {
    const schema = z.object({
      owner: z.string().min(1),
      repo: z.string().min(1),
      pr_number: z.number().int().positive(),
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    try {
      const pr = await getPullRequest(parsed.data.owner, parsed.data.repo, parsed.data.pr_number);
      return { success: true, data: { number: pr.number, title: pr.title, body: pr.body, state: pr.state, head: pr.head.ref, base: pr.base.ref, draft: pr.draft, html_url: pr.html_url } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const get_github_file: ToolDefinition = {
  name: 'get_github_file',
  description: 'Read a file from a GitHub repository at a specific ref/branch.',
  permissionLevel: 'L1',
  parameters: {
    owner: { type: 'string', description: 'Repository owner', required: true },
    repo: { type: 'string', description: 'Repository name', required: true },
    file_path: { type: 'string', description: 'Path to the file in the repository', required: true },
    ref: { type: 'string', description: 'Branch name, tag, or commit SHA (optional)', required: false },
  },
  execute: async (params) => {
    const schema = z.object({
      owner: z.string().min(1),
      repo: z.string().min(1),
      file_path: z.string().min(1),
      ref: z.string().optional(),
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    try {
      const file = await getFileContents(parsed.data.owner, parsed.data.repo, parsed.data.file_path, parsed.data.ref);
      return { success: true, data: file };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

// ─── Write Tools (Level 2) ────────────────────────────────────────────────────

export const create_github_issue: ToolDefinition = {
  name: 'create_github_issue',
  description: 'Create a new GitHub issue. Requires approval.',
  permissionLevel: 'L2',
  parameters: {
    owner: { type: 'string', description: 'Repository owner', required: true },
    repo: { type: 'string', description: 'Repository name', required: true },
    title: { type: 'string', description: 'Issue title', required: true },
    body: { type: 'string', description: 'Issue body/description', required: true },
    labels: { type: 'array', description: 'Optional list of label names', required: false },
    reason: { type: 'string', description: 'Reason for creating this issue', required: true },
  },
  execute: async (params) => {
    const schema = z.object({
      owner: z.string().min(1),
      repo: z.string().min(1),
      title: z.string().min(1),
      body: z.string(),
      labels: z.array(z.string()).optional().default([]),
      reason: z.string().min(1),
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    try {
      const result = await createIssue(parsed.data.owner, parsed.data.repo, parsed.data.title, parsed.data.body, parsed.data.labels);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const create_github_pull_request: ToolDefinition = {
  name: 'create_github_pull_request',
  description: 'Create a GitHub pull request from a feature branch. Requires approval. Merging requires Level 3 and is not supported in this phase.',
  permissionLevel: 'L2',
  parameters: {
    owner: { type: 'string', description: 'Repository owner', required: true },
    repo: { type: 'string', description: 'Repository name', required: true },
    title: { type: 'string', description: 'PR title', required: true },
    body: { type: 'string', description: 'PR description', required: true },
    head: { type: 'string', description: 'Source branch (the branch with your changes)', required: true },
    base: { type: 'string', description: 'Target branch (e.g. main)', required: true },
    draft: { type: 'boolean', description: 'Create as draft PR (default: false)', required: false },
    reason: { type: 'string', description: 'Reason for creating this PR', required: true },
  },
  execute: async (params) => {
    const schema = z.object({
      owner: z.string().min(1),
      repo: z.string().min(1),
      title: z.string().min(1),
      body: z.string(),
      head: z.string().min(1),
      base: z.string().min(1),
      draft: z.boolean().optional().default(false),
      reason: z.string().min(1),
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };
    try {
      const result = await createPullRequest(parsed.data.owner, parsed.data.repo, parsed.data.title, parsed.data.body, parsed.data.head, parsed.data.base, parsed.data.draft);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

