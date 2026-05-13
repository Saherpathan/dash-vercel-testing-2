// src/services/apiService.ts

/**
 * Fetches logs from the Vercel API, passing user-provided GCP credentials 
 * and BigQuery configuration via headers.
 */
export const fetchLogs = async (filters: any) => {
  // 1. Pull the credentials stored by CommandBar from localStorage
  const gcpToken = localStorage.getItem('user_gcp_token');
  const geminiKey = localStorage.getItem('user_gemini_key');

  // 2. Build the request headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // The OAuth Token (from gcloud auth print-access-token)
    'Authorization': gcpToken ? `Bearer ${gcpToken}` : '',
    // The Gemini Key for AI features
    'x-gemini-api-key': geminiKey || '',
    // BigQuery Configuration (maps to getHeader in api/index.ts)
    'x-gcp-project-id': filters.projectId || '',
    'x-bq-dataset': filters.dataset || '',
    'x-bq-table': filters.table || '',
  };

  // 3. Construct the URL with standard filters (Timespan, Agent ID, etc.)
  const queryParams = new URLSearchParams({
    timespan: filters.timespan || '24h',
    agent_id: filters.agentId || 'all',
    user_id: filters.userId || 'all',
  });

  const response = await fetch(`/api?${queryParams.toString()}`, {
    method: 'GET',
    headers: headers,
  });

  if (!response.ok) {
    const errorData = await response.json();
    // If we get a 403 or 401, it means the user's token is expired or invalid
    throw new Error(errorData.error || `Error ${response.status}: Failed to fetch logs`);
  }

  return response.json();
};