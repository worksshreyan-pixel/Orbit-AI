// local-agent/src/capabilities/index.ts
/**
 * Capability registry mapping capability names to handler functions.
 * Each handler receives a single argument object and returns a Promise<any>.
 */
import { readFile, listDir, writeFile, patchFile, renameFile, deleteFile, searchFiles } from './fileSystem';
import { runProjectCommand } from './command';
import { gitStatus, gitDiff, gitLog, gitBranches } from './git';
import { getSystemInfo, listWorkspaces, heartbeat, getActiveWindow, getRunningProcesses, getScreenInfo } from './system';
import { openApp, openUrl, closeApp } from './apps';
import { takeScreenshot } from './screen';

export const capabilityRegistry: Record<string, (args: Record<string, unknown>) => Promise<any>> = {
  // read-only filesystem
  read_file: readFile,
  list_dir: listDir,
  search_files: searchFiles,
  // write filesystem
  write_file: writeFile,
  patch_file: patchFile,
  rename_file: renameFile,
  delete_file: deleteFile,
  // command execution (whitelisted npm scripts)
  run_project_command: runProjectCommand,
  // git read-only
  git_status: gitStatus,
  git_diff: gitDiff,
  git_log: gitLog,
  git_branches: gitBranches,
  // system information & heartbeat
  get_system_info: getSystemInfo,
  get_active_window: getActiveWindow,
  get_running_processes: getRunningProcesses,
  get_screen_info: getScreenInfo,
  take_screenshot: takeScreenshot,
  list_workspaces: listWorkspaces,
  heartbeat: heartbeat,
  // app launching
  open_app: openApp,
  close_app: closeApp,
  open_url: openUrl,
};
