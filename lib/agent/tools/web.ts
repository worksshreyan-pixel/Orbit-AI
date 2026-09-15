import { z } from 'zod';
import type { ToolDefinition } from '@/lib/types/agent';
import { defaultWebSearchProvider } from '../providers/web-search';

export const search_web: ToolDefinition = {
  name: 'search_web',
  description: 'Search the web for current information.',
  permissionLevel: 'L1',
  parameters: {
    query: { type: 'string', description: 'Search query', required: true },
    maxResults: { type: 'number', description: 'Maximum results to return (default 5)', required: false }
  },
  execute: async (params) => {
    const schema = z.object({
      query: z.string().min(1),
      maxResults: z.number().max(10).optional().default(5)
    });
    
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    try {
      const results = await defaultWebSearchProvider.search(parsed.data.query, parsed.data.maxResults);
      return { success: true, data: { results } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const open_web_source: ToolDefinition = {
  name: 'open_web_source',
  description: 'Open a web URL to extract its readable content.',
  permissionLevel: 'L1',
  parameters: {
    url: { type: 'string', description: 'URL to open', required: true }
  },
  execute: async (params) => {
    const schema = z.object({
      url: z.string().url()
    });
    
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    try {
      const result = await defaultWebSearchProvider.read(parsed.data.url);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

