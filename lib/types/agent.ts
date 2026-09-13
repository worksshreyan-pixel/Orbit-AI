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

export interface AIProvider {
  name: string;
  generateResponse: (prompt: string, context: AIContext) => Promise<AIResponse>;
}

export interface AIContext {
  userId: string;
  memories: string[];
  recentTasks: string[];
  projectContext?: string;
  systemPrompt?: string;
}

export interface AIResponse {
  text: string;
  plan?: AgentPlan;
  toolCalls?: ToolCall[];
  confidence: number;
}

export interface ToolCall {
  toolName: string;
  parameters: Record<string, unknown>;
}
