import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAIProvider } from '@/lib/agent/ai-provider';
import type { AIContext } from '@/lib/types/agent';

export async function POST(req: NextRequest) {
  try {
    const { runId, request } = await req.json();

    if (!runId || !request) {
      return NextResponse.json({ error: 'Missing runId or request' }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: run } = await supabase
      .from('agent_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (!run) {
      return NextResponse.json({ error: 'Agent run not found' }, { status: 404 });
    }

    // Step 1: Understanding
    await supabase.from('agent_steps').insert({
      agent_run_id: runId,
      user_id: run.user_id,
      step_number: 0,
      step_type: 'understanding',
      title: 'Understanding your request',
      description: `Analyzing: "${request}"`,
      status: 'in_progress',
    });

    await supabase.from('agent_runs').update({ status: 'understanding' }).eq('id', runId);

    // Retrieve context for AI
    const [memoriesRes, tasksRes] = await Promise.all([
      supabase.from('memories').select('key, value, category').eq('user_id', run.user_id).limit(20),
      supabase.from('tasks').select('title, status, priority').eq('user_id', run.user_id).limit(10),
    ]);

    const memories = (memoriesRes.data || []).map((m: { key: string; value: string }) => `${m.key}: ${m.value}`);
    const recentTasks = (tasksRes.data || []).map((t: { title: string }) => t.title);

    const context: AIContext = {
      userId: run.user_id,
      memories,
      recentTasks,
    };

    await supabase.from('agent_steps').update({ status: 'completed' }).eq('agent_run_id', runId).eq('step_number', 0);

    // Step 2: Planning
    await supabase.from('agent_steps').insert({
      agent_run_id: runId,
      user_id: run.user_id,
      step_number: 1,
      step_type: 'planning',
      title: 'Planning approach',
      description: 'Determining the best way to handle this request',
      status: 'in_progress',
    });

    await supabase.from('agent_runs').update({ status: 'planning' }).eq('id', runId);

    // Call AI provider
    const provider = getAIProvider();
    const aiResponse = await provider.generateResponse(request, context);

    await supabase.from('agent_steps').update({ status: 'completed' }).eq('agent_run_id', runId).eq('step_number', 1);

    // Step 3: Generating response
    await supabase.from('agent_steps').insert({
      agent_run_id: runId,
      user_id: run.user_id,
      step_number: 2,
      step_type: 'result',
      title: 'Generating response',
      description: 'ORBIT is formulating a response',
      status: 'completed',
    });

    // Update the run with the result
    await supabase.from('agent_runs').update({
      status: 'completed',
      result: aiResponse.text,
    }).eq('id', runId);

    // Create notification
    await supabase.from('notifications').insert({
      user_id: run.user_id,
      type: 'agent_completed',
      title: 'Agent run completed',
      body: request.slice(0, 80),
      data: { run_id: runId },
    });

    return NextResponse.json({ success: true, runId, result: aiResponse.text });
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';

    const body = await req.json().catch(() => ({}));
    if (body.runId) {
      const supabase = createServerClient();
      await supabase.from('agent_runs').update({
        status: 'failed',
        error: 'The agent encountered an error during execution.',
      }).eq('id', body.runId);
    }

    return NextResponse.json({ error: 'Agent execution failed' }, { status: 500 });
  }
}
