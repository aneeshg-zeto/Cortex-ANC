'use client';

import { Loader2, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AddEmployeesMenu } from '@/components/hr/add-employees-menu';
import { HrShell } from '@/components/hr/hr-shell';
import { GlassCard } from '@cortex/ui';

type SheetItem = { id: string; name: string };

export default function HrUploadPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const method = searchParams.get('method') ?? 'file';

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [sheets, setSheets] = useState<SheetItem[]>([]);
  const [sheetsLoaded, setSheetsLoaded] = useState(method !== 'google');
  const [connectUrl, setConnectUrl] = useState<string | null>(null);
  const loadingSheets = method === 'google' && !sheetsLoaded;

  useEffect(() => {
    if (method !== 'google') return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/hr/upload/google-sheets');
        const data = (await res.json()) as {
          spreadsheets?: SheetItem[];
          error?: string;
          connectUrl?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? 'Could not load spreadsheets');
          setConnectUrl(data.connectUrl ?? null);
          return;
        }
        setSheets(data.spreadsheets ?? []);
      } finally {
        if (!cancelled) setSheetsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [method]);

  async function onFileSelected(file: File) {
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/hr/upload/file', { method: 'POST', body: form });
      const data = (await res.json()) as { uploadId?: string; error?: string };
      if (!res.ok || !data.uploadId) throw new Error(data.error ?? 'Upload failed');
      router.push(`/hr/upload/validate?upload_id=${encodeURIComponent(data.uploadId)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
      setUploading(false);
    }
  }

  async function importSheet(spreadsheetId: string) {
    setUploading(true);
    setError('');
    try {
      const res = await fetch(`/api/hr/upload/google-sheets/${spreadsheetId}`, { method: 'POST' });
      const data = (await res.json()) as { uploadId?: string; error?: string; connectUrl?: string };
      if (!res.ok || !data.uploadId) {
        setConnectUrl(data.connectUrl ?? null);
        throw new Error(data.error ?? 'Import failed');
      }
      router.push(`/hr/upload/validate?upload_id=${encodeURIComponent(data.uploadId)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
      setUploading(false);
    }
  }

  return (
    <HrShell
      title="Add employees"
      subtitle={method === 'google' ? 'Import from Google Sheets' : 'Upload Excel or CSV'}
      actions={<AddEmployeesMenu />}
    >
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex gap-2 text-xs">
          <Link
            href="/hr/upload?method=file"
            className={`rounded-lg px-3 py-1.5 ${method === 'file' ? 'bg-[#a78bfa]/20 text-[#a78bfa]' : 'text-zinc-500 hover:text-white'}`}
          >
            Excel / CSV
          </Link>
          <Link
            href="/hr/upload?method=google"
            className={`rounded-lg px-3 py-1.5 ${method === 'google' ? 'bg-[#a78bfa]/20 text-[#a78bfa]' : 'text-zinc-500 hover:text-white'}`}
          >
            Google Sheets
          </Link>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
            {connectUrl && (
              <Link href={connectUrl} className="ml-2 text-[#a78bfa] underline">
                Connect Google
              </Link>
            )}
          </div>
        )}

        {method === 'file' ? (
          <GlassCard className="border-[#2a2a2a] bg-[#0f0f0f] p-8">
            <label
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 transition-colors ${
                uploading
                  ? 'border-[#a78bfa]/30 opacity-60'
                  : 'border-[#2a2a2a] hover:border-[#a78bfa]/50'
              }`}
            >
              {uploading ? (
                <Loader2 className="size-8 animate-spin text-[#a78bfa]" />
              ) : (
                <Upload className="size-8 text-[#a78bfa]" />
              )}
              <p className="mt-3 text-sm font-medium text-white">
                {uploading ? 'Parsing file…' : 'Drop file or click to browse'}
              </p>
              <p className="mt-1 text-xs text-zinc-500">.xlsx, .xls, or .csv</p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFileSelected(f);
                }}
              />
            </label>
            <p className="mt-4 text-xs text-zinc-600">
              Required columns: first_name, last_name, email, department, designation,
              date_of_joining, salary. Optional: bank_account_number, bank_ifsc, status.
            </p>
          </GlassCard>
        ) : loadingSheets ? (
          <div className="flex h-40 items-center justify-center text-zinc-500">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {sheets.map((sheet) => (
              <button
                key={sheet.id}
                type="button"
                disabled={uploading}
                onClick={() => importSheet(sheet.id)}
                className="flex w-full items-center justify-between rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-3 text-left text-sm text-white hover:border-[#a78bfa]/40 disabled:opacity-50"
              >
                <span className="truncate">{sheet.name}</span>
                <span className="text-xs text-[#a78bfa]">Import</span>
              </button>
            ))}
            {!sheets.length && !error && (
              <p className="text-center text-sm text-zinc-500">
                No spreadsheets found in your Google Drive.
              </p>
            )}
          </div>
        )}

        <Link href="/hr" className="inline-block text-sm text-zinc-500 hover:text-[#a78bfa]">
          Back to dashboard
        </Link>
      </div>
    </HrShell>
  );
}
