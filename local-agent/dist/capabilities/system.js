"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSystemInfo = getSystemInfo;
exports.listWorkspaces = listWorkspaces;
exports.heartbeat = heartbeat;
exports.getActiveWindow = getActiveWindow;
exports.getRunningProcesses = getRunningProcesses;
exports.getScreenInfo = getScreenInfo;
// local-agent/src/capabilities/system.ts
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const auditLogger_1 = require("../auditLogger");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/** Get system information without leaking secrets */
async function getSystemInfo(_args) {
    const info = {
        platform: os_1.default.platform(),
        arch: os_1.default.arch(),
        hostname: os_1.default.hostname(),
        cpus: os_1.default.cpus().length,
        totalMemoryMB: Math.round(os_1.default.totalmem() / (1024 * 1024)),
        freeMemoryMB: Math.round(os_1.default.freemem() / (1024 * 1024)),
        uptimeSeconds: Math.round(os_1.default.uptime()),
        agentVersion: '0.1.0',
    };
    await (0, auditLogger_1.logAudit)({ capability: 'get_system_info', status: 'completed' });
    return info;
}
/** List configured allowed workspaces */
async function listWorkspaces(_args) {
    const allowed = (process.env.ORBIT_ALLOWED_WORKSPACES || process.cwd())
        .split(';')
        .filter(Boolean)
        .map((w) => path_1.default.resolve(w));
    await (0, auditLogger_1.logAudit)({ capability: 'list_workspaces', status: 'completed' });
    return allowed;
}
/** Periodic heartbeat capability */
async function heartbeat(_args) {
    const response = {
        status: 'online',
        timestamp: new Date().toISOString(),
    };
    await (0, auditLogger_1.logAudit)({ capability: 'heartbeat', status: 'completed' });
    return response;
}
/** Get active window using PowerShell */
async function getActiveWindow(_args) {
    try {
        // A simple PowerShell script to get the foreground window title and process name
        const psScript = `
      Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        public class Win32 {
          [DllImport("user32.dll")]
          public static extern IntPtr GetForegroundWindow();
          [DllImport("user32.dll", SetLastError=true)]
          public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
          [DllImport("user32.dll", CharSet=CharSet.Auto, SetLastError=true)]
          public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
        }
"@
      $hwnd = [Win32]::GetForegroundWindow()
      $pid = 0
      [Win32]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null
      $sb = New-Object System.Text.StringBuilder 256
      [Win32]::GetWindowText($hwnd, $sb, $sb.Capacity) | Out-Null
      $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
      
      @{
        title = $sb.ToString()
        processName = if ($process) { $process.ProcessName } else { "Unknown" }
      } | ConvertTo-Json
    `;
        // Base64 encode the script for powershell -EncodedCommand to avoid all quoting/newline issues
        const encodedScript = Buffer.from(psScript, 'utf16le').toString('base64');
        const { stdout } = await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedScript}`);
        const result = JSON.parse(stdout);
        await (0, auditLogger_1.logAudit)({ capability: 'get_active_window', status: 'completed' });
        return {
            title: result.title || '',
            processName: result.processName || ''
        };
    }
    catch (error) {
        await (0, auditLogger_1.logAudit)({ capability: 'get_active_window', status: 'error', error: error.message });
        throw new Error('Failed to get active window');
    }
}
/** Get safe list of running processes */
async function getRunningProcesses(_args) {
    try {
        const { stdout } = await execAsync('tasklist /NH /FO CSV');
        const lines = stdout.trim().split('\n');
        const processes = lines.map(line => {
            // "System Idle Process","0","Services","0","8 K"
            const parts = line.split('","').map(p => p.replace(/"/g, '').trim());
            if (parts.length >= 5) {
                const memoryStr = parts[4].replace(/[^0-9]/g, '');
                const memoryMB = Math.round((parseInt(memoryStr, 10) || 0) / 1024);
                return {
                    name: parts[0],
                    pid: parseInt(parts[1], 10),
                    memoryMB
                };
            }
            return null;
        }).filter(Boolean);
        // Sort by memory usage descending and take top 50 to bound results
        const topProcesses = processes.sort((a, b) => b.memoryMB - a.memoryMB).slice(0, 50);
        await (0, auditLogger_1.logAudit)({ capability: 'get_running_processes', status: 'completed' });
        return topProcesses;
    }
    catch (error) {
        await (0, auditLogger_1.logAudit)({ capability: 'get_running_processes', status: 'error', error: error.message });
        throw new Error('Failed to get running processes');
    }
}
/** Get basic screen info */
async function getScreenInfo(_args) {
    try {
        const { stdout } = await execAsync('powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen.Bounds | ConvertTo-Json"');
        const bounds = JSON.parse(stdout);
        await (0, auditLogger_1.logAudit)({ capability: 'get_screen_info', status: 'completed' });
        return {
            width: bounds.Width || 0,
            height: bounds.Height || 0
        };
    }
    catch (error) {
        await (0, auditLogger_1.logAudit)({ capability: 'get_screen_info', status: 'error', error: error.message });
        // Default fallback
        return { width: 1920, height: 1080 };
    }
}
