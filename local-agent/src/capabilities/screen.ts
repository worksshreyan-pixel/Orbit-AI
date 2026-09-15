// local-agent/src/capabilities/screen.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { logAudit } from '../auditLogger';

const execAsync = promisify(exec);

/** Take a screenshot and return bounded base64 */
export async function takeScreenshot(_args?: Record<string, unknown>): Promise<{ data: string; mimeType: string }> {
  const tmpPath = path.join(os.tmpdir(), `orbit_screenshot_${Date.now()}.png`);
  
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
    
    const buffer = await fs.readFile(tmpPath);
    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    
    if (buffer.length > MAX_SIZE) {
      // Very crude resize check. If it's too big, just return error
      throw new Error(`Screenshot size (${buffer.length} bytes) exceeds 2MB limit.`);
    }
    
    const base64 = buffer.toString('base64');
    
    await logAudit({ capability: 'take_screenshot', status: 'completed', size: buffer.length });
    
    return {
      data: base64,
      mimeType: 'image/png'
    };
  } catch (error: any) {
    await logAudit({ capability: 'take_screenshot', status: 'error', error: error.message });
    throw new Error('Failed to take screenshot: ' + error.message);
  } finally {
    // Always cleanup the temporary file
    try {
      if (await fs.stat(tmpPath).catch(() => null)) {
        await fs.unlink(tmpPath);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}
