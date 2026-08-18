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
