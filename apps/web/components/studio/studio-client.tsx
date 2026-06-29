'use client';

import { useSearchParams } from 'next/navigation';

import { DashboardBuilder } from '@/components/studio/dashboard-builder';
import { GraphExplorerView } from '@/components/studio/graph-explorer-view';
import { NotebookEditor } from '@/components/studio/notebook-editor';
import { WorkflowCanvas } from '@/components/studio/workflow-canvas';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'workflows', label: 'Workflows' },
  { id: 'notebook', label: 'Notebook' },
  { id: 'graph', label: 'Graph' },
] as const;

export type StudioTabId = (typeof TABS)[number]['id'];

export function StudioClient() {
  const searchParams = useSearchParams();
  const raw = searchParams.get('tab');
  const tab: StudioTabId = TABS.some((t) => t.id === raw) ? (raw as StudioTabId) : 'dashboard';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border bg-background px-4 py-3 md:px-6">
        <nav className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <a
              key={t.id}
              href={`/studio?tab=${t.id}`}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                tab === t.id
                  ? 'bg-[#14b8a6]/15 font-medium text-[#14b8a6]'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground/80'
              }`}
            >
              {t.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'dashboard' && <DashboardBuilder />}
        {tab === 'workflows' && <WorkflowCanvas />}
        {tab === 'notebook' && <NotebookEditor />}
        {tab === 'graph' && <GraphExplorerView />}
      </div>
    </div>
  );
}
