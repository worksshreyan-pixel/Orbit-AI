import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import type { ToolDefinition } from '@/lib/types/agent';

export const list_tasks: ToolDefinition = {
  name: 'list_tasks',
  description: 'Retrieve the user\'s tasks. Can optionally filter by status or project.',
  permissionLevel: 'L1',
  parameters: {
    status: { type: 'string', description: 'Filter by status (todo, in_progress, waiting, completed)', required: false },
    projectId: { type: 'string', description: 'Filter by project ID', required: false },
  },
  execute: async (params, context) => {
    const schema = z.object({
      status: z.string().optional(),
      projectId: z.string().optional()
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    const supabase = createServerClient();
    let query = supabase.from('tasks').select('*').eq('user_id', context.userId);
    
    if (parsed.data.status) query = query.eq('status', parsed.data.status);
    if (parsed.data.projectId) query = query.eq('project_id', parsed.data.projectId);
    
    const { data, error } = await query.order('created_at', { ascending: false }).limit(20);
    
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },
};

export const create_task: ToolDefinition = {
  name: 'create_task',
  description: 'Create a new task in the user\'s task system',
  permissionLevel: 'L1',
  parameters: {
    title: { type: 'string', description: 'Task title', required: true },
    description: { type: 'string', description: 'Task description', required: false },
    priority: { type: 'string', description: 'Priority level (low, medium, high, urgent)', required: false },
    dueAt: { type: 'string', description: 'Due date ISO string', required: false },
    projectId: { type: 'string', description: 'Associated project ID', required: false },
  },
  execute: async (params, context) => {
    const schema = z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      dueAt: z.string().optional(),
      projectId: z.string().optional()
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    const supabase = createServerClient();
    const { data, error } = await supabase.from('tasks').insert({
      user_id: context.userId,
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority || 'medium',
      due_at: parsed.data.dueAt,
      project_id: parsed.data.projectId,
      status: 'todo'
    }).select().single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },
};

export const update_task: ToolDefinition = {
  name: 'update_task',
  description: 'Update an existing task',
  permissionLevel: 'L1',
  parameters: {
    taskId: { type: 'string', description: 'Task ID', required: true },
    changes: { type: 'object', description: 'Changes to apply (status, title, description, priority)', required: true },
  },
  execute: async (params, context) => {
    const schema = z.object({
      taskId: z.string(),
      changes: z.object({
        status: z.enum(['todo', 'in_progress', 'waiting', 'completed']).optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      })
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    const supabase = createServerClient();
    
    // Whitelist changes
    const updates: Record<string, any> = {};
    if (parsed.data.changes.status) updates.status = parsed.data.changes.status;
    if (parsed.data.changes.title) updates.title = parsed.data.changes.title;
    if (parsed.data.changes.description) updates.description = parsed.data.changes.description;
    if (parsed.data.changes.priority) updates.priority = parsed.data.changes.priority;

    if (Object.keys(updates).length === 0) {
      return { success: false, error: 'No valid changes provided' };
    }

    const { data, error } = await supabase.from('tasks')
      .update(updates)
      .eq('id', parsed.data.taskId)
      .eq('user_id', context.userId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },
};

export const complete_task: ToolDefinition = {
  name: 'complete_task',
  description: 'Mark a task as completed',
  permissionLevel: 'L1',
  parameters: {
    taskId: { type: 'string', description: 'Task ID', required: true },
  },
  execute: async (params, context) => {
    const schema = z.object({
      taskId: z.string(),
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    const supabase = createServerClient();
    
    const { data, error } = await supabase.from('tasks')
      .update({ status: 'completed' })
      .eq('id', parsed.data.taskId)
      .eq('user_id', context.userId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },
};

export const delete_task: ToolDefinition = {
  name: 'delete_task',
  description: 'Delete a task permanently',
  permissionLevel: 'L3',
  parameters: {
    taskId: { type: 'string', description: 'Task ID', required: true },
  },
  execute: async (params, context) => {
    const schema = z.object({
      taskId: z.string(),
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    const supabase = createServerClient();
    const { error } = await supabase.from('tasks')
      .delete()
      .eq('id', parsed.data.taskId)
      .eq('user_id', context.userId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  },
};

