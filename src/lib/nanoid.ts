// Tiny ID generator — no external dependency needed
let counter = 0;
export function nanoid(): string {
  return `${Date.now().toString(36)}-${(++counter).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
