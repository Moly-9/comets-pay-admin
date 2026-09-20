import { useEffect, useRef } from 'react';
import type { OperationLogInput } from './operationLog';
import type { NavPage } from './types';

// Log the completed use of search, not keystrokes or the entered search text.
export function useOperationSearch(query: string, module: NavPage, onOperation?: (input: OperationLogInput) => void) {
  const lastQuery = useRef('');
  useEffect(() => {
    const normalized = query.trim();
    if (!normalized) {
      lastQuery.current = '';
      return;
    }
    if (!onOperation || normalized === lastQuery.current) return;
    const timer = window.setTimeout(() => {
      lastQuery.current = normalized;
      onOperation({ module, action: '搜索' });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [module, onOperation, query]);
}
