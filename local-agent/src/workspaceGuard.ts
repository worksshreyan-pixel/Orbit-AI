// local-agent/src/workspaceGuard.ts
import path from 'path';
import fs from 'fs/promises';

// List of exact filenames that are globally banned from being read
const BANNED_FILES = new Set([
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  'credentials',
  'private_key'
]);

/**
 * Validate that a requested path stays within one of the allowed workspaces.
 * Returns the absolute resolved path if valid, otherwise throws.
 */
export async function resolveWorkspacePath(requestedPath: string): Promise<string> {
  const resolved = path.resolve(requestedPath);
  
  // Strict absolute path and traversal checks based on process.cwd() is unreliable if cwd changes,
  // but we must reject '..' and UNC paths explicitly in the requested string
  if (requestedPath.includes('..') || requestedPath.startsWith('\\\\')) {
    throw new Error('Path traversal and UNC paths are strictly forbidden');
  }

  // Check against banned file names
  const basename = path.basename(resolved).toLowerCase();
  if (BANNED_FILES.has(basename) || basename.endsWith('.pem') || basename.endsWith('.key')) {
    throw new Error('Access to sensitive credentials files is forbidden');
  }

  // Resolve symlinks to final real path.
  const real = await fs.realpath(resolved);
  const allowed = (process.env.ORBIT_ALLOWED_WORKSPACES || '').split(';').filter(Boolean);
  
  const isAllowed = allowed.some((w) => {
    const absW = path.resolve(w);
    const rel = path.relative(absW, real);
    // If it doesn't start with .. and is not absolute, it is inside the workspace
    return !rel.startsWith('..') && !path.isAbsolute(rel);
  });
  
  if (!isAllowed) {
    throw new Error('Resolved path is not within allowed workspaces');
  }
  return real;
}
