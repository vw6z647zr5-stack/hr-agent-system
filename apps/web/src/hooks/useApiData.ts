import { useCallback, useEffect, useRef, useState } from 'react';

interface UseApiDataOptions {
  /** 失败后按指数退避重试。 */
  retry?: number;
  /** 自动刷新间隔，单位毫秒；0 表示关闭。 */
  refreshInterval?: number;
  /** 跳过首次请求。 */
  skip?: boolean;
}

interface UseApiDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setData: (data: T | null) => void;
}

export function useApiData<T>(
  fetcher: () => Promise<T>,
  options: UseApiDataOptions = {},
): UseApiDataResult<T> {
  const { retry = 2, refreshInterval = 0, skip = false } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const retryRef = useRef(0);

  const fetch = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const result = await fetcher();
      if (mountedRef.current) {
        setData(result);
        retryRef.current = 0;
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const message = (err as Error).message;
      if (retryRef.current < retry) {
        retryRef.current += 1;
        const delay = Math.min(1000 * 2 ** retryRef.current, 8000);
        setTimeout(() => { void fetch(); }, delay);
        return;
      }
      setError(message);
      retryRef.current = 0;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [fetcher, retry]);

  useEffect(() => {
    mountedRef.current = true;
    if (!skip) void fetch();
    return () => { mountedRef.current = false; };
  }, [fetch, skip]);

  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return;
    const timer = setInterval(() => { void fetch(); }, refreshInterval);
    return () => clearInterval(timer);
  }, [fetch, refreshInterval]);

  return { data, loading, error, refresh: fetch, setData };
}
