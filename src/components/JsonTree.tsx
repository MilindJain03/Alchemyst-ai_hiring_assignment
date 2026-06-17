"use client";

import { useState } from "react";

interface Props {
  nodeKey: string;
  value: unknown;
  depth: number;
}

// Limit deep rendering for performance on large payloads
const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 50;

export function JsonTreeNode({ nodeKey, value, depth }: Props) {
  const [expanded, setExpanded] = useState(depth < 2);
  const indent = depth * 16 + 12;

  // Object or Array
  if (typeof value === "object" && value !== null) {
    const isArray = Array.isArray(value);
    const entries = isArray
      ? (value as unknown[])
          .slice(0, MAX_ARRAY_ITEMS)
          .map((v, i) => [String(i), v] as [string, unknown])
      : Object.entries(value as Record<string, unknown>);

    const overflow = isArray && (value as unknown[]).length > MAX_ARRAY_ITEMS;
    const bracket = isArray ? ["[", "]"] : ["{", "}"];
    const size = isArray
      ? (value as unknown[]).length
      : Object.keys(value as object).length;

    // At max depth, show truncated
    if (depth >= MAX_DEPTH) {
      return (
        <div
          style={{
            padding: `2px 8px 2px ${indent}px`,
            color: "var(--text-muted)",
            fontSize: 12,
          }}
        >
          <span style={{ color: "var(--text)" }}>{nodeKey}: </span>
          <span>{isArray ? `[…${size} items]` : `{…${size} keys}`}</span>
        </div>
      );
    }

    return (
      <div>
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
          <span style={{ color: "var(--text)", marginRight: 4 }}>
            {nodeKey}:
          </span>
          <span style={{ color: "var(--text-muted)" }}>
            {expanded ? "▾" : "▸"} {bracket[0]}
            {!expanded && `…${size}`}
            {!expanded && bracket[1]}
          </span>
        </div>
        {expanded && (
          <div>
            {entries.map(([k, v]) => (
              <JsonTreeNode key={k} nodeKey={k} value={v} depth={depth + 1} />
            ))}
            {overflow && (
              <div
                style={{
                  padding: `2px 8px 2px ${indent + 16}px`,
                  color: "var(--text-muted)",
                  fontSize: 11,
                }}
              >
                …and {(value as unknown[]).length - MAX_ARRAY_ITEMS} more items
              </div>
            )}
            <div
              style={{
                padding: `2px 8px 2px ${indent}px`,
                color: "var(--text-muted)",
              }}
            >
              {bracket[1]}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Primitive
  return (
    <div
      style={{
        display: "flex",
        padding: `2px 8px 2px ${indent}px`,
        lineHeight: 1.6,
        gap: 4,
      }}
    >
      <span style={{ color: "var(--text)" }}>{nodeKey}:</span>
      <span style={{ color: primitiveColor(value) }}>
        {renderPrimitive(value)}
      </span>
    </div>
  );
}

function primitiveColor(v: unknown): string {
  if (typeof v === "string") return "#a5d6ff";
  if (typeof v === "number") return "#79c0ff";
  if (typeof v === "boolean") return "var(--orange)";
  if (v === null) return "var(--text-muted)";
  return "var(--text)";
}

function renderPrimitive(v: unknown): string {
  if (typeof v === "string") {
    const s = v.length > 200 ? v.slice(0, 200) + "…" : v;
    return `"${s}"`;
  }
  if (v === null) return "null";
  return String(v);
}
