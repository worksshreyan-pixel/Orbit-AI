import { resolveWorkspacePath } from '../src/workspaceGuard';
import { runProjectCommand } from '../src/capabilities/command';
import { readFile } from '../src/capabilities/fileSystem';
import { openUrl } from '../src/capabilities/apps';

describe('Local Agent Security Tests', () => {
  beforeAll(() => {
    process.env.ORBIT_ALLOWED_WORKSPACES = process.cwd();
  });

  describe('workspaceGuard', () => {
    it('rejects traversal attacks', async () => {
      await expect(resolveWorkspacePath('../../../etc/passwd'))
        .rejects.toThrow(/forbidden|not within allowed workspaces/);
    });

    it('rejects UNC path attacks', async () => {
      await expect(resolveWorkspacePath('\\\\localhost\\c$\\windows'))
        .rejects.toThrow(/forbidden|not within allowed workspaces/);
    });

    it('rejects absolute path escapes outside workspace', async () => {
      await expect(resolveWorkspacePath('C:\\Windows\\System32\\cmd.exe'))
        .rejects.toThrow(/forbidden|not within allowed workspaces/);
    });

    it('rejects sensitive credential files', async () => {
      await expect(resolveWorkspacePath('.env')).rejects.toThrow(/sensitive credentials/);
      await expect(resolveWorkspacePath('private_key.pem')).rejects.toThrow(/sensitive credentials/);
      await expect(resolveWorkspacePath('credentials')).rejects.toThrow(/sensitive credentials/);
    });
  });

  describe('fileSystem', () => {
    it('allows reading valid workspace files', async () => {
      const result = await readFile({ path: 'package.json' });
      expect(result.includes('orbit-local-agent') || result.includes('nextjs')).toBe(true);
    });
  });

  describe('command execution', () => {
    it('rejects non-whitelisted commands', async () => {
      await expect(runProjectCommand({ command: 'rm -rf /' }))
        .rejects.toThrow(/Command not allowed/);
    });

    it('rejects shell injection via whitelist bypass attempt', async () => {
      await expect(runProjectCommand({ command: 'npm run test & echo vulnerable' }))
        .rejects.toThrow(/Command not allowed/);
    });
  });

  describe('URL opening', () => {
    it('rejects dangerous URL schemes', async () => {
      await expect(openUrl({ url: 'file:///c:/windows/system32/cmd.exe' }))
        .rejects.toThrow(/Only http:\/\/ and https:\/\//);
      
      await expect(openUrl({ url: 'javascript:alert(1)' }))
        .rejects.toThrow(/Only http:\/\/ and https:\/\//);
    });
  });
});
