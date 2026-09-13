import type { ToolDefinition } from '@/lib/types/agent';

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

export function getToolsByPermissionLevel(level: 'safe' | 'approval' | 'explicit'): ToolDefinition[] {
  return getAllTools().filter((t) => t.permissionLevel === level);
}

// Placeholder tools - architecture only, no real integrations
registerTool({
  name: 'create_task',
  description: 'Create a new task in the user\'s task system',
  permissionLevel: 'safe',
  parameters: {
    title: { type: 'string', description: 'Task title', required: true },
    priority: { type: 'string', description: 'Priority level', required: false, enum: ['low', 'medium', 'high', 'urgent'] },
    dueDate: { type: 'string', description: 'Due date ISO string', required: false },
    projectId: { type: 'string', description: 'Associated project ID', required: false },
  },
  execute: async () => ({
    success: false,
    error: 'Tool execution requires server-side implementation. This is an architecture placeholder.',
  }),
});

registerTool({
  name: 'create_project',
  description: 'Create a new project',
  permissionLevel: 'approval',
  parameters: {
    name: { type: 'string', description: 'Project name', required: true },
    description: { type: 'string', description: 'Project description', required: false },
  },
  execute: async () => ({
    success: false,
    error: 'Tool execution requires server-side implementation. This is an architecture placeholder.',
  }),
});

registerTool({
  name: 'research_web',
  description: 'Research a topic on the web',
  permissionLevel: 'safe',
  parameters: {
    query: { type: 'string', description: 'Search query', required: true },
  maxResults: { type: 'number', description: 'Maximum results', required: false },
  },
  execute: async () => ({
    success: false,
    error: 'Web research requires a search API integration. This is an architecture placeholder.',
  }),
});

registerTool({
  name: 'search_notion',
  description: 'Search the user\'s Notion workspace',
  permissionLevel: 'safe',
  parameters: {
    query: { type: 'string', description: 'Search query', required: true },
  },
  execute: async () => ({
    success: false,
    error: 'Notion integration not connected. Connect Notion in Settings to enable this tool.',
  }),
});

registerTool({
  name: 'create_notion_task',
  description: 'Create a task in Notion',
  permissionLevel: 'approval',
  parameters: {
    title: { type: 'string', description: 'Task title', required: true },
    databaseId: { type: 'string', description: 'Notion database ID', required: true },
  },
  execute: async () => ({
    success: false,
    error: 'Notion integration not connected. Connect Notion in Settings to enable this tool.',
  }),
});

registerTool({
  name: 'search_github',
  description: 'Search GitHub repositories',
  permissionLevel: 'safe',
  parameters: {
    query: { type: 'string', description: 'Search query', required: true },
  },
  execute: async () => ({
    success: false,
    error: 'GitHub integration not connected. Connect GitHub in Settings to enable this tool.',
  }),
});

registerTool({
  name: 'create_github_issue',
  description: 'Create a GitHub issue',
  permissionLevel: 'approval',
  parameters: {
    repo: { type: 'string', description: 'Repository name', required: true },
    title: { type: 'string', description: 'Issue title', required: true },
    body: { type: 'string', description: 'Issue body', required: false },
  },
  execute: async () => ({
    success: false,
    error: 'GitHub integration not connected. Connect GitHub in Settings to enable this tool.',
  }),
});

registerTool({
  name: 'get_project',
  description: 'Retrieve project details',
  permissionLevel: 'safe',
  parameters: {
    projectId: { type: 'string', description: 'Project ID', required: true },
  },
  execute: async () => ({
    success: false,
    error: 'Tool execution requires server-side implementation. This is an architecture placeholder.',
  }),
});

registerTool({
  name: 'update_task',
  description: 'Update an existing task',
  permissionLevel: 'approval',
  parameters: {
    taskId: { type: 'string', description: 'Task ID', required: true },
    status: { type: 'string', description: 'New status', required: false, enum: ['todo', 'in_progress', 'waiting', 'completed'] },
  },
  execute: async () => ({
    success: false,
    error: 'Tool execution requires server-side implementation. This is an architecture placeholder.',
  }),
});

registerTool({
  name: 'delete_task',
  description: 'Delete a task permanently',
  permissionLevel: 'explicit',
  parameters: {
    taskId: { type: 'string', description: 'Task ID', required: true },
  },
  execute: async () => ({
    success: false,
    error: 'Destructive operations require explicit confirmation. This is an architecture placeholder.',
  }),
});

registerTool({
  name: 'send_notification',
  description: 'Send a push notification to the user\'s devices',
  permissionLevel: 'safe',
  parameters: {
    title: { type: 'string', description: 'Notification title', required: true },
    body: { type: 'string', description: 'Notification body', required: false },
  },
  execute: async () => ({
    success: false,
    error: 'Push notification service not configured. This is an architecture placeholder.',
  }),
});

registerTool({
  name: 'get_timetable',
  description: 'Retrieve the user\'s schedule or timetable',
  permissionLevel: 'safe',
  parameters: {
    date: { type: 'string', description: 'Date in ISO format', required: false },
  },
  execute: async () => ({
    success: false,
    error: 'Calendar integration not connected. This is an architecture placeholder.',
  }),
});

registerTool({
  name: 'schedule_task',
  description: 'Schedule a task for a specific time',
  permissionLevel: 'approval',
  parameters: {
    taskId: { type: 'string', description: 'Task ID', required: true },
    scheduledFor: { type: 'string', description: 'ISO datetime', required: true },
  },
  execute: async () => ({
    success: false,
    error: 'Calendar integration not connected. This is an architecture placeholder.',
  }),
});

registerTool({
  name: 'inspect_project',
  description: 'Inspect a code project and provide analysis',
  permissionLevel: 'safe',
  parameters: {
    repoUrl: { type: 'string', description: 'Repository URL', required: true },
  },
  execute: async () => ({
    success: false,
    error: 'Code inspection requires GitHub integration. This is an architecture placeholder.',
  }),
});

registerTool({
  name: 'run_code',
  description: 'Execute code in a sandboxed environment',
  permissionLevel: 'explicit',
  parameters: {
    language: { type: 'string', description: 'Programming language', required: true },
    code: { type: 'string', description: 'Code to execute', required: true },
  },
  execute: async () => ({
    success: false,
    error: 'Code execution sandbox not configured. This is an architecture placeholder.',
  }),
});
