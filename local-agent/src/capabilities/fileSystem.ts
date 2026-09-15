// local-agent/src/capabilities/fileSystem.ts
import { promises as fs } from 'fs';
import { resolveWorkspacePath } from '../workspaceGuard';
import { logAudit } from '../auditLogger';

/** Read a file within allowed workspaces */
export async function readFile(args: Record<string, unknown>): Promise<string> {
  const filePath = String(args.path);
  const realPath = await resolveWorkspacePath(filePath);
  
  // Enforce 5MB file size limit
  const MAX_SIZE = 5 * 1024 * 1024;
  const stat = await fs.stat(realPath);
  if (stat.size > MAX_SIZE) {
    throw new Error(`File exceeds maximum allowed read size of 5MB. Actual size: ${stat.size} bytes`);
  }
  
  const content = await fs.readFile(realPath, { encoding: 'utf8' });
  await logAudit({ capability: 'read_file', status: 'completed', path: realPath });
  return content;
}

/** List directory contents (names only) */
export async function listDir(args: Record<string, unknown>): Promise<string[]> {
  const dirPath = String(args.path);
  const realPath = await resolveWorkspacePath(dirPath);
  const entries = await fs.readdir(realPath);
  await logAudit({ capability: 'list_dir', status: 'completed', path: realPath });
  return entries;
}

import path from 'path';

export async function writeFile(args: Record<string, unknown>): Promise<void> {
  const filePath = String(args.path);
  const content = String(args.content);
  const realPath = await resolveWorkspacePath(filePath);
  
  const MAX_SIZE = 1024 * 1024; // 1MB
  if (Buffer.byteLength(content, 'utf8') > MAX_SIZE) {
    throw new Error(`File exceeds maximum allowed write size of 1MB.`);
  }

  const dir = path.dirname(realPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(realPath, content, { encoding: 'utf8' });
  await logAudit({ capability: 'write_file', status: 'completed', path: realPath });
}

export async function patchFile(args: Record<string, unknown>): Promise<void> {
  const filePath = String(args.path);
  const expectedContent = String(args.expectedContent);
  const newContent = String(args.newContent);
  const realPath = await resolveWorkspacePath(filePath);

  const currentContent = await fs.readFile(realPath, { encoding: 'utf8' });
  if (currentContent !== expectedContent) {
    throw new Error('Patch failed: The file has been modified since it was last read.');
  }

  await fs.writeFile(realPath, newContent, { encoding: 'utf8' });
  await logAudit({ capability: 'patch_file', status: 'completed', path: realPath });
}

export async function renameFile(args: Record<string, unknown>): Promise<void> {
  const oldPath = String(args.oldPath);
  const newPath = String(args.newPath);
  const realOldPath = await resolveWorkspacePath(oldPath);
  const realNewPath = await resolveWorkspacePath(newPath);

  try {
    await fs.stat(realNewPath);
    throw new Error(`Rename failed: Destination already exists.`);
  } catch (e: any) {
    if (e.code !== 'ENOENT') throw e;
  }

  const dir = path.dirname(realNewPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.rename(realOldPath, realNewPath);
  await logAudit({ capability: 'rename_file', status: 'completed', path: realOldPath, target: realNewPath });
}

export async function deleteFile(args: Record<string, unknown>): Promise<void> {
  const filePath = String(args.path);
  const realPath = await resolveWorkspacePath(filePath);

  const stats = await fs.stat(realPath);
  if (stats.isDirectory()) {
    throw new Error('Access denied: Cannot delete directories.');
  }

  await fs.unlink(realPath);
  await logAudit({ capability: 'delete_file', status: 'completed', path: realPath });
}

export async function searchFiles(args: Record<string, unknown>): Promise<any[]> {
  const root = await resolveWorkspacePath(String(args.path));
  const query = String(args.query);
  const results: any[] = [];
  const maxResults = 50;

  async function scanDir(dir: string) {
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      if (results.length >= maxResults) return;
      if (['node_modules', '.git', '.next'].includes(item.name)) continue;

      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        await scanDir(fullPath);
      } else {
        try {
          const stats = await fs.stat(fullPath);
          if (stats.size > 100 * 1024) continue;
          
          const content = await fs.readFile(fullPath, 'utf8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(query)) {
              results.push({
                file: path.relative(root, fullPath),
                line: i + 1,
                snippet: lines[i].trim()
              });
              if (results.length >= maxResults) return;
            }
          }
        } catch (e) {
          // ignore unreadable
        }
      }
    }
  }

  await scanDir(root);
  await logAudit({ capability: 'search_files', status: 'completed', path: root });
  return results;
}
