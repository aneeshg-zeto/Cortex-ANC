'use client';

import { Plus, Save, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

type WorkflowNode = {
  id: string;
  type: 'trigger' | 'action' | 'condition';
  label: string;
  x: number;
  y: number;
};

type WorkflowEdge = { id: string; from: string; to: string };

type WorkflowDefinition = { nodes: WorkflowNode[]; edges: WorkflowEdge[] };

const NODE_COLORS = {
  trigger: '#14b8a6',
  action: '#3b82f6',
  condition: '#f59e0b',
};

const TEMPLATES = [
  { type: 'trigger' as const, label: 'Connector sync' },
  { type: 'trigger' as const, label: 'Schedule' },
  { type: 'action' as const, label: 'Send email' },
  { type: 'action' as const, label: 'Create issue' },
  { type: 'condition' as const, label: 'If / else' },
];

export function WorkflowCanvas() {
  const [workflows, setWorkflows] = useState<
    { id: string; name: string; definition: WorkflowDefinition }[]
  >([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [definition, setDefinition] = useState<WorkflowDefinition>({ nodes: [], edges: [] });
  const [name, setName] = useState('Untitled workflow');
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [dragNode, setDragNode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/studio/workflows');
    if (!res.ok) return;
    const d = (await res.json()) as {
      workflows: { id: string; name: string; definition: WorkflowDefinition }[];
    };
    setWorkflows(d.workflows ?? []);
    if (d.workflows?.[0] && !activeId) {
      setActiveId(d.workflows[0].id);
      setName(d.workflows[0].name);
      setDefinition(d.workflows[0].definition ?? { nodes: [], edges: [] });
    }
  }, [activeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/studio/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeId ?? undefined,
          name,
          definition,
        }),
      });
      if (res.ok) {
        const d = (await res.json()) as { workflow: { id: string } };
        setActiveId(d.workflow.id);
        void load();
      }
    } finally {
      setSaving(false);
    }
  }

  function addNode(type: WorkflowNode['type'], label: string) {
    const id = `n-${Date.now()}`;
    const node: WorkflowNode = {
      id,
      type,
      label,
      x: 80 + definition.nodes.length * 40,
      y: 80 + definition.nodes.length * 30,
    };
    setDefinition((d) => ({ ...d, nodes: [...d.nodes, node] }));
  }

  function onNodeClick(id: string) {
    if (connectFrom && connectFrom !== id) {
      const edgeId = `e-${connectFrom}-${id}`;
      if (!definition.edges.some((e) => e.id === edgeId)) {
        setDefinition((d) => ({
          ...d,
          edges: [...d.edges, { id: edgeId, from: connectFrom, to: id }],
        }));
      }
      setConnectFrom(null);
      return;
    }
    setConnectFrom(id);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragNode || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDefinition((d) => ({
      ...d,
      nodes: d.nodes.map((n) => (n.id === dragNode ? { ...n, x, y } : n)),
    }));
  }

  const nodeMap = new Map(definition.nodes.map((n) => [n.id, n]));

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-52 shrink-0 border-r border-border bg-card p-3">
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Nodes
        </p>
        <ul className="mt-2 space-y-1">
          {TEMPLATES.map((t) => (
            <li key={t.label}>
              <button
                type="button"
                onClick={() => addNode(t.type, t.label)}
                className="w-full rounded border border-border px-2 py-1.5 text-left text-xs text-foreground/80 hover:border-[#14b8a6]/40"
              >
                <span
                  className="mr-1.5 inline-block size-2 rounded-full"
                  style={{ backgroundColor: NODE_COLORS[t.type] }}
                />
                {t.label}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[10px] text-muted-foreground">
          Click node → click another to connect
        </p>
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-[10px] text-muted-foreground">Saved flows</p>
          {workflows.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                setActiveId(w.id);
                setName(w.name);
                setDefinition(w.definition ?? { nodes: [], edges: [] });
              }}
              className={`mt-1 block w-full truncate rounded px-2 py-1 text-left text-[11px] ${
                activeId === w.id
                  ? 'bg-[#14b8a6]/15 text-[#14b8a6]'
                  : 'text-muted-foreground hover:text-foreground/80'
              }`}
            >
              {w.name}
            </button>
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-dark rounded-lg px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              setActiveId(null);
              setName('New workflow');
              setDefinition({ nodes: [], edges: [] });
            }}
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground"
          >
            <Plus className="size-3" /> New
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="inline-flex items-center gap-1 rounded bg-[#14b8a6] px-3 py-1 text-xs font-semibold text-black"
          >
            <Save className="size-3" /> {saving ? '…' : 'Save'}
          </button>
          {activeId && (
            <button
              type="button"
              onClick={async () => {
                await fetch(`/api/studio/workflows?id=${activeId}`, { method: 'DELETE' });
                setActiveId(null);
                setDefinition({ nodes: [], edges: [] });
                void load();
              }}
              className="ml-auto text-red-400"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>

        <div className="relative flex-1 overflow-hidden bg-muted">
          <svg
            ref={svgRef}
            className="h-full w-full"
            onPointerMove={onPointerMove}
            onPointerUp={() => setDragNode(null)}
          >
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#14b8a6" fillOpacity="0.6" />
              </marker>
            </defs>
            {definition.edges.map((e) => {
              const a = nodeMap.get(e.from);
              const b = nodeMap.get(e.to);
              if (!a || !b) return null;
              return (
                <line
                  key={e.id}
                  x1={a.x + 70}
                  y1={a.y + 20}
                  x2={b.x}
                  y2={b.y + 20}
                  stroke="#14b8a6"
                  strokeOpacity={0.45}
                  strokeWidth={2}
                  markerEnd="url(#arrow)"
                />
              );
            })}
            {definition.nodes.map((n) => (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                className="cursor-pointer"
                onPointerDown={() => setDragNode(n.id)}
                onClick={() => onNodeClick(n.id)}
              >
                <rect
                  width={140}
                  height={40}
                  rx={8}
                  fill="#0f0f0f"
                  stroke={connectFrom === n.id ? '#14b8a6' : NODE_COLORS[n.type]}
                  strokeWidth={connectFrom === n.id ? 2 : 1.5}
                />
                <circle cx={12} cy={20} r={5} fill={NODE_COLORS[n.type]} />
                <text
                  x={24}
                  y={25}
                  className="fill-zinc-200 text-[11px]"
                  style={{ fontFamily: 'Inter' }}
                >
                  {n.label}
                </text>
                <text
                  x={24}
                  y={36}
                  className="fill-zinc-600 text-[8px]"
                  style={{ fontFamily: 'monospace' }}
                >
                  {n.type}
                </text>
              </g>
            ))}
          </svg>
          {!definition.nodes.length && (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Add trigger nodes from the left panel
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
