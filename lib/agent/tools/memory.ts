import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import type { ToolDefinition } from '@/lib/types/agent';

export const search_memory: ToolDefinition = {
  name: 'search_memory',
  description: 'Search the user\'s long-term memory system',
  permissionLevel: 'L1',
  parameters: {
    query: { type: 'string', description: 'Search query', required: true },
  },
  execute: async (params, context) => {
    const schema = z.object({ query: z.string() });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('user_id', context.userId)
      .ilike('content', `%${parsed.data.query}%`)
      .limit(20);

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },
};

export const save_memory: ToolDefinition = {
  name: 'save_memory',
  description: 'Save an important piece of context to long-term memory',
  permissionLevel: 'L1',
  parameters: {
    content: { type: 'string', description: 'Detailed content of the memory', required: true },
    category: { type: 'string', description: 'Category (preference, project, goal, decision, context, instruction)', required: true },
    importance: { type: 'number', description: 'Importance level', required: false },
    projectId: { type: 'string', description: 'Associated Project ID', required: false }
  },
  execute: async (params, context) => {
    const schema = z.object({
      content: z.string(),
      category: z.string(),
      importance: z.number().optional(),
      projectId: z.string().optional()
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    const supabase = createServerClient();
    const { data, error } = await supabase.from('memories').insert({
      user_id: context.userId,
      content: parsed.data.content,
      category: parsed.data.category || 'context',
      importance: 'normal',
      project_id: parsed.data.projectId || null,
      metadata: {}
    }).select().single();
    
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },
};

