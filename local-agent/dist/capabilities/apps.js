"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openApp = openApp;
exports.openUrl = openUrl;
exports.closeApp = closeApp;
// local-agent/src/capabilities/apps.ts
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const auditLogger_1 = require("../auditLogger");
// Configured allowed application paths
const ALLOWED_APPS = {
    code: [
        path_1.default.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'Code.exe'),
        'C:\\Program Files\\Microsoft VS Code\\Code.exe',
    ],
    chrome: [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path_1.default.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ],
    notepad: [
        'C:\\Windows\\System32\\notepad.exe',
        'C:\\Windows\\notepad.exe',
    ],
};
/** Verify and open an allowed application */
async function openApp(args) {
    const appName = String(args.app || '').toLowerCase().trim();
    const candidates = ALLOWED_APPS[appName];
    if (!candidates) {
        throw new Error(`Application '${appName}' is not in the allowed apps registry.`);
    }
    let executablePath = '';
    for (const candidate of candidates) {
        if (candidate && fs_1.default.existsSync(candidate)) {
            executablePath = candidate;
            break;
        }
    }
    if (!executablePath) {
        throw new Error(`Executable for application '${appName}' was not found on this system.`);
    }
    return new Promise((resolve, reject) => {
        // Explicitly use spawn with shell: false
        const child = (0, child_process_1.spawn)(executablePath, [], { shell: false, detached: true, stdio: 'ignore' });
        child.on('error', (error) => {
            (0, auditLogger_1.logAudit)({ capability: 'open_app', status: 'error', app: appName, error: error.message });
            reject(error);
        });
        child.unref(); // allow the parent process to exit independently
        (0, auditLogger_1.logAudit)({ capability: 'open_app', status: 'completed', app: appName, path: executablePath });
        resolve({ success: true, message: `Successfully launched ${appName}` });
    });
}
/** Open a URL in the user's default browser safely */
async function openUrl(args) {
    const targetUrl = String(args.url || '').trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
        throw new Error('Only http:// and https:// URLs can be opened.');
    }
    try {
        // Use the safe 'open' library which avoids naive shell injections
        const openLib = (await Promise.resolve().then(() => __importStar(require('open')))).default;
        await openLib(targetUrl);
        (0, auditLogger_1.logAudit)({ capability: 'open_url', status: 'completed', url: targetUrl });
        return { success: true, url: targetUrl };
    }
    catch (error) {
        (0, auditLogger_1.logAudit)({ capability: 'open_url', status: 'error', url: targetUrl, error: error.message });
        throw error;
    }
}
/** Close an allowed application safely */
async function closeApp(args) {
    const appName = String(args.app || '').toLowerCase().trim();
    const candidates = ALLOWED_APPS[appName];
    if (!candidates) {
        throw new Error(`Application '${appName}' is not in the allowed apps registry.`);
    }
    const executableName = path_1.default.basename(candidates[0]); // e.g. "Code.exe"
    try {
        const { exec } = await Promise.resolve().then(() => __importStar(require('child_process')));
        const { promisify } = await Promise.resolve().then(() => __importStar(require('util')));
        const execAsync = promisify(exec);
        // Use taskkill with exactly the executable name.
        // /F forcefully terminates, /IM specifies image name.
        await execAsync(`taskkill /F /IM "${executableName}"`);
        (0, auditLogger_1.logAudit)({ capability: 'close_app', status: 'completed', app: appName, executable: executableName });
        return { success: true, message: `Successfully closed ${appName}` };
    }
    catch (error) {
        (0, auditLogger_1.logAudit)({ capability: 'close_app', status: 'error', app: appName, error: error.message });
        throw new Error(`Failed to close ${appName}: ` + error.message);
    }
}
