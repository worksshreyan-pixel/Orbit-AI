import { getTool } from '@/lib/agent/tools/index';
import type { ToolResult, ToolContext } from '@/lib/types/agent';
import { createServerClient } from '@/lib/supabase/server';

export async function executeTool(
  toolName: string,
  parameters: Record<string, unknown>,
  context: ToolContext
): Promise<ToolResult> {
  const tool = getTool(toolName);
  
  if (!tool) {
    return {
      success: false,
      error: `Tool "${toolName}" not found in registry.`,
    };
  }

  // Validate parameters loosely based on schema
  for (const [key, param] of Object.entries(tool.parameters)) {
    if (param.required && parameters[key] === undefined) {
      return {
        success: false,
        error: `Missing required parameter: ${key}`,
      };
    }
  }



  try {
    const result = await tool.execute(parameters, context);
    
    // TEMPORARY DEBUG LOGGING AS REQUESTED
    let databaseRows: number | undefined;
    let inputContextRows: number | undefined;
    let outputRows: number | undefined;

    if (result.success && result.data) {
      const data = result.data as Record<string, any>;
      
      if (toolName === 'get_planning_context') {
        databaseRows = data.tasks?.length ?? 0;
        outputRows = data.tasks?.length ?? 0;
      } else if (toolName === 'prioritize_tasks') {
        databaseRows = 0;
        inputContextRows = data.ranked?.length ?? 0;
        outputRows = data.ranked?.length ?? 0;
      } else if (toolName === 'get_today_plan' || toolName === 'get_upcoming_plan') {
        databaseRows = 0;
        inputContextRows = data.tasks?.length ?? 0;
        outputRows = data.tasks?.length ?? 0;
      } else {
        if (Array.isArray(data.tasks)) databaseRows = data.tasks.length;
        else if (Array.isArray(data)) databaseRows = data.length;
      }
    }

    console.log('[ORBIT TOOL DEBUG]');
    console.log('tool:', toolName);
    console.log('authenticatedUserId:', context.userId);
    console.log('arguments:', JSON.stringify(parameters));
    if (databaseRows !== undefined) console.log('databaseRows:', databaseRows);
    if (inputContextRows !== undefined) console.log('inputContextRows:', inputContextRows);
    if (outputRows !== undefined) console.log('outputRows:', outputRows);
    
    // For manual test trace logging
    if (toolName === 'prioritize_tasks' || toolName === 'get_today_plan') {
      console.log('[ORBIT PLANNER TRACE]');
      console.log(`databaseRows: ${databaseRows ?? ''}`);
      console.log(`inputContextRows: ${inputContextRows ?? ''}`);
      const rankedRows = result.success && result.data ? ((result.data as any).ranked?.length || (result.data as any).tasks?.length || 0) : 0;
      console.log(`rankedRows: ${rankedRows}`);
      console.log(`returnedRows: ${outputRows ?? ''}`);
      
      const topTask = result.success && result.data ? ((result.data as any).ranked?.[0] || (result.data as any).tasks?.[0]) : null;
      console.log(`topTaskId: ${topTask?.id || ''}`);
      console.log(`topTaskTitle: ${topTask?.title || ''}`);
    }

    // Do not log the entire result object if it's too big, just a summary
    console.log('result snippet:', JSON.stringify(result).substring(0, 200));

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown tool execution error',
    };
  }
}
