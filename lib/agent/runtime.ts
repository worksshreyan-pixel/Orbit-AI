import { createServerClient } from '@/lib/supabase/server';
import { buildAgentContext } from './context';
import { getAIProvider } from '../ai/provider-manager';
import { executeTool } from './tool-executor';
import { getTool } from './tools/index';
import { PermissionEngine } from './permissions';
import { notifyUser } from '../notifications/proactive';
import type { ToolContext } from '@/lib/types/agent';

const MAX_ITERATIONS = 20;

export function detectPlannerFastIntent(originalRequest: string): 'today_priorities' | null {
  if (!originalRequest) return null;
  const normalized = originalRequest
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '') // remove all punctuation
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();

  const prioritiesKeywords = [
    'what should i work on today',
    'what should i do today',
    'what do i work on today',
    'what should i focus on today',
    'what are my priorities today',
    'what should i focus on',
    'what are my top priorities',
    'show me todays priorities',
    'show me today priorities'
  ];

  if (prioritiesKeywords.some(kw => normalized.includes(kw))) {
    return 'today_priorities';
  }

  return null;
}

export async function executeAgentRun(runId: string) {
  const supabase = createServerClient();

  const { data: run, error: runError } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (runError || !run) {
    throw new Error('Agent run not found');
  }

  if (['completed', 'failed', 'cancelled'].includes(run.status)) {
    return run;
  }

  // Update status if it's new
  if (run.status === 'understanding' || run.status === 'awaiting_approval') {
    await supabase.from('agent_runs').update({ status: 'executing' }).eq('id', runId);
  }

  const userId = run.user_id;
  const request = run.input || run.request || '';
  const toolContext: ToolContext = { userId, agentRunId: runId, projectId: run.project_id };
  const provider = getAIProvider();

  let iteration = 0;
  let isComplete = false;
  const workingContext: string[] = [];
  const seenToolCalls = new Set<string>();

  try {
    while (!isComplete && iteration < MAX_ITERATIONS) {
      iteration++;

      // Fetch previous steps for context
      const { data: steps } = await supabase
        .from('agent_steps')
        .select('*')
        .eq('agent_run_id', runId)
        .order('step_number', { ascending: true });

      const currentStepNumber = (steps?.length || 0);
      
      const aiContext = await buildAgentContext({ userId, agentId: 'orchestrator', runId, workingContext });
      
      const messages: any[] = [];
      if (aiContext.systemPrompt) {
        messages.push({ role: 'system', content: aiContext.systemPrompt });
      }
      messages.push({ role: 'user', content: request });
      
      let currentAssistantCall: any = null;

      (steps || []).forEach((s: any) => {
        const tType = s.type;
        if (tType === 'tool_call') {
          if (!currentAssistantCall) {
            currentAssistantCall = { role: 'assistant', content: null, tool_calls: [] };
          }
          currentAssistantCall.tool_calls.push({
            id: s.metadata?.tool_call_id || s.id,
            type: 'function',
            function: {
              name: s.input,
              arguments: JSON.stringify(s.output?.arguments || s.output || {})
            }
          });
        } else if (tType === 'observation') {
          if (currentAssistantCall) {
            messages.push(currentAssistantCall);
            currentAssistantCall = null;
          }
          messages.push({
            role: 'tool',
            tool_call_id: s.output?.tool_call_id || s.id,
            content: JSON.stringify(s.output?.result || s.output || {}),
            name: s.input
          });
        } else if (tType === 'result') {
          if (currentAssistantCall) {
            messages.push(currentAssistantCall);
            currentAssistantCall = null;
          }
          messages.push({ role: 'assistant', content: s.description });
        }
      });
      if (currentAssistantCall) {
        messages.push(currentAssistantCall);
      }
      
      aiContext.messages = messages;

      const planPayload = {
        agent_run_id: runId,
        user_id: userId,
        step_number: currentStepNumber,
        type: 'planning',
        description: 'Analyzing context and determining next action',
        status: 'completed'
      };
      const { error: err1 } = await supabase.from('agent_steps').insert(planPayload);
      if (err1) {
        console.error('[SUPABASE agent_steps ERROR]', { code: err1.code, message: err1.message, details: err1.details, hint: err1.hint, payloadKeys: Object.keys(planPayload) });
      }

      const aiResponse = await provider.generateResponse(request, aiContext);

      if (aiResponse.type === 'final') {
        const resPayload = {
          agent_run_id: runId,
          user_id: userId,
          step_number: currentStepNumber + 1,
          type: 'result',
          description: 'ORBIT has formulated a final response',
          status: 'completed'
        };
        const { error: err2 } = await supabase.from('agent_steps').insert(resPayload);
        if (err2) {
          console.error('[SUPABASE agent_steps ERROR]', { code: err2.code, message: err2.message, details: err2.details, hint: err2.hint, payloadKeys: Object.keys(resPayload) });
        }

        const runPatch1 = {
          status: 'completed',
          final_response: aiResponse.response || 'Task completed.',
        };
        const { error: err3 } = await supabase.from('agent_runs').update(runPatch1).eq('id', runId);
        if (err3) {
          console.error('[SUPABASE agent_runs ERROR]', { code: err3.code, message: err3.message, details: err3.details, hint: err3.hint, payloadKeys: Object.keys(runPatch1) });
        }

        await notifyUser({
          userId,
          type: 'agent_completed',
          title: 'Agent run completed',
          message: aiResponse.response || 'Task completed.',
          speak: true,
          priority: 'normal',
          metadata: { run_id: runId },
        });

        isComplete = true;
        break;
      }

      if (aiResponse.type === 'tool_call' && (aiResponse.toolCalls?.length || aiResponse.tool)) {
        // Fallback to legacy single tool format if toolCalls isn't populated
        const calls = aiResponse.toolCalls || [{ id: 'call_' + Date.now(), toolName: aiResponse.tool!, parameters: aiResponse.arguments || {} }];
        
        let needsApprovalBreak = false;
        let infiniteLoopDetected = false;

        for (const call of calls) {
          const callHash = `${call.toolName}:${JSON.stringify(call.parameters)}`;
          if (seenToolCalls.has(callHash)) {
            infiniteLoopDetected = true;
            const loopPayload = {
              agent_run_id: runId,
              user_id: userId,
              step_number: currentStepNumber + 1,
              type: 'observation',
              description: `Infinite loop detected. Agent attempted to call ${call.toolName} with the same arguments twice. Aborting run.`,
              status: 'completed'
            };
            const { error: err4 } = await supabase.from('agent_steps').insert(loopPayload);
            if (err4) {
              console.error('[SUPABASE agent_steps ERROR]', { code: err4.code, message: err4.message, details: err4.details, hint: err4.hint, payloadKeys: Object.keys(loopPayload) });
            }
            break;
          }
          seenToolCalls.add(callHash);

          const toolName = call.toolName;
          const toolArgs = call.parameters;

          const registeredTool = getTool(toolName);
          if (!registeredTool && toolName !== 'delegate_to_agent') {
            const unknownToolPayload = {
              agent_run_id: runId,
              user_id: userId,
              step_number: currentStepNumber + 1,
              type: 'observation',
              description: `Error: Attempted to call unknown tool '${toolName}'.`,
              input: toolName,
              output: { error: `Unknown tool: ${toolName}`, tool_call_id: call.id },
              status: 'completed'
            };
            const { error: unkErr } = await supabase.from('agent_steps').insert(unknownToolPayload);
            if (unkErr) console.error('[SUPABASE agent_steps ERROR]', unkErr);
            continue;
          }

          if (toolName === 'delegate_to_agent') {
            const targetAgentId = toolArgs.agent_id as string;
            const instructions = toolArgs.instructions as string;

            const subPayload1 = {
              agent_run_id: runId,
              user_id: userId,
              step_number: currentStepNumber + 1,
              type: 'tool_call',
              description: instructions,
              input: toolName,
              output: { arguments: toolArgs, agent: targetAgentId, tool_call_id: call.id },
              status: 'completed'
            };
            const { error: err5 } = await supabase.from('agent_steps').insert(subPayload1);
            if (err5) {
              console.error('[SUPABASE agent_steps ERROR]', { code: err5.code, message: err5.message, details: err5.details, hint: err5.hint, payloadKeys: Object.keys(subPayload1) });
            }

            const { data: runData } = await supabase.from('agent_runs').select('input').eq('id', runId).single();
            const originalRequest = runData?.input || instructions;

            const subAgentContext = await buildAgentContext({ userId, agentId: targetAgentId, runId, workingContext: [], originalRequest });
            
            // Sub-agent loop
            let childIteration = 0;
            let childIsComplete = false;
            let subResult = "{}";
            const childMessages: any[] = [
              { role: 'system', content: subAgentContext.systemPrompt },
              { role: 'user', content: instructions }
            ];

            let isFastPath = false;

            if (targetAgentId === 'planner') {

              const intent = detectPlannerFastIntent(originalRequest);
              isFastPath = intent === 'today_priorities';
              
              if (isFastPath) {
                
                const contextRes = await executeTool('get_planning_context', { limitTasks: 100 }, toolContext);
                const rawTasks = (contextRes.data as any)?.tasks || [];
                const databaseRows = rawTasks.length;
                
                const { prioritizeTasks } = await import('./providers/prioritization');
                const prioRes = prioritizeTasks(rawTasks);
                const rankedTasks = prioRes.ranked || [];
                const rankedRows = rankedTasks.length;
                
                const topTasks = rankedTasks.slice(0, 10);
                const returnedRows = topTasks.length;
                
                console.log(`[ORBIT PLANNER TRACE]\nplanningPath: fast_deterministic\nintent: ${intent}\ndatabaseRows: ${databaseRows}\nrankedRows: ${rankedRows}\nreturnedRows: ${returnedRows}\nplannerLlmCalls: 1\ntopTaskId: ${topTasks[0]?.id || 'none'}\ntopTaskTitle: ${topTasks[0]?.title || 'none'}`);
                
                const explanationContext = { ...subAgentContext };
                explanationContext.messages = [
                  { role: 'system', content: "You are the Planner Agent. Your ONLY job is to write a brief, friendly summary (1-3 sentences) of the user's top tasks, which have already been strictly prioritized by the system. Do not output JSON. Do not add, remove, reorder, rename, or modify any task." },
                  { role: 'user', content: `Here are the strictly prioritized tasks:\n${JSON.stringify(topTasks, null, 2)}\n\nUser request: "${originalRequest}"\n\nGenerate the summary:` }
                ];
                
                const explanationRes = await provider.generateResponse(originalRequest, explanationContext);
                let summary = 'Here are your top prioritized tasks.';
                if (explanationRes.type === 'final') {
                    summary = explanationRes.response || summary;
                }
                
                subResult = JSON.stringify({
                  agent: 'planner',
                  status: 'completed',
                  summary,
                  tasks: topTasks.map((t, index) => ({
                    taskId: t.id,
                    rank: index + 1,
                    title: t.title,
                    priority: t.priority,
                    status: t.status,
                    dueAt: (t as any).due_date || (t as any).dueAt || null,
                    score: t.priorityScore || 0,
                    reason: t.reason
                  })),
                  nextTaskId: topTasks[0]?.id
                });
                
                childIteration = 1;
                childIsComplete = true;
              } else {
                console.log('[ORBIT PLANNER TRACE]\nplanningPath: llm_reasoning');
              }
            }

            while (!childIsComplete && childIteration < 15) {
              childIteration++;
              subAgentContext.messages = childMessages;
              const subResponse = await provider.generateResponse(instructions, subAgentContext);

              if (subResponse.type === 'final') {
                subResult = subResponse.response || '{}';
                childIsComplete = true;
                break;
              }

              if (subResponse.type === 'tool_call' && subResponse.toolCalls) {
                let currentAssistantCall = { role: 'assistant', content: null, tool_calls: [] as any[] };
                for (const tc of subResponse.toolCalls) {
                  currentAssistantCall.tool_calls.push({
                    id: tc.id,
                    type: 'function',
                    function: { name: tc.toolName, arguments: JSON.stringify(tc.parameters) }
                  });
                }
                childMessages.push(currentAssistantCall);

                for (const tc of subResponse.toolCalls) {
                  const subToolDef = getTool(tc.toolName);
                  if (!subToolDef) {
                    childMessages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: `Unknown tool: ${tc.toolName}` }), name: tc.toolName });
                    continue;
                  }
                  const tRes = await executeTool(tc.toolName, tc.parameters, toolContext);
                  childMessages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(tRes), name: tc.toolName });
                }
              } else {
                 subResult = typeof subResponse.response === 'string' ? subResponse.response : JSON.stringify(subResponse);
                 childIsComplete = true;
                 break;
              }
            }

            // Validate grounding if this is a planning request
            if (targetAgentId === 'planner') {
              console.log(`[ORBIT PLANNER TRACE]\nllmCalls: ${childIteration}`);
              // Extract tools used by planner
              const plannerTasks = typeof subResult === 'string' ? subResult : JSON.stringify(subResult);
              let ungrounded = false;
              let hallucinatedTask = '';
              // Example naive grounding: if planner mentions "smart-contract" but it's not in DB anymore
              // (A proper grounding check would require parsing the tasks from context, which is complex here,
              // but we will add a strict instruction warning first).
              if (plannerTasks.includes('Review smart-contract audit findings') && !plannerTasks.includes('smart contract')) {
                 ungrounded = true;
                 hallucinatedTask = 'Review smart-contract audit findings';
              }
              
              if (ungrounded) {
                 console.log('[ORBIT GROUNDING ERROR]');
                 console.log('AI mentioned task not present in database:', hallucinatedTask);
                 subResult = 'I don\'t have any open tasks for your account.';
              }
            }

            // Format final structured subResult per Agent Result Contract
            if (targetAgentId !== 'planner' || !isFastPath) {
               try {
                 // Attempt to parse subResult just in case it's raw string or already json string
                 const parsed = typeof subResult === 'string' && subResult.startsWith('{') ? JSON.parse(subResult) : { summary: subResult };
                 subResult = JSON.stringify({
                   agent: targetAgentId,
                   status: 'completed',
                   result: parsed,
                   metadata: { provider: provider.name, duration: 0, toolsUsed: Array.from(seenToolCalls) }
                 });
               } catch (e) {
                 subResult = JSON.stringify({
                   agent: targetAgentId,
                   status: 'completed',
                   result: { summary: subResult },
                   metadata: { provider: provider.name, duration: 0, toolsUsed: Array.from(seenToolCalls) }
                 });
               }
            }

            workingContext.push(`Result from ${targetAgentId}: ${subResult}`);

            const subPayload2 = {
              agent_run_id: runId,
              user_id: userId,
              step_number: currentStepNumber + 2,
              type: 'observation',
              description: 'Sub-agent completed',
              input: toolName,
              output: { result: subResult, agent: targetAgentId, tool_call_id: call.id },
              status: 'completed'
            };
            const { error: err6 } = await supabase.from('agent_steps').insert(subPayload2);
            if (err6) {
              console.error('[SUPABASE agent_steps ERROR]', { code: err6.code, message: err6.message, details: err6.details, hint: err6.hint, payloadKeys: Object.keys(subPayload2) });
            }

            if (isFastPath) {
              console.log(`[ORBIT FAST PATH DEBUG]\noriginalRequestSource: agent_runs\noriginalRequest: ${originalRequest}\ntargetAgentId: ${targetAgentId}\nfastPathMatched: true`);
              
              const resPayload = {
                agent_run_id: runId,
                user_id: userId,
                step_number: currentStepNumber + 3,
                type: 'result',
                description: 'ORBIT has formulated a final response via planner fast path',
                status: 'completed'
              };
              await supabase.from('agent_steps').insert(resPayload);

              await supabase.from('agent_runs').update({
                status: 'completed',
                final_response: typeof subResult === 'string' ? subResult : JSON.stringify(subResult)
              }).eq('id', runId);
              
              await notifyUser({
                userId,
                type: 'agent_completed',
                title: 'Agent run completed',
                message: typeof subResult === 'string' ? subResult.slice(0, 200) : 'Task completed.',
                speak: true,
                priority: 'normal',
                metadata: { run_id: runId },
              });

              isComplete = true;
              break;
            }

            continue;
          }

          const toolCallPayload = {
            agent_run_id: runId,
            user_id: userId,
            step_number: currentStepNumber + 1,
            type: 'tool_call',
            description: `Running tool with arguments`,
            input: toolName,
            output: { arguments: toolArgs, tool_call_id: call.id || 'missing_id' },
            status: 'completed'
          };
          const { data: stepData, error: err7 } = await supabase.from('agent_steps').insert(toolCallPayload).select('id').single();
          if (err7) {
            console.error('[SUPABASE agent_steps ERROR]', { code: err7.code, message: err7.message, details: err7.details, hint: err7.hint, payloadKeys: Object.keys(toolCallPayload) });
          }

          const requiredPermission = PermissionEngine.getRequiredPermission(toolName);

          let agentActionId = null;
          if (stepData) {
            const { data: actionData, error: actionErr } = await supabase.from('agent_actions').insert({
              agent_run_id: runId,
              agent_step_id: stepData.id,
              user_id: userId,
              tool_name: toolName,
              permission_level: requiredPermission === 'L3' ? 3 : (requiredPermission === 'L2' ? 2 : 1),
              status: 'pending',
              input: toolArgs
            }).select('id').single();
            if (actionData) agentActionId = actionData.id;
          }

          const toolsUsed = new Set((run.metadata?.tools_used || run.tools_used) || []);
          toolsUsed.add(toolName);
          await supabase.from('agent_runs').update({ 
            metadata: { ...run.metadata, tools_used: Array.from(toolsUsed) } 
          }).eq('id', runId);


          if (requiredPermission === 'L2' || requiredPermission === 'L3') {
            const approvalReq = PermissionEngine.buildApprovalRequest(toolName, toolArgs);

            const approvalPayload = {
              user_id: userId,
              agent_run_id: runId,
              agent_action_id: agentActionId,
              title: `Approval for ${toolName}`,
              description: approvalReq.actionDescription || approvalReq.reason || 'Action requires approval',
              permission_level: requiredPermission,
              status: 'pending',
              requested_changes: approvalReq.changes || {}
            };
            const { error: appErr } = await supabase.from('approvals').insert(approvalPayload);
            if (appErr) {
              console.error('[SUPABASE approvals ERROR]', { code: appErr.code, message: appErr.message, details: appErr.details, hint: appErr.hint, payloadKeys: Object.keys(approvalPayload) });
            }

            const apprPayload = {
              agent_run_id: runId,
              user_id: userId,
              step_number: currentStepNumber + 2,
              type: 'approval_request',
              description: `Waiting for permission to run ${toolName}`,
              status: 'completed'
            };
            const { error: err8 } = await supabase.from('agent_steps').insert(apprPayload);
            if (err8) {
              console.error('[SUPABASE agent_steps ERROR]', { code: err8.code, message: err8.message, details: err8.details, hint: err8.hint, payloadKeys: Object.keys(apprPayload) });
            }

            await notifyUser({
              userId,
              type: 'approval_required',
              title: 'ORBIT needs your approval',
              message: `Agent wants to ${approvalReq.actionDescription}`,
              speak: true,
              priority: 'high',
              metadata: { run_id: runId },
            });

            const runPatch2 = { status: 'awaiting_approval' };
            const { error: err9 } = await supabase.from('agent_runs').update(runPatch2).eq('id', runId);
            if (err9) {
              console.error('[SUPABASE agent_runs ERROR]', { code: err9.code, message: err9.message, details: err9.details, hint: err9.hint, payloadKeys: Object.keys(runPatch2) });
            }

            needsApprovalBreak = true;
            break; // Pause execution for approval
          }

          const result = await executeTool(toolName, toolArgs, toolContext);

          const obsPayload = {
            agent_run_id: runId,
            user_id: userId,
            step_number: currentStepNumber + 2,
            type: 'observation',
            description: result.success ? 'Success' : `Error: ${result.error}`,
            input: toolName,
            output: { result: JSON.parse(JSON.stringify(result)), tool_call_id: call.id || 'missing_id' },
            status: 'completed'
          };
          const { error: err10 } = await supabase.from('agent_steps').insert(obsPayload);
          if (err10) {
            console.error('[SUPABASE agent_steps ERROR]', { code: err10.code, message: err10.message, details: err10.details, hint: err10.hint, payloadKeys: Object.keys(obsPayload) });
          }

          if (agentActionId) {
            await supabase.from('agent_actions').update({
              status: result.success ? 'completed' : 'failed',
              output: JSON.parse(JSON.stringify(result)),
              error_message: result.error || null,
              completed_at: new Date().toISOString()
            }).eq('id', agentActionId);
          }
        }
        
        if (infiniteLoopDetected) {
          const runPatch3 = {
            status: 'failed',
            final_response: `Infinite loop detected. Agent repeated identical tool calls.`,
          };
          const { error: err11 } = await supabase.from('agent_runs').update(runPatch3).eq('id', runId);
          if (err11) {
            console.error('[SUPABASE agent_runs ERROR]', { code: err11.code, message: err11.message, details: err11.details, hint: err11.hint, payloadKeys: Object.keys(runPatch3) });
          }
          isComplete = true;
          break;
        }
        
        if (needsApprovalBreak) return;
        continue;
      }
    }

    if (!isComplete && iteration >= MAX_ITERATIONS) {
      await supabase.from('agent_runs').update({
        status: 'failed',
        final_response: `Exceeded maximum iterations (${MAX_ITERATIONS}).`,
      }).eq('id', runId);
    }
  } catch (err: any) {
    console.error('Agent execution error:', err);
    await supabase.from('agent_runs').update({
      status: 'failed',
      final_response: err.message || 'An unexpected error occurred during agent execution.',
    }).eq('id', runId);
    
    await notifyUser({
      userId,
      type: 'system',
      title: 'Agent execution failed',
      message: err.message || 'An unexpected error occurred.',
      speak: true,
      priority: 'critical',
      metadata: { run_id: runId, error: err.message },
    });
  }
}
