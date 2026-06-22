'use client';

import { Plus, Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { CollaborationCursors } from '@/components/studio/collaboration-cursors';

type NotebookBlock = {
  id: string;
  type: 'text' | 'heading' | 'bullet' | 'code' | 'embed';
  content: string;
};

const BLOCK_STYLES: Record<NotebookBlock['type'], string> = {
  text: 'text-sm text-foreground/80',
  heading: 'text-lg font-semibold text-foreground',
  bullet: 'text-sm text-foreground/80 pl-4 before:content-["•"] before:absolute before:left-0',
  code: 'font-mono text-xs text-emerald-300 bg-background rounded p-3 border border-border',
  embed: 'text-xs text-muted-foreground italic border border-dashed border-border rounded p-4',
};

export function NotebookEditor() {
  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [title, setTitle] = useState('Untitled notebook');
  const [blocks, setBlocks] = useState<NotebookBlock[]>([
    { id: 'b1', type: 'heading', content: 'Weekly executive notes' },
  ]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/studio/notebooks');
    if (!res.ok) return;
    const d = (await res.json()) as {
      notebooks: { id: string; title: string; blocks: NotebookBlock[] }[];
    };
    if (d.notebooks?.[0]) {
      setNotebookId(d.notebooks[0].id);
      setTitle(d.notebooks[0].title);
      setBlocks(d.notebooks[0].blocks.length ? d.notebooks[0].blocks : blocks);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/studio/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notebookId ?? undefined, title, blocks }),
      });
      if (res.ok) {
        const d = (await res.json()) as { notebook: { id: string } };
        setNotebookId(d.notebook.id);
      }
    } finally {
      setSaving(false);
    }
  }

  function addBlock(type: NotebookBlock['type']) {
    setBlocks((b) => [
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
    ]);
  }

  function updateBlock(id: string, content: string) {
    setBlocks((b) => b.map((x) => (x.id === id ? { ...x, content } : x)));
  }

  return (
    <div className="relative flex h-full flex-col">
      <CollaborationCursors page="/studio-notebook" />
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
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
          onClick={() => void save()}
          className="inline-flex items-center gap-1 rounded bg-[#14b8a6] px-3 py-1 text-xs font-semibold text-black"
        >
          <Save className="size-3" /> {saving ? '…' : 'Save'}
        </button>
      </div>
      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto p-6 space-y-4">
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
            ) : (
              <div
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => updateBlock(block.id, e.currentTarget.textContent ?? '')}
                className={`relative outline-none ${BLOCK_STYLES[block.type]}`}
              >
                {block.content}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
