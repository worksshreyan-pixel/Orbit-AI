import fs from 'fs';
import path from 'path';
import { createServerClient } from '@/lib/supabase/server';

export interface ProjectInfo {
  name: string;
  framework?: string;
  language?: string;
  packageManager?: string;
  projectType?: string;
  files: string[];
}

export interface FileTree {
  name: string;
  type: 'file' | 'directory';
  children?: FileTree[];
}

export interface SearchResult {
  file: string;
  line: number;
  snippet: string;
}

export interface ProjectWorkspaceProvider {
  getProjectInfo(projectPath: string): Promise<ProjectInfo>;
  listFiles(projectPath: string, directory?: string): Promise<FileTree[]>;
  readFile(projectPath: string, filePath: string): Promise<string>;
  searchFiles(projectPath: string, query: string): Promise<SearchResult[]>;
  writeFile(projectPath: string, filePath: string, content: string): Promise<void>;
  patchFile(projectPath: string, filePath: string, expectedContent: string, newContent: string): Promise<void>;
  renameFile(projectPath: string, oldPath: string, newPath: string): Promise<void>;
  deleteFile(projectPath: string, filePath: string): Promise<void>;
  generateDiff(oldText: string, newText: string): string;
}

const REDACTED_MESSAGE = '[REDACTED — sensitive file]';
const SENSITIVE_FILE_PATTERNS = [
  /^\.env/i,
  /\.pem$/i,
  /\.key$/i,
  /credentials/i,
  /service-account/i,
  /private_key/i,
  /\.aws/i,
  /\.ssh/i
];

function isSensitiveFile(fileName: string): boolean {
  return SENSITIVE_FILE_PATTERNS.some(pattern => pattern.test(fileName));
}

function resolveSafePath(baseDir: string, targetPath: string): string {
  // We use process.cwd() as the default authorized workspace if none is explicitly provided.
  // In a real cloud setup, baseDir would be explicitly validated against the user's DB.
  
  const allowedWorkspaces = [process.cwd()];
  if (process.env.ALLOWED_WORKSPACES) {
    allowedWorkspaces.push(...process.env.ALLOWED_WORKSPACES.split(',').map(p => path.resolve(p.trim())));
  }

  const resolvedBase = path.resolve(baseDir);
  const isAllowedBase = allowedWorkspaces.some(ws => resolvedBase.startsWith(ws) || ws.startsWith(resolvedBase));
  
  if (!isAllowedBase) {
    throw new Error('Access denied: Unauthorized workspace directory.');
  }

  const resolvedTarget = path.resolve(resolvedBase, targetPath);
  
  // Strict boundary check
  if (!resolvedTarget.startsWith(resolvedBase)) {
    throw new Error('Access denied: Path traversal attempt blocked.');
  }

  return resolvedTarget;
}

export const defaultWorkspaceProvider: ProjectWorkspaceProvider = {
  async getProjectInfo(projectPath: string): Promise<ProjectInfo> {
    const root = resolveSafePath(projectPath, '');
    
    let framework = 'Unknown';
    let language = 'Unknown';
    let packageManager = 'Unknown';
    let projectType = 'Unknown';
    
    const files = [];
    try {
      const dirItems = await fs.promises.readdir(root, { withFileTypes: true });
      for (const item of dirItems) {
        files.push(item.name);
      }
    } catch (e: any) {
      throw new Error(`Failed to inspect project: ${e.message}`);
    }

    if (files.includes('package.json')) {
      language = 'JavaScript';
      packageManager = files.includes('yarn.lock') ? 'yarn' : (files.includes('pnpm-lock.yaml') ? 'pnpm' : 'npm');
      projectType = 'Node.js';
      
      try {
        const pkgContent = await fs.promises.readFile(path.join(root, 'package.json'), 'utf8');
        const pkg = JSON.parse(pkgContent);
        if (pkg.dependencies?.next) framework = 'Next.js';
        else if (pkg.dependencies?.react) framework = 'React';
        if (pkg.devDependencies?.typescript || pkg.dependencies?.typescript) language = 'TypeScript';
      } catch (e) {
        // Ignore read errors for package.json
      }
    } else if (files.includes('requirements.txt') || files.includes('pyproject.toml')) {
      language = 'Python';
      projectType = 'Python';
    } else if (files.includes('build.gradle') || files.includes('settings.gradle') || files.includes('AndroidManifest.xml')) {
      language = 'Java/Kotlin';
      projectType = 'Android';
    }
    
    return {
      name: path.basename(root),
      framework,
      language,
      packageManager,
      projectType,
      files: files.slice(0, 50) // Return top-level files
    };
  },

  async listFiles(projectPath: string, directory: string = ''): Promise<FileTree[]> {
    const targetDir = resolveSafePath(projectPath, directory);
    
    async function buildTree(dir: string, depth: number): Promise<FileTree[]> {
      if (depth > 3) return []; // Limit depth to prevent massive trees
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      const tree: FileTree[] = [];
      
      for (const item of items) {
        if (item.name === 'node_modules' || item.name === '.git' || item.name === '.next') continue;
        
        if (item.isDirectory()) {
          tree.push({
            name: item.name,
            type: 'directory',
            children: await buildTree(path.join(dir, item.name), depth + 1)
          });
        } else {
          tree.push({
            name: item.name,
            type: 'file'
          });
        }
      }
      return tree;
    }
    
    return buildTree(targetDir, 0);
  },

  async readFile(projectPath: string, filePath: string): Promise<string> {
    const targetFile = resolveSafePath(projectPath, filePath);
    
    if (isSensitiveFile(path.basename(targetFile))) {
      return REDACTED_MESSAGE;
    }

    try {
      const stats = await fs.promises.stat(targetFile);
      if (stats.size > 500 * 1024) {
        return '[Error: File exceeds 500KB limit]';
      }
      const content = await fs.promises.readFile(targetFile, 'utf8');
      
      // Secondary check for obvious secrets inside file contents
      if (/BEGIN (RSA|OPENSSH) PRIVATE KEY/i.test(content)) {
        return REDACTED_MESSAGE;
      }
      
      return content;
    } catch (e: any) {
      throw new Error(`Failed to read file: ${e.message}`);
    }
  },

  async searchFiles(projectPath: string, query: string): Promise<SearchResult[]> {
    const root = resolveSafePath(projectPath, '');
    const results: SearchResult[] = [];
    const maxResults = 50;

    async function scanDir(dir: string) {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        if (results.length >= maxResults) return;
        
        if (item.name === 'node_modules' || item.name === '.git' || item.name === '.next' || isSensitiveFile(item.name)) {
          continue;
        }

        const fullPath = path.join(dir, item.name);
        
        if (item.isDirectory()) {
          await scanDir(fullPath);
        } else {
          try {
            const stats = await fs.promises.stat(fullPath);
            if (stats.size > 100 * 1024) continue; // Skip large files for search
            
            const content = await fs.promises.readFile(fullPath, 'utf8');
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
            // Ignore unreadable files
          }
        }
      }
    }

    await scanDir(root);
    return results;
  },

  async writeFile(projectPath: string, filePath: string, content: string): Promise<void> {
    const targetFile = resolveSafePath(projectPath, filePath);
    
    if (isSensitiveFile(path.basename(targetFile))) {
      throw new Error('Access denied: Cannot write to sensitive files.');
    }

    if (Buffer.byteLength(content, 'utf8') > 1024 * 1024) {
      throw new Error('Access denied: File size exceeds 1MB limit.');
    }

    // Ensure directory exists safely
    const dir = path.dirname(targetFile);
    await fs.promises.mkdir(dir, { recursive: true });

    await fs.promises.writeFile(targetFile, content, 'utf8');
  },

  async patchFile(projectPath: string, filePath: string, expectedContent: string, newContent: string): Promise<void> {
    const targetFile = resolveSafePath(projectPath, filePath);
    
    if (isSensitiveFile(path.basename(targetFile))) {
      throw new Error('Access denied: Cannot patch sensitive files.');
    }

    const currentContent = await fs.promises.readFile(targetFile, 'utf8');
    
    if (currentContent !== expectedContent) {
      throw new Error('Patch failed: The file has been modified since it was last read. Please re-read the file and try again.');
    }

    await this.writeFile(projectPath, filePath, newContent);
  },

  async renameFile(projectPath: string, oldPath: string, newPath: string): Promise<void> {
    const sourceFile = resolveSafePath(projectPath, oldPath);
    const destFile = resolveSafePath(projectPath, newPath);

    if (isSensitiveFile(path.basename(sourceFile)) || isSensitiveFile(path.basename(destFile))) {
      throw new Error('Access denied: Cannot rename sensitive files.');
    }

    try {
      await fs.promises.stat(destFile);
      throw new Error(`Rename failed: Destination ${newPath} already exists.`);
    } catch (e: any) {
      if (e.code !== 'ENOENT') {
        throw new Error(`Rename failed: ${e.message}`);
      }
    }

    // Ensure dest directory exists
    await fs.promises.mkdir(path.dirname(destFile), { recursive: true });
    await fs.promises.rename(sourceFile, destFile);
  },

  async deleteFile(projectPath: string, filePath: string): Promise<void> {
    const targetFile = resolveSafePath(projectPath, filePath);

    if (isSensitiveFile(path.basename(targetFile))) {
      throw new Error('Access denied: Cannot delete sensitive files.');
    }

    const stats = await fs.promises.stat(targetFile);
    if (stats.isDirectory()) {
      throw new Error('Access denied: Cannot delete directories in this phase.');
    }

    await fs.promises.unlink(targetFile);
  },

  generateDiff(oldText: string, newText: string): string {
    // Extremely basic block diff logic for UI representation
    // In a real prod setup, use 'diff' library, but here we just return a summary or basic replace string.
    if (oldText === newText) return 'No changes.';
    return `--- OLD\n+++ NEW\n\n[Content changed. Original size: ${oldText.length} chars, New size: ${newText.length} chars]`;
  }
};

let cachedLocalProvider: ProjectWorkspaceProvider | null = null;

export async function getWorkspaceProvider(executionTarget: 'cloud' | 'local-agent', userId: string): Promise<ProjectWorkspaceProvider> {
  if (executionTarget === 'local-agent') {
    if (!cachedLocalProvider) {
      const supabase = createServerClient();
      const { data: devices, error } = await supabase
        .from('devices')
        .select('credential')
        .eq('user_id', userId)
        .limit(1);

      if (error || !devices || devices.length === 0) {
        throw new Error('LOCAL_AGENT_OFFLINE: No paired ORBIT Local Agent is currently online.');
      }
      
      const { LocalAgentWorkspaceProvider } = require('./local-agent-provider');
      cachedLocalProvider = new LocalAgentWorkspaceProvider(
        process.env.LOCAL_AGENT_WS_URL || 'ws://localhost:8080',
        devices[0].credential
      );
    }
    return cachedLocalProvider!;
  }
  return defaultWorkspaceProvider;
}
