"use client";

import { useEffect, useRef } from "react";
import { useAgentStore } from "@/lib/store/agentStore";
import type { ToolSegment } from "@/lib/types";

interface Props {
  segment: ToolSegment;
  streamId: string;
  onClick: () => void;
}

export function ToolCallCard({ segment, streamId, onClick }: Props) {
  const highlightedChatTarget = useAgentStore((s) => s.highlightedChatTarget);
  const setHighlightedTrace = useAgentStore((s) => s.setHighlightedTrace);
  const traceEvents = useAgentStore((s) => s.traceEvents);
  const cardRef = useRef<HTMLDivElement>(null);

  const isHighlighted = highlightedChatTarget === segment.call_id;
  const isPending = segment.status === "pending";

  // Find corresponding trace event for bidirectional linking
  const traceEvent = traceEvents.find(
    (e) => e.type === "TOOL_CALL" && e.callId === segment.call_id
  );

  // Flash when highlighted from timeline
  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isHighlighted]);

  const handleClick = () => {
    onClick();
    // Also highlight in timeline
    if (traceEvent) {
      setHighlightedTrace(traceEvent.id);
    }
  };

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      style={{
        border: `1px solid ${isHighlighted ? "var(--accent)" : isPending ? "var(--yellow)" : "var(--border)"}`,
        borderRadius: 8,
        background: isHighlighted
          ? "rgba(56, 139, 253, 0.08)"
          : "var(--surface)",
        overflow: "hidden",
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
      }}
      className={isHighlighted ? "highlight-flash" : undefined}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface2)",
        }}
      >
        <span style={{ fontSize: 14 }}>{isPending ? "⚙️" : "✅"}</span>
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 12,
            fontWeight: 600,
            color: isPending ? "var(--yellow)" : "var(--green)",
          }}
        >
          {segment.tool_name}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            color: "var(--text-muted)",
            fontFamily: "monospace",
          }}
        >
          {segment.call_id.slice(0, 12)}
        </span>
        {isPending && (
          <span
            style={{
              fontSize: 11,
              color: "var(--yellow)",
              background: "rgba(210, 153, 34, 0.15)",
              padding: "2px 6px",
              borderRadius: 4,
            }}
          >
            running…
          </span>
        )}
      </div>

      {/* Args */}
      <div style={{ padding: "8px 12px" }}>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            marginBottom: 4,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Input
        </div>
        <InlineJson value={segment.args} />
      </div>

      {/* Result */}
      {segment.result !== null && (
        <div
          style={{
            padding: "8px 12px",
            borderTop: "1px solid var(--border)",
            background: "rgba(63, 185, 80, 0.04)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--green)",
              marginBottom: 4,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Result
          </div>
          <InlineJson value={segment.result} />
        </div>
      )}
    </div>
  );
}

function InlineJson({ value }: { value: unknown }) {
  const str = JSON.stringify(value, null, 2);
  // Syntax highlight
  const html = str.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = "json-number";
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? "json-key" : "json-string";
      } else if (/true|false/.test(match)) {
        cls = "json-boolean";
      } else if (/null/.test(match)) {
        cls = "json-null";
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );

  return (
    <pre
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        fontSize: 12,
        fontFamily: "monospace",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        margin: 0,
        lineHeight: 1.5,
        maxHeight: 200,
        overflow: "auto",
      }}
    />
  );
}
