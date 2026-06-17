"use client";

import { useRef, useEffect } from "react";
import { useAgentStore } from "@/lib/store/agentStore";
import { ToolCallCard } from "./ToolCallCard";
import type { AgentStream, TextSegment, ToolSegment } from "@/lib/types";

interface Props {
  stream: AgentStream;
}

export function StreamView({ stream }: Props) {
  const setHighlightedChatTarget = useAgentStore(
    (s) => s.setHighlightedChatTarget
  );
  const highlightedChatTarget = useAgentStore((s) => s.highlightedChatTarget);
  const containerRef = useRef<HTMLDivElement>(null);

  // Bidirectional highlight: scroll into view when highlighted from timeline
  useEffect(() => {
    if (
      highlightedChatTarget &&
      stream.stream_id === highlightedChatTarget &&
      containerRef.current
    ) {
      containerRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
      containerRef.current.classList.add("highlight-flash");
      setTimeout(() => {
        containerRef.current?.classList.remove("highlight-flash");
      }, 1200);
    }
  }, [highlightedChatTarget, stream.stream_id]);

  const isStreaming = stream.status === "streaming";
  const isPending = stream.status === "tool_pending";

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      {/* Agent avatar */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #388bfd, #bc8cff)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
          color: "#fff",
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        A
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          minWidth: 0,
        }}
      >
        {stream.segments.map((seg) => {
          if (seg.kind === "text") {
            return (
              <TextSegmentView
                key={seg.id}
                segment={seg as TextSegment}
                isLastSegment={
                  stream.segments[stream.segments.length - 1].id === seg.id
                }
                isStreaming={isStreaming}
              />
            );
          } else {
            return (
              <ToolCallCard
                key={seg.id}
                segment={seg as ToolSegment}
                streamId={stream.stream_id}
                onClick={() =>
                  setHighlightedChatTarget(
                    highlightedChatTarget === seg.call_id ? null : seg.call_id
                  )
                }
              />
            );
          }
        })}

        {/* Tool pending indicator */}
        {isPending && stream.segments.length === 0 && (
          <div
            style={{
              color: "var(--text-muted)",
              fontSize: 12,
              fontStyle: "italic",
            }}
          >
            Waiting for tool result…
          </div>
        )}

        {/* Stream status */}
        {stream.status === "complete" && stream.segments.length === 0 && (
          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
            (empty response)
          </div>
        )}
      </div>
    </div>
  );
}

function TextSegmentView({
  segment,
  isLastSegment,
  isStreaming,
}: {
  segment: TextSegment;
  isLastSegment: boolean;
  isStreaming: boolean;
}) {
  const showCursor = isLastSegment && isStreaming;

  return (
    <div
      style={{
        color: "var(--text)",
        fontSize: 14,
        lineHeight: 1.65,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
      className={showCursor ? "stream-cursor" : undefined}
    >
      {segment.text}
    </div>
  );
}
