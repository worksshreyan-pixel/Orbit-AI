import { resolveWorkspacePath } from '../src/workspaceGuard';
import path from 'path';

describe('WorkspaceGuard', () => {
  const originalEnv = process.env.ORBIT_ALLOWED_WORKSPACES;

  beforeAll(() => {
    process.env.ORBIT_ALLOWED_WORKSPACES = process.cwd();
  });

  afterAll(() => {
    process.env.ORBIT_ALLOWED_WORKSPACES = originalEnv;
  });

  it('allows valid paths within current workspace', async () => {
    const resolved = await resolveWorkspacePath('package.json');
    expect(resolved).toBe(path.resolve('package.json'));
  });

  it('rejects path traversal attacks (..)', async () => {
    await expect(resolveWorkspacePath('../../../Windows/System32')).rejects.toThrow();
  });
});
