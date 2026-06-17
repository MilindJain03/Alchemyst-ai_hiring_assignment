"use client";

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  memo,
} from "react";
import { useAgentStore } from "@/lib/store/agentStore";
import type { TraceEvent, TraceEventType } from "@/lib/types";

const TYPE_COLOR: Record<TraceEventType | string, string> = {
  TOKEN_GROUP: "var(--text-muted)",
  TOOL_CALL: "var(--yellow)",
  TOOL_RESULT: "var(--green)",
  CONTEXT_SNAPSHOT: "var(--purple)",
  PING: "#4a9eff",
  PONG: "#4a9eff",
  STREAM_END: "var(--text-muted)",
  ERROR: "var(--red)",
  CONNECT: "var(--green)",
  DISCONNECT: "var(--red)",
  RESUME: "var(--orange)",
  USER_MESSAGE: "var(--accent)",
};

const TYPE_ICON: Record<TraceEventType | string, string> = {
  TOKEN_GROUP: "◈",
  TOOL_CALL: "⚙",
  TOOL_RESULT: "✓",
  CONTEXT_SNAPSHOT: "◎",
  PING: "♡",
  PONG: "♥",
  STREAM_END: "■",
  ERROR: "✗",
  CONNECT: "↗",
  DISCONNECT: "↙",
  RESUME: "↺",
  USER_MESSAGE: "↑",
};

const ALL_TYPES: TraceEventType[] = [
  "TOKEN_GROUP",
  "TOOL_CALL",
  "TOOL_RESULT",
  "CONTEXT_SNAPSHOT",
  "PING",
  "PONG",
  "STREAM_END",
  "ERROR",
  "CONNECT",
  "DISCONNECT",
  "RESUME",
  "USER_MESSAGE",
];

export function TraceTimeline() {
  const allEvents = useAgentStore((s) => s.traceEvents);
  const highlightedTraceId = useAgentStore((s) => s.highlightedTraceId);
  const setHighlightedTrace = useAgentStore((s) => s.setHighlightedTrace);
  const setHighlightedChatTarget = useAgentStore(
    (s) => s.setHighlightedChatTarget
  );

  const [filter, setFilter] = useState<Set<TraceEventType>>(
    new Set(ALL_TYPES)
  );
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  // Filter events
  const events = allEvents.filter((e) => {
    if (!filter.has(e.type as TraceEventType)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        e.type.toLowerCase().includes(q) ||
        (e.toolName ?? "").toLowerCase().includes(q) ||
        (e.tokenText ?? "").toLowerCase().includes(q) ||
        (e.message ?? "").toLowerCase().includes(q) ||
        (e.code ?? "").toLowerCase().includes(q) ||
        (e.content ?? "").toLowerCase().includes(q) ||
        (e.contextId ?? "").toLowerCase().includes(q) ||
        (e.callId ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [events.length, autoScroll]);

  // Scroll to highlighted event
  useEffect(() => {
    if (highlightedTraceId && highlightRef.current) {
      highlightRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [highlightedTraceId]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  };

  const toggleType = (t: TraceEventType) => {
    setFilter((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const handleEventClick = useCallback(
    (event: TraceEvent) => {
      setHighlightedTrace(event.id === highlightedTraceId ? null : event.id);
      // Bidirectional: highlight in chat
      if (event.type === "TOOL_CALL" && event.callId) {
        setHighlightedChatTarget(event.callId);
      } else if (event.type === "TOKEN_GROUP" && event.streamId) {
        setHighlightedChatTarget(event.streamId);
      } else if (event.type === "STREAM_END" && event.streamId) {
        setHighlightedChatTarget(event.streamId);
      }
    },
    [highlightedTraceId, setHighlightedTrace, setHighlightedChatTarget]
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Filter bar */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          gap: 8,
          flexDirection: "column",
          background: "var(--surface2)",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events…"
            style={{
              flex: 1,
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "4px 8px",
              color: "var(--text)",
              fontSize: 12,
              outline: "none",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
          <button
            onClick={() => setShowFilter((v) => !v)}
            style={{
              background: showFilter ? "var(--accent-dim)" : "var(--bg)",
              border: `1px solid ${showFilter ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 4,
              padding: "4px 8px",
              color: showFilter ? "var(--accent)" : "var(--text-muted)",
              fontSize: 11,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Filter ({filter.size}/{ALL_TYPES.length})
          </button>
          <span
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              alignSelf: "center",
              whiteSpace: "nowrap",
            }}
          >
            {events.length} events
          </span>
        </div>

        {showFilter && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
            }}
          >
            {ALL_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => toggleType(t)}
                style={{
                  background: filter.has(t)
                    ? `${TYPE_COLOR[t]}22`
                    : "var(--bg)",
                  border: `1px solid ${filter.has(t) ? TYPE_COLOR[t] : "var(--border)"}`,
                  borderRadius: 4,
                  padding: "2px 6px",
                  color: filter.has(t) ? TYPE_COLOR[t] : "var(--text-muted)",
                  fontSize: 10,
                  cursor: "pointer",
                  fontFamily: "monospace",
                }}
              >
                {TYPE_ICON[t]} {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Events list */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "4px 0",
        }}
      >
        {events.length === 0 && (
          <div
            style={{
              padding: 24,
              color: "var(--text-muted)",
              fontSize: 12,
              textAlign: "center",
            }}
          >
            No events yet
          </div>
        )}

        {events.map((event) => (
          <TraceEventRow
            key={event.id}
            event={event}
            isHighlighted={event.id === highlightedTraceId}
            onClick={handleEventClick}
            containerRef={event.id === highlightedTraceId ? highlightRef : null}
          />
        ))}

        {!autoScroll && (
          <button
            onClick={() => {
              setAutoScroll(true);
              listRef.current?.scrollTo({
                top: listRef.current.scrollHeight,
                behavior: "smooth",
              });
            }}
            style={{
              position: "sticky",
              bottom: 8,
              left: "50%",
              transform: "translateX(-50%)",
              display: "block",
              background: "var(--accent)",
              border: "none",
              borderRadius: 12,
              padding: "4px 12px",
              color: "#fff",
              fontSize: 11,
              cursor: "pointer",
              margin: "4px auto",
            }}
          >
            ↓ Jump to latest
          </button>
        )}
      </div>
    </div>
  );
}

// Memoized row to prevent full list re-renders on every token
const TraceEventRow = memo(
  function TraceEventRow({
    event,
    isHighlighted,
    onClick,
    containerRef,
  }: {
    event: TraceEvent;
    isHighlighted: boolean;
    onClick: (e: TraceEvent) => void;
    containerRef?: React.RefObject<HTMLDivElement | null> | null;
  }) {
    const [expanded, setExpanded] = useState(false);
    const color = TYPE_COLOR[event.type] ?? "var(--text-muted)";
    const icon = TYPE_ICON[event.type] ?? "·";

    const isToolPair =
      event.type === "TOOL_CALL" || event.type === "TOOL_RESULT";
    const time = new Date(event.timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    } as Intl.DateTimeFormatOptions);

    const label = buildLabel(event);
    const detail = buildDetail(event, expanded);

    return (
      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
        onClick={() => onClick(event)}
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "4px 12px",
          cursor: "pointer",
          background: isHighlighted
            ? "rgba(56, 139, 253, 0.12)"
            : "transparent",
          borderLeft: isHighlighted
            ? `2px solid var(--accent)`
            : isToolPair
            ? `2px solid ${color}44`
            : "2px solid transparent",
          transition: "background 0.1s",
        }}
        onMouseEnter={(e) => {
          if (!isHighlighted)
            (e.currentTarget as HTMLElement).style.background =
              "rgba(255,255,255,0.03)";
        }}
        onMouseLeave={(e) => {
          if (!isHighlighted)
            (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
        className={isHighlighted ? "highlight-flash" : undefined}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
          }}
        >
          {/* Icon */}
          <span
            style={{ color, fontSize: 12, flexShrink: 0, width: 14 }}
          >
            {icon}
          </span>

          {/* Type */}
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 10,
              color,
              flexShrink: 0,
              width: 100,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {event.type}
          </span>

          {/* Label */}
          <span
            style={{
              flex: 1,
              fontSize: 11,
              color: "var(--text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
          >
            {label}
          </span>

          {/* seq */}
          {event.seq !== null && (
            <span
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
                fontFamily: "monospace",
                flexShrink: 0,
              }}
            >
              #{event.seq}
            </span>
          )}

          {/* Time */}
          <span
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              fontFamily: "monospace",
              flexShrink: 0,
            }}
          >
            {time.slice(-12)}
          </span>

          {/* Expand toggle */}
          {detail && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: 10,
                padding: "0 2px",
                flexShrink: 0,
              }}
            >
              {expanded ? "▲" : "▼"}
            </button>
          )}
        </div>

        {/* Expanded detail */}
        {expanded && detail && (
          <div
            style={{
              marginTop: 4,
              marginLeft: 22,
              padding: "6px 8px",
              background: "var(--bg)",
              borderRadius: 4,
              fontSize: 11,
              fontFamily: "monospace",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              color: "var(--text)",
              maxHeight: 300,
              overflow: "auto",
              lineHeight: 1.5,
            }}
          >
            {detail}
          </div>
        )}
      </div>
    );
  }
);

function buildLabel(event: TraceEvent): string {
  switch (event.type) {
    case "TOKEN_GROUP":
      return `${event.tokenCount} tokens (${event.durationMs}ms)`;
    case "TOOL_CALL":
      return `${event.toolName}(${JSON.stringify(event.args).slice(0, 60)}…)`;
    case "TOOL_RESULT":
      return `${event.callId?.slice(0, 12)} → ${JSON.stringify(event.result).slice(0, 60)}`;
    case "CONTEXT_SNAPSHOT":
      return event.contextId ?? "";
    case "PING":
      return event.challenge
        ? `challenge="${event.challenge}"`
        : "(empty challenge)";
    case "PONG":
      return `echo="${event.challenge}"`;
    case "STREAM_END":
      return event.streamId ?? "";
    case "ERROR":
      return `${event.code}: ${event.message}`;
    case "CONNECT":
      return "WebSocket connected";
    case "DISCONNECT":
      return (event as { message?: string }).message ?? "disconnected";
    case "RESUME":
      return (event as { message?: string }).message ?? "resuming";
    case "USER_MESSAGE":
      return event.content ?? "";
    default:
      return "";
  }
}

function buildDetail(event: TraceEvent, _expanded: boolean): string | null {
  switch (event.type) {
    case "TOKEN_GROUP":
      return event.tokenText ?? null;
    case "TOOL_CALL":
      return JSON.stringify(event.args, null, 2);
    case "TOOL_RESULT":
      return JSON.stringify(event.result, null, 2);
    case "CONTEXT_SNAPSHOT":
      return null; // shown in Context Inspector
    default:
      return null;
  }
}
