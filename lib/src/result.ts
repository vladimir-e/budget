/**
 * Result type for error handling without exceptions.
 * All expected failures use Result instead of throwing.
 */

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Create a successful Result */
export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

/** Create a failed Result */
export function err<T = never>(error: string): Result<T> {
  return { ok: false, error };
}
