import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface DashboardFilters {
  agentId: string;
  userId: string;
  timespan: string;
  traceId: string;
}

export function useDashboardFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Memoize filters to prevent unnecessary re-renders in components
  const filters = useMemo(() => ({
    agentId: searchParams.get('agent_id') || 'all',
    userId: searchParams.get('user_id') || 'all',
    timespan: searchParams.get('timespan') || '24h',
    traceId: searchParams.get('trace_id') || '',
  }), [searchParams]);

  /**
   * Updates URL search parameters based on filter changes.
   * If a value is 'all' or empty, the parameter is removed for a cleaner URL.
   */
  const setFilters = useCallback((newFilters: Partial<DashboardFilters>) => {
    const params = new URLSearchParams(searchParams);
    
    // Helper to handle parameter updates
    const updateParam = (key: string, value: string | undefined) => {
      if (!value || value === 'all') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    };

    if (newFilters.agentId !== undefined) updateParam('agent_id', newFilters.agentId);
    if (newFilters.userId !== undefined) updateParam('user_id', newFilters.userId);
    if (newFilters.timespan !== undefined) updateParam('timespan', newFilters.timespan);
    
    if (newFilters.traceId !== undefined) {
      if (newFilters.traceId) params.set('trace_id', newFilters.traceId);
      else params.delete('trace_id');
    }
    
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  return { filters, setFilters };
}
