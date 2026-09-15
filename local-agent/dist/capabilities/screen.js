"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.takeScreenshot = takeScreenshot;
// local-agent/src/capabilities/screen.ts
const child_process_1 = require("child_process");
const util_1 = require("util");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const fs_1 = require("fs");
const auditLogger_1 = require("../auditLogger");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/** Take a screenshot and return bounded base64 */
async function takeScreenshot(_args) {
    const tmpPath = path_1.default.join(os_1.default.tmpdir(), `orbit_screenshot_${Date.now()}.png`);
    try {
        // PowerShell script to take a screenshot and save it
        const psScript = `
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing
      $screen = [System.Windows.Forms.Screen]::PrimaryScreen
      $bounds = $screen.Bounds
      $bmp = New-Object System.Drawing.Bitmap $bounds.width, $bounds.height
      $graphics = [System.Drawing.Graphics]::FromImage($bmp)
      $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.size)
      $bmp.Save('${tmpPath.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
      $graphics.Dispose()
      $bmp.Dispose()
    `;
        await execAsync(`powershell -NoProfile -Command "${psScript.replace(/\n/g, ';').replace(/"/g, '\\"')}"`);
        const buffer = await fs_1.promises.readFile(tmpPath);
        const MAX_SIZE = 2 * 1024 * 1024; // 2MB
        if (buffer.length > MAX_SIZE) {
            // Very crude resize check. If it's too big, just return error
            throw new Error(`Screenshot size (${buffer.length} bytes) exceeds 2MB limit.`);
        }
        const base64 = buffer.toString('base64');
        await (0, auditLogger_1.logAudit)({ capability: 'take_screenshot', status: 'completed', size: buffer.length });
        return {
            data: base64,
            mimeType: 'image/png'
        };
    }
    catch (error) {
        await (0, auditLogger_1.logAudit)({ capability: 'take_screenshot', status: 'error', error: error.message });
        throw new Error('Failed to take screenshot: ' + error.message);
    }
    finally {
        // Always cleanup the temporary file
        try {
            if (await fs_1.promises.stat(tmpPath).catch(() => null)) {
                await fs_1.promises.unlink(tmpPath);
            }
        }
        catch (e) {
            // Ignore cleanup errors
        }
    }
}
