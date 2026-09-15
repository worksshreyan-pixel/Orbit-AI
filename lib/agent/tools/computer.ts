import { z } from 'zod';
import type { ToolDefinition } from '@/lib/types/agent';
import { getComputerProvider } from '../providers/computer';

export const get_system_info: ToolDefinition = {
  name: 'get_system_info',
  description: 'Get basic information about the operating system and agent status.',
  permissionLevel: 'L1',
  parameters: {
    executionTarget: { type: 'string', description: 'Must be "cloud" or "local-agent"', required: true }
  },
  execute: async (params, context) => {
    const schema = z.object({ executionTarget: z.enum(['cloud', 'local-agent']) });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    try {
      const provider = await getComputerProvider(parsed.data.executionTarget, context.userId);
      const info = await provider.getSystemInfo();
      return { success: true, data: info };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const get_active_window: ToolDefinition = {
  name: 'get_active_window',
  description: 'Get the title and process name of the currently active/focused window.',
  permissionLevel: 'L1',
  parameters: {
    executionTarget: { type: 'string', description: 'Must be "cloud" or "local-agent"', required: true }
  },
  execute: async (params, context) => {
    const schema = z.object({ executionTarget: z.enum(['cloud', 'local-agent']) });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    try {
      const provider = await getComputerProvider(parsed.data.executionTarget, context.userId);
      const info = await provider.getActiveWindow();
      return { success: true, data: info };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const get_running_processes: ToolDefinition = {
  name: 'get_running_processes',
  description: 'Get a bounded list of running processes with their names and PIDs.',
  permissionLevel: 'L1',
  parameters: {
    executionTarget: { type: 'string', description: 'Must be "cloud" or "local-agent"', required: true }
  },
  execute: async (params, context) => {
    const schema = z.object({ executionTarget: z.enum(['cloud', 'local-agent']) });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    try {
      const provider = await getComputerProvider(parsed.data.executionTarget, context.userId);
      const info = await provider.getRunningProcesses();
      return { success: true, data: info };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const get_screen_info: ToolDefinition = {
  name: 'get_screen_info',
  description: 'Get the current primary screen resolution bounds.',
  permissionLevel: 'L1',
  parameters: {
    executionTarget: { type: 'string', description: 'Must be "cloud" or "local-agent"', required: true }
  },
  execute: async (params, context) => {
    const schema = z.object({ executionTarget: z.enum(['cloud', 'local-agent']) });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    try {
      const provider = await getComputerProvider(parsed.data.executionTarget, context.userId);
      const info = await provider.getScreenInfo();
      return { success: true, data: info };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const take_screenshot: ToolDefinition = {
  name: 'take_screenshot',
  description: 'Take a screenshot of the primary display. Returns base64 encoded image data.',
  permissionLevel: 'L1',
  parameters: {
    executionTarget: { type: 'string', description: 'Must be "cloud" or "local-agent"', required: true }
  },
  execute: async (params, context) => {
    const schema = z.object({ executionTarget: z.enum(['cloud', 'local-agent']) });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    try {
      const provider = await getComputerProvider(parsed.data.executionTarget, context.userId);
      const result = await provider.takeScreenshot();
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const open_app: ToolDefinition = {
  name: 'open_app',
  description: 'Open a registered and allowed application by name (e.g., "code", "chrome", "notepad").',
  permissionLevel: 'L2',
  parameters: {
    app: { type: 'string', description: 'The registered name of the application to open', required: true },
    reason: { type: 'string', description: 'Reason for opening the application', required: true },
    executionTarget: { type: 'string', description: 'Must be "cloud" or "local-agent"', required: true }
  },
  execute: async (params, context) => {
    const schema = z.object({
      app: z.string().min(1),
      reason: z.string().min(1),
      executionTarget: z.enum(['cloud', 'local-agent'])
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    try {
      const provider = await getComputerProvider(parsed.data.executionTarget, context.userId);
      const result = await provider.openApp({ app: parsed.data.app });
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const close_app: ToolDefinition = {
  name: 'close_app',
  description: 'Close a registered application by name (e.g., "code", "chrome").',
  permissionLevel: 'L2',
  parameters: {
    app: { type: 'string', description: 'The registered name of the application to close', required: true },
    reason: { type: 'string', description: 'Reason for closing the application', required: true },
    executionTarget: { type: 'string', description: 'Must be "cloud" or "local-agent"', required: true }
  },
  execute: async (params, context) => {
    const schema = z.object({
      app: z.string().min(1),
      reason: z.string().min(1),
      executionTarget: z.enum(['cloud', 'local-agent'])
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    try {
      const provider = await getComputerProvider(parsed.data.executionTarget, context.userId);
      const result = await provider.closeApp({ app: parsed.data.app });
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const open_url: ToolDefinition = {
  name: 'open_url',
  description: 'Open a URL in the default browser.',
  permissionLevel: 'L2',
  parameters: {
    url: { type: 'string', description: 'The URL to open (must be http/https)', required: true },
    reason: { type: 'string', description: 'Reason for opening the URL', required: true },
    executionTarget: { type: 'string', description: 'Must be "cloud" or "local-agent"', required: true }
  },
  execute: async (params, context) => {
    const schema = z.object({
      url: z.string().url(),
      reason: z.string().min(1),
      executionTarget: z.enum(['cloud', 'local-agent'])
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    try {
      const provider = await getComputerProvider(parsed.data.executionTarget, context.userId);
      const result = await provider.openUrl({ url: parsed.data.url });
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};
