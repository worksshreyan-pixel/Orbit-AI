import { z } from 'zod';
import type { ToolDefinition } from '@/lib/types/agent';
import { getWorkspaceProvider } from '../providers/workspace';

export const inspect_project: ToolDefinition = {
  name: 'inspect_project',
  description: 'Understand a project structure (framework, language, important files).',
  permissionLevel: 'L1',
  parameters: {
    projectPath: { type: 'string', description: 'Absolute path to the project root', required: true },
    executionTarget: { type: 'string', description: 'Must be "cloud" or "local-agent"', required: true }
  },
  execute: async (params, context) => {
    const schema = z.object({
      projectPath: z.string().min(1),
      executionTarget: z.enum(['cloud', 'local-agent'])
    });
    
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    try {
      const provider = await getWorkspaceProvider(parsed.data.executionTarget, context.userId);
      const info = await provider.getProjectInfo(parsed.data.projectPath);
      return { success: true, data: info };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const list_project_files: ToolDefinition = {
  name: 'list_project_files',
  description: 'List files and directories in the project workspace.',
  permissionLevel: 'L1',
  parameters: {
    projectPath: { type: 'string', description: 'Absolute path to the project root', required: true },
    directory: { type: 'string', description: 'Relative path within the project to list (default root)', required: false },
    executionTarget: { type: 'string', description: 'Must be "cloud" or "local-agent"', required: true }
  },
  execute: async (params, context) => {
    const schema = z.object({
      projectPath: z.string().min(1),
      directory: z.string().optional().default(''),
      executionTarget: z.enum(['cloud', 'local-agent'])
    });
    
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    try {
      const provider = await getWorkspaceProvider(parsed.data.executionTarget, context.userId);
      const tree = await provider.listFiles(parsed.data.projectPath, parsed.data.directory);
      return { success: true, data: { files: tree } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const read_project_file: ToolDefinition = {
  name: 'read_project_file',
  description: 'Read the contents of a source file.',
  permissionLevel: 'L1',
  parameters: {
    projectPath: { type: 'string', description: 'Absolute path to the project root', required: true },
    filePath: { type: 'string', description: 'Relative path to the file', required: true },
    executionTarget: { type: 'string', description: 'Must be "cloud" or "local-agent"', required: true }
  },
  execute: async (params, context) => {
    const schema = z.object({
      projectPath: z.string().min(1),
      filePath: z.string().min(1),
      executionTarget: z.enum(['cloud', 'local-agent'])
    });
    
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    try {
      const provider = await getWorkspaceProvider(parsed.data.executionTarget, context.userId);
      const content = await provider.readFile(parsed.data.projectPath, parsed.data.filePath);
      return { success: true, data: { content } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const search_project_files: ToolDefinition = {
  name: 'search_project_files',
  description: 'Search project files for a specific query or code snippet.',
  permissionLevel: 'L1',
  parameters: {
    projectPath: { type: 'string', description: 'Absolute path to the project root', required: true },
    query: { type: 'string', description: 'String to search for', required: true },
    executionTarget: { type: 'string', description: 'Must be "cloud" or "local-agent"', required: true }
  },
  execute: async (params, context) => {
    const schema = z.object({
      projectPath: z.string().min(1),
      query: z.string().min(1),
      executionTarget: z.enum(['cloud', 'local-agent'])
    });
    
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    try {
      const provider = await getWorkspaceProvider(parsed.data.executionTarget, context.userId);
      const results = await provider.searchFiles(parsed.data.projectPath, parsed.data.query);
      return { success: true, data: { results } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const write_project_file: ToolDefinition = {
  name: 'write_project_file',
  description: 'Write or overwrite a source file. Use for creating new files or replacing small files entirely.',
  permissionLevel: 'L2', // Level 2
  parameters: {
    projectPath: { type: 'string', description: 'Absolute path to the project root', required: true },
    filePath: { type: 'string', description: 'Relative path to the file', required: true },
    content: { type: 'string', description: 'The new file content', required: true },
    reason: { type: 'string', description: 'Reason for the change', required: true },
    executionTarget: { type: 'string', description: 'Must be "cloud" or "local-agent"', required: true }
  },
  execute: async (params, context) => {
    const schema = z.object({
      projectPath: z.string().min(1),
      filePath: z.string().min(1),
      content: z.string(),
      reason: z.string().min(1),
      executionTarget: z.enum(['cloud', 'local-agent'])
    });
    
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    try {
      const provider = await getWorkspaceProvider(parsed.data.executionTarget, context.userId);
      await provider.writeFile(parsed.data.projectPath, parsed.data.filePath, parsed.data.content);
      return { success: true, data: { file: parsed.data.filePath, operation: 'written', bytes: parsed.data.content.length } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const patch_project_file: ToolDefinition = {
  name: 'patch_project_file',
  description: 'Surgically update an existing file. Verifies expectedContent matches actual content before applying newContent.',
  permissionLevel: 'L2', // Level 2
  parameters: {
    projectPath: { type: 'string', description: 'Absolute path to the project root', required: true },
    filePath: { type: 'string', description: 'Relative path to the file', required: true },
    expectedContent: { type: 'string', description: 'The exact current content of the file to verify against user modifications', required: true },
    newContent: { type: 'string', description: 'The complete new content of the file', required: true },
    reason: { type: 'string', description: 'Reason for the patch', required: true },
    executionTarget: { type: 'string', description: 'Must be "cloud" or "local-agent"', required: true }
  },
  execute: async (params, context) => {
    const schema = z.object({
      projectPath: z.string().min(1),
      filePath: z.string().min(1),
      expectedContent: z.string(),
      newContent: z.string(),
      reason: z.string().min(1),
      executionTarget: z.enum(['cloud', 'local-agent'])
    });
    
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    try {
      const provider = await getWorkspaceProvider(parsed.data.executionTarget, context.userId);
      await provider.patchFile(parsed.data.projectPath, parsed.data.filePath, parsed.data.expectedContent, parsed.data.newContent);
      return { success: true, data: { file: parsed.data.filePath, operation: 'patched' } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const rename_project_file: ToolDefinition = {
  name: 'rename_project_file',
  description: 'Rename or move a file within the workspace.',
  permissionLevel: 'L2', // Level 2
  parameters: {
    projectPath: { type: 'string', description: 'Absolute path to the project root', required: true },
    oldPath: { type: 'string', description: 'Current relative path of the file', required: true },
    newPath: { type: 'string', description: 'New relative path of the file', required: true },
    reason: { type: 'string', description: 'Reason for the rename', required: true },
    executionTarget: { type: 'string', description: 'Must be "cloud" or "local-agent"', required: true }
  },
  execute: async (params, context) => {
    const schema = z.object({
      projectPath: z.string().min(1),
      oldPath: z.string().min(1),
      newPath: z.string().min(1),
      reason: z.string().min(1),
      executionTarget: z.enum(['cloud', 'local-agent'])
    });
    
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    try {
      const provider = await getWorkspaceProvider(parsed.data.executionTarget, context.userId);
      await provider.renameFile(parsed.data.projectPath, parsed.data.oldPath, parsed.data.newPath);
      return { success: true, data: { from: parsed.data.oldPath, to: parsed.data.newPath, operation: 'renamed' } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const delete_project_file: ToolDefinition = {
  name: 'delete_project_file',
  description: 'Delete a file from the workspace. Requires explicit confirmation.',
  permissionLevel: 'L3', // Level 3
  parameters: {
    projectPath: { type: 'string', description: 'Absolute path to the project root', required: true },
    filePath: { type: 'string', description: 'Relative path to the file to delete', required: true },
    reason: { type: 'string', description: 'Reason for the deletion', required: true },
    executionTarget: { type: 'string', description: 'Must be "cloud" or "local-agent"', required: true }
  },
  execute: async (params, context) => {
    const schema = z.object({
      projectPath: z.string().min(1),
      filePath: z.string().min(1),
      reason: z.string().min(1),
      executionTarget: z.enum(['cloud', 'local-agent'])
    });
    
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    try {
      const provider = await getWorkspaceProvider(parsed.data.executionTarget, context.userId);
      await provider.deleteFile(parsed.data.projectPath, parsed.data.filePath);
      return { success: true, data: { file: parsed.data.filePath, operation: 'deleted' } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

