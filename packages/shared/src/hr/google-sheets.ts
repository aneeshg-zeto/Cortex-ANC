import { getValidAccessToken } from '../auth/connected-accounts';
import { mapRawRowsToUploadRows, type HrUploadRow } from './employee-upload';

export type GoogleSpreadsheetSummary = { id: string; name: string };

export class GoogleSheetsAuthError extends Error {
  constructor(message = 'Google account not connected') {
    super(message);
    this.name = 'GoogleSheetsAuthError';
  }
}

async function googleFetch(url: string, token: string): Promise<Response> {
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  });
}

export async function listGoogleSpreadsheets(
  tenantId: string,
): Promise<GoogleSpreadsheetSummary[]> {
  const token = await getValidAccessToken('google', tenantId);
  if (!token) throw new GoogleSheetsAuthError();

  const q = encodeURIComponent(
    "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
  );
  const res = await googleFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=50&orderBy=modifiedTime desc`,
    token,
  );

  if (res.status === 401 || res.status === 403) {
    throw new GoogleSheetsAuthError('Insufficient Google permissions for Sheets');
  }
  if (!res.ok) return [];

  const data = (await res.json()) as { files?: Array<{ id: string; name: string }> };
  return (data.files ?? []).map((f) => ({ id: f.id, name: f.name }));
}

export async function fetchGoogleSheetRows(
  tenantId: string,
  spreadsheetId: string,
): Promise<{ rows: HrUploadRow[]; sheetTitle: string }> {
  const token = await getValidAccessToken('google', tenantId);
  if (!token) throw new GoogleSheetsAuthError();

  const metaRes = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties.title`,
    token,
  );
  if (metaRes.status === 401 || metaRes.status === 403) {
    throw new GoogleSheetsAuthError('Insufficient Google permissions for Sheets');
  }
  if (!metaRes.ok) throw new Error('Could not read spreadsheet metadata');

  const meta = (await metaRes.json()) as {
    properties?: { title?: string };
    sheets?: Array<{ properties?: { title?: string } }>;
  };
  const sheetTitle = meta.sheets?.[0]?.properties?.title ?? 'Sheet1';
  const docTitle = meta.properties?.title ?? spreadsheetId;

  const range = encodeURIComponent(sheetTitle);
  const valuesRes = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    token,
  );
  if (!valuesRes.ok) throw new Error('Could not read spreadsheet data');

  const values = (await valuesRes.json()) as { values?: unknown[][] };
  const all = values.values ?? [];
  if (all.length < 2) {
    return { rows: [], sheetTitle: docTitle };
  }

  const headers = (all[0] ?? []).map((h) => String(h ?? ''));
  const rows = mapRawRowsToUploadRows(headers, all.slice(1));
  return { rows, sheetTitle: docTitle };
}
