"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveWorkspacePath = resolveWorkspacePath;
// local-agent/src/workspaceGuard.ts
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
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
async function resolveWorkspacePath(requestedPath) {
    const resolved = path_1.default.resolve(requestedPath);
    // Strict absolute path and traversal checks based on process.cwd() is unreliable if cwd changes,
    // but we must reject '..' and UNC paths explicitly in the requested string
    if (requestedPath.includes('..') || requestedPath.startsWith('\\\\')) {
        throw new Error('Path traversal and UNC paths are strictly forbidden');
    }
    // Check against banned file names
    const basename = path_1.default.basename(resolved).toLowerCase();
    if (BANNED_FILES.has(basename) || basename.endsWith('.pem') || basename.endsWith('.key')) {
        throw new Error('Access to sensitive credentials files is forbidden');
    }
    // Resolve symlinks to final real path.
    const real = await promises_1.default.realpath(resolved);
    const allowed = (process.env.ORBIT_ALLOWED_WORKSPACES || '').split(';').filter(Boolean);
    const isAllowed = allowed.some((w) => {
        const absW = path_1.default.resolve(w);
        const rel = path_1.default.relative(absW, real);
        // If it doesn't start with .. and is not absolute, it is inside the workspace
        return !rel.startsWith('..') && !path_1.default.isAbsolute(rel);
    });
    if (!isAllowed) {
        throw new Error('Resolved path is not within allowed workspaces');
    }
    return real;
}
