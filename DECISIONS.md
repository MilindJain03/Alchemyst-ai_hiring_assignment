# Architectural Decision Record — Agent Console

## 1. Seq-Based Ordering and Deduplication

**Data structure:** Min-heap (binary heap) keyed on `seq`.

**Rationale:** The heap provides O(log n) insertion and O(log n) extraction of the minimum element. For normal mode (in-order delivery), every message hits the "process immediately" fast path — the heap is never touched. For chaos mode (out-of-order delivery), messages buffer until the expected seq arrives, then the heap is drained in a single while-loop.

**Deduplication:** A `Set<number>` of seen seq values is checked on every push. Duplicate messages are dropped before they reach the heap. This is O(1) per check.

**lastProcessed vs lastReceived:** The buffer tracks `lastProcessed` — the highest seq whose handler has returned (DOM has consumed it). This is what gets sent as `last_seq` in the RESUME message. If we used "last received" instead, we'd ask the server to skip messages that were received but not yet processed — silently losing events.

**Edge case:** On `USER_MESSAGE`, the server resets its sequence counter to 0. The buffer is reset accordingly. This is safe because a new turn means a clean slate.

## 2. Preventing Layout Shift During Tool Call Interruptions

**Strategy:** The chat state is an array of `StreamSegment` items — either `TextSegment` or `ToolSegment`. When a `TOOL_CALL` arrives:
1. The pending token group in the trace is flushed.
2. A new `ToolSegment` is pushed to the stream's `segments` array.
3. The existing `TextSegment`s are not touched — they remain frozen.
4. When `TOKEN` events resume, a new `TextSegment` is started.

**Why this prevents reflow:** The `TextSegment` before the tool call is a stable DOM node. It does not change when the tool card appears or when streaming resumes. The tool card is appended, not inserted. Post-tool tokens go into a new text node. No existing text is re-rendered.

**CSS approach:** `white-space: pre-wrap` on text segments ensures word-wrapping is deterministic. The streaming cursor (`::after` pseudo-element on the last text segment) is purely decorative and doesn't affect layout.

**The race condition in TOOL_ACK:** The spec says "send TOOL_ACK when the client has rendered the tool call card." But there's a race: if we wait for React to commit before sending, we might exceed the 2-second window on a slow render. Our approach: send TOOL_ACK immediately when the `TOOL_CALL` message is processed by the state machine (before the render cycle). This is technically before DOM commit but is the correct tradeoff — the card *will* render on the next frame. The alternative (waiting for useEffect) risks a protocol violation.

**The race condition the assignment hinted at:** The TOOL_ACK timeout (5s server-side) creates a race with reconnection. If the connection drops after the server sends TOOL_CALL but before our TOOL_ACK arrives, the server logs a violation. On RESUME, the TOOL_CALL is replayed. We send TOOL_ACK again. But the server's `pendingAcks` map has already been cleared by the abort. Our second ACK is logged as "unexpected." This is a protocol-level ambiguity — the spec doesn't define whether pending ACKs survive a reconnect.

## 3. Reconnection State Recovery

**Tracking consumed state:** `SequenceBuffer.lastProcessed` is incremented only when the message handler returns (synchronously). This is the DOM-consumed pointer. It persists across disconnections because the buffer is a singleton that lives outside the React render cycle.

**RESUME sequence:**
1. WebSocket `close` event fires.
2. Connection status → `reconnecting`.
3. After exponential backoff, new WebSocket is created.
4. `ws.onopen` fires. RESUME is sent **as the first message**, before any other traffic. (The server's reconnection handler replays events and waits for RESUME before proceeding.)
5. Server replays all events with `seq > last_seq`.
6. Replayed events flow through the same `SequenceBuffer.push()` path. Duplicates (already in the seen Set) are silently dropped.

**Exponential backoff:** 500ms → 1s → 2s → 4s → 8s → 10s (capped). Capped at 10s to avoid indefinite wait in production. Max 8 retries before status → `dead`.

**Mid-tool-call drop:** If the connection drops after TOOL_CALL but before TOOL_RESULT, the `ToolSegment` remains in `status: "pending"` in the store. When the RESUME replay delivers the original TOOL_CALL (which has a `seq` we've already seen), it's deduplicated. But when TOOL_RESULT arrives (new seq), it updates the existing segment to `status: "complete"`.

## 4. Scaling to 50 Concurrent Agent Streams

The current design assumes one active stream at a time. For an operations dashboard with 50 simultaneous streams:

- **SequenceBuffer per agent:** Each agent connection needs its own buffer. The global singleton becomes a `Map<agentId, SequenceBuffer>`.
- **Store partitioning:** The Zustand store would need sharding by agent ID to prevent one agent's token flood from blocking renders for others. Consider one store slice per agent, or a `Map<agentId, AgentState>` with per-slice selectors.
- **Timeline virtualization:** At 30 events/sec per agent × 50 agents = 1500 events/sec. The timeline must use a windowed list (react-window or similar) — only rendering ~20 rows at a time.
- **WebWorker for message routing:** Parsing JSON and sequence ordering could move to a WebWorker, posting processed events to the main thread. This prevents token floods from blocking the UI thread.
- **WebSocket fan-in:** Use a single WebSocket multiplexer or a shared worker pattern to avoid 50 simultaneous TCP connections.

## 5. Scaling to 100x Longer Responses

For full document generation (10,000+ tokens per response):

- **Segment virtualization:** The current `TextSegment[]` model appends to a string. For very long segments, string concatenation is O(n). Switch to a rope or chunked buffer — keep an array of fixed-size chunks (e.g., 200 chars each), render only the visible chunks with a virtual scroll container.
- **No DOM for every token:** Instead of a React component per token, use a single `<div>` whose `textContent` is updated via a ref (`textRef.current.textContent += token`). This bypasses React diffing entirely. The cursor can be a separate absolutely-positioned element.
- **Chunked context snapshots:** The current JSON tree renders eagerly. For large documents, lazy expansion (load children on click, not on mount) is essential. The current implementation already depth-limits at 6 levels.
- **Streaming markdown:** For document generation, tokens likely form markdown. A streaming markdown parser (incrementally building an AST) would avoid re-parsing the entire document on every token.
