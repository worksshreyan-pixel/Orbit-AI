import type { ToolDefinition } from '@/lib/types/agent';

export const delegate_to_agent: ToolDefinition = {
  name: 'delegate_to_agent',
  description: 'Delegate a complex subtask to a specialized agent. Always use this instead of trying to answer directly if the task requires a specialist.',
  permissionLevel: 'L1',
  parameters: {
    agent_id: { type: 'string', description: 'ID of the agent to delegate to (e.g. planner, researcher, developer, computer)', required: true, enum: ['planner', 'researcher', 'developer', 'study', 'computer'] },
    instructions: { type: 'string', description: 'Detailed instructions for the subtask', required: true },
  },
  execute: async () => ({ success: false, error: 'Intercepted by Orchestrator' }),
};

export const dangerous_test_action: ToolDefinition = {
  name: 'dangerous_test_action',
  description: 'Mock tool to test Level 3 explicit permission flow.',
  permissionLevel: 'L3',
  parameters: {
    target: { type: 'string', description: 'Target identifier', required: true }
  },
  execute: async (params) => {
    return { success: true, data: { status: 'mock_executed', target: params.target } };
  }
};

