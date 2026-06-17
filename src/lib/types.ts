// ─────────────────────────────────────────────────────────────────────────────
// Protocol Types — shared across the application
// These mirror the agent-server protocol exactly.
// ─────────────────────────────────────────────────────────────────────────────

// ── Server → Client ──────────────────────────────────────────────────────────

export interface TokenMessage {
  type: "TOKEN";
  seq: number;
  text: string;
  stream_id: string;
}

export interface ToolCallMessage {
  type: "TOOL_CALL";
  seq: number;
  call_id: string;
  tool_name: string;
  args: Record<string, unknown>;
  stream_id: string;
}

export interface ToolResultMessage {
  type: "TOOL_RESULT";
  seq: number;
  call_id: string;
  result: Record<string, unknown>;
  stream_id: string;
}

export interface ContextSnapshotMessage {
  type: "CONTEXT_SNAPSHOT";
  seq: number;
  context_id: string;
  data: Record<string, unknown>;
}

export interface PingMessage {
  type: "PING";
  seq: number;
  challenge: string;
}

export interface StreamEndMessage {
  type: "STREAM_END";
  seq: number;
  stream_id: string;
}

export interface ErrorMessage {
  type: "ERROR";
  seq: number;
  code: string;
  message: string;
}

export type ServerMessage =
  | TokenMessage
  | ToolCallMessage
  | ToolResultMessage
  | ContextSnapshotMessage
  | PingMessage
  | StreamEndMessage
  | ErrorMessage;

// ── Client → Server ──────────────────────────────────────────────────────────

export interface UserMessagePayload {
  type: "USER_MESSAGE";
  content: string;
}

export interface PongPayload {
  type: "PONG";
  echo: string;
}

export interface ResumePayload {
  type: "RESUME";
  last_seq: number;
}

export interface ToolAckPayload {
  type: "TOOL_ACK";
  call_id: string;
}

export type ClientMessage =
  | UserMessagePayload
  | PongPayload
  | ResumePayload
  | ToolAckPayload;

// ─────────────────────────────────────────────────────────────────────────────
// Application-level types (rendering state)
// ─────────────────────────────────────────────────────────────────────────────

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "dead";

// A stream segment is either a block of text tokens or a tool call/result pair
export interface TextSegment {
  kind: "text";
  id: string;
  text: string;
}

export interface ToolSegment {
  kind: "tool";
  id: string;
  call_id: string;
  tool_name: string;
  args: Record<string, unknown>;
  result: Record<string, unknown> | null;
  status: "pending" | "complete";
}

export type StreamSegment = TextSegment | ToolSegment;

export interface AgentStream {
  stream_id: string;
  segments: StreamSegment[];
  status: "streaming" | "tool_pending" | "complete";
  startedAt: number;
}

// A chat turn is a user message followed by one or more agent streams
export interface ChatTurn {
  id: string;
  userMessage: string;
  streams: AgentStream[];
  startedAt: number;
}

// ── Trace Timeline ────────────────────────────────────────────────────────────

export type TraceEventType =
  | "TOKEN_GROUP"
  | "TOOL_CALL"
  | "TOOL_RESULT"
  | "CONTEXT_SNAPSHOT"
  | "PING"
  | "PONG"
  | "STREAM_END"
  | "ERROR"
  | "CONNECT"
  | "DISCONNECT"
  | "RESUME"
  | "USER_MESSAGE";

export interface TraceEvent {
  id: string;
  type: TraceEventType;
  seq: number | null;
  timestamp: number;
  // Token group fields
  tokenCount?: number;
  tokenText?: string;
  streamId?: string;
  durationMs?: number;
  // Tool fields
  callId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  result?: Record<string, unknown>;
  // Context fields
  contextId?: string;
  // Ping/pong
  challenge?: string;
  // Error
  code?: string;
  message?: string;
  // User message
  content?: string;
  // Highlight target
  highlightTarget?: string;
}

// ── Context Inspector ─────────────────────────────────────────────────────────

export interface ContextSnapshot {
  id: string;
  context_id: string;
  seq: number;
  timestamp: number;
  data: Record<string, unknown>;
}

export type DiffType = "added" | "removed" | "changed" | "unchanged";

export interface DiffNode {
  key: string;
  type: DiffType;
  oldValue?: unknown;
  newValue?: unknown;
  children?: DiffNode[];
}
