import type { AIContext, ToolParameter } from '@/lib/types/agent';
import { getAllTools } from '../agent/tools/index';

export function convertToJSONSchema(parameters: Record<string, ToolParameter>) {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const [key, param] of Object.entries(parameters)) {
    const { required: isRequired, ...schemaProps } = param;
    properties[key] = schemaProps;
    if (isRequired) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

export function buildSystemPrompt(context: AIContext): string {
  const memoryStr = context.memories && context.memories.length > 0
    ? `\nKnown context:\n${context.memories.map((m) => `- ${m}`).join('\n')}`
    : '';
  const taskStr = context.recentTasks && context.recentTasks.length > 0
    ? `\nRecent tasks:\n${context.recentTasks.map((t) => `- ${t}`).join('\n')}`
    : '';

  const tools = (context.availableTools || getAllTools()).map(t => ({
    name: t.name,
    description: t.description,
  }));
  
  const toolStr = tools.length > 0 
    ? `\n\nAvailable tools:\n${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}`
    : '';
  
  const obsStr = (context.observations && context.observations.length > 0)
    ? `\n\nPrevious steps and observations in this run:\n${context.observations.map((o) => `- ${o}`).join('\n')}`
    : '';

  const workingContextStr = (context.workingContext && context.workingContext.length > 0)
    ? `\n\nWorking Context (Results from specialized agents):\n${context.workingContext.map((c) => `- ${c}`).join('\n')}`
    : '';

  return `You are ORBIT, a private personal AI operating system for a single user. You help manage projects, tasks, ideas, research, and personal productivity. Be concise, intelligent, and actionable.${memoryStr}${taskStr}${toolStr}${obsStr}${workingContextStr}

If you need to perform an action, use a tool.
If you have completed the request or just need to reply to the user, respond directly.`;
}
