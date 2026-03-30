/**
 * Pipeline retry utility — Task 3.10
 * Exponential backoff with jitter. Used by all pipeline steps.
 */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  label?: string;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 500, maxDelayMs = 10000, label = "op" } = opts;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isLast = attempt === maxAttempts;
      if (isLast) {
        console.error(`[retry] ${label} failed after ${maxAttempts} attempts:`, err);
        throw err;
      }
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 200, maxDelayMs);
      console.warn(`[retry] ${label} attempt ${attempt} failed, retrying in ${Math.round(delay)}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error(`${label}: unreachable`);
}
