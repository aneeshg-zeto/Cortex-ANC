'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minus, Plus, Search } from 'lucide-react';

type GraphNode = { id: string; label: string; type: string };
type GraphEdge = { id: string; from: string; to: string; type: string };

const NODE_COLORS: Record<string, string> = {
  Person: '#3b82f6',
  Project: '#14b8a6',
  Ticket: '#f59e0b',
  Connector: '#8b5cf6',
  Document: '#06b6d4',
  Organization: '#a855f7',
};

type SimNode = GraphNode & { x: number; y: number; vx: number; vy: number };

function runLayout(nodes: SimNode[], edges: GraphEdge[], w: number, h: number) {
  const map = new Map(nodes.map((n) => [n.id, n]));
  for (let t = 0; t < 140; t++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const rep = 4500 / (dist * dist);
        dx = (dx / dist) * rep;
        dy = (dy / dist) * rep;
        a.vx -= dx;
        a.vy -= dy;
        b.vx += dx;
        b.vy += dy;
      }
    }
    for (const e of edges) {
      const a = map.get(e.from);
      const b = map.get(e.to);
      if (!a || !b) continue;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const pull = (dist - 80) * 0.04;
      dx = (dx / dist) * pull;
      dy = (dy / dist) * pull;
      a.vx += dx;
      a.vy += dy;
      b.vx -= dx;
      b.vy -= dy;
    }
    for (const n of nodes) {
      n.vx += (w / 2 - n.x) * 0.015;
      n.vy += (h / 2 - n.y) * 0.015;
      n.vx *= 0.82;
      n.vy *= 0.82;
      n.x = Math.max(30, Math.min(w - 30, n.x + n.vx));
      n.y = Math.max(30, Math.min(h - 30, n.y + n.vy));
    }
  }
}

export function GraphExplorerView() {
  const router = useRouter();
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [seeded, setSeeded] = useState(false);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState({ w: 900, h: 520 });

  const load = useCallback(async () => {
    const res = await fetch('/api/panel/graph-overview');
    if (!res.ok) return;
    const d = (await res.json()) as {
      nodes: GraphNode[];
      edges: GraphEdge[];
      seeded?: boolean;
    };
    setNodes(d.nodes ?? []);
    setEdges(d.edges ?? []);
    setSeeded(Boolean(d.seeded));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter(
      (n) => n.label.toLowerCase().includes(q) || n.type.toLowerCase().includes(q),
    );
  }, [nodes, query]);

  const layout = useMemo(() => {
    const sim: SimNode[] = filtered.map((n, i) => {
      const angle = (i / Math.max(filtered.length, 1)) * Math.PI * 2;
      const r = Math.min(size.w, size.h) * 0.3;
      return {
        ...n,
        x: size.w / 2 + Math.cos(angle) * r,
        y: size.h / 2 + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
      };
    });
    const edgeSet = new Set(filtered.map((n) => n.id));
    const relevantEdges = edges.filter((e) => edgeSet.has(e.from) && edgeSet.has(e.to));
    runLayout(sim, relevantEdges, size.w, size.h);
    return sim;
  }, [filtered, edges, size.w, size.h]);

  const pos = useMemo(() => new Map(layout.map((n) => [n.id, n])), [layout]);
  const relevantEdges = edges.filter((e) => pos.has(e.from) && pos.has(e.to));

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter nodes…"
            className="flex-1 bg-transparent text-sm text-foreground outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setTransform((t) => ({ ...t, k: Math.min(2.5, t.k + 0.2) }))}
          className="rounded border border-border p-1.5 text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setTransform((t) => ({ ...t, k: Math.max(0.4, t.k - 0.2) }))}
          className="rounded border border-border p-1.5 text-muted-foreground hover:text-foreground"
        >
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setTransform({ x: 0, y: 0, k: 1 })}
          className="rounded border border-border p-1.5 text-muted-foreground hover:text-foreground"
        >
          <Maximize2 className="size-4" />
        </button>
        {seeded && (
          <span className="text-[10px] text-muted-foreground">Sample data — connect tools</span>
        )}
      </div>

      <div ref={containerRef} className="relative min-h-[420px] flex-1 overflow-hidden bg-muted">
        <svg
          width={size.w}
          height={size.h}
          className="cursor-grab active:cursor-grabbing"
          onWheel={(e) => {
            e.preventDefault();
            setTransform((t) => ({
              ...t,
              k: Math.max(0.4, Math.min(2.5, t.k - e.deltaY * 0.001)),
            }));
          }}
          onPointerDown={(e) => {
            dragRef.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
          }}
          onPointerMove={(e) => {
            if (!dragRef.current) return;
            setTransform((t) => ({
              ...t,
              x: e.clientX - dragRef.current!.x,
              y: e.clientY - dragRef.current!.y,
            }));
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
        >
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            {relevantEdges.map((e) => {
              const a = pos.get(e.from);
              const b = pos.get(e.to);
              if (!a || !b) return null;
              return (
                <line
                  key={e.id}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="#14b8a6"
                  strokeOpacity={0.35}
                  strokeWidth={1.5}
                />
              );
            })}
            {layout.map((n) => {
              const isExpanded = expanded.has(n.id);
              const r = isExpanded ? 14 : hovered?.id === n.id ? 11 : 8;
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x},${n.y})`}
                  className="cursor-pointer"
                  onMouseEnter={() => setHovered(n)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => toggleExpand(n.id)}
                  onDoubleClick={() => router.push('/studio?tab=graph')}
                >
                  <circle
                    r={r}
                    fill={NODE_COLORS[n.type] ?? '#64748b'}
                    fillOpacity={0.9}
                    stroke={NODE_COLORS[n.type] ?? '#64748b'}
                    strokeWidth={2}
                  />
                  <text y={r + 14} textAnchor="middle" className="fill-zinc-400 text-[9px]">
                    {n.label.length > 16 ? `${n.label.slice(0, 14)}…` : n.label}
                  </text>
                  {isExpanded && (
                    <text y={r + 26} textAnchor="middle" className="fill-zinc-600 text-[8px]">
                      {n.type} · double-click for Q&A
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {hovered && (
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-border bg-muted/95 px-3 py-2 text-xs backdrop-blur-sm">
            <p className="font-medium text-foreground">{hovered.label}</p>
            <p className="text-muted-foreground">{hovered.type} · click to expand</p>
          </div>
        )}

        <div className="absolute bottom-3 right-3 h-20 w-28 overflow-hidden rounded-lg border border-border bg-background/90">
          <p className="px-1 pt-0.5 text-[8px] text-muted-foreground">Minimap</p>
          <svg width="100%" height="calc(100% - 12px)" viewBox={`0 0 ${size.w} ${size.h}`}>
            {layout.map((n) => (
              <circle
                key={`mm-${n.id}`}
                cx={n.x}
                cy={n.y}
                r={expanded.has(n.id) ? 5 : 3}
                fill={NODE_COLORS[n.type] ?? '#64748b'}
              />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
