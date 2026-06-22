'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type LineageNode = { id: string; label: string; type: string };
type LineageEdge = { id: string; from: string; to: string };

const TYPE_COLORS: Record<string, string> = {
  connector: '#14b8a6',
  table: '#3b82f6',
  metric: '#f59e0b',
  document: '#a78bfa',
};

type SimNode = LineageNode & { x: number; y: number; vx: number; vy: number };

function layout(nodes: SimNode[], edges: LineageEdge[], w: number, h: number) {
  for (let t = 0; t < 100; t++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const f = 3000 / (dist * dist);
        dx = (dx / dist) * f;
        dy = (dy / dist) * f;
        a.vx -= dx;
        a.vy -= dy;
        b.vx += dx;
        b.vy += dy;
      }
    }
    const map = new Map(nodes.map((n) => [n.id, n]));
    for (const e of edges) {
      const a = map.get(e.from);
      const b = map.get(e.to);
      if (!a || !b) continue;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const pull = (dist - 90) * 0.03;
      dx = (dx / dist) * pull;
      dy = (dy / dist) * pull;
      a.vx += dx;
      a.vy += dy;
      b.vx -= dx;
      b.vy -= dy;
    }
    for (const n of nodes) {
      n.vx += (w / 2 - n.x) * 0.01;
      n.vy += (h / 2 - n.y) * 0.01;
      n.vx *= 0.85;
      n.vy *= 0.85;
      n.x += n.vx;
      n.y += n.vy;
    }
  }
}

export function LineageGraph() {
  const [nodes, setNodes] = useState<LineageNode[]>([]);
  const [edges, setEdges] = useState<LineageEdge[]>([]);
  const [hovered, setHovered] = useState<LineageNode | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 480 });

  useEffect(() => {
    void fetch('/api/studio/lineage')
      .then((r) => r.json())
      .then((d: { nodes: LineageNode[]; edges: LineageEdge[] }) => {
        setNodes(d.nodes ?? []);
        setEdges(d.edges ?? []);
      });
  }, []);

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

  const layoutNodes = useMemo(() => {
    const sim: SimNode[] = nodes.map((n, i) => ({
      ...n,
      x: size.w / 2 + Math.cos((i / Math.max(nodes.length, 1)) * Math.PI * 2) * 120,
      y: size.h / 2 + Math.sin((i / Math.max(nodes.length, 1)) * Math.PI * 2) * 120,
      vx: 0,
      vy: 0,
    }));
    layout(sim, edges, size.w, size.h);
    return sim;
  }, [nodes, edges, size.w, size.h]);

  const pos = useMemo(() => new Map(layoutNodes.map((n) => [n.id, n])), [layoutNodes]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-2">
        <p className="text-xs text-muted-foreground">
          Connectors → tables → metrics · scroll to zoom · drag background to pan
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <span
              key={type}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
              {type}
            </span>
          ))}
        </div>
      </div>
      <div ref={containerRef} className="relative flex-1 overflow-hidden bg-muted">
        <svg
          width={size.w}
          height={size.h}
          className="cursor-grab"
          onWheel={(e) => {
            e.preventDefault();
            setTransform((t) => ({
              ...t,
              k: Math.max(0.3, Math.min(2.5, t.k - e.deltaY * 0.001)),
            }));
          }}
        >
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            {edges.map((e) => {
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
            {layoutNodes.map((n) => (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(null)}
              >
                <rect
                  x={-50}
                  y={-14}
                  width={100}
                  height={28}
                  rx={6}
                  fill="#0f0f0f"
                  stroke={TYPE_COLORS[n.type] ?? '#64748b'}
                  strokeWidth={1.5}
                />
                <text
                  textAnchor="middle"
                  y={4}
                  className="fill-zinc-300 text-[9px]"
                  style={{ fontFamily: 'Inter' }}
                >
                  {n.label.length > 14 ? `${n.label.slice(0, 12)}…` : n.label}
                </text>
              </g>
            ))}
          </g>
        </svg>
        {hovered && (
          <div className="absolute bottom-3 left-3 rounded-lg border border-border bg-muted/95 px-3 py-2 text-xs">
            <p className="font-medium text-foreground">{hovered.label}</p>
            <p className="text-muted-foreground">{hovered.type}</p>
          </div>
        )}
        <div className="absolute bottom-3 right-3 h-16 w-24 overflow-hidden rounded border border-border bg-background/90">
          <svg width="100%" height="100%" viewBox={`0 0 ${size.w} ${size.h}`}>
            {layoutNodes.map((n) => (
              <circle
                key={`mm-${n.id}`}
                cx={n.x}
                cy={n.y}
                r={3}
                fill={TYPE_COLORS[n.type] ?? '#64748b'}
              />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
