import { useCallback, useState } from 'react';

type Updater<T> = (previous: T[]) => T[];

export interface OptimisticListController<T> {
  items: T[];
  setItems: (items: T[]) => void;
  /** 立即用 updater 更新本地列表；返回快照与 commit/rollback 控制器。 */
  applyOptimistic: (updater: Updater<T>) => OptimisticHandle<T>;
}

export interface OptimisticHandle<T> {
  snapshot: T[];
  commit: () => void;
  rollback: () => void;
  /** 包裹一个异步操作：失败自动回滚，成功保持当前状态。 */
  run: <R>(operation: () => Promise<R>) => Promise<R>;
}

export function useOptimisticList<T>(initial: T[] = []): OptimisticListController<T> {
  const [items, setItems] = useState<T[]>(initial);

  const applyOptimistic = useCallback((updater: Updater<T>): OptimisticHandle<T> => {
    let snapshot: T[] = [];
    setItems((previous) => {
      snapshot = previous;
      return updater(previous);
    });

    const rollback = () => setItems(snapshot);
    const commit = () => {
      // no-op: 当前状态已是最新
    };

    const run = async <R,>(operation: () => Promise<R>): Promise<R> => {
      try {
        return await operation();
      } catch (error) {
        rollback();
        throw error;
      }
    };

    return { snapshot, commit, rollback, run };
  }, []);

  return { items, setItems, applyOptimistic };
}
