"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runProjectCommand = runProjectCommand;
// local-agent/src/capabilities/command.ts
const child_process_1 = require("child_process");
const workspaceGuard_1 = require("../workspaceGuard");
const auditLogger_1 = require("../auditLogger");
// Whitelisted npm scripts (approved commands)
const allowedCommands = new Set([
    'npm run build',
    'npm run test',
    'npm run lint',
    'npm run typecheck',
]);
/** Execute a permitted npm script within the project workspace safely */
async function runProjectCommand(args) {
    const commandArg = String(args.command || '').trim();
    if (!allowedCommands.has(commandArg)) {
        throw new Error(`Command not allowed: ${commandArg}`);
    }
    const workspaceRoot = await (0, workspaceGuard_1.resolveWorkspacePath)('.');
    return new Promise((resolve, reject) => {
        const parts = commandArg.split(' ');
        const cmd = parts[0];
        const cmdArgs = parts.slice(1);
        // Explicitly set shell: false to prevent command injection
        const child = (0, child_process_1.spawn)(cmd, cmdArgs, { cwd: workspaceRoot, shell: false });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        child.on('error', (error) => {
            (0, auditLogger_1.logAudit)({ capability: 'run_project_command', status: 'error', command: commandArg, error: error.message });
            reject(error);
        });
        child.on('close', (code) => {
            if (code !== 0) {
                const err = new Error(`Command exited with code ${code}\nStderr: ${stderr}`);
                (0, auditLogger_1.logAudit)({ capability: 'run_project_command', status: 'error', command: commandArg, error: err.message });
                return reject(err);
            }
            (0, auditLogger_1.logAudit)({ capability: 'run_project_command', status: 'completed', command: commandArg, path: workspaceRoot });
            resolve({ stdout, stderr });
        });
    });
}
