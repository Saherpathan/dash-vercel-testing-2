export const fetchAgentData = async (timespan: string = '24h') => {
  const credentials = {
    projectId: localStorage.getItem('user_gcp_project') || '',
    datasetId: localStorage.getItem('user_bq_dataset') || '',
    tableId: localStorage.getItem('user_bq_table') || '',
  };

  const response = await fetch(`/api?timespan=${encodeURIComponent(timespan)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-gcp-project-id': credentials.projectId,
      'x-bq-dataset': credentials.datasetId,
      'x-bq-table': credentials.tableId,
    }
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch data');
  }

  return response.json();
};
