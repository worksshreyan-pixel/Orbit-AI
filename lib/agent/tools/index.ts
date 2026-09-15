import type { ToolDefinition } from '@/lib/types/agent';
import { search_memory, save_memory } from './memory';
import { list_tasks, create_task, update_task, complete_task, delete_task } from './tasks';
import { list_projects, get_project, create_project, update_project } from './projects';
import { list_research, get_research, create_research, update_research } from './research';
import { create_notification } from './notifications';
import { delegate_to_agent } from './system';
import { search_web, open_web_source } from './web';
import { inspect_project, list_project_files, read_project_file, search_project_files, write_project_file, patch_project_file, rename_project_file, delete_project_file } from './developer';
import { run_project_command, run_project_build, run_project_tests } from './command';
import { get_git_status, get_git_diff, get_git_log, list_git_branches, get_git_remote, create_git_branch, checkout_git_branch, stage_git_files, commit_git_changes, push_git_branch } from './git';
import { get_github_repository, list_github_issues, get_github_issue, list_github_pull_requests, get_github_pull_request, get_github_file, create_github_issue, create_github_pull_request } from './github';
import { get_planning_context, prioritize_tasks, get_today_plan, get_upcoming_plan, create_plan, schedule_task, reschedule_task } from './planning';
import { get_system_info, get_active_window, get_running_processes, get_screen_info, take_screenshot, open_app, close_app, open_url } from './computer';

const toolRegistry = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition) {
  toolRegistry.set(tool.name, tool);
}

export function getTool(name: string): ToolDefinition | undefined {
  return toolRegistry.get(name);
}

export function getAllTools(): ToolDefinition[] {
  return Array.from(toolRegistry.values());
}

export function getToolsByPermissionLevel(level: 'L1' | 'L2' | 'L3'): ToolDefinition[] {
  return getAllTools().filter((t) => t.permissionLevel === level);
}

// Auto-register all tools
[
  search_memory, save_memory,
  list_tasks, create_task, update_task, complete_task, delete_task,
  list_projects, get_project, create_project, update_project,
  list_research, get_research, create_research, update_research,
  create_notification,
  delegate_to_agent,
  search_web, open_web_source,
  inspect_project, list_project_files, read_project_file, search_project_files,
  write_project_file, patch_project_file, rename_project_file, delete_project_file,
  run_project_command, run_project_build, run_project_tests,
  // Git tools
  get_git_status, get_git_diff, get_git_log, list_git_branches, get_git_remote,
  create_git_branch, checkout_git_branch, stage_git_files, commit_git_changes, push_git_branch,
  // GitHub tools
  get_github_repository, list_github_issues, get_github_issue,
  list_github_pull_requests, get_github_pull_request, get_github_file,
  create_github_issue, create_github_pull_request,
  // Planning tools
  get_planning_context, prioritize_tasks, get_today_plan, get_upcoming_plan,
  create_plan, schedule_task, reschedule_task,
  // Computer tools
  get_system_info, get_active_window, get_running_processes, get_screen_info, take_screenshot,
  open_app, close_app, open_url
].forEach(registerTool);
