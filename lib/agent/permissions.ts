import { getTool } from './tools/index';
import type { PermissionLevel } from '@/lib/types/database';

export const PermissionEngine = {
  getRequiredPermission(toolName: string): PermissionLevel {
    const tool = getTool(toolName);
    if (!tool) {
      // If the tool isn't registered, we default to explicit just in case.
      // But typically it shouldn't execute anyway.
      return 'L3';
    }
    return tool.permissionLevel;
  },

  buildApprovalRequest(toolName: string, args: Record<string, any>) {
    const tool = getTool(toolName);
    
    let description = `Execute ${toolName}`;
    let reason = 'An agent requested to run this tool.';
    
    if (tool) {
      description = tool.description;
    }

    if (toolName === 'update_task') {
      description = `Update task ${args.taskId}`;
      reason = 'Updating task properties.';
    } else if (toolName === 'create_project') {
      description = `Create new project: ${args.name}`;
      reason = 'Creating a workspace project.';
    } else if (toolName === 'save_memory') {
      description = `Save memory to category ${args.category || 'context'}`;
      reason = 'Persisting learned context.';
    } else if (toolName === 'create_research') {
      description = `Start research on: ${args.topic}`;
      reason = 'Gathering extended information.';
    } else if (toolName === 'delete_task') {
      description = `Permanently delete task ${args.taskId}`;
      reason = 'Removing task from database.';
    // Git operations
    } else if (toolName === 'create_git_branch') {
      description = `Create git branch: ${args.branchName}`;
      reason = args.reason || 'Creating a feature branch for the proposed changes.';
    } else if (toolName === 'checkout_git_branch') {
      description = `Checkout branch: ${args.branchName}`;
      reason = args.reason || 'Switching to the target branch.';
    } else if (toolName === 'stage_git_files') {
      const files = Array.isArray(args.files) ? args.files.join(', ') : String(args.files);
      description = `Stage files for commit: ${files}`;
      reason = args.reason || 'Preparing files for a commit.';
    } else if (toolName === 'commit_git_changes') {
      description = `Commit staged changes: "${args.message}"`;
      reason = args.reason || 'Committing approved changes.';
    } else if (toolName === 'push_git_branch') {
      description = `Push branch to remote (${args.remote || 'origin'})`;
      reason = args.reason || 'Publishing the branch to the remote repository.';
    // GitHub write operations
    } else if (toolName === 'create_github_issue') {
      description = `Create GitHub issue: "${args.title}" on ${args.owner}/${args.repo}`;
      reason = args.reason || 'Creating a GitHub issue.';
    } else if (toolName === 'create_github_pull_request') {
      description = `Create PR: "${args.title}" (${args.head} → ${args.base}) on ${args.owner}/${args.repo}`;
      reason = args.reason || 'Creating a pull request for review.';
    // Developer file / command operations
    } else if (toolName === 'write_project_file' || toolName === 'patch_project_file') {
      description = `Modify file: ${args.filePath}`;
      reason = args.reason || 'Applying proposed code change.';
    } else if (toolName === 'rename_project_file') {
      description = `Rename file: ${args.oldPath} → ${args.newPath}`;
      reason = args.reason || 'Renaming as part of refactoring.';
    } else if (toolName === 'delete_project_file') {
      description = `Delete file: ${args.filePath}`;
      reason = args.reason || 'Removing a file from the project.';
    } else if (toolName === 'run_project_build' || toolName === 'run_project_command') {
      description = `Run command in project workspace`;
      reason = args.reason || 'Executing a development command.';
    // Planning operations
    } else if (toolName === 'create_plan') {
      const taskCount = Array.isArray(args.tasks) ? args.tasks.length : '?';
      description = `Create plan: "${args.title}" (${taskCount} tasks)`;
      reason = args.reason || 'Creating a structured plan.';
    } else if (toolName === 'schedule_task') {
      description = `Schedule task at ${args.scheduledAt} (~${args.estimatedMinutes} min)`;
      reason = args.reason || 'Scheduling a task.';
    } else if (toolName === 'reschedule_task') {
      description = `Reschedule task to ${args.newScheduledAt}`;
      reason = args.reason || 'Moving a task to a new time slot.';
    }

    return {
      actionDescription: description,
      reason,
      changes: args
    };
  }
};
