/**
 * GitHub REST API provider.
 *
 * SECURITY:
 * - The token is read from process.env.GITHUB_TOKEN (server-side only).
 * - The token is NEVER returned to the model, logged, or included in tool output.
 * - Authorization headers are stripped from all error messages before returning.
 */

const GITHUB_API = 'https://api.github.com';

function getToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      'GitHub integration not configured. Please add GITHUB_TOKEN to your .env.local file.',
    );
  }
  return token;
}

function getHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${getToken()}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'ORBIT-Agent/1.0',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/** Strip Authorization header from any stringified error payloads */
function sanitizeError(msg: string): string {
  return msg.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, '[REDACTED]');
}

async function githubFetch<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${endpoint}`, { headers: getHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(sanitizeError(`GitHub API error ${res.status}: ${body.substring(0, 200)}`));
  }
  return res.json() as Promise<T>;
}

async function githubPost<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${GITHUB_API}${endpoint}`, {
    method: 'POST',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(sanitizeError(`GitHub API error ${res.status}: ${text.substring(0, 200)}`));
  }
  return res.json() as Promise<T>;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GitHubRepo {
  full_name: string;
  name: string;
  description: string | null;
  default_branch: string;
  private: boolean;
  html_url: string;
  stargazers_count: number;
  open_issues_count: number;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: { name: string }[];
  assignees: { login: string }[];
  html_url: string;
  created_at: string;
  updated_at: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  body: string | null;
  state: string;
  head: { ref: string };
  base: { ref: string };
  html_url: string;
  draft: boolean;
  created_at: string;
  updated_at: string;
}

export interface GitHubFileContent {
  name: string;
  path: string;
  content: string; // base64
  encoding: string;
  size: number;
  html_url: string;
}

// ─── Read Operations ─────────────────────────────────────────────────────────

export async function getRepository(owner: string, repo: string): Promise<GitHubRepo> {
  return githubFetch<GitHubRepo>(`/repos/${owner}/${repo}`);
}

export async function listIssues(
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'open',
  limit = 20,
): Promise<GitHubIssue[]> {
  return githubFetch<GitHubIssue[]>(
    `/repos/${owner}/${repo}/issues?state=${state}&per_page=${Math.min(limit, 50)}`,
  );
}

export async function getIssue(owner: string, repo: string, number: number): Promise<GitHubIssue> {
  return githubFetch<GitHubIssue>(`/repos/${owner}/${repo}/issues/${number}`);
}

export async function listPullRequests(
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'open',
  limit = 20,
): Promise<GitHubPullRequest[]> {
  return githubFetch<GitHubPullRequest[]>(
    `/repos/${owner}/${repo}/pulls?state=${state}&per_page=${Math.min(limit, 50)}`,
  );
}

export async function getPullRequest(
  owner: string,
  repo: string,
  number: number,
): Promise<GitHubPullRequest> {
  return githubFetch<GitHubPullRequest>(`/repos/${owner}/${repo}/pulls/${number}`);
}

export async function getFileContents(
  owner: string,
  repo: string,
  filePath: string,
  ref?: string,
): Promise<{ content: string; path: string; size: number; html_url: string }> {
  const endpoint = ref
    ? `/repos/${owner}/${repo}/contents/${filePath}?ref=${encodeURIComponent(ref)}`
    : `/repos/${owner}/${repo}/contents/${filePath}`;
  const raw = await githubFetch<GitHubFileContent>(endpoint);

  if (raw.size > 200 * 1024) {
    return { content: '[File too large to display]', path: raw.path, size: raw.size, html_url: raw.html_url };
  }

  // Decode base64
  const decoded = Buffer.from(raw.content.replace(/\n/g, ''), 'base64').toString('utf8');
  return { content: decoded, path: raw.path, size: raw.size, html_url: raw.html_url };
}

// ─── Write Operations ─────────────────────────────────────────────────────────

export async function createIssue(
  owner: string,
  repo: string,
  title: string,
  body: string,
  labels: string[] = [],
): Promise<{ number: number; html_url: string; title: string }> {
  if (!title.trim()) throw new Error('Issue title cannot be empty.');
  const result = await githubPost<{ number: number; html_url: string; title: string }>(
    `/repos/${owner}/${repo}/issues`,
    { title, body, labels },
  );
  return { number: result.number, html_url: result.html_url, title: result.title };
}

export async function createPullRequest(
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string, // source branch
  base: string, // target branch
  draft = false,
): Promise<{ number: number; html_url: string; title: string }> {
  if (!title.trim()) throw new Error('PR title cannot be empty.');
  if (!head.trim() || !base.trim()) throw new Error('Head and base branches are required.');
  if (head === base) throw new Error('Head and base branches must be different.');
  const result = await githubPost<{ number: number; html_url: string; title: string }>(
    `/repos/${owner}/${repo}/pulls`,
    { title, body, head, base, draft },
  );
  return { number: result.number, html_url: result.html_url, title: result.title };
}
