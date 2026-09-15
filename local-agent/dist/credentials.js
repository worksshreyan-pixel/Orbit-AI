"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setCredential = setCredential;
exports.getCredential = getCredential;
exports.hasCredential = hasCredential;
exports.clearCredential = clearCredential;
// local-agent/src/credentials.ts
/**
 * Secure credential storage for ORBIT Local Agent on Windows.
 * Manages long-lived opaque device credentials in user-isolated AppData storage.
 * Device credentials are completely separate from short-lived pairing tokens.
 */
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const CRED_DIR = path_1.default.join(process.env.APPDATA || osTempDir(), 'orbit', 'local-agent');
const CRED_PATH = path_1.default.join(CRED_DIR, 'credential.json');
function osTempDir() {
    return process.env.TEMP || process.env.TMP || 'C:\\Windows\\Temp';
}
/** Store the long-lived device credential with restricted file permissions */
async function setCredential(token, deviceId) {
    if (!token || typeof token !== 'string') {
        throw new Error('Invalid token provided to setCredential');
    }
    await fs_1.default.promises.mkdir(CRED_DIR, { recursive: true });
    const payload = {
        deviceId,
        token,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    // Write file with restricted permissions (0o600 - owner read/write only)
    await fs_1.default.promises.writeFile(CRED_PATH, JSON.stringify(payload, null, 2), {
        encoding: 'utf8',
        mode: 0o600,
    });
}
/** Retrieve the stored device token synchronously without require.cache pollution */
function getCredential() {
    try {
        if (!fs_1.default.existsSync(CRED_PATH)) {
            return '';
        }
        const raw = fs_1.default.readFileSync(CRED_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed.token === 'string' ? parsed.token : '';
    }
    catch (_) {
        return '';
    }
}
/** Check if a valid credential exists */
function hasCredential() {
    return Boolean(getCredential());
}
/** Revoke/remove the stored device credential on re-pairing or logout */
async function clearCredential() {
    try {
        if (fs_1.default.existsSync(CRED_PATH)) {
            await fs_1.default.promises.unlink(CRED_PATH);
        }
    }
    catch (_) {
        // Silently ignore if already removed
    }
}
