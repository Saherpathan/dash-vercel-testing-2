import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * DashboardFilters Interface
 * Includes BigQuery Configuration and standard dashboard logic filters.
 */
export interface DashboardFilters {
  agentId: string;
  userId: string;
  timespan: string;
  traceId: string;
  projectId: string; 
  dataset: string;  
  table: string;     
}

export function useDashboardFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * Memoize filters to prevent unnecessary re-renders.
   * Maps URL snake_case parameters to camelCase object properties.
   */
  const filters = useMemo(() => ({
    agentId: searchParams.get('agent_id') || 'all',
    userId: searchParams.get('user_id') || 'all',
    timespan: searchParams.get('timespan') || '24h',
    traceId: searchParams.get('trace_id') || '',
    projectId: searchParams.get('project_id') || '',
    dataset: searchParams.get('dataset') || '',
    table: searchParams.get('table') || '',
  }), [searchParams]);

  /**
   * Updates URL search parameters based on filter changes.
   * Uses { replace: true } to prevent clogging the browser history while typing.
   */
  const setFilters = useCallback((newFilters: Partial<DashboardFilters>) => {
    const params = new URLSearchParams(searchParams);
    
    /**
     * Helper to handle parameter updates.
     * Logic: 
     * - 'all' value clears the param for a cleaner URL.
     * - Empty strings are KEPT to preserve the URL structure for sharing.
     */
    const updateParam = (key: string, value: string | undefined) => {
      if (value === undefined) return;
      
      if (value === 'all') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    };

    // Update Logic Filters
    updateParam('agent_id', newFilters.agentId);
    updateParam('user_id', newFilters.userId);
    updateParam('timespan', newFilters.timespan);
    
    // Update BigQuery Config (Persists these in the URL for sharing)
    updateParam('project_id', newFilters.projectId);
    updateParam('dataset', newFilters.dataset);
    updateParam('table', newFilters.table);
    
    // Explicit Trace ID handling
    if (newFilters.traceId !== undefined) {
      if (newFilters.traceId) {
        params.set('trace_id', newFilters.traceId);
      } else {
        params.delete('trace_id');
      }
    }
    
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  return { filters, setFilters };
}