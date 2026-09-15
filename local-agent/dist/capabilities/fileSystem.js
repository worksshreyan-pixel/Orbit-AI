"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readFile = readFile;
exports.listDir = listDir;
exports.writeFile = writeFile;
exports.patchFile = patchFile;
exports.renameFile = renameFile;
exports.deleteFile = deleteFile;
exports.searchFiles = searchFiles;
// local-agent/src/capabilities/fileSystem.ts
const fs_1 = require("fs");
const workspaceGuard_1 = require("../workspaceGuard");
const auditLogger_1 = require("../auditLogger");
/** Read a file within allowed workspaces */
async function readFile(args) {
    const filePath = String(args.path);
    const realPath = await (0, workspaceGuard_1.resolveWorkspacePath)(filePath);
    // Enforce 5MB file size limit
    const MAX_SIZE = 5 * 1024 * 1024;
    const stat = await fs_1.promises.stat(realPath);
    if (stat.size > MAX_SIZE) {
        throw new Error(`File exceeds maximum allowed read size of 5MB. Actual size: ${stat.size} bytes`);
    }
    const content = await fs_1.promises.readFile(realPath, { encoding: 'utf8' });
    await (0, auditLogger_1.logAudit)({ capability: 'read_file', status: 'completed', path: realPath });
    return content;
}
/** List directory contents (names only) */
async function listDir(args) {
    const dirPath = String(args.path);
    const realPath = await (0, workspaceGuard_1.resolveWorkspacePath)(dirPath);
    const entries = await fs_1.promises.readdir(realPath);
    await (0, auditLogger_1.logAudit)({ capability: 'list_dir', status: 'completed', path: realPath });
    return entries;
}
const path_1 = __importDefault(require("path"));
async function writeFile(args) {
    const filePath = String(args.path);
    const content = String(args.content);
    const realPath = await (0, workspaceGuard_1.resolveWorkspacePath)(filePath);
    const MAX_SIZE = 1024 * 1024; // 1MB
    if (Buffer.byteLength(content, 'utf8') > MAX_SIZE) {
        throw new Error(`File exceeds maximum allowed write size of 1MB.`);
    }
    const dir = path_1.default.dirname(realPath);
    await fs_1.promises.mkdir(dir, { recursive: true });
    await fs_1.promises.writeFile(realPath, content, { encoding: 'utf8' });
    await (0, auditLogger_1.logAudit)({ capability: 'write_file', status: 'completed', path: realPath });
}
async function patchFile(args) {
    const filePath = String(args.path);
    const expectedContent = String(args.expectedContent);
    const newContent = String(args.newContent);
    const realPath = await (0, workspaceGuard_1.resolveWorkspacePath)(filePath);
    const currentContent = await fs_1.promises.readFile(realPath, { encoding: 'utf8' });
    if (currentContent !== expectedContent) {
        throw new Error('Patch failed: The file has been modified since it was last read.');
    }
    await fs_1.promises.writeFile(realPath, newContent, { encoding: 'utf8' });
    await (0, auditLogger_1.logAudit)({ capability: 'patch_file', status: 'completed', path: realPath });
}
async function renameFile(args) {
    const oldPath = String(args.oldPath);
    const newPath = String(args.newPath);
    const realOldPath = await (0, workspaceGuard_1.resolveWorkspacePath)(oldPath);
    const realNewPath = await (0, workspaceGuard_1.resolveWorkspacePath)(newPath);
    try {
        await fs_1.promises.stat(realNewPath);
        throw new Error(`Rename failed: Destination already exists.`);
    }
    catch (e) {
        if (e.code !== 'ENOENT')
            throw e;
    }
    const dir = path_1.default.dirname(realNewPath);
    await fs_1.promises.mkdir(dir, { recursive: true });
    await fs_1.promises.rename(realOldPath, realNewPath);
    await (0, auditLogger_1.logAudit)({ capability: 'rename_file', status: 'completed', path: realOldPath, target: realNewPath });
}
async function deleteFile(args) {
    const filePath = String(args.path);
    const realPath = await (0, workspaceGuard_1.resolveWorkspacePath)(filePath);
    const stats = await fs_1.promises.stat(realPath);
    if (stats.isDirectory()) {
        throw new Error('Access denied: Cannot delete directories.');
    }
    await fs_1.promises.unlink(realPath);
    await (0, auditLogger_1.logAudit)({ capability: 'delete_file', status: 'completed', path: realPath });
}
async function searchFiles(args) {
    const root = await (0, workspaceGuard_1.resolveWorkspacePath)(String(args.path));
    const query = String(args.query);
    const results = [];
    const maxResults = 50;
    async function scanDir(dir) {
        const items = await fs_1.promises.readdir(dir, { withFileTypes: true });
        for (const item of items) {
            if (results.length >= maxResults)
                return;
            if (['node_modules', '.git', '.next'].includes(item.name))
                continue;
            const fullPath = path_1.default.join(dir, item.name);
            if (item.isDirectory()) {
                await scanDir(fullPath);
            }
            else {
                try {
                    const stats = await fs_1.promises.stat(fullPath);
                    if (stats.size > 100 * 1024)
                        continue;
                    const content = await fs_1.promises.readFile(fullPath, 'utf8');
                    const lines = content.split('\n');
                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].includes(query)) {
                            results.push({
                                file: path_1.default.relative(root, fullPath),
                                line: i + 1,
                                snippet: lines[i].trim()
                            });
                            if (results.length >= maxResults)
                                return;
                        }
                    }
                }
                catch (e) {
                    // ignore unreadable
                }
            }
        }
    }
    await scanDir(root);
    await (0, auditLogger_1.logAudit)({ capability: 'search_files', status: 'completed', path: root });
    return results;
}
