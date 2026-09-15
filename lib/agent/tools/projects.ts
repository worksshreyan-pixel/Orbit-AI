import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import type { ToolDefinition } from '@/lib/types/agent';

export const list_projects: ToolDefinition = {
  name: 'list_projects',
  description: 'Retrieve the user\'s projects.',
  permissionLevel: 'L1',
  parameters: {
    status: { type: 'string', description: 'Filter by status (active, paused, completed, archived)', required: false },
  },
  execute: async (params, context) => {
    const schema = z.object({
      status: z.enum(['active', 'paused', 'completed', 'archived']).optional()
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    const supabase = createServerClient();
    let query = supabase.from('projects').select('*').eq('user_id', context.userId);
    if (parsed.data.status) query = query.eq('status', parsed.data.status);
    
    const { data, error } = await query.order('created_at', { ascending: false }).limit(20);
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },
};

export const get_project: ToolDefinition = {
  name: 'get_project',
  description: 'Retrieve details of a specific project.',
  permissionLevel: 'L1',
  parameters: {
    projectId: { type: 'string', description: 'Project ID', required: true },
  },
  execute: async (params, context) => {
    const schema = z.object({
      projectId: z.string()
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    const supabase = createServerClient();
    const { data, error } = await supabase.from('projects')
      .select('*')
      .eq('id', parsed.data.projectId)
      .eq('user_id', context.userId)
      .single();
    
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },
};

export const create_project: ToolDefinition = {
  name: 'create_project',
  description: 'Create a new project',
  permissionLevel: 'L1',
  parameters: {
    name: { type: 'string', description: 'Project name', required: true },
    description: { type: 'string', description: 'Project description', required: false },
    priority: { type: 'string', description: 'Project priority', required: false },
  },
  execute: async (params, context) => {
    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      priority: z.string().optional()
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    const supabase = createServerClient();
    const { data, error } = await supabase.from('projects').insert({
      user_id: context.userId,
      name: parsed.data.name,
      description: parsed.data.description,
      status: 'active',
      metadata: parsed.data.priority ? { priority: parsed.data.priority } : {}
    }).select().single();
    
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },
};

export const update_project: ToolDefinition = {
  name: 'update_project',
  description: 'Update a specific project',
  permissionLevel: 'L1',
  parameters: {
    projectId: { type: 'string', description: 'Project ID', required: true },
    changes: { type: 'object', description: 'Changes to apply (status, name, description)', required: true },
  },
  execute: async (params, context) => {
    const schema = z.object({
      projectId: z.string(),
      changes: z.object({
        status: z.enum(['active', 'paused', 'completed', 'archived']).optional(),
        name: z.string().optional(),
        description: z.string().optional()
      })
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    const supabase = createServerClient();
    
    const updates: Record<string, any> = {};
    if (parsed.data.changes.status) updates.status = parsed.data.changes.status;
    if (parsed.data.changes.name) updates.name = parsed.data.changes.name;
    if (parsed.data.changes.description !== undefined) updates.description = parsed.data.changes.description;

    if (Object.keys(updates).length === 0) {
      return { success: false, error: 'No valid changes provided' };
    }

    const { data, error } = await supabase.from('projects')
      .update(updates)
      .eq('id', parsed.data.projectId)
      .eq('user_id', context.userId)
      .select()
      .single();
    
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },
};

