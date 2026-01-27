export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on certain errors
      if (isNonRetryableError(lastError)) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        onRetry?.(attempt + 1, lastError);
        await sleep(delay);
      }
    }
  }

  throw lastError!;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNonRetryableError(error: Error): boolean {
  // Don't retry validation errors or explicit user errors
  const nonRetryableMessages = [
    'Topic is required',
    'Invalid request',
  ];
  return nonRetryableMessages.some((msg) => error.message.includes(msg));
}

export function getNetworkErrorMessage(error: Error): string {
  const message = error.message.toLowerCase();

  // Check if browser is offline
  if (!navigator.onLine) {
    return "You're offline. Please check your internet connection and try again.";
  }

  // Common network error patterns
  if (message.includes('failed to fetch') || message.includes('network')) {
    return "Unable to reach the server. This could be due to network issues or a firewall blocking the connection. Please try again.";
  }

  if (message.includes('timeout')) {
    return "The request timed out. The server might be busy. Please try again in a moment.";
  }

  if (message.includes('cors')) {
    return "Connection blocked by browser security. Please try refreshing the page.";
  }

  // Default message
  return error.message || "An unexpected error occurred. Please try again.";
}

export function isNetworkError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    !navigator.onLine ||
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('cors')
  );
}
