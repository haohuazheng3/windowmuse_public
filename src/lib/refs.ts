/** Human-friendly reference for an order or job, shown in the studio and in support mail. Client-safe. */
export function shortRef(id: string): string {
  return id.replace(/^[a-z]+_/, "").slice(0, 8).toUpperCase();
}
