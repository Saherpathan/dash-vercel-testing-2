import { BigQuery } from '@google-cloud/bigquery';

const TIME_SPANS: Record<string, string> = {
  '1h': '1 HOUR',
  '24h': '24 HOUR',
  '7d': '7 DAY',
  '30d': '30 DAY',
  '90d': '90 DAY',
  '1y': '1 YEAR',
};

const PROJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,61}[A-Za-z0-9]$/;
const BQ_ID_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,1023}$/;

function getHeader(req: any, name: string): string {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || '' : String(value || '').trim();
}

function normalizePrivateKey(value: string): string {
  return value
    .replace(/^"|"$/g, '')
    .replace(/\\n/g, '\n');
}

function getBigQueryClient(): BigQuery {
  const projectId = process.env.GCP_PROJECT_ID;
  const clientEmail = process.env.GCP_CLIENT_EMAIL;
  const privateKey = process.env.GCP_PRIVATE_KEY 
  ? process.env.GCP_PRIVATE_KEY.replace(/\\n/g, '\n') 
  : undefined;

const bigquery = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: {
    client_email: process.env.GCP_CLIENT_EMAIL,
    private_key: privateKey, // Use the cleaned key here
  },
});

  if (clientEmail && privateKey) {
    return new BigQuery({
      projectId,
      credentials: {
        client_email: clientEmail,
        private_key: normalizePrivateKey(privateKey),
      },
    });
  }

  // Local development can use GOOGLE_APPLICATION_CREDENTIALS or ADC.
  return new BigQuery({ projectId });
}

function assertValidTableRef(projectId: string, datasetId: string, tableId: string) {
  if (!PROJECT_ID_PATTERN.test(projectId)) {
    throw new Error('Invalid Project ID. Use only letters, numbers, and hyphens.');
  }
  if (!BQ_ID_PATTERN.test(datasetId)) {
    throw new Error('Invalid Dataset ID. Use a BigQuery dataset id, not a full path.');
  }
  if (!BQ_ID_PATTERN.test(tableId)) {
    throw new Error('Invalid Table ID. Use a table id without project/dataset prefixes.');
  }
}

function parseJson(value: unknown): any {
  if (!value || typeof value !== 'string') return value || {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function timestampValue(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value.value) return value.value;
  return String(value);
}

function latencyValue(value: unknown): number {
  const parsed = parseJson(value);
  if (typeof parsed === 'number') return parsed;
  return Number(parsed?.total_ms || parsed?.latency_ms || 0);
}

function tokenValue(content: any, attributes: any): number {
  const usage = content?.usage || attributes?.usage_metadata || {};
  return Number(
    usage.total
      || usage.total_token_count
      || usage.total_tokens
      || attributes?.total_tokens
      || content?.total_tokens
      || 0
  );
}

function classifyEvent(row: any): string {
  const eventType = String(row.event_type || '').toUpperCase();
  if (eventType.includes('TOOL')) return 'tool';
  if (eventType.includes('AGENT') || eventType.includes('INVOCATION')) {
    return 'agent';
  }
  return 'orchestrator';
}

function eventLabel(row: any, content: any): string {
  return (
    content?.tool
    || content?.tool_name
    || row.agent
    || row.event_type
    || row.span_id
    || row.session_id
    || 'Unknown event'
  );
}

function normalizeRow(row: any) {
  const content = parseJson(row.content);
  const attributes = parseJson(row.attributes);
  const timestamp = timestampValue(row.timestamp);

  return {
    ...row,
    id: row.span_id || row.event_id || `${row.session_id || 'session'}:${row.timestamp || ''}`,
    parent_id: row.parent_span_id || null,
    type: classifyEvent(row),
    label: eventLabel(row, content),
    timestamp,
    latency: latencyValue(row.latency_ms),
    total_tokens: tokenValue(content, attributes),
    content,
    attributes,
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userProject = getHeader(req, 'x-gcp-project-id');
  const userDataset = getHeader(req, 'x-bq-dataset');
  const userTable = getHeader(req, 'x-bq-table');
  const timespan = Array.isArray(req.query?.timespan)
    ? req.query.timespan[0]
    : req.query?.timespan;

  if (!userProject || !userDataset || !userTable) {
    return res.status(400).json({ 
      error: "Missing Configuration: Ensure Project, Dataset, and Table IDs are entered." 
    });
  }

  try {
    assertValidTableRef(userProject, userDataset, userTable);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }

  const interval = TIME_SPANS[String(timespan || '24h')] || TIME_SPANS['24h'];
  const tablePath = `\`${userProject}.${userDataset}.${userTable}\``;
  const query = `
    SELECT * FROM ${tablePath}
    WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${interval})
    ORDER BY timestamp DESC
    LIMIT 1000
  `;

  try {
    const [rows] = await getBigQueryClient().query({ query });
    res.status(200).json(rows.map(normalizeRow));
  } catch (error: any) {
    console.error('BigQuery connector error:', error);
    res.status(500).json({
      error: error.message || 'Failed to query BigQuery',
      code: error.code,
    });
  }
}

