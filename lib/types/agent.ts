import type { PermissionLevel } from './database';

export interface ToolDefinition {
  name: string;
  description: string;
  permissionLevel: PermissionLevel;
  parameters: Record<string, ToolParameter>;
  execute: (params: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  enum?: string[];
}

export interface ToolContext {
  userId: string;
  projectId?: string;
  agentRunId: string;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  requiresApproval?: boolean;
  approvalData?: {
    toolName: string;
    actionDescription: string;
    reason: string;
    changes: Record<string, unknown>;
    permissionLevel: PermissionLevel;
  };
}

export interface AgentPlan {
  steps: PlanStep[];
  requiresApproval: boolean;
  estimatedTools: string[];
}

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  toolName?: string;
  toolParams?: Record<string, unknown>;
  permissionLevel: PermissionLevel;
}

import type { ProviderCapabilities } from '../ai/types';

export interface AIProvider {
  name: string;
  capabilities: ProviderCapabilities;
  generateResponse: (prompt: string, context: AIContext) => Promise<AIResponse>;
  checkHealth: () => Promise<boolean>;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_calls?: {
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }[];
  tool_call_id?: string;
}

export interface AIContext {
  userId: string;
  agentId?: string;
  runId?: string;
  originalRequest?: string;
  workingContext?: string[];
  memories?: string[];
  recentTasks?: string[];
  projectContext?: string;
  research?: string[];
  systemPrompt?: string;
  observations?: string[];
  availableTools?: ToolDefinition[];
  messages?: AIMessage[];
  modelProfile?: { primary: string; fallback?: string };
}

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  tools: string[];
  permissionLevel: PermissionLevel;
  systemPrompt: string;
  modelProfile?: { primary: string; fallback?: string };
  contextRequirements?: string[];
}

export interface SubAgentResult {
  agent: string;
  status: 'completed' | 'failed';
  summary: string;
  findings?: unknown[];
  recommendation?: string;
  artifacts?: unknown[];
  next_actions?: string[];
  error?: string;
}

export interface AIResponse {
  type: 'final' | 'tool_call';
  response?: string;
  toolCalls?: ToolCall[]; // Normalized structured tool calls array
  // Deprecated fields, keeping them optional for backwards compat during refactor
  tool?: string;
  arguments?: Record<string, unknown>;
  confidence?: number;
}

export interface ToolCall {
  id?: string;
  toolName: string;
  parameters: Record<string, unknown>;
}
