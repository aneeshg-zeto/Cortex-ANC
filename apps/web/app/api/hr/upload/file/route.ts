import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

import { withHrAuth } from '@/lib/hr-auth';
import { storeHrUpload } from '@/lib/hr-upload-server';
import { mapRawRowsToUploadRows } from '@cortex/shared';

const ALLOWED_EXT = ['.xlsx', '.xls', '.csv'];

export const POST = withHrAuth(async (request, { tenant }) => {
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  if (!ALLOWED_EXT.some((ext) => name.endsWith(ext))) {
    return NextResponse.json(
      { error: 'Unsupported file type. Use .xlsx, .xls, or .csv' },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let headers: string[] = [];
  let bodyRows: unknown[][] = [];

  if (name.endsWith('.csv')) {
    const text = buffer.toString('utf-8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      return NextResponse.json({ error: 'File has no data rows' }, { status: 400 });
    }
    headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    bodyRows = lines
      .slice(1)
      .map((line) => line.split(',').map((c) => c.trim().replace(/^"|"$/g, '')));
  } else {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      return NextResponse.json({ error: 'Spreadsheet is empty' }, { status: 400 });
    }
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
    if (grid.length < 2) {
      return NextResponse.json({ error: 'Spreadsheet has no data rows' }, { status: 400 });
    }
    headers = (grid[0] ?? []).map((h) => String(h ?? ''));
    bodyRows = grid.slice(1) as unknown[][];
  }

  const rows = mapRawRowsToUploadRows(headers, bodyRows);
  if (!rows.length) {
    return NextResponse.json({ error: 'No employee rows found' }, { status: 400 });
  }

  const uploadId = await storeHrUpload(tenant, {
    source: 'file',
    sourceName: file.name,
    rows,
  });

  return NextResponse.json({ uploadId, rowCount: rows.length });
});
