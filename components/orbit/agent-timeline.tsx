'use client';

import type { AgentRun, AgentStep } from '@/lib/types/database';
import { cn } from '@/lib/utils';
import {
  Brain,
  ClipboardList,
  Search,
  Wrench,
  Eye,
  ShieldAlert,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabaseClient } from '@/lib/supabase/client';

const stepIcons: Record<string, typeof Brain> = {
  understanding: Brain,
  planning: ClipboardList,
  researching: Search,
  tool_call: Wrench,
  observation: Eye,
  approval_request: ShieldAlert,
  executing: Play,
  result: CheckCircle2,
  error: AlertCircle,
  retry: RotateCcw,
};

const stepColors: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-primary/10 text-primary animate-pulse',
  completed: 'bg-success/10 text-success',
  failed: 'bg-destructive/10 text-destructive',
  skipped: 'bg-muted text-muted-foreground opacity-50',
};

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

export function AgentTimeline({ run: initialRun }: { run: AgentRun }) {
  const [run, setRun] = useState(initialRun);
  const [steps, setSteps] = useState<AgentStep[]>(initialRun.steps || []);

  useEffect(() => {
    setRun(initialRun);
    setSteps(initialRun.steps || []);

    const channel = supabaseClient
      .channel(`agent_run:${initialRun.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'agent_runs',
        filter: `id=eq.${initialRun.id}`,
      }, (payload) => {
        setRun(payload.new as AgentRun);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'agent_steps',
        filter: `agent_run_id=eq.${initialRun.id}`,
      }, async () => {
        const { data } = await supabaseClient
          .from('agent_steps')
          .select('*')
          .eq('agent_run_id', initialRun.id)
          .order('step_number', { ascending: true });
        if (data) setSteps(data as AgentStep[]);
      })
      .subscribe();

    return () => { supabaseClient.removeChannel(channel); };
  }, [initialRun]);

  const isRunning = ['understanding', 'planning', 'researching', 'awaiting_approval', 'executing'].includes(run.status);

  return (
    <div className="space-y-3">
      {/* Run header */}
      <div className="flex items-start gap-3 pb-3 border-b border-border">
        <div className={cn(
          'mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0',
          run.status === 'completed' ? 'bg-success/10 text-success' :
          run.status === 'failed' ? 'bg-destructive/10 text-destructive' :
          'bg-primary/10 text-primary'
        )}>
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> :
           run.status === 'completed' ? <CheckCircle2 className="h-4 w-4" /> :
           run.status === 'failed' ? <AlertCircle className="h-4 w-4" /> :
           <Brain className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{run.request}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{statusLabels[run.status]}</p>
        </div>
      </div>

      {/* Steps timeline */}
      {steps.length > 0 && (
        <div className="space-y-2 ml-2">
          {steps.map((step, idx) => {
            const Icon = stepIcons[step.step_type] || Brain;
            return (
              <div key={step.id} className="flex gap-3 animate-fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
                <div className="flex flex-col items-center">
                  <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0', stepColors[step.status])}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  {idx < steps.length - 1 && (
                    <div className="w-px h-full bg-border mt-1" />
                  )}
                </div>
                <div className="flex-1 pb-3 min-w-0">
                  <p className="text-sm font-medium">{step.title}</p>
                  {step.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                  )}
                  {step.tool_name && (
                    <span className="inline-block mt-1 text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {step.tool_name}
                    </span>
                  )}
                  {step.error && (
                    <p className="text-xs text-destructive mt-1">{step.error}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Result */}
      {run.result && (
        <div className="p-3 rounded-lg bg-muted/50 border border-border animate-fade-in">
          <p className="text-sm whitespace-pre-wrap">{run.result}</p>
        </div>
      )}

      {/* Error */}
      {run.error && (
        <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
          <p className="text-sm text-destructive">{run.error}</p>
        </div>
      )}
    </div>
  );
}
