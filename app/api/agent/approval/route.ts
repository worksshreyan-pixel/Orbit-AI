import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { executeTool } from '@/lib/agent/tool-executor';
import { executeAgentRun } from '@/lib/agent/runtime';
import type { ToolContext } from '@/lib/types/agent';

export async function POST(req: Request) {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { approvalId, action } = await req.json();

    if (!approvalId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
    }

    // Fetch the approval record, ensuring the user owns it
    const { data: approval, error: approvalError } = await supabase
      .from('approvals')
      .select('*')
      .eq('id', approvalId)
      .eq('user_id', user.id)
      .single();

    if (approvalError || !approval) {
      return NextResponse.json({ error: 'Approval not found or unauthorized' }, { status: 404 });
    }

    if (approval.status !== 'pending') {
      return NextResponse.json({ error: 'Approval is no longer pending' }, { status: 400 });
    }

    // Process the rejection
    if (action === 'reject') {
      await supabase.from('approvals').update({ status: 'rejected' }).eq('id', approvalId);

      // Record that the action was rejected in the agent_steps
      if (approval.agent_run_id) {
        // Find the current step number to append correctly
        const { data: steps } = await supabase
          .from('agent_steps')
          .select('step_number')
          .eq('agent_run_id', approval.agent_run_id)
          .order('step_number', { ascending: false })
          .limit(1);
          
        const nextStepNumber = steps && steps.length > 0 ? steps[0].step_number + 1 : 1;

        await supabase.from('agent_steps').insert({
          agent_run_id: approval.agent_run_id,
          user_id: user.id,
          step_number: nextStepNumber,
          type: 'observation',
          title: `Result of ${approval.tool_name}`,
          description: `User rejected the execution of this tool.`,
          input: approval.tool_name,
          output: { success: false, error: 'User rejected the action.' },
          status: 'completed'
        });

        // Set run back to executing
        await supabase.from('agent_runs').update({ status: 'executing' }).eq('id', approval.agent_run_id);
        
        // Resume run asynchronously
        executeAgentRun(approval.agent_run_id).catch(console.error);
      }

      return NextResponse.json({ success: true, message: 'Action rejected.' });
    }

    // Process the approval
    await supabase.from('approvals').update({ status: 'approved' }).eq('id', approvalId);

    if (approval.agent_run_id) {
      const toolName = approval.tool_name;
      const toolArgs = approval.changes as Record<string, unknown>;
      
      const { data: run } = await supabase.from('agent_runs').select('project_id').eq('id', approval.agent_run_id).single();
      const toolContext: ToolContext = { userId: user.id, agentRunId: approval.agent_run_id, projectId: run?.project_id };
      
      // Execute the tool now that it's approved
      const result = await executeTool(toolName, toolArgs, toolContext);

      // Find next step number
      const { data: steps } = await supabase
        .from('agent_steps')
        .select('step_number')
        .eq('agent_run_id', approval.agent_run_id)
        .order('step_number', { ascending: false })
        .limit(1);
        
      const nextStepNumber = steps && steps.length > 0 ? steps[0].step_number + 1 : 1;

      // Insert observation
      await supabase.from('agent_steps').insert({
        agent_run_id: approval.agent_run_id,
        user_id: user.id,
        step_number: nextStepNumber,
        type: 'observation',
        title: `Result of ${toolName}`,
        description: result.success ? 'Success' : `Error: ${result.error}`,
        input: toolName,
        output: result,
        status: 'completed'
      });

      // Update agent action if present
      if (approval.agent_step_id) {
        await supabase.from('agent_actions').update({
          status: result.success ? 'completed' : 'failed',
          output: result,
          error_message: result.error || null,
          completed_at: new Date().toISOString()
        }).eq('agent_step_id', approval.agent_step_id);
      }

      // Set run back to executing
      await supabase.from('agent_runs').update({ status: 'executing' }).eq('id', approval.agent_run_id);

      // Resume run asynchronously
      executeAgentRun(approval.agent_run_id).catch(console.error);
    }

    return NextResponse.json({ success: true, message: 'Action approved and executed.' });
  } catch (error: any) {
    console.error('Approval API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('approvals')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ approvals: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
