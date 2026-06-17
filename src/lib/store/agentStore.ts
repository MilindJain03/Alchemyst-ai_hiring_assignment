// ─────────────────────────────────────────────────────────────────────────────
// Agent Store — Zustand store for all application state
//
// State management rationale:
//   Zustand was chosen over Redux because:
//   1. No boilerplate — slices are plain objects with setter functions.
//   2. Immer integration for safe immutable updates on nested structures.
//   3. Subscription granularity — components subscribe to only what they read,
//      avoiding re-renders caused by unrelated state changes.
//   4. The WebSocket manager runs outside React; Zustand's getState/setState
//      API works perfectly from non-React modules.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  ConnectionStatus,
  ChatTurn,
  AgentStream,
  StreamSegment,
  TextSegment,
  ToolSegment,
  TraceEvent,
  TraceEventType,
  ContextSnapshot,
} from "../types";
import { nanoid } from "../nanoid";

// ── State shape ───────────────────────────────────────────────────────────────

interface AgentState {
  // Connection
  connectionStatus: ConnectionStatus;
  lastSeq: number;
  reconnectAttempt: number;
  serverUrl: string;

  // Chat turns
  turns: ChatTurn[];
  activeTurnId: string | null;

  // Trace timeline
  traceEvents: TraceEvent[];
  highlightedTraceId: string | null;
  highlightedChatTarget: string | null;

  // Context inspector
  contextSnapshots: Record<string, ContextSnapshot[]>;
  activeContextId: string | null;

  // Token group accumulator (for trace batching)
  _pendingTokenGroup: {
    traceId: string;
    streamId: string;
    startSeq: number;
    endSeq: number;
    startTime: number;
    count: number;
    text: string;
  } | null;
}

// ── Actions ───────────────────────────────────────────────────────────────────

interface AgentActions {
  // Connection
  setConnectionStatus: (status: ConnectionStatus) => void;
  setLastSeq: (seq: number) => void;
  setReconnectAttempt: (n: number) => void;
  setServerUrl: (url: string) => void;

  // Chat
  startTurn: (userMessage: string) => string;
  startStream: (turnId: string, streamId: string) => void;
  appendToken: (streamId: string, text: string, seq: number) => void;
  handleToolCall: (
    streamId: string,
    callId: string,
    toolName: string,
    args: Record<string, unknown>,
    seq: number
  ) => void;
  handleToolResult: (
    streamId: string,
    callId: string,
    result: Record<string, unknown>,
    seq: number
  ) => void;
  endStream: (streamId: string, seq: number) => void;

  // Trace
  addTraceEvent: (event: Omit<TraceEvent, "id">) => string;
  flushTokenGroup: () => void;
  accumulateToken: (
    streamId: string,
    text: string,
    seq: number,
    callId?: string
  ) => void;
  setHighlightedTrace: (id: string | null) => void;
  setHighlightedChatTarget: (id: string | null) => void;

  // Context
  addContextSnapshot: (snapshot: Omit<ContextSnapshot, "id">) => void;
  setActiveContextId: (id: string | null) => void;

  // Reset
  reset: () => void;
}

type AgentStore = AgentState & AgentActions;

// ── Helpers ───────────────────────────────────────────────────────────────────

function findTurnByStream(
  turns: ChatTurn[],
  streamId: string
): ChatTurn | undefined {
  return turns.find((t) => t.streams.some((s) => s.stream_id === streamId));
}

function findStream(
  turns: ChatTurn[],
  streamId: string
): AgentStream | undefined {
  for (const turn of turns) {
    const s = turn.streams.find((s) => s.stream_id === streamId);
    if (s) return s;
  }
  return undefined;
}

const initialState: AgentState = {
  connectionStatus: "idle",
  lastSeq: 0,
  reconnectAttempt: 0,
  serverUrl: "ws://localhost:4747/ws",
  turns: [],
  activeTurnId: null,
  traceEvents: [],
  highlightedTraceId: null,
  highlightedChatTarget: null,
  contextSnapshots: {},
  activeContextId: null,
  _pendingTokenGroup: null,
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAgentStore = create<AgentStore>()(
  immer((set, get) => ({
    ...initialState,

    // ── Connection ──────────────────────────────────────────────────────────

    setConnectionStatus: (status) =>
      set((s) => {
        s.connectionStatus = status;
      }),

    setLastSeq: (seq) =>
      set((s) => {
        s.lastSeq = seq;
      }),

    setReconnectAttempt: (n) =>
      set((s) => {
        s.reconnectAttempt = n;
      }),

    setServerUrl: (url) =>
      set((s) => {
        s.serverUrl = url;
      }),

    // ── Chat ────────────────────────────────────────────────────────────────

    startTurn: (userMessage) => {
      const id = nanoid();
      set((s) => {
        const turn: ChatTurn = {
          id,
          userMessage,
          streams: [],
          startedAt: Date.now(),
        };
        s.turns.push(turn);
        s.activeTurnId = id;
      });
      return id;
    },

    startStream: (turnId, streamId) => {
      set((s) => {
        const turn = s.turns.find((t) => t.id === turnId);
        if (!turn) return;
        turn.streams.push({
          stream_id: streamId,
          segments: [],
          status: "streaming",
          startedAt: Date.now(),
        });
      });
    },

    appendToken: (streamId, text, _seq) => {
      set((s) => {
        const stream = findStream(s.turns as ChatTurn[], streamId);
        if (!stream) return;

        const segs = stream.segments;
        const last = segs[segs.length - 1];

        if (last && last.kind === "text") {
          // Append to existing text segment
          (last as TextSegment).text += text;
        } else {
          // Start new text segment
          segs.push({ kind: "text", id: nanoid(), text } as TextSegment);
        }
      });
    },

    handleToolCall: (streamId, callId, toolName, args, _seq) => {
      set((s) => {
        const stream = findStream(s.turns as ChatTurn[], streamId);
        if (!stream) return;
        stream.status = "tool_pending";
        const seg: ToolSegment = {
          kind: "tool",
          id: nanoid(),
          call_id: callId,
          tool_name: toolName,
          args,
          result: null,
          status: "pending",
        };
        stream.segments.push(seg);
      });
    },

    handleToolResult: (streamId, callId, result, _seq) => {
      set((s) => {
        const stream = findStream(s.turns as ChatTurn[], streamId);
        if (!stream) return;
        stream.status = "streaming";
        const seg = stream.segments.find(
          (seg): seg is ToolSegment =>
            seg.kind === "tool" && (seg as ToolSegment).call_id === callId
        );
        if (seg) {
          seg.result = result;
          seg.status = "complete";
        }
      });
    },

    endStream: (streamId, _seq) => {
      set((s) => {
        const stream = findStream(s.turns as ChatTurn[], streamId);
        if (!stream) return;
        stream.status = "complete";
      });
    },

    // ── Trace ────────────────────────────────────────────────────────────────

    addTraceEvent: (event) => {
      const id = nanoid();
      set((s) => {
        s.traceEvents.push({ ...event, id });
        // Cap at 2000 events to prevent memory bloat
        if (s.traceEvents.length > 2000) {
          s.traceEvents.splice(0, s.traceEvents.length - 2000);
        }
      });
      return id;
    },

    flushTokenGroup: () => {
      const pending = get()._pendingTokenGroup;
      if (!pending) return;
      set((s) => {
        s._pendingTokenGroup = null;
        const event: TraceEvent = {
          id: pending.traceId,
          type: "TOKEN_GROUP",
          seq: pending.endSeq,
          timestamp: pending.startTime,
          tokenCount: pending.count,
          tokenText: pending.text,
          streamId: pending.streamId,
          durationMs: Date.now() - pending.startTime,
        };
        // Find and update the placeholder or push new
        const idx = s.traceEvents.findIndex((e) => e.id === pending.traceId);
        if (idx >= 0) {
          s.traceEvents[idx] = event;
        } else {
          s.traceEvents.push(event);
        }
      });
    },

    accumulateToken: (streamId, text, seq, _callId) => {
      const pending = get()._pendingTokenGroup;
      const now = Date.now();

      if (pending && pending.streamId === streamId) {
        // Update existing group
        set((s) => {
          if (!s._pendingTokenGroup) return;
          s._pendingTokenGroup.count += 1;
          s._pendingTokenGroup.text += text;
          s._pendingTokenGroup.endSeq = seq;
          // Update the live trace event too
          const idx = s.traceEvents.findIndex(
            (e) => e.id === s._pendingTokenGroup?.traceId
          );
          if (idx >= 0) {
            s.traceEvents[idx] = {
              ...s.traceEvents[idx],
              tokenCount: s._pendingTokenGroup.count,
              tokenText: s._pendingTokenGroup.text,
              seq,
              durationMs: now - s._pendingTokenGroup.startTime,
            };
          }
        });
      } else {
        // Flush old group and start new one
        get().flushTokenGroup();
        const traceId = nanoid();
        set((s) => {
          s._pendingTokenGroup = {
            traceId,
            streamId,
            startSeq: seq,
            endSeq: seq,
            startTime: now,
            count: 1,
            text,
          };
          // Push a live placeholder into the trace
          s.traceEvents.push({
            id: traceId,
            type: "TOKEN_GROUP",
            seq,
            timestamp: now,
            tokenCount: 1,
            tokenText: text,
            streamId,
            durationMs: 0,
          });
        });
      }
    },

    setHighlightedTrace: (id) =>
      set((s) => {
        s.highlightedTraceId = id;
      }),

    setHighlightedChatTarget: (id) =>
      set((s) => {
        s.highlightedChatTarget = id;
      }),

    // ── Context ──────────────────────────────────────────────────────────────

    addContextSnapshot: (snapshot) => {
      set((s) => {
        const id = nanoid();
        const full: ContextSnapshot = { ...snapshot, id };
        if (!s.contextSnapshots[snapshot.context_id]) {
          s.contextSnapshots[snapshot.context_id] = [];
          s.activeContextId = snapshot.context_id;
        }
        s.contextSnapshots[snapshot.context_id].push(full);
        // Update active if not set
        if (!s.activeContextId) {
          s.activeContextId = snapshot.context_id;
        }
      });
    },

    setActiveContextId: (id) =>
      set((s) => {
        s.activeContextId = id;
      }),

    // ── Reset ────────────────────────────────────────────────────────────────

    reset: () =>
      set((s) => {
        Object.assign(s, {
          ...initialState,
          serverUrl: s.serverUrl,
        });
      }),
  }))
);
