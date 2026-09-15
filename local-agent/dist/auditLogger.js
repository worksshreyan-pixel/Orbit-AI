"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAudit = logAudit;
// local-agent/src/auditLogger.ts
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const LOG_DIR = path_1.default.join(process.env.APPDATA || '', 'orbit', 'local-agent', 'logs');
const LOG_FILE = path_1.default.join(LOG_DIR, 'audit.jsonl');
/** Ensure the log directory exists */
async function ensureLogDir() {
    await fs_1.promises.mkdir(LOG_DIR, { recursive: true });
}
/** Write a structured audit entry */
async function logAudit(entry) {
    await ensureLogDir();
    const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + '\n';
    await fs_1.promises.appendFile(LOG_FILE, line, { encoding: 'utf8' });
}
