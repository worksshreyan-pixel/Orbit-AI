// src/protocol/messages.ts
export type MessageBase = {
  type: "request" | "response" | "event";
  requestId: string;
};

export interface AgentRequest extends MessageBase {
  type: "request";
  capability: string;
  args: Record<string, unknown>;
}

export interface AgentResponse extends MessageBase {
  type: "response";
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface AgentEvent extends MessageBase {
  type: "event";
  event: string;
  payload: Record<string, unknown>;
}
