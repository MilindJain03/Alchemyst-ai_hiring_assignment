"use client";

import { useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { TraceTimeline } from "@/components/TraceTimeline";
import { ContextInspector } from "@/components/ContextInspector";
import { ConnectionBar } from "@/components/ConnectionBar";

type Panel = "trace" | "context";

export default function Home() {
  const [activePanel, setActivePanel] = useState<Panel>("trace");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <ConnectionBar />

      {/* Main area */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Chat panel */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            borderRight: sidebarOpen ? "1px solid var(--border)" : "none",
            overflow: "hidden",
          }}
        >
          <ChatPanel />
        </div>

        {/* Side panel */}
        {sidebarOpen && (
          <div
            style={{
              width: 420,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              background: "var(--surface)",
            }}
          >
            {/* Panel tabs */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid var(--border)",
                background: "var(--surface2)",
              }}
            >
              {(["trace", "context"] as Panel[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setActivePanel(p)}
                  style={{
                    padding: "8px 16px",
                    background: "none",
                    border: "none",
                    borderBottom:
                      activePanel === p
                        ? "2px solid var(--accent)"
                        : "2px solid transparent",
                    color:
                      activePanel === p ? "var(--text)" : "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: activePanel === p ? 600 : 400,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    transition: "all 0.15s",
                  }}
                >
                  {p === "trace" ? "Trace Timeline" : "Context Inspector"}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <button
                onClick={() => setSidebarOpen(false)}
                style={{
                  padding: "8px 12px",
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: 16,
                }}
                title="Close panel"
              >
                ✕
              </button>
            </div>

            {/* Panel content */}
            <div style={{ flex: 1, overflow: "hidden" }}>
              {activePanel === "trace" ? (
                <TraceTimeline />
              ) : (
                <ContextInspector />
              )}
            </div>
          </div>
        )}

        {/* Collapsed sidebar toggle */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              width: 24,
              background: "var(--surface2)",
              border: "none",
              borderLeft: "1px solid var(--border)",
              color: "var(--text-muted)",
              cursor: "pointer",
              writingMode: "vertical-rl",
              fontSize: 11,
              letterSpacing: "0.05em",
            }}
            title="Open side panel"
          >
            ▶ TIMELINE
          </button>
        )}
      </div>
    </div>
  );
}
