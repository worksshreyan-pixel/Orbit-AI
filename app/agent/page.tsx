'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/orbit/app-shell';
import { supabaseClient } from '@/lib/supabase/client';
import type { AgentRun } from '@/lib/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/orbit/empty-state';
import { CommandInput } from '@/components/orbit/command-input';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Bot, CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react';

const statusLabels: Record<string, string> = {
  understanding: 'Understanding',
  planning: 'Planning',
  researching: 'Researching',
  awaiting_approval: 'Awaiting Approval',
  executing: 'Executing',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export default function AgentPage() {
  return (
    <AppShell>
      <AgentContent />
    </AppShell>
  );
}

function AgentContent() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const loadRuns = useCallback(async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const { data } = await supabaseClient
      .from('agent_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    setRuns(data as AgentRun[] || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadRuns(); }, [loadRuns]);

  const filteredRuns = runs.filter((r) => {
    if (filter === 'active') return ['understanding', 'planning', 'researching', 'awaiting_approval', 'executing'].includes(r.status);
    if (filter === 'completed') return ['completed', 'failed', 'cancelled'].includes(r.status);
    return true;
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:px-8 md:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agent</h1>
        <p className="text-sm text-muted-foreground mt-1">AI execution timeline and history</p>
      </div>

      <CommandInput onRunStart={loadRuns} />

      <div className="flex gap-2">
        {(['all', 'active', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize',
              filter === f ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filteredRuns.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              icon={Bot}
              title="No agent runs"
              description="Submit a command above to see ORBIT's execution timeline here."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRuns.map((run) => (
            <Link key={run.id} href={`/agent/${run.id}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                      run.status === 'completed' ? 'bg-success/10 text-success' :
                      run.status === 'failed' ? 'bg-destructive/10 text-destructive' :
                      'bg-primary/10 text-primary'
                    )}>
                      {['understanding', 'planning', 'researching', 'awaiting_approval', 'executing'].includes(run.status) ?
                        <Loader2 className="h-4 w-4 animate-spin" /> :
                       run.status === 'completed' ? <CheckCircle2 className="h-4 w-4" /> :
                       run.status === 'failed' ? <AlertCircle className="h-4 w-4" /> :
                       <Clock className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{run.request}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{statusLabels[run.status]}</span>
                        {run.tools_used.length > 0 && (
                          <span className="text-xs text-muted-foreground">· {run.tools_used.length} tools</span>
                        )}
                      </div>
                      {run.result && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{run.result}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
