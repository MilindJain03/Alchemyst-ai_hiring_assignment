// ─────────────────────────────────────────────────────────────────────────────
// SequenceBuffer — handles out-of-order and duplicate messages
//
// Design:
//   - Tracks the highest seq fully processed (lastProcessed).
//   - Incoming messages with seq <= lastProcessed are duplicates and dropped.
//   - Incoming messages with seq == lastProcessed + 1 are processed immediately.
//   - All others are inserted into a min-heap sorted by seq.
//   - After each process, drain the heap for any newly unblocked messages.
//
// This separates "socket received" from "DOM consumed" — critical for RESUME.
// ─────────────────────────────────────────────────────────────────────────────

import type { ServerMessage } from "../types";

type MessageHandler = (msg: ServerMessage) => void;

export class SequenceBuffer {
  private lastProcessed: number = 0;
  private heap: ServerMessage[] = [];
  private seen: Set<number> = new Set();
  private handler: MessageHandler;

  constructor(handler: MessageHandler) {
    this.handler = handler;
  }

  reset(lastSeq: number = 0): void {
    this.lastProcessed = lastSeq;
    this.heap = [];
    this.seen = new Set();
  }

  getLastProcessed(): number {
    return this.lastProcessed;
  }

  push(msg: ServerMessage): void {
    const seq = msg.seq;

    // Deduplicate
    if (this.seen.has(seq)) return;
    this.seen.add(seq);

    // Already processed (can happen on RESUME replay of events we already have)
    if (seq <= this.lastProcessed) return;

    // In-order: process immediately then drain
    if (seq === this.lastProcessed + 1) {
      this.processOne(msg);
      this.drain();
      return;
    }

    // Out-of-order: buffer it
    this.heapPush(msg);
  }

  private processOne(msg: ServerMessage): void {
    this.lastProcessed = msg.seq;
    this.handler(msg);
  }

  private drain(): void {
    while (
      this.heap.length > 0 &&
      this.heap[0].seq === this.lastProcessed + 1
    ) {
      const next = this.heapPop()!;
      this.processOne(next);
    }
  }

  // ── Min-heap operations ───────────────────────────────────────────────────

  private heapPush(msg: ServerMessage): void {
    this.heap.push(msg);
    this.bubbleUp(this.heap.length - 1);
  }

  private heapPop(): ServerMessage | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent].seq <= this.heap[i].seq) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  private bubbleDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.heap[left].seq < this.heap[smallest].seq) {
        smallest = left;
      }
      if (right < n && this.heap[right].seq < this.heap[smallest].seq) {
        smallest = right;
      }
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}
