/** Supabase BIGINT RPC results often arrive as string, number, or bigint. */
export function coerceRpcBigint(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}
