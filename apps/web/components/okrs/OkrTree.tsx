'use client';

import { AppShell } from '@/components/app-shell';
import { Bar, Card, EmptyHint, Pill, SyncButton, useJson } from '@/components/intel/kit';
import type { Objective } from '@/lib/okrs/store';
import type { OkrTreeNode } from '@/lib/okrs/rollup';

function statusTone(s: string): string {
  return s === 'at_risk' ? 'warn' : s === 'off_track' ? 'bad' : 'good';
}

function ObjectiveCard({ node, depth }: { node: OkrTreeNode; depth: number }) {
  return (
    <div style={{ marginLeft: depth * 16 }}>
      <Card>
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-foreground">{node.title}</h4>
          <span className="flex items-center gap-2">
            <Pill text={node.level} />
            <Pill text={`${node.progress}%`} tone={statusTone(node.status)} />
          </span>
        </div>
        <div className="mt-2">
          <Bar value={node.progress} max={100} />
        </div>
        {node.keyResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {node.keyResults.map((kr) => (
              <div key={kr.id} className="text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>{kr.title}</span>
                  <span>
                    {kr.current}/{kr.target} {kr.unit}
                  </span>
                </div>
                <Bar value={kr.progress} max={100} />
              </div>
            ))}
          </div>
        )}
      </Card>
      {node.children.length > 0 && (
        <div className="mt-2 space-y-2">
          {node.children.map((c) => (
            <ObjectiveCard key={c.id} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function OkrTree() {
  const { data, loading, reload } = useJson<{ objectives: Objective[]; tree: OkrTreeNode[] }>(
    '/api/okrs',
  );
  const tree = data?.tree ?? [];

  return (
    <AppShell
      title="OKRs"
      subtitle="Objectives and key results with auto-tracked progress"
      badge={<SyncButton url="/api/okrs" onDone={reload} />}
    >
      <div className="h-full overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : tree.length === 0 ? (
          <EmptyHint>No objectives yet.</EmptyHint>
        ) : (
          <div className="space-y-3">
            {tree.map((n) => (
              <ObjectiveCard key={n.id} node={n} depth={0} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
