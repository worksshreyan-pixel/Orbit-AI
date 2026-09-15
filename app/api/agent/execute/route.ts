import { NextRequest, NextResponse } from 'next/server';
import { executeAgentRun } from '@/lib/agent/runtime';
import { createServerClient, getAuthUser } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { runId, request } = await req.json();

    if (!runId && !request) {
      return NextResponse.json({ error: 'Missing runId or request' }, { status: 400 });
    }

    let actualRunId = runId;

    if (!actualRunId) {
      // Create a new run if one doesn't exist
      const supabase = createServerClient();
      console.log('[DEBUG] POST /api/agent/execute started');
      console.log('[DEBUG] Auth header present?', !!req.headers.get('Authorization'));
      const cookieHeader = req.headers.get('cookie') || '';
      console.log('[DEBUG] Cookies present:', cookieHeader.split(';').map(c => c.split('=')[0].trim()));
      const user = await getAuthUser(req);
      console.log('[DEBUG] getAuthUser result:', !!user, user?.id);
      
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { data: run, error } = await supabase.from('agent_runs').insert({
        user_id: user.id,
        input: request,
        status: 'queued'
      }).select().single();

      if (error || !run) {
        console.error('[DEBUG] Failed to create run:', error);
        return NextResponse.json({ error: 'Failed to create run' }, { status: 500 });
      }
      
      actualRunId = run.id;
    }

    // Hand over to the runtime in the background
    executeAgentRun(actualRunId).catch(err => console.error('Background execution failed:', err));

    return NextResponse.json({ 
      success: true, 
      runId: actualRunId, 
      status: 'understanding'
    });
  } catch (err) {
    console.error('Agent execution failed:', err);
    
    // Attempt to set run to failed if we know the runId
    try {
      const body = await req.json().catch(() => ({}));
      if (body.runId) {
        const supabase = createServerClient();
        await supabase.from('agent_runs').update({
          status: 'failed',
          error: 'The agent encountered an error during execution.',
        }).eq('id', body.runId);
      }
    } catch (e) {
      // ignore
    }

    return NextResponse.json({ error: 'Agent execution failed' }, { status: 500 });
  }
}
