import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import type { ToolDefinition } from '@/lib/types/agent';

export const list_research: ToolDefinition = {
  name: 'list_research',
  description: 'Get user\'s active research items.',
  permissionLevel: 'L1',
  parameters: {
    status: { type: 'string', description: 'Status (pending, in_progress, completed)', required: false },
  },
  execute: async (params, context) => {
    const schema = z.object({
      status: z.enum(['pending', 'in_progress', 'completed']).optional()
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    const supabase = createServerClient();
    let query = supabase.from('research').select('*').eq('user_id', context.userId);
    if (parsed.data.status) query = query.eq('status', parsed.data.status);
    
    const { data, error } = await query.limit(10);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },
};

export const get_research: ToolDefinition = {
  name: 'get_research',
  description: 'Retrieve details of a specific research item.',
  permissionLevel: 'L1',
  parameters: {
    researchId: { type: 'string', description: 'Research ID', required: true },
  },
  execute: async (params, context) => {
    const schema = z.object({
      researchId: z.string()
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    const supabase = createServerClient();
    const { data, error } = await supabase.from('research')
      .select('*')
      .eq('id', parsed.data.researchId)
      .eq('user_id', context.userId)
      .single();
    
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },
};

export const create_research: ToolDefinition = {
  name: 'create_research',
  description: 'Start a new research item',
  permissionLevel: 'L1',
  parameters: {
    topic: { type: 'string', description: 'Topic to research', required: true },
    query: { type: 'string', description: 'Specific query', required: true },
    projectId: { type: 'string', description: 'Associated Project ID', required: false },
  },
  execute: async (params, context) => {
    const schema = z.object({
      topic: z.string().min(1),
      query: z.string().min(1),
      projectId: z.string().optional()
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    const supabase = createServerClient();
    const { data, error } = await supabase.from('research').insert({
      user_id: context.userId,
      topic: parsed.data.topic,
      query: parsed.data.query,
      project_id: parsed.data.projectId || null,
      status: 'pending',
    }).select().single();
    
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },
};

export const update_research: ToolDefinition = {
  name: 'update_research',
  description: 'Update a research record with findings, sources, and status.',
  permissionLevel: 'L1',
  parameters: {
    researchId: { type: 'string', description: 'Research ID', required: true },
    changes: { type: 'object', description: 'Changes to apply (status, summary, findings, sources)', required: true }
  },
  execute: async (params, context) => {
    const schema = z.object({
      researchId: z.string(),
      changes: z.object({
        status: z.enum(['pending', 'in_progress', 'completed', 'failed']).optional(),
        summary: z.string().optional(),
        findings: z.string().optional(),
        sources: z.array(z.any()).optional()
      })
    });

    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    const updates: Record<string, any> = {};
    if (parsed.data.changes.status) updates.status = parsed.data.changes.status;
    if (parsed.data.changes.summary !== undefined) updates.summary = parsed.data.changes.summary;
    if (parsed.data.changes.findings !== undefined) updates.findings = parsed.data.changes.findings;
    if (parsed.data.changes.sources !== undefined) updates.sources = parsed.data.changes.sources;

    if (Object.keys(updates).length === 0) {
      return { success: false, error: 'No valid changes provided' };
    }

    const supabase = createServerClient();
    const { data, error } = await supabase.from('research')
      .update(updates)
      .eq('id', parsed.data.researchId)
      .eq('user_id', context.userId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }
};

