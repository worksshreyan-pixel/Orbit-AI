import { checkPermission, getRequiredPermission } from '../src/permissions';

describe('Local Agent Permission Engine', () => {
  it('assigns Level 1 to safe read-only capabilities', () => {
    expect(getRequiredPermission('read_file')).toBe(1);
    expect(getRequiredPermission('list_dir')).toBe(1);
    expect(getRequiredPermission('get_system_info')).toBe(1);
    expect(getRequiredPermission('git_status')).toBe(1);
  });

  it('assigns Level 2 to run_project_command', () => {
    expect(getRequiredPermission('run_project_command')).toBe(2);
  });

  it('rejects disallowed capabilities', () => {
    expect(() => getRequiredPermission('read_secrets')).toThrow();
    expect(() => getRequiredPermission('arbitrary_exec')).toThrow();
  });

  it('allows Level 1 checks', async () => {
    await expect(checkPermission('read_file', { path: 'package.json' })).resolves.toBe(1);
  });

  it('enforces explicit approval check on Level 2 if explicitly disapproved', async () => {
    await expect(checkPermission('run_project_command', { command: 'npm run build', approved: false })).rejects.toThrow();
  });
});
