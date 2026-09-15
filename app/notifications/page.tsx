'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabaseClient } from '@/lib/supabase/client';
import type { Notification, NotificationType } from '@/lib/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/orbit/empty-state';
import { Bell, CheckCheck, Bot, ShieldCheck, Calendar, Search, FolderKanban, Info } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const typeConfig: Record<NotificationType, { icon: typeof Bell; color: string }> = {
  agent_completed: { icon: Bot, color: 'bg-primary/10 text-primary' },
  approval_required: { icon: ShieldCheck, color: 'bg-warning/10 text-warning' },
  task_due: { icon: Calendar, color: 'bg-destructive/10 text-destructive' },
  research_completed: { icon: Search, color: 'bg-purple-500/10 text-purple-500' },
  project_update: { icon: FolderKanban, color: 'bg-cyan-500/10 text-cyan-500' },
  system: { icon: Info, color: 'bg-muted text-muted-foreground' },
  info: { icon: Info, color: 'bg-muted text-muted-foreground' },
};

export default function NotificationsPage() {
  return (
      <NotificationsContent />
  );
}

function NotificationsContent() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'unread' | 'all'>('all');

  const load = useCallback(async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;
    let query = supabaseClient.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
    if (filter === 'unread') query = query.eq('read', false);
    const { data } = await query;
    setNotifications(data as Notification[] || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id: string) => {
    await supabaseClient.from('notifications').update({ read: true }).eq('id', id);
    load();
  };

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    await Promise.all(unread.map((n) => supabaseClient.from('notifications').update({ read: true }).eq('id', n.id)));
    toast.success('All notifications marked as read');
    load();
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:px-8 md:py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1">
            {(['all', 'unread'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize',
                  filter === f ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                )}
              >
                {f}
              </button>
            ))}
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4 mr-1.5" />Mark all read
            </Button>
          )}
        </div>
      </div>

      <Card className="border-dashed">
        <CardContent className="py-3">
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Bell className="h-3.5 w-3.5" />
            Web Push notifications are architecturally ready. Configure a push service in Settings to receive notifications on your devices.
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={Bell}
              title="No notifications"
              description="ORBIT will notify you when agent runs complete, approvals are needed, or tasks are due."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {notifications.map((n) => {
            const config = typeConfig[n.type];
            const Icon = config.icon;
            return (
              <Card
                key={n.id}
                className={cn('hover:bg-accent/30 transition-colors cursor-pointer', !n.read && 'border-primary/30')}
                onClick={() => !n.read && markRead(n.id)}
              >
                <CardContent className="py-3">
                  <div className="flex items-start gap-3">
                    <div className={cn('mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0', config.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn('text-sm', n.read ? 'font-normal' : 'font-medium')}>{n.title}</p>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                      </div>
                      {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
