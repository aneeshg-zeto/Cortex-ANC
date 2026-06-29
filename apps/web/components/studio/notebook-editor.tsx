'use client';

import { Plus, Save } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { CollaborationCursors } from '@/components/studio/collaboration-cursors';

type NotebookBlock = {
  id: string;
  type: 'text' | 'heading' | 'bullet' | 'code' | 'embed';
  content: string;
};

const BLOCK_STYLES: Record<NotebookBlock['type'], string> = {
  text: 'text-sm text-foreground/80',
  heading: 'text-lg font-semibold text-foreground',
  bullet: 'text-sm text-foreground/80',
  code: 'font-mono text-xs text-emerald-300 bg-background rounded p-3 border border-border',
  embed: 'text-xs text-muted-foreground italic border border-dashed border-border rounded p-4',
};

const EMPTY_BLOCK: NotebookBlock = { id: 'b1', type: 'text', content: '' };

export function NotebookEditor() {
  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [title, setTitle] = useState('Untitled notebook');
  const [blocks, setBlocks] = useState<NotebookBlock[]>([EMPTY_BLOCK]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const titleRef = useRef(title);
  const blocksRef = useRef(blocks);
  const notebookIdRef = useRef(notebookId);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);

  titleRef.current = title;
  blocksRef.current = blocks;
  notebookIdRef.current = notebookId;

  const persist = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/studio/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: notebookIdRef.current ?? undefined,
          title: titleRef.current,
          blocks: blocksRef.current,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? 'Save failed');
      }
      const d = (await res.json()) as { notebook: { id: string } };
      setNotebookId(d.notebook.id);
      setLastSavedAt(new Date());
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      if (!opts?.silent) setSaving(false);
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (!hydrated.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persist({ silent: true });
    }, 400);
  }, [persist]);

  const load = useCallback(async () => {
    setLoading(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/studio/notebooks');
      if (!res.ok) throw new Error('Could not load notebook');
      const d = (await res.json()) as {
        notebooks: { id: string; title: string; blocks: NotebookBlock[] }[];
      };
      if (d.notebooks?.[0]) {
        const nb = d.notebooks[0];
        setNotebookId(nb.id);
        setTitle(nb.title || 'Untitled notebook');
        setBlocks(nb.blocks?.length ? nb.blocks : [EMPTY_BLOCK]);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
      hydrated.current = true;
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [load]);

  function updateTitle(next: string) {
    setTitle(next);
    scheduleSave();
  }

  function addBlock(type: NotebookBlock['type']) {
    setBlocks((b) => {
      const next = [
        ...b,
        {
          id: `b-${Date.now()}`,
          type,
          content:
            type === 'heading'
              ? 'New section'
              : type === 'bullet'
                ? 'List item'
                : type === 'code'
                  ? '// code'
                  : type === 'embed'
                    ? 'https://…'
                    : '',
        },
      ];
      blocksRef.current = next;
      return next;
    });
    scheduleSave();
  }

  function updateBlock(id: string, content: string) {
    setBlocks((b) => {
      const next = b.map((x) => (x.id === id ? { ...x, content } : x));
      blocksRef.current = next;
      return next;
    });
    scheduleSave();
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading notebook…
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      <CollaborationCursors page="/studio-notebook" />
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <input
          value={title}
          onChange={(e) => updateTitle(e.target.value)}
          className="input-dark min-w-[200px] flex-1 rounded-lg px-2 py-1 text-sm font-medium"
        />
        <div className="flex flex-wrap gap-1">
          {(['heading', 'text', 'bullet', 'code', 'embed'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => addBlock(t)}
              className="rounded border border-border px-2 py-1 text-[10px] capitalize text-muted-foreground hover:text-foreground"
            >
              <Plus className="mr-0.5 inline size-3" />
              {t}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void persist()}
          className="inline-flex items-center gap-1 rounded bg-[#14b8a6] px-3 py-1 text-xs font-semibold text-black disabled:opacity-60"
        >
          <Save className="size-3" /> {saving ? 'Saving…' : 'Save'}
        </button>
        <span className="text-[10px] text-muted-foreground">
          {saveError
            ? saveError
            : saving
              ? 'Auto-saving…'
              : lastSavedAt
                ? `Saved ${lastSavedAt.toLocaleTimeString()} · indexed for Brain`
                : 'Auto-saves · indexed for Brain'}
        </span>
      </div>
      <div className="mx-auto w-full max-w-2xl flex-1 space-y-4 overflow-y-auto p-6">
        {blocks.map((block) => (
          <div key={block.id} className="relative">
            {block.type === 'code' ? (
              <textarea
                value={block.content}
                onChange={(e) => updateBlock(block.id, e.target.value)}
                className={BLOCK_STYLES.code + ' w-full min-h-[80px] resize-y outline-none'}
              />
            ) : block.type === 'embed' ? (
              <div className={BLOCK_STYLES.embed}>
                <input
                  value={block.content}
                  onChange={(e) => updateBlock(block.id, e.target.value)}
                  placeholder="Embed URL"
                  className="w-full bg-transparent outline-none"
                />
              </div>
            ) : block.type === 'bullet' ? (
              <div className="flex gap-2">
                <span className="mt-0.5 text-muted-foreground">•</span>
                <textarea
                  value={block.content}
                  onChange={(e) => updateBlock(block.id, e.target.value)}
                  rows={1}
                  className={`${BLOCK_STYLES.bullet} w-full resize-none bg-transparent outline-none`}
                />
              </div>
            ) : block.type === 'heading' ? (
              <textarea
                value={block.content}
                onChange={(e) => updateBlock(block.id, e.target.value)}
                rows={1}
                className={`${BLOCK_STYLES.heading} w-full resize-none bg-transparent outline-none`}
              />
            ) : (
              <textarea
                value={block.content}
                onChange={(e) => updateBlock(block.id, e.target.value)}
                rows={3}
                className={`${BLOCK_STYLES.text} w-full resize-y bg-transparent outline-none`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
