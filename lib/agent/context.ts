import { createServerClient } from '@/lib/supabase/server';
import type { AIContext } from '@/lib/types/agent';
import { getAgent } from './registry';

export async function buildAgentContext(options: {
  userId: string;
  agentId?: string;
  runId?: string;
  workingContext?: string[];
  originalRequest?: string;
}): Promise<AIContext> {
  const { userId, agentId = 'orchestrator', runId, workingContext = [], originalRequest } = options;
  const supabase = createServerClient();

  const agentDef = getAgent(agentId);
  const systemPrompt = agentDef?.systemPrompt;
  const contextRequirements = agentDef?.contextRequirements || ['memories', 'tasks'];

  let memories: string[] | undefined;
  let recentTasks: string[] | undefined;
  let projectContext: string | undefined;
  let research: string[] | undefined;

  const queries = [];

  if (contextRequirements.includes('memories')) {
    queries.push(
      supabase.from('memories').select('id, content, category, importance, source, project_id, metadata, created_at')
        .eq('user_id', userId).order('importance', { ascending: false }).limit(20)
        .then((res: any) => { memories = (res.data || []).map((m: any) => `[${m.category}] ${m.content}`); })
    );
  }

  if (contextRequirements.includes('tasks')) {
    queries.push(
      supabase.from('tasks').select('title, status, priority').eq('user_id', userId).limit(10)
        .then((res: any) => { recentTasks = (res.data || []).map((t: { title: string }) => t.title); })
    );
  }

  if (contextRequirements.includes('projects')) {
    queries.push(
      supabase.from('projects').select('name, description, status').eq('user_id', userId).limit(5)
        .then((res: any) => { 
          if (res.data && res.data.length > 0) {
            projectContext = res.data.map((p: any) => `${p.name}: ${p.description} (${p.status})`).join('\n');
          }
        })
    );
  }

  if (contextRequirements.includes('research')) {
    queries.push(
      supabase.from('research').select('topic, summary').eq('user_id', userId).order('updated_at', { ascending: false }).limit(5)
        .then((res: any) => { research = (res.data || []).map((r: any) => `[${r.topic}] ${r.summary}`); })
    );
  }

  await Promise.all(queries);

  // Dynamically load the tools the agent is permitted to use
  const { getAllTools } = await import('./tools/index');
  const allSystemTools = getAllTools();
  const availableTools = agentDef 
    ? allSystemTools.filter(t => agentDef.tools.includes(t.name))
    : allSystemTools; // Fallback for safety

  return {
    userId,
    agentId,
    runId,
    originalRequest,
    workingContext,
    memories,
    recentTasks,
    projectContext,
    research,
    systemPrompt,
    observations: [],
    availableTools,
    modelProfile: agentDef?.modelProfile,
  };
}
