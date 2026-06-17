// ─────────────────────────────────────────────────────────────────────────────
// JSON Diff Engine
//
// Computes a structural diff between two arbitrary JSON objects.
// Returns a tree of DiffNode entries that classify each key as
// added, removed, changed, or unchanged.
// ─────────────────────────────────────────────────────────────────────────────

import type { DiffNode } from "../types";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function diffJson(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  depth: number = 0
): DiffNode[] {
  // Limit recursion depth to prevent stack overflow on huge payloads
  if (depth > 8) {
    const changed = JSON.stringify(oldObj) !== JSON.stringify(newObj);
    return changed
      ? [{ key: "(deep)", type: "changed", oldValue: oldObj, newValue: newObj }]
      : [{ key: "(deep)", type: "unchanged", newValue: newObj }];
  }

  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
  const nodes: DiffNode[] = [];

  for (const key of allKeys) {
    const inOld = Object.prototype.hasOwnProperty.call(oldObj, key);
    const inNew = Object.prototype.hasOwnProperty.call(newObj, key);

    if (!inOld) {
      nodes.push({ key, type: "added", newValue: newObj[key] });
    } else if (!inNew) {
      nodes.push({ key, type: "removed", oldValue: oldObj[key] });
    } else {
      const ov = oldObj[key];
      const nv = newObj[key];

      if (isPlainObject(ov) && isPlainObject(nv)) {
        const children = diffJson(ov, nv, depth + 1);
        const anyChange = children.some((c) => c.type !== "unchanged");
        nodes.push({
          key,
          type: anyChange ? "changed" : "unchanged",
          children,
        });
      } else {
        const same = JSON.stringify(ov) === JSON.stringify(nv);
        nodes.push(
          same
            ? { key, type: "unchanged", newValue: nv }
            : { key, type: "changed", oldValue: ov, newValue: nv }
        );
      }
    }
  }

  // Sort: changed/added/removed first, unchanged last
  nodes.sort((a, b) => {
    const order: Record<string, number> = {
      added: 0,
      removed: 1,
      changed: 2,
      unchanged: 3,
    };
    return (order[a.type] ?? 3) - (order[b.type] ?? 3);
  });

  return nodes;
}

export function hasDiff(nodes: DiffNode[]): boolean {
  return nodes.some((n) => n.type !== "unchanged");
}
