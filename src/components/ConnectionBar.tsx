"use client";

import { useEffect, useRef, useState } from "react";
import { useAgentStore } from "@/lib/store/agentStore";
import { wsManager } from "@/lib/ws/manager";

const STATUS_COLOR: Record<string, string> = {
  idle: "var(--text-muted)",
  connecting: "var(--yellow)",
  connected: "var(--green)",
  reconnecting: "var(--orange)",
  dead: "var(--red)",
};

const STATUS_LABEL: Record<string, string> = {
  idle: "Disconnected",
  connecting: "Connecting…",
  connected: "Connected",
  reconnecting: "Reconnecting…",
  dead: "Connection failed",
};

export function ConnectionBar() {
  const connectionStatus = useAgentStore((s) => s.connectionStatus);
  const reconnectAttempt = useAgentStore((s) => s.reconnectAttempt);
  const serverUrl = useAgentStore((s) => s.serverUrl);
  const setServerUrl = useAgentStore((s) => s.setServerUrl);
  const lastSeq = useAgentStore((s) => s.lastSeq);

  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState(serverUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingUrl) inputRef.current?.focus();
  }, [editingUrl]);

  const handleConnect = () => {
    const url = urlInput.trim() || "ws://localhost:4747/ws";
    setServerUrl(url);
    setUrlInput(url);
    setEditingUrl(false);
    wsManager.connect(url);
  };

  const handleDisconnect = () => {
    wsManager.disconnect();
  };

  const isConnected =
    connectionStatus === "connected" || connectionStatus === "reconnecting";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "6px 16px",
        background: "var(--surface2)",
        borderBottom: "1px solid var(--border)",
        height: 44,
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--text)",
          letterSpacing: "-0.02em",
          whiteSpace: "nowrap",
        }}
      >
        Agent Console
      </span>

      <div
        style={{ width: 1, height: 20, background: "var(--border)" }}
      />

      {/* Status indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: STATUS_COLOR[connectionStatus] ?? "var(--text-muted)",
            display: "inline-block",
            boxShadow:
              connectionStatus === "connected"
                ? "0 0 6px var(--green)"
                : connectionStatus === "reconnecting"
                ? "0 0 6px var(--orange)"
                : "none",
            flexShrink: 0,
          }}
        />
        <span style={{ color: STATUS_COLOR[connectionStatus], fontSize: 12 }}>
          {STATUS_LABEL[connectionStatus]}
          {connectionStatus === "reconnecting" &&
            ` (attempt ${reconnectAttempt + 1})`}
        </span>
      </div>

      {/* URL input */}
      <div style={{ flex: 1, display: "flex", gap: 8 }}>
        {editingUrl ? (
          <input
            ref={inputRef}
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConnect();
              if (e.key === "Escape") {
                setEditingUrl(false);
                setUrlInput(serverUrl);
              }
            }}
            style={{
              flex: 1,
              background: "var(--bg)",
              border: "1px solid var(--accent)",
              borderRadius: 4,
              padding: "3px 8px",
              color: "var(--text)",
              fontSize: 12,
              fontFamily: "monospace",
              outline: "none",
            }}
            placeholder="ws://localhost:4747/ws"
          />
        ) : (
          <button
            onClick={() => setEditingUrl(true)}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "3px 8px",
              color: "var(--text-muted)",
              fontSize: 12,
              fontFamily: "monospace",
              cursor: "pointer",
              textAlign: "left",
              maxWidth: 300,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title="Click to edit server URL"
          >
            {serverUrl}
          </button>
        )}
      </div>

      {/* seq indicator */}
      {lastSeq > 0 && (
        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            fontFamily: "monospace",
          }}
        >
          seq {lastSeq}
        </span>
      )}

      {/* Connect/Disconnect */}
      {isConnected ? (
        <button
          onClick={handleDisconnect}
          style={{
            background: "rgba(248, 81, 73, 0.15)",
            border: "1px solid var(--red)",
            borderRadius: 4,
            padding: "4px 12px",
            color: "var(--red)",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Disconnect
        </button>
      ) : (
        <button
          onClick={handleConnect}
          style={{
            background: "rgba(56, 139, 253, 0.15)",
            border: "1px solid var(--accent)",
            borderRadius: 4,
            padding: "4px 12px",
            color: "var(--accent)",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          {connectionStatus === "dead" ? "Retry" : "Connect"}
        </button>
      )}
    </div>
  );
}
