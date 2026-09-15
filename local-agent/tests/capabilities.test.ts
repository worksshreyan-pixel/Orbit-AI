import { readFile, listDir } from '../src/capabilities/fileSystem';
import { runProjectCommand } from '../src/capabilities/command';
import { getSystemInfo, heartbeat } from '../src/capabilities/system';

describe('Capabilities', () => {
  beforeAll(() => {
    process.env.ORBIT_ALLOWED_WORKSPACES = process.cwd();
  });

  it('reads allowed file content', async () => {
    const content = await readFile({ path: 'package.json' });
    expect(content.includes('orbit-local-agent') || content.includes('nextjs')).toBe(true);
  });

  it('lists directory entries', async () => {
    const entries = await listDir({ path: '.' });
    expect(entries).toContain('package.json');
  });

  it('retrieves system information', async () => {
    const info = await getSystemInfo();
    expect(info.agentVersion).toBe('0.1.0');
    expect(info.cpus).toBeGreaterThan(0);
  });

  it('returns online heartbeat', async () => {
    const hb = await heartbeat();
    expect(hb.status).toBe('online');
  });

  it('rejects commands not on the whitelist', async () => {
    await expect(runProjectCommand({ command: 'rm -rf /' })).rejects.toThrow('Command not allowed');
    await expect(runProjectCommand({ command: 'powershell' })).rejects.toThrow('Command not allowed');
  });
});
