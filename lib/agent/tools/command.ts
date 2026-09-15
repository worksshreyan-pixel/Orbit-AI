import { z } from 'zod';
import type { ToolDefinition } from '@/lib/types/agent';
import { getCommandProvider } from '../providers/command';

export const run_project_command: ToolDefinition = {
  name: 'run_project_command',
  description: 'Execute a development command (e.g., npm install <pkg>). Requires explicit approval.',
  permissionLevel: 'L2', // Level 2
  parameters: {
    projectPath: { type: 'string', description: 'Absolute path to the project root', required: true },
    command: { type: 'string', description: 'The exact command to execute (e.g., "npm install lucide-react")', required: true },
    reason: { type: 'string', description: 'Reason for executing this command', required: true },
    executionTarget: { type: 'string', description: 'Must be "cloud" or "local-agent"', required: true }
  },
  execute: async (params, context) => {
    const schema = z.object({
      projectPath: z.string().min(1),
      command: z.string().min(1),
      reason: z.string().min(1),
      executionTarget: z.enum(['cloud', 'local-agent'])
    });
    
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    try {
      const provider = await getCommandProvider(parsed.data.executionTarget, context.userId);
      const result = await provider.executeCommand(parsed.data.projectPath, parsed.data.command);
      return { success: result.success, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const run_project_build: ToolDefinition = {
  name: 'run_project_build',
  description: 'Run the standard build command for the project (e.g., npm run build).',
  permissionLevel: 'L2', // Level 2
  parameters: {
    projectPath: { type: 'string', description: 'Absolute path to the project root', required: true },
    reason: { type: 'string', description: 'Reason for running the build', required: true },
    executionTarget: { type: 'string', description: 'Must be "cloud" or "local-agent"', required: true }
  },
  execute: async (params, context) => {
    const schema = z.object({
      projectPath: z.string().min(1),
      reason: z.string().min(1),
      executionTarget: z.enum(['cloud', 'local-agent'])
    });
    
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    // Assuming the build command is `npm run build` by default. 
    // In a sophisticated setup, we might detect yarn vs npm from workspace info first.
    try {
      const provider = await getCommandProvider(parsed.data.executionTarget, context.userId);
      const result = await provider.executeCommand(parsed.data.projectPath, 'npm run build', { timeoutMs: 5 * 60 * 1000 });
      return { success: result.success, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const run_project_tests: ToolDefinition = {
  name: 'run_project_tests',
  description: 'Run the test suite for the project.',
  permissionLevel: 'L1', // Level 1 (Safe to run without pausing)
  parameters: {
    projectPath: { type: 'string', description: 'Absolute path to the project root', required: true },
    reason: { type: 'string', description: 'Reason for running the tests', required: true },
    executionTarget: { type: 'string', description: 'Must be "cloud" or "local-agent"', required: true }
  },
  execute: async (params, context) => {
    const schema = z.object({
      projectPath: z.string().min(1),
      reason: z.string().min(1),
      executionTarget: z.enum(['cloud', 'local-agent'])
    });
    
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    try {
      const provider = await getCommandProvider(parsed.data.executionTarget, context.userId);
      const result = await provider.executeCommand(parsed.data.projectPath, 'npm run test', { timeoutMs: 5 * 60 * 1000 });
      return { success: result.success, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

