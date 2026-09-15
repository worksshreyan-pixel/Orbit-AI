import { PermissionEngine } from '../../lib/agent/permissions';
import { getTool } from '../../lib/agent/tools/index';

// Mock getTool to test PermissionEngine fallback
jest.mock('../../lib/agent/tools/index', () => ({
  getTool: jest.fn(),
}));

describe('PermissionEngine and Levels', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('defaults to L3 if tool is not found', () => {
    (getTool as jest.Mock).mockReturnValue(undefined);
    const level = PermissionEngine.getRequiredPermission('unknown_tool');
    expect(level).toBe('L3');
  });

  it('uses the tool permission level if found', () => {
    (getTool as jest.Mock).mockReturnValue({ permissionLevel: 'L1' });
    const level = PermissionEngine.getRequiredPermission('some_tool');
    expect(level).toBe('L1');
  });
});
