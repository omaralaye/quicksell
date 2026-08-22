/**
 * Utility functions to make database and network operations resilient to network failures,
 * timeouts, and transient connection errors.
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  onRetry?: (attempt: number, error: any) => void;
}

/**
 * Executes an async function with exponential backoff retry logic.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 500;
  const backoffFactor = options.backoffFactor ?? 2;

  let attempt = 0;
  let delay = initialDelayMs;

  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      if (attempt >= maxRetries) {
        console.error(`[Resilience] Max retries (${maxRetries}) reached. Throwing error:`, err);
        throw err;
      }

      if (options.onRetry) {
        options.onRetry(attempt, err);
      } else {
        console.warn(`[Resilience] Attempt ${attempt} failed: ${err?.message || err}. Retrying in ${delay}ms...`);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= backoffFactor;
    }
  }
}

/**
 * Normalizes error messages into user-friendly localized strings.
 */
export function formatErrorMessage(err: any, fallbackMessage = 'An unexpected error occurred. Please try again.'): string {
  if (!err) return fallbackMessage;
  if (typeof err === 'string') return err;
  if (err.message && typeof err.message === 'string') return err.message;
  if (err.error_description) return err.error_description;
  return fallbackMessage;
}

/**
 * Generates an idempotency key for network requests.
 */
export function generateIdempotencyKey(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
