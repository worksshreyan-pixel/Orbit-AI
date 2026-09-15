"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.capabilityRegistry = void 0;
// local-agent/src/capabilities/index.ts
/**
 * Capability registry mapping capability names to handler functions.
 * Each handler receives a single argument object and returns a Promise<any>.
 */
const fileSystem_1 = require("./fileSystem");
const command_1 = require("./command");
const git_1 = require("./git");
const system_1 = require("./system");
const apps_1 = require("./apps");
const screen_1 = require("./screen");
exports.capabilityRegistry = {
    // read-only filesystem
    read_file: fileSystem_1.readFile,
    list_dir: fileSystem_1.listDir,
    search_files: fileSystem_1.searchFiles,
    // write filesystem
    write_file: fileSystem_1.writeFile,
    patch_file: fileSystem_1.patchFile,
    rename_file: fileSystem_1.renameFile,
    delete_file: fileSystem_1.deleteFile,
    // command execution (whitelisted npm scripts)
    run_project_command: command_1.runProjectCommand,
    // git read-only
    git_status: git_1.gitStatus,
    git_diff: git_1.gitDiff,
    git_log: git_1.gitLog,
    git_branches: git_1.gitBranches,
    // system information & heartbeat
    get_system_info: system_1.getSystemInfo,
    get_active_window: system_1.getActiveWindow,
    get_running_processes: system_1.getRunningProcesses,
    get_screen_info: system_1.getScreenInfo,
    take_screenshot: screen_1.takeScreenshot,
    list_workspaces: system_1.listWorkspaces,
    heartbeat: system_1.heartbeat,
    // app launching
    open_app: apps_1.openApp,
    close_app: apps_1.closeApp,
    open_url: apps_1.openUrl,
};
