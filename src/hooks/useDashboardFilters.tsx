import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * DashboardFilters Interface
 * Expanded to include BigQuery Configuration required by the API headers.
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
   * Pulls values directly from URL search parameters.
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
   * This is what persists your BigQuery config in the browser bar.
   */
  const setFilters = useCallback((newFilters: Partial<DashboardFilters>) => {
    const params = new URLSearchParams(searchParams);
    
    // Helper to handle parameter updates
    const updateParam = (key: string, value: string | undefined) => {
      if (value === undefined) return;
      
      if (!value || value === 'all') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    };

    // Standard Filters
    updateParam('agent_id', newFilters.agentId);
    updateParam('user_id', newFilters.userId);
    updateParam('timespan', newFilters.timespan);
    
    // BigQuery Configuration Parameters
    updateParam('project_id', newFilters.projectId);
    updateParam('dataset', newFilters.dataset);
    updateParam('table', newFilters.table);
    
    // Special handling for Trace ID
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