import { useCallback, useRef, useState } from 'react';

export interface LoadingState {
  loading: boolean;
  error: Error | null;
  /** 包裹异步函数，自动管理 loading/error。失败时会重新抛出错误。 */
  withLoading: <R>(fn: () => Promise<R>) => Promise<R>;
  reset: () => void;
}

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error('Unknown error');
  }
}

export function useLoadingState(): LoadingState {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const inFlight = useRef(0);

  const withLoading = useCallback(async <R,>(fn: () => Promise<R>): Promise<R> => {
    inFlight.current += 1;
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      const normalized = toError(err);
      setError(normalized);
      throw normalized;
    } finally {
      inFlight.current = Math.max(0, inFlight.current - 1);
      if (inFlight.current === 0) {
        setLoading(false);
      }
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
    inFlight.current = 0;
  }, []);

  return { loading, error, withLoading, reset };
}
