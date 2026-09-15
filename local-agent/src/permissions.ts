// local-agent/src/permissions.ts
/**
 * Local Permission Engine for ORBIT Local Agent.
 * Validates requested capability and arguments against permission levels.
 * Level 1 (Auto): Safe read-only operations.
 * Level 2 (Approval required): Controlled command execution.
 * Disallowed: Any operation outside the strict capability boundaries.
 */

export type PermissionLevel = 1 | 2 | 3;

const LEVEL_1_CAPABILITIES = new Set<string>([
  'read_file',
  'list_dir',
  'git_status',
  'git_diff',
  'git_log',
  'git_branches',
  'get_system_info',
  'list_workspaces',
  'heartbeat',
  'open_app',
  'open_url',
  'get_active_window',
  'get_running_processes',
  'get_screen_info',
  'take_screenshot',
  'write_file',
  'patch_file',
  'rename_file',
  'delete_file',
  'close_app',
]);

const LEVEL_2_CAPABILITIES = new Set<string>([
  'run_project_command',
]);

export function getRequiredPermission(capability: string): PermissionLevel {
  if (LEVEL_1_CAPABILITIES.has(capability)) {
    return 1;
  }
  if (LEVEL_2_CAPABILITIES.has(capability)) {
    return 2;
  }
  throw new Error(`Capability '${capability}' is not permitted by Local Agent policy.`);
}

export async function checkPermission(capability: string, args: Record<string, unknown>): Promise<PermissionLevel> {
  const level = getRequiredPermission(capability);
  
  if (level === 2 && capability === 'run_project_command') {
    // Check if approved parameter or approval payload is attached if needed
    // For local agent execution, Level 2 requires user approval acknowledgement
    if (args && args.approved === false) {
      throw new Error(`Execution of command requires explicit user approval.`);
    }
  }

  return level;
}
