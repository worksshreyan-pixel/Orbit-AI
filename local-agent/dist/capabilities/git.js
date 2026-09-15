"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gitStatus = gitStatus;
exports.gitDiff = gitDiff;
exports.gitLog = gitLog;
exports.gitBranches = gitBranches;
// local-agent/src/capabilities/git.ts
const child_process_1 = require("child_process");
const workspaceGuard_1 = require("../workspaceGuard");
const auditLogger_1 = require("../auditLogger");
/** Run a git command safely in the workspace and return stdout */
function runGit(gitArgs, cwd) {
    const result = (0, child_process_1.execSync)(`git ${gitArgs.join(' ')}`, {
        cwd,
        encoding: 'utf8',
        timeout: 15_000,
    });
    return result.trim();
}
/** Git status (read-only) */
async function gitStatus(args) {
    const workspace = String(args.workspace || '.');
    const cwd = await (0, workspaceGuard_1.resolveWorkspacePath)(workspace);
    const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
    const status = runGit(['status', '--porcelain'], cwd);
    await (0, auditLogger_1.logAudit)({ capability: 'git_status', status: 'completed', path: cwd });
    return { branch, status };
}
/** Git diff (read-only) */
async function gitDiff(args) {
    const workspace = String(args.workspace || '.');
    const cwd = await (0, workspaceGuard_1.resolveWorkspacePath)(workspace);
    const diff = runGit(['diff', '--stat'], cwd);
    await (0, auditLogger_1.logAudit)({ capability: 'git_diff', status: 'completed', path: cwd });
    return diff;
}
/** Git log (read-only, last N commits) */
async function gitLog(args) {
    const workspace = String(args.workspace || '.');
    const count = Number(args.count) || 10;
    const cwd = await (0, workspaceGuard_1.resolveWorkspacePath)(workspace);
    const log = runGit(['log', '--oneline', '-n', String(count)], cwd);
    await (0, auditLogger_1.logAudit)({ capability: 'git_log', status: 'completed', path: cwd });
    return log;
}
/** Git branches (read-only) */
async function gitBranches(args) {
    const workspace = String(args.workspace || '.');
    const cwd = await (0, workspaceGuard_1.resolveWorkspacePath)(workspace);
    const raw = runGit(['branch', '--list'], cwd);
    const branches = raw.split('\n').map((b) => b.replace(/^\*?\s*/, '').trim()).filter(Boolean);
    await (0, auditLogger_1.logAudit)({ capability: 'git_branches', status: 'completed', path: cwd });
    return branches;
}
