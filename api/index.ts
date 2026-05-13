import { BigQuery } from '@google-cloud/bigquery';
import { OAuth2Client } from 'google-auth-library';

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

/**
 * UPDATED: BigQuery Client Factory
 * Now accepts an optional OAuth token from the user.
 */
function getBigQueryClient(projectId: string, userToken?: string): BigQuery {
  // If the user provided an OAuth token via the frontend, use it.
  // This is the "Zero-Liability" path.
  if (userToken) {
    // Use an OAuth access token provided by the user by creating an auth client
    const authClient = new OAuth2Client();
    authClient.setCredentials({ access_token: userToken });
    return new BigQuery({ projectId, authClient });
  }

  // Fallback: Use your Master Service Account (if configured in Vercel Env)
  const clientEmail = process.env.GCP_CLIENT_EMAIL;
  const privateKey = process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (clientEmail && privateKey) {
    return new BigQuery({
      projectId: process.env.GCP_PROJECT_ID || projectId,
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
    });
  }

  // Local/ADC Fallback
  return new BigQuery({ projectId });
}

function assertValidTableRef(projectId: string, datasetId: string, tableId: string) {
  if (!PROJECT_ID_PATTERN.test(projectId)) {
    throw new Error('Invalid Project ID. Use only letters, numbers, and hyphens.');
  }
  if (!BQ_ID_PATTERN.test(datasetId)) {
    throw new Error('Invalid Dataset ID.');
  }
  if (!BQ_ID_PATTERN.test(tableId)) {
    throw new Error('Invalid Table ID.');
  }
}

// --- Data Normalization Helpers (Unchanged) ---
function parseJson(value: unknown): any {
  if (!value || typeof value !== 'string') return value || {};
  try { return JSON.parse(value); } catch { return {}; }
}

function timestampValue(value: any): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.value || String(value);
}

function latencyValue(value: unknown): number {
  const parsed = parseJson(value);
  return typeof parsed === 'number' ? parsed : Number(parsed?.total_ms || parsed?.latency_ms || 0);
}

function tokenValue(content: any, attributes: any): number {
  const usage = content?.usage || attributes?.usage_metadata || {};
  return Number(usage.total || usage.total_tokens || 0);
}

function normalizeRow(row: any) {
  const content = parseJson(row.content);
  const attributes = parseJson(row.attributes);
  return {
    ...row,
    id: row.span_id || row.event_id || `${row.session_id}:${row.timestamp}`,
    type: String(row.event_type || '').toUpperCase().includes('TOOL') ? 'tool' : 'agent',
    timestamp: timestampValue(row.timestamp),
    latency: latencyValue(row.latency_ms),
    total_tokens: tokenValue(content, attributes),
    content,
    attributes,
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // 1. Extract credentials and config from headers
  const authHeader = getHeader(req, 'Authorization');
  const userToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  
  const userProject = getHeader(req, 'x-gcp-project-id');
  const userDataset = getHeader(req, 'x-bq-dataset');
  const userTable = getHeader(req, 'x-bq-table');
  
  const timespan = Array.isArray(req.query?.timespan) ? req.query.timespan[0] : req.query?.timespan;

  if (!userProject || !userDataset || !userTable) {
    return res.status(400).json({ error: "Missing Config: Project, Dataset, or Table ID." });
  }

  try {
    assertValidTableRef(userProject, userDataset, userTable);
    
    // 2. Initialize client with user's specific token and project
    const client = getBigQueryClient(userProject, userToken);

    const interval = TIME_SPANS[String(timespan || '24h')] || TIME_SPANS['24h'];
    const query = `
      SELECT * FROM \`${userProject}.${userDataset}.${userTable}\`
      WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${interval})
      ORDER BY timestamp DESC
      LIMIT 1000
    `;

    const [rows] = await client.query({ query });
    res.status(200).json(rows.map(normalizeRow));
  } catch (error: any) {
    console.error('BigQuery error:', error);
    res.status(error.code === 403 ? 403 : 500).json({
      error: error.message || 'Failed to query BigQuery',
      code: error.code,
    });
  }
}