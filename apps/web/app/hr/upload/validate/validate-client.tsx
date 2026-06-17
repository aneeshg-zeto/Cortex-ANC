'use client';

import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { HrShell } from '@/components/hr/hr-shell';
import {
  HR_DEFAULT_DEPARTMENTS,
  type HrUploadFieldError,
  type HrUploadRow,
} from '@cortex/shared/hr/upload';

const COLUMNS: { key: keyof HrUploadRow; label: string }[] = [
  { key: 'first_name', label: 'First name' },
  { key: 'last_name', label: 'Last name' },
  { key: 'email', label: 'Email' },
  { key: 'department', label: 'Department' },
  { key: 'designation', label: 'Designation' },
  { key: 'date_of_joining', label: 'Join date' },
  { key: 'salary', label: 'Salary' },
  { key: 'bank_account_number', label: 'Bank account' },
  { key: 'bank_ifsc', label: 'IFSC' },
  { key: 'status', label: 'Status' },
];

type RowValidation = { rowIndex: number; row: HrUploadRow; errors: HrUploadFieldError[] };

export default function HrUploadValidateClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uploadId = searchParams.get('upload_id') ?? '';

  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<HrUploadRow[]>([]);
  const [validations, setValidations] = useState<RowValidation[]>([]);
  const [summary, setSummary] = useState({ total: 0, valid: 0, errors: 0 });
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [editing, setEditing] = useState<{ row: number; field: keyof HrUploadRow } | null>(null);

  useEffect(() => {
    if (!uploadId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/hr/upload/data/${uploadId}`);
        const data = (await res.json()) as {
          rows?: HrUploadRow[];
          validations?: RowValidation[];
          summary?: typeof summary;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? 'Failed to load upload');
        setRows(data.rows ?? []);
        setValidations(data.validations ?? []);
        setSummary(data.summary ?? { total: 0, valid: 0, errors: 0 });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uploadId]);

  const refresh = useCallback(async () => {
    if (!uploadId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/hr/upload/data/${uploadId}`);
      const data = (await res.json()) as {
        rows?: HrUploadRow[];
        validations?: RowValidation[];
        summary?: typeof summary;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? 'Failed to load upload');
      setRows(data.rows ?? []);
      setValidations(data.validations ?? []);
      setSummary(data.summary ?? { total: 0, valid: 0, errors: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [uploadId]);

  const errorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of validations) {
      for (const err of v.errors) {
        map.set(`${v.rowIndex}:${err.field}`, err.message);
      }
    }
    return map;
  }, [validations]);

  const visibleRows = useMemo(() => {
    const indices = rows.map((_, i) => i);
    if (!errorsOnly) return indices;
    return indices.filter((i) => validations.find((v) => v.rowIndex === i)?.errors.length);
  }, [rows, validations, errorsOnly]);

  async function onCellBlur(rowIndex: number, field: keyof HrUploadRow, value: string) {
    setEditing(null);
    const res = await fetch(`/api/hr/upload/data/${uploadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowIndex, field, value }),
    });
    const data = (await res.json()) as {
      rows?: HrUploadRow[];
      validations?: RowValidation[];
      summary?: typeof summary;
    };
    if (res.ok) {
      setRows(data.rows ?? []);
      setValidations(data.validations ?? []);
      if (data.summary) setSummary(data.summary);
    }
  }

  async function confirmImport() {
    setImporting(true);
    setError('');
    try {
      const res = await fetch('/api/hr/upload/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Import failed');
      router.push(`/hr/employees?imported=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
      await refresh();
    } finally {
      setImporting(false);
    }
  }

  function cellError(rowIndex: number, field: keyof HrUploadRow): string | undefined {
    return errorMap.get(`${rowIndex}:${field}`);
  }

  if (!uploadId) {
    return (
      <HrShell title="Validate employee data" subtitle="Missing upload id">
        <p className="text-zinc-500">
          <Link href="/hr/upload" className="text-[#a78bfa] hover:underline">
            Start a new upload
          </Link>
        </p>
      </HrShell>
    );
  }

  return (
    <HrShell title="Validate employee data" subtitle="Review and fix rows before import">
      <div className="mx-auto max-w-[1200px] space-y-4">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-[#a78bfa]" />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-3">
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-zinc-400">
                  Total: <strong className="text-white">{summary.total}</strong>
                </span>
                <span className="text-zinc-400">
                  Valid: <strong className="text-[#a78bfa]">{summary.valid}</strong>
                </span>
                <span className="text-zinc-400">
                  Errors: <strong className="text-red-400">{summary.errors}</strong>
                </span>
              </div>
              <label className="flex items-center gap-2 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={errorsOnly}
                  onChange={(e) => setErrorsOnly(e.target.checked)}
                  className="rounded border-[#2a2a2a]"
                />
                Show only rows with errors
              </label>
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}

            <div className="overflow-x-auto rounded-xl border border-[#2a2a2a]">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-[#0f0f0f] uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-2 py-2">Status</th>
                    {COLUMNS.map((c) => (
                      <th key={c.key} className="px-2 py-2 whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((rowIndex) => {
                    const row = rows[rowIndex];
                    const rowErrors =
                      validations.find((v) => v.rowIndex === rowIndex)?.errors ?? [];
                    const valid = rowErrors.length === 0;
                    return (
                      <tr key={rowIndex} className="border-t border-[#2a2a2a]">
                        <td className="px-2 py-1.5">
                          {valid ? (
                            <CheckCircle2 className="size-4 text-[#a78bfa]" aria-label="Valid" />
                          ) : (
                            <AlertTriangle
                              className="size-4 text-red-400"
                              aria-label="Has errors"
                            />
                          )}
                        </td>
                        {COLUMNS.map((col) => {
                          const err = cellError(rowIndex, col.key);
                          const isEditing = editing?.row === rowIndex && editing.field === col.key;
                          return (
                            <td key={col.key} className="px-1 py-1">
                              {isEditing ? (
                                col.key === 'department' ? (
                                  <select
                                    autoFocus
                                    defaultValue={row[col.key]}
                                    className="w-full min-w-[7rem] rounded border border-[#a78bfa]/50 bg-[#0a0a0a] px-1 py-0.5 text-white"
                                    onBlur={(e) => onCellBlur(rowIndex, col.key, e.target.value)}
                                  >
                                    <option value="">Select</option>
                                    {HR_DEFAULT_DEPARTMENTS.map((d) => (
                                      <option key={d} value={d}>
                                        {d}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    autoFocus
                                    defaultValue={row[col.key]}
                                    className="w-full min-w-[6rem] rounded border border-[#a78bfa]/50 bg-[#0a0a0a] px-1 py-0.5 text-white"
                                    onBlur={(e) => onCellBlur(rowIndex, col.key, e.target.value)}
                                  />
                                )
                              ) : (
                                <button
                                  type="button"
                                  title={err ?? 'Click to edit'}
                                  onClick={() => setEditing({ row: rowIndex, field: col.key })}
                                  className={`block w-full truncate rounded px-1 py-0.5 text-left ${
                                    err
                                      ? 'border border-red-500/50 text-red-200'
                                      : 'border border-transparent text-zinc-300 hover:border-[#a78bfa]/30'
                                  }`}
                                >
                                  {row[col.key] || '—'}
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#2a2a2a] pt-4">
              <Link
                href="/hr"
                className="rounded-lg border border-[#2a2a2a] px-4 py-2 text-sm text-zinc-400 hover:text-white"
              >
                Cancel
              </Link>
              <button
                type="button"
                disabled={importing || summary.errors > 0 || summary.total === 0}
                onClick={confirmImport}
                className="inline-flex items-center gap-2 rounded-lg bg-[#a78bfa] px-5 py-2 text-sm font-medium text-[#0a0a0a] disabled:opacity-40"
              >
                {importing && <Loader2 className="size-4 animate-spin" />}
                Confirm and import
              </button>
            </div>
          </>
        )}
      </div>
    </HrShell>
  );
}
