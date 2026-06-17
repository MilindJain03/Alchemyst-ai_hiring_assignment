"use client";

import { useEffect, useRef, useState } from "react";
import { useAgentStore } from "@/lib/store/agentStore";
import { wsManager } from "@/lib/ws/manager";
import { StreamView } from "./StreamView";

export function ChatPanel() {
  const turns = useAgentStore((s) => s.turns);
  const connectionStatus = useAgentStore((s) => s.connectionStatus);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  const canSend = connectionStatus === "connected" && input.trim().length > 0;

  const handleSend = () => {
    if (!canSend) return;
    const content = input.trim();
    setInput("");
    wsManager.sendUserMessage(content);
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {turns.length === 0 && (
          <EmptyState connectionStatus={connectionStatus} />
        )}

        {turns.map((turn) => (
          <div key={turn.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* User message */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div
                style={{
                  maxWidth: "75%",
                  background: "var(--accent-dim)",
                  border: "1px solid var(--accent)",
                  borderRadius: "12px 12px 2px 12px",
                  padding: "8px 12px",
                  color: "var(--text)",
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {turn.userMessage}
              </div>
            </div>

            {/* Agent streams */}
            {turn.streams.map((stream) => (
              <StreamView key={stream.stream_id} stream={stream} />
            ))}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          padding: "12px 16px",
          background: "var(--surface)",
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
        }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            connectionStatus === "connected"
              ? "Type a message… (Enter to send, Shift+Enter for newline)"
              : connectionStatus === "reconnecting"
              ? "Reconnecting…"
              : "Connect to the agent server to start"
          }
          disabled={connectionStatus !== "connected"}
          rows={1}
          style={{
            flex: 1,
            background: connectionStatus === "connected" ? "var(--surface2)" : "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "8px 12px",
            color: "var(--text)",
            fontSize: 13,
            resize: "none",
            outline: "none",
            lineHeight: 1.5,
            minHeight: 38,
            maxHeight: 120,
            fontFamily: "inherit",
            transition: "border-color 0.15s",
            opacity: connectionStatus === "connected" ? 1 : 0.5,
          }}
          onFocus={(e) =>
            (e.target.style.borderColor = "var(--accent)")
          }
          onBlur={(e) =>
            (e.target.style.borderColor = "var(--border)")
          }
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          style={{
            background: canSend
              ? "var(--accent)"
              : "var(--surface2)",
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            color: canSend ? "#fff" : "var(--text-muted)",
            fontSize: 13,
            cursor: canSend ? "pointer" : "not-allowed",
            height: 38,
            whiteSpace: "nowrap",
            transition: "all 0.15s",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

function EmptyState({ connectionStatus }: { connectionStatus: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 40,
        color: "var(--text-muted)",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 32 }}>⬡</div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
          Agent Console
        </div>
        <div style={{ fontSize: 13, maxWidth: 360, lineHeight: 1.6 }}>
          {connectionStatus === "idle" || connectionStatus === "dead"
            ? "Connect to the agent server to begin. Try keywords like report, analyze, search, schema, or long."
            : connectionStatus === "connecting" || connectionStatus === "reconnecting"
            ? "Establishing connection to agent server…"
            : "Type a message to start interacting with the AI agent."}
        </div>
      </div>
      {(connectionStatus === "idle" || connectionStatus === "dead") && (
        <div
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "10px 16px",
            fontSize: 12,
            fontFamily: "monospace",
            color: "var(--text-muted)",
            textAlign: "left",
            lineHeight: 1.8,
          }}
        >
          <div>hello / hi — greeting (no tool calls)</div>
          <div>report / q3 — one tool call + context</div>
          <div>analyze / compare — two tool calls</div>
          <div>search / find — immediate tool call</div>
          <div>schema / large — 500KB+ context</div>
          <div>long / document — many tokens</div>
        </div>
      )}
    </div>
  );
}
