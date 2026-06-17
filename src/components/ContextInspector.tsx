"use client";

import { useState, useMemo } from "react";
import { useAgentStore } from "@/lib/store/agentStore";
import { JsonTreeNode } from "./JsonTree";
import { diffJson, hasDiff } from "@/lib/diff/jsonDiff";
import type { DiffNode } from "@/lib/types";

export function ContextInspector() {
  const contextSnapshots = useAgentStore((s) => s.contextSnapshots);
  const activeContextId = useAgentStore((s) => s.activeContextId);
  const setActiveContextId = useAgentStore((s) => s.setActiveContextId);

  const contextIds = Object.keys(contextSnapshots);

  const snapshots = activeContextId
    ? (contextSnapshots[activeContextId] ?? [])
    : [];

  const [snapshotIdx, setSnapshotIdx] = useState<number | null>(null);
  const [showDiff, setShowDiff] = useState(true);

  // When new snapshots arrive, auto-advance to latest
  const effectiveIdx =
    snapshotIdx !== null
      ? Math.min(snapshotIdx, snapshots.length - 1)
      : snapshots.length - 1;

  const currentSnapshot = snapshots[effectiveIdx] ?? null;
  const prevSnapshot = effectiveIdx > 0 ? snapshots[effectiveIdx - 1] : null;

  const diffNodes: DiffNode[] | null = useMemo(() => {
    if (!showDiff || !prevSnapshot || !currentSnapshot) return null;
    return diffJson(prevSnapshot.data, currentSnapshot.data);
  }, [showDiff, prevSnapshot, currentSnapshot]);

  const diffHasChanges = diffNodes ? hasDiff(diffNodes) : false;

  if (contextIds.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          color: "var(--text-muted)",
          fontSize: 12,
          textAlign: "center",
        }}
      >
        No context snapshots received yet.
        <br />
        <br />
        Try sending "report" or "analyze" to trigger a context update.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Context selector */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface2)",
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Context:
        </span>
        {contextIds.map((id) => (
          <button
            key={id}
            onClick={() => {
              setActiveContextId(id);
              setSnapshotIdx(null);
            }}
            style={{
              background:
                id === activeContextId ? "var(--accent-dim)" : "var(--bg)",
              border: `1px solid ${id === activeContextId ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 4,
              padding: "2px 8px",
              color:
                id === activeContextId ? "var(--accent)" : "var(--text-muted)",
              fontSize: 11,
              fontFamily: "monospace",
              cursor: "pointer",
            }}
          >
            {id}
          </button>
        ))}
      </div>

      {/* Scrubber */}
      {snapshots.length > 1 && (
        <div
          style={{
            padding: "8px 12px",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface2)",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <button
            onClick={() => setSnapshotIdx(Math.max(0, effectiveIdx - 1))}
            disabled={effectiveIdx === 0}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "2px 8px",
              color: effectiveIdx === 0 ? "var(--text-muted)" : "var(--text)",
              cursor: effectiveIdx === 0 ? "not-allowed" : "pointer",
              fontSize: 12,
            }}
          >
            ◀
          </button>

          <input
            type="range"
            min={0}
            max={snapshots.length - 1}
            value={effectiveIdx}
            onChange={(e) => setSnapshotIdx(Number(e.target.value))}
            style={{ flex: 1, accentColor: "var(--accent)" }}
          />

          <button
            onClick={() =>
              setSnapshotIdx(Math.min(snapshots.length - 1, effectiveIdx + 1))
            }
            disabled={effectiveIdx === snapshots.length - 1}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "2px 8px",
              color:
                effectiveIdx === snapshots.length - 1
                  ? "var(--text-muted)"
                  : "var(--text)",
              cursor:
                effectiveIdx === snapshots.length - 1
                  ? "not-allowed"
                  : "pointer",
              fontSize: 12,
            }}
          >
            ▶
          </button>

          <span
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              whiteSpace: "nowrap",
            }}
          >
            {effectiveIdx + 1} / {snapshots.length}
          </span>

          <button
            onClick={() => setShowDiff((v) => !v)}
            style={{
              background: showDiff ? "rgba(188,140,255,0.15)" : "var(--bg)",
              border: `1px solid ${showDiff ? "var(--purple)" : "var(--border)"}`,
              borderRadius: 4,
              padding: "2px 8px",
              color: showDiff ? "var(--purple)" : "var(--text-muted)",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Diff
          </button>
        </div>
      )}

      {/* Snapshot metadata */}
      {currentSnapshot && (
        <div
          style={{
            padding: "6px 12px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            gap: 16,
            fontSize: 11,
            color: "var(--text-muted)",
            background: "var(--surface2)",
            flexWrap: "wrap",
          }}
        >
          <span>seq: {currentSnapshot.seq}</span>
          <span>
            {new Date(currentSnapshot.timestamp).toLocaleTimeString()}
          </span>
          {diffNodes && diffHasChanges && (
            <span style={{ color: "var(--yellow)" }}>
              ⚡ changes detected
            </span>
          )}
          {diffNodes && !diffHasChanges && prevSnapshot && (
            <span style={{ color: "var(--green)" }}>✓ no changes</span>
          )}
          <span style={{ marginLeft: "auto" }}>
            ~{Math.round(JSON.stringify(currentSnapshot.data).length / 1024)}KB
          </span>
        </div>
      )}

      {/* Tree view */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 0",
          fontFamily: "monospace",
          fontSize: 12,
        }}
      >
        {currentSnapshot && (
          <>
            {diffNodes ? (
              <DiffTreeView nodes={diffNodes} depth={0} />
            ) : (
              <JsonTreeView data={currentSnapshot.data} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DiffTreeView({
  nodes,
  depth,
}: {
  nodes: DiffNode[];
  depth: number;
}) {
  return (
    <>
      {nodes.map((node) => (
        <DiffNodeView key={node.key} node={node} depth={depth} />
      ))}
    </>
  );
}

function DiffNodeView({ node, depth }: { node: DiffNode; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const indent = depth * 16 + 12;

  const bgClass =
    node.type === "added"
      ? "diff-added"
      : node.type === "removed"
      ? "diff-removed"
      : node.type === "changed"
      ? "diff-changed"
      : undefined;

  const color =
    node.type === "added"
      ? "var(--green)"
      : node.type === "removed"
      ? "var(--red)"
      : node.type === "changed"
      ? "var(--yellow)"
      : "var(--text-muted)";

  const prefix =
    node.type === "added"
      ? "+"
      : node.type === "removed"
      ? "−"
      : node.type === "changed"
      ? "~"
      : " ";

  if (node.children) {
    return (
      <div className={bgClass}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: `2px 8px 2px ${indent}px`,
            cursor: "pointer",
            userSelect: "none",
          }}
          onClick={() => setExpanded((v) => !v)}
        >
          <span style={{ color, width: 12, flexShrink: 0 }}>{prefix}</span>
          <span style={{ color: "var(--text)", marginRight: 4 }}>
            {node.key}:
          </span>
          <span style={{ color: "var(--text-muted)" }}>
            {expanded ? "▾" : "▸"} {"{…}"}
          </span>
        </div>
        {expanded && (
          <DiffTreeView nodes={node.children} depth={depth + 1} />
        )}
      </div>
    );
  }

  return (
    <div
      className={bgClass}
      style={{
        padding: `2px 8px 2px ${indent}px`,
        display: "flex",
        gap: 4,
        flexWrap: "wrap",
        lineHeight: 1.6,
      }}
    >
      <span style={{ color, width: 12, flexShrink: 0 }}>{prefix}</span>
      <span style={{ color: "var(--text)" }}>{node.key}:</span>
      {node.type === "changed" ? (
        <span>
          <span
            style={{
              color: "var(--red)",
              textDecoration: "line-through",
              marginRight: 6,
            }}
          >
            {renderValue(node.oldValue)}
          </span>
          <span style={{ color: "var(--green)" }}>
            {renderValue(node.newValue)}
          </span>
        </span>
      ) : (
        <span style={{ color: valueColor(node.newValue ?? node.oldValue) }}>
          {renderValue(node.newValue ?? node.oldValue)}
        </span>
      )}
    </div>
  );
}

function JsonTreeView({ data }: { data: Record<string, unknown> }) {
  return (
    <>
      {Object.entries(data).map(([key, value]) => (
        <JsonTreeNode key={key} nodeKey={key} value={value} depth={0} />
      ))}
    </>
  );
}

function renderValue(v: unknown): string {
  if (typeof v === "string") return `"${v.slice(0, 80)}"`;
  if (v === null) return "null";
  if (typeof v === "object") return JSON.stringify(v).slice(0, 80);
  return String(v);
}

function valueColor(v: unknown): string {
  if (typeof v === "string") return "var(--json-string, #a5d6ff)";
  if (typeof v === "number") return "var(--json-number, #79c0ff)";
  if (typeof v === "boolean") return "var(--orange)";
  if (v === null) return "var(--text-muted)";
  return "var(--text)";
}
