export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived';
export type TaskStatus = 'todo' | 'in_progress' | 'waiting' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type IdeaStatus = 'new' | 'reviewed' | 'converted_task' | 'converted_project' | 'converted_research' | 'archived';
export type MemoryCategory = 'preference' | 'project' | 'goal' | 'decision' | 'context' | 'instruction';
export type MemoryImportance = 'low' | 'normal' | 'high' | 'critical';
export type ResearchStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type AgentRunStatus = 'understanding' | 'planning' | 'researching' | 'awaiting_approval' | 'executing' | 'completed' | 'failed' | 'cancelled';
export type AgentStepType = 'understanding' | 'planning' | 'researching' | 'tool_call' | 'observation' | 'approval_request' | 'executing' | 'result' | 'error' | 'retry';
export type AgentStepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type PermissionLevel = 'L1' | 'L2' | 'L3';
export type NotificationType = 'agent_completed' | 'approval_required' | 'task_due' | 'research_completed' | 'project_update' | 'system' | 'info';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';
export type IntegrationProvider = 'notion' | 'github' | 'google' | 'linear' | 'slack' | 'openai' | 'anthropic' | 'gemini' | 'custom';
export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'expired';

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  color: string;
  goals: string[];
  deadline: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  project?: Project | null;
  subtasks?: Subtask[];
}

export interface Subtask {
  id: string;
  task_id: string;
  user_id: string;
  title: string;
  completed: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Idea {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: IdeaStatus;
  tags: string[];
  created_at: string;
  updated_at: string;
  project?: Project | null;
}

export interface Memory {
  id: string;
  user_id: string;
  content?: string;
  category: MemoryCategory;
  key?: string;
  value?: string;
  source?: string | null;
  project_id: string | null;
  importance: MemoryImportance;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Research {
  id: string;
  user_id: string;
  project_id: string | null;
  topic: string;
  query: string | null;
  status: ResearchStatus;
  sources: Record<string, unknown>[];
  findings: string | null;
  summary: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  project?: Project | null;
}

export interface AgentRun {
  id: string;
  user_id: string;
  project_id: string | null;
  input?: string;
  request?: string;
  status: AgentRunStatus;
  plan: Record<string, unknown>[];
  final_response?: string | null;
  result?: string | null;
  error: string | null;
  tools_used?: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  steps?: AgentStep[];
}

export interface AgentStep {
  id: string;
  agent_run_id: string;
  user_id: string;
  step_number: number;
  type?: AgentStepType;
  step_type?: AgentStepType;
  title?: string;
  description: string | null;
  input?: string | null;
  tool_name?: string | null;
  output?: Record<string, any>;
  tool_input?: Record<string, any>;
  tool_output?: Record<string, any>;
  status: AgentStepStatus;
  error: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Approval {
  id: string;
  user_id: string;
  agent_run_id: string | null;
  agent_step_id: string | null;
  tool_name: string;
  action_description: string;
  reason: string | null;
  changes: Record<string, unknown>;
  permission_level: PermissionLevel;
  status: ApprovalStatus;
  reviewed_at: string | null;
  reviewer_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message?: string | null;
  body?: string | null;
  metadata?: Record<string, any>;
  data?: Record<string, any>;
  priority: NotificationPriority;
  speak: boolean;
  read: boolean;
  created_at: string;
}

export interface Integration {
  id: string;
  user_id: string;
  provider: IntegrationProvider;
  name: string;
  status: IntegrationStatus;
  config: Record<string, unknown>;
  scopes: string[];
  last_synced_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Device {
  id: string;
  user_id: string;
  name: string | null;
  status: 'active' | 'revoked';
  platform: string | null;
  push_subscription: Record<string, unknown> | null;
  user_agent: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PairingSession {
  id: string;
  user_id: string;
  code: string;
  status: 'pending' | 'completed' | 'expired';
  device_id: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}
