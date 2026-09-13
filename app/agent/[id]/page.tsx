'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/orbit/app-shell';
import { supabaseClient } from '@/lib/supabase/client';
import type { AgentRun } from '@/lib/types/database';
import { AgentTimeline } from '@/components/orbit/agent-timeline';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AgentRunPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <AgentRunContent id={params.id} />
    </AppShell>
  );
}

function AgentRunContent({ id }: { id: string }) {
  const [run, setRun] = useState<AgentRun | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data } = await supabaseClient
        .from('agent_runs')
        .select('*, steps:agent_steps(*)')
        .eq('id', id)
        .single();

      if (data) {
        const steps = (data.steps || []).sort((a: { step_number: number }, b: { step_number: number }) => a.step_number - b.step_number);
        setRun({ ...data, steps } as AgentRun);
      }
      setLoading(false);
    })();
  }, [id]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:px-8 md:py-8 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push('/agent')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Agent
      </Button>

      {loading ? (
        <div className="h-40 rounded-xl bg-muted animate-pulse" />
      ) : !run ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Agent run not found.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-4">
            <AgentTimeline run={run} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
