/**
 * Reject if a promise hasn't settled in `ms`. Wrapping a data call in this lets
 * `Promise.allSettled` settle (and the rest of a screen render) even when one
 * request stalls — a flaky connection or a cold/paused backend can otherwise
 * leave a fetch pending forever and hang a screen's loading spinner.
 */
export function withTimeout<T>(p: Promise<T>, ms = 5000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);
}

/**
 * Retry a promise-returning op a few times with linear backoff. Meant for
 * TRANSIENT failures (a flaky mobile connection, a cold/paused free-tier
 * backend) where the same call succeeds a moment later — this is why logging a
 * set could fail a handful of times across a workout with no real problem.
 * Re-throws the last error if every attempt fails.
 *
 * Only wrap operations that are safe to run twice (reads, or writes keyed on a
 * client-supplied id so a repeat is an idempotent upsert).
 */
export async function retry<T>(
  fn: () => Promise<T>,
  { tries = 3, delayMs = 400 }: { tries?: number; delayMs?: number } = {},
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt < tries - 1) {
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}
