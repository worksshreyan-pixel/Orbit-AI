import { createServerClient } from '@/lib/supabase/server';
import { NotificationType, NotificationPriority } from '@/lib/types/database';
import { getLocalAgentConnection } from '../agent/providers/local-agent-connection';

export async function notifyUser({
  userId,
  type,
  title,
  message,
  priority = 'normal',
  speak = false,
  metadata = {}
}: {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  priority?: NotificationPriority;
  speak?: boolean;
  metadata?: Record<string, any>;
}) {
  const supabase = createServerClient();
  
  const { data, error } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    message: message,
    priority,
    speak,
    data: metadata,
    read: false
  }).select().single();

  if (error) {
    console.error('Failed to insert proactive notification:', error);
  }

  try {
    const { getLocalCredential } = require('../agent/providers/local-credentials');
    const wsUrl = process.env.LOCAL_AGENT_WS_URL || 'ws://localhost:3001/ws';
    const credential = getLocalCredential().credential || '';
    const conn = getLocalAgentConnection({ wsUrl, credential });
    await conn.sendEvent('notification', {
      type,
      title,
      message,
      priority,
      speak,
      metadata
    });
  } catch (err) {
    // ignore if local agent is not connected
  }

  return data;
}
