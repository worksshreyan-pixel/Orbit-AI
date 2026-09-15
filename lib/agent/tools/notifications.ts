import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import type { ToolDefinition } from '@/lib/types/agent';

export const create_notification: ToolDefinition = {
  name: 'create_notification',
  description: 'Send a notification to the user.',
  permissionLevel: 'L1',
  parameters: {
    type: { type: 'string', description: 'Notification type (info, success, warning, error)', required: true },
    title: { type: 'string', description: 'Notification title', required: true },
    message: { type: 'string', description: 'Notification body', required: false },
    actionUrl: { type: 'string', description: 'Optional URL to link to', required: false }
  },
  execute: async (params, context) => {
    const schema = z.object({
      type: z.string(),
      title: z.string().min(1),
      message: z.string().optional(),
      actionUrl: z.string().optional()
    });
    const parsed = schema.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    const supabase = createServerClient();
    const { data, error } = await supabase.from('notifications').insert({
      user_id: context.userId,
      type: parsed.data.type,
      title: parsed.data.title,
      message: parsed.data.message || '',
      metadata: parsed.data.actionUrl ? { actionUrl: parsed.data.actionUrl } : {}
    }).select().single();
    
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },
};

