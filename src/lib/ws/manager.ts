// ─────────────────────────────────────────────────────────────────────────────
// WebSocket Manager — connection lifecycle state machine
//
// States:
//   idle        → CONNECTING (on connect())
//   connecting  → connected (on ws.open) | reconnecting (on ws.error/close)
//   connected   → reconnecting (on ws.close/error) | idle (on disconnect())
//   reconnecting→ connecting (after backoff) | dead (max retries exceeded)
//   dead        → idle (on manual reconnect)
//
// Key invariants:
//   1. RESUME is ALWAYS the first message sent on reconnection.
//   2. lastProcessed seq is tracked by SequenceBuffer, not the socket.
//   3. PONG is sent within 3 seconds; empty challenge is handled gracefully.
//   4. TOOL_ACK is sent immediately when TOOL_CALL is processed.
// ─────────────────────────────────────────────────────────────────────────────

import { SequenceBuffer } from "./sequenceBuffer";
import { useAgentStore } from "../store/agentStore";
import type { ServerMessage, ClientMessage } from "../types";

const MAX_RETRIES = 8;
const BACKOFF_STEPS = [500, 1000, 2000, 4000, 8000, 10000];

function backoffMs(attempt: number): number {
  return BACKOFF_STEPS[Math.min(attempt, BACKOFF_STEPS.length - 1)];
}

class AgentWebSocketManager {
  private ws: WebSocket | null = null;
  private url: string = "";
  private buffer: SequenceBuffer;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt: number = 0;
  private manuallyDisconnected: boolean = false;
  private dropTimeout: ReturnType<typeof setTimeout> | null = null;

  // Track the active turn so we can attach new streams to it
  private activeTurnId: string | null = null;

  constructor() {
    this.buffer = new SequenceBuffer((msg) => this.dispatch(msg));
  }

  // ── Public API ────────────────────────────────────────────────────────────

  connect(url: string): void {
    this.url = url;
    this.manuallyDisconnected = false;
    this.reconnectAttempt = 0;
    this.openSocket();
  }

  disconnect(): void {
    this.manuallyDisconnected = true;
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close(1000, "manual disconnect");
      this.ws = null;
    }
    this.buffer.reset();
    useAgentStore.getState().setConnectionStatus("idle");
  }

  send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  sendUserMessage(content: string): void {
    const store = useAgentStore.getState();
    const turnId = store.startTurn(content);
    this.activeTurnId = turnId;

    // Add to trace
    store.addTraceEvent({
      type: "USER_MESSAGE",
      seq: null,
      timestamp: Date.now(),
      content,
    });

    this.send({ type: "USER_MESSAGE", content });

    // Reset sequence buffer for new conversation turn
    // (server resets seq to 0 on each new USER_MESSAGE)
    this.buffer.reset(0);
    store.setLastSeq(0);
  }

  // ── Socket lifecycle ──────────────────────────────────────────────────────

  private openSocket(): void {
    const store = useAgentStore.getState();
    store.setConnectionStatus("connecting");

    try {
      const ws = new WebSocket(this.url);
      this.ws = ws;

      ws.onopen = () => this.onOpen(ws);
      ws.onmessage = (e) => this.onMessage(e);
      ws.onclose = (e) => this.onClose(e, ws);
      ws.onerror = () => {
        // onclose will fire after onerror — handle there
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private onOpen(ws: WebSocket): void {
    const store = useAgentStore.getState();
    this.reconnectAttempt = 0;
    store.setReconnectAttempt(0);

    const lastSeq = this.buffer.getLastProcessed();
    const isResume = lastSeq > 0;

    if (isResume) {
      // RESUME must be the very first message after reconnection
      store.setConnectionStatus("connected");
      this.send({ type: "RESUME", last_seq: lastSeq });
      store.addTraceEvent({
        type: "RESUME",
        seq: null,
        timestamp: Date.now(),
        message: `Resuming from seq=${lastSeq}`,
      } as Parameters<typeof store.addTraceEvent>[0]);
    } else {
      store.setConnectionStatus("connected");
    }

    store.addTraceEvent({
      type: "CONNECT",
      seq: null,
      timestamp: Date.now(),
    });

    // Flush any pending token group
    store.flushTokenGroup();

    if (ws !== this.ws) return; // stale reference
  }

  private onMessage(event: MessageEvent): void {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(event.data as string) as ServerMessage;
    } catch {
      // Malformed JSON — ignore
      return;
    }

    // Push into the sequence buffer (handles ordering/dedup)
    this.buffer.push(msg);

    // Track highest seq for RESUME
    useAgentStore.getState().setLastSeq(this.buffer.getLastProcessed());
  }

  private onClose(event: CloseEvent, ws: WebSocket): void {
    if (ws !== this.ws) return; // stale

    const store = useAgentStore.getState();
    store.flushTokenGroup();

    store.addTraceEvent({
      type: "DISCONNECT",
      seq: null,
      timestamp: Date.now(),
      message: `code=${event.code}`,
    } as Parameters<typeof store.addTraceEvent>[0]);

    if (this.manuallyDisconnected) {
      store.setConnectionStatus("idle");
      return;
    }

    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.manuallyDisconnected) return;

    const store = useAgentStore.getState();

    if (this.reconnectAttempt >= MAX_RETRIES) {
      store.setConnectionStatus("dead");
      return;
    }

    store.setConnectionStatus("reconnecting");
    store.setReconnectAttempt(this.reconnectAttempt);

    const delay = backoffMs(this.reconnectAttempt);
    this.reconnectAttempt++;

    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.openSocket();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ── Message dispatch ──────────────────────────────────────────────────────

  private dispatch(msg: ServerMessage): void {
    const store = useAgentStore.getState();

    switch (msg.type) {
      case "TOKEN":
        this.handleToken(msg, store);
        break;

      case "TOOL_CALL":
        this.handleToolCall(msg, store);
        break;

      case "TOOL_RESULT":
        this.handleToolResult(msg, store);
        break;

      case "CONTEXT_SNAPSHOT":
        this.handleContextSnapshot(msg, store);
        break;

      case "PING":
        this.handlePing(msg, store);
        break;

      case "STREAM_END":
        this.handleStreamEnd(msg, store);
        break;

      case "ERROR":
        this.handleError(msg, store);
        break;
    }
  }

  private handleToken(
    msg: Extract<ServerMessage, { type: "TOKEN" }>,
    store: ReturnType<typeof useAgentStore.getState>
  ): void {
    // Ensure stream exists
    const activeTurnId = this.activeTurnId;
    if (activeTurnId) {
      const turn = store.turns.find((t) => t.id === activeTurnId);
      if (turn && !turn.streams.find((s) => s.stream_id === msg.stream_id)) {
        store.startStream(activeTurnId, msg.stream_id);
      }
    }

    store.appendToken(msg.stream_id, msg.text, msg.seq);
    store.accumulateToken(msg.stream_id, msg.text, msg.seq);
  }

  private handleToolCall(
    msg: Extract<ServerMessage, { type: "TOOL_CALL" }>,
    store: ReturnType<typeof useAgentStore.getState>
  ): void {
    // Ensure stream exists
    const activeTurnId = this.activeTurnId;
    if (activeTurnId) {
      const turn = store.turns.find((t) => t.id === activeTurnId);
      if (turn && !turn.streams.find((s) => s.stream_id === msg.stream_id)) {
        store.startStream(activeTurnId, msg.stream_id);
      }
    }

    // Flush pending token group before showing tool call
    store.flushTokenGroup();

    store.handleToolCall(
      msg.stream_id,
      msg.call_id,
      msg.tool_name,
      msg.args,
      msg.seq
    );

    store.addTraceEvent({
      type: "TOOL_CALL",
      seq: msg.seq,
      timestamp: Date.now(),
      callId: msg.call_id,
      toolName: msg.tool_name,
      args: msg.args,
      streamId: msg.stream_id,
    });

    // Send TOOL_ACK immediately (within 2s requirement)
    this.send({ type: "TOOL_ACK", call_id: msg.call_id });
  }

  private handleToolResult(
    msg: Extract<ServerMessage, { type: "TOOL_RESULT" }>,
    store: ReturnType<typeof useAgentStore.getState>
  ): void {
    store.handleToolResult(msg.stream_id, msg.call_id, msg.result, msg.seq);

    store.addTraceEvent({
      type: "TOOL_RESULT",
      seq: msg.seq,
      timestamp: Date.now(),
      callId: msg.call_id,
      result: msg.result,
      streamId: msg.stream_id,
    });
  }

  private handleContextSnapshot(
    msg: Extract<ServerMessage, { type: "CONTEXT_SNAPSHOT" }>,
    store: ReturnType<typeof useAgentStore.getState>
  ): void {
    store.addContextSnapshot({
      context_id: msg.context_id,
      seq: msg.seq,
      timestamp: Date.now(),
      data: msg.data,
    });

    store.addTraceEvent({
      type: "CONTEXT_SNAPSHOT",
      seq: msg.seq,
      timestamp: Date.now(),
      contextId: msg.context_id,
    });
  }

  private handlePing(
    msg: Extract<ServerMessage, { type: "PING" }>,
    store: ReturnType<typeof useAgentStore.getState>
  ): void {
    // Handle corrupt PING (empty challenge) gracefully — still respond
    const echo = msg.challenge ?? "";
    this.send({ type: "PONG", echo });

    store.addTraceEvent({
      type: "PING",
      seq: msg.seq,
      timestamp: Date.now(),
      challenge: msg.challenge,
    });

    store.addTraceEvent({
      type: "PONG",
      seq: null,
      timestamp: Date.now(),
      challenge: echo,
    });
  }

  private handleStreamEnd(
    msg: Extract<ServerMessage, { type: "STREAM_END" }>,
    store: ReturnType<typeof useAgentStore.getState>
  ): void {
    store.flushTokenGroup();
    store.endStream(msg.stream_id, msg.seq);

    store.addTraceEvent({
      type: "STREAM_END",
      seq: msg.seq,
      timestamp: Date.now(),
      streamId: msg.stream_id,
    });
  }

  private handleError(
    msg: Extract<ServerMessage, { type: "ERROR" }>,
    store: ReturnType<typeof useAgentStore.getState>
  ): void {
    store.addTraceEvent({
      type: "ERROR",
      seq: msg.seq,
      timestamp: Date.now(),
      code: msg.code,
      message: msg.message,
    });
  }
}

// Singleton
export const wsManager = new AgentWebSocketManager();
