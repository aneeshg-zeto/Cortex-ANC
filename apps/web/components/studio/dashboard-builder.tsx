'use client';

import {
  Activity,
  BarChart3,
  GripHorizontal,
  Hash,
  List,
  Minus,
  PieChart,
  Table2,
  Trash2,
  Type,
} from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { CollaborationCursors } from '@/components/studio/collaboration-cursors';
import { StudioWidget } from '@/components/studio/studio-widget';
import { STUDIO_WIDGET_GROUPS } from '@cortex/shared/studio/types';

type LayoutWidget = {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  props?: Record<string, unknown>;
};

const ICON_BY_TYPE: Record<string, React.ComponentType<{ className?: string }>> = {
  metric: Hash,
  'bar-chart': BarChart3,
  'pie-chart': PieChart,
  table: Table2,
  'sparkline-list': Activity,
  text: Type,
  divider: Minus,
  'email-digest': List,
  'velocity-tracker': BarChart3,
  'org-heatmap': Activity,
  'ai-usage': Hash,
};

const CATALOG_LABEL: Record<string, string> = Object.fromEntries(
  STUDIO_WIDGET_GROUPS.flatMap((g) => g.items.map((c) => [c.type, c.label])),
);

type StudioMetrics = {
  documents: number;
  connectors: number;
  nodes: number;
  timeline: { day: string; count: number }[];
  sources: { source: string; count: number }[];
};

type StudioWidgetData = {
  velocity: { team: string; thisWeek: number; lastWeek: number; deltaPct: number }[];
  emailDigest: string[];
  heatmap: { week: string; count: number }[];
  aiUsage: { sessions7d: number; estTokens: number; estCostInr: number };
};

type QALog = { query: string; created_at: string };

const COLS = 12;
const ROW_H = 56;
const GAP = 10;

type ActiveDrag =
  | {
      kind: 'move';
      id: string;
      el: HTMLElement;
      startX: number;
      startY: number;
      origX: number;
      origY: number;
      pointerId: number;
    }
  | {
      kind: 'resize';
      axis: 'e' | 's' | 'se';
      id: string;
      el: HTMLElement;
      startX: number;
      startY: number;
      origX: number;
      origY: number;
      origW: number;
      origH: number;
      origPixelW: number;
      origPixelH: number;
      pointerId: number;
    };

function colWidth(containerWidth: number): number {
  return (containerWidth - GAP * (COLS - 1)) / COLS;
}

function toPixelX(x: number, containerWidth: number): number {
  return x * (colWidth(containerWidth) + GAP);
}

function toPixelW(w: number, containerWidth: number): number {
  return w * colWidth(containerWidth) + (w - 1) * GAP;
}

function toPixelY(y: number): number {
  return y * (ROW_H + GAP);
}

function toPixelH(h: number): number {
  return h * ROW_H + (h - 1) * GAP;
}

function toGridCol(px: number, containerWidth: number): number {
  return Math.round(px / (colWidth(containerWidth) + GAP));
}

function toGridRow(px: number): number {
  return Math.round(px / (ROW_H + GAP));
}

function toGridW(px: number, containerWidth: number): number {
  const step = colWidth(containerWidth) + GAP;
  return Math.max(1, Math.round((px + GAP) / step));
}

function toGridH(px: number): number {
  return Math.max(1, Math.round((px + GAP) / (ROW_H + GAP)));
}

function minWidgetWidth(type: string): number {
  return type === 'divider' ? 1 : 2;
}

function minWidgetHeight(type: string): number {
  return type === 'divider' ? 1 : 2;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function overlaps(a: LayoutWidget, b: LayoutWidget): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function resolveCollisions(layout: LayoutWidget[], moved: LayoutWidget): LayoutWidget[] {
  const items = layout.map((w) => (w.id === moved.id ? { ...moved } : { ...w }));

  function resolveWidget(movedW: LayoutWidget, current: LayoutWidget[]): LayoutWidget[] {
    let result = current;
    for (const other of result) {
      if (other.id === movedW.id) continue;
      const m = result.find((w) => w.id === movedW.id)!;
      if (overlaps(m, other)) {
        const pushed: LayoutWidget = { ...other, y: Math.max(0, m.y + m.h) };
        result = result.map((w) => (w.id === other.id ? pushed : w));
        result = resolveWidget(pushed, result);
      }
    }
    return result;
  }

  return resolveWidget(moved, items);
}

function preserveWidgetRefs(prev: LayoutWidget[], next: LayoutWidget[]): LayoutWidget[] {
  return next.map((w) => {
    const old = prev.find((p) => p.id === w.id);
    if (
      old &&
      old.x === w.x &&
      old.y === w.y &&
      old.w === w.w &&
      old.h === w.h &&
      old.type === w.type &&
      old.props === w.props
    ) {
      return old;
    }
    return w;
  });
}

function getContentWidth(el: HTMLElement): number {
  const style = window.getComputedStyle(el);
  const padL = parseFloat(style.paddingLeft) || 0;
  const padR = parseFloat(style.paddingRight) || 0;
  return el.clientWidth - padL - padR;
}

function getGridPadding(el: HTMLElement) {
  const style = window.getComputedStyle(el);
  return {
    padL: parseFloat(style.paddingLeft) || 0,
    padT: parseFloat(style.paddingTop) || 0,
    padR: parseFloat(style.paddingRight) || 0,
  };
}

function positionGhostEl(
  ghost: HTMLElement,
  widget: LayoutWidget,
  containerWidth: number,
  padL: number,
  padT: number,
) {
  ghost.style.display = 'block';
  ghost.style.left = `${padL + toPixelX(widget.x, containerWidth)}px`;
  ghost.style.top = `${padT + toPixelY(widget.y)}px`;
  ghost.style.width = `${toPixelW(widget.w, containerWidth)}px`;
  ghost.style.height = `${toPixelH(widget.h)}px`;
}

function hideGhost(ghost: HTMLElement | null) {
  if (ghost) ghost.style.display = 'none';
}

type TileMemoProps = {
  widget: LayoutWidget;
  isSelected: boolean;
  containerWidth: number;
  metrics: StudioMetrics | null;
  logs: QALog[];
  widgetData: StudioWidgetData | null;
  onDragStart: (id: string, e: React.PointerEvent) => void;
  onResizeStart: (id: string, dir: 'e' | 's' | 'se', e: React.PointerEvent) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
};

const TileMemo = memo(
  function TileMemo({
    widget: w,
    isSelected,
    onDragStart,
    onResizeStart,
    onDelete,
    onSelect,
    metrics,
    logs,
    widgetData,
  }: TileMemoProps) {
    const title = CATALOG_LABEL[w.type] ?? w.type;

    return (
      <div
        data-tile-id={w.id}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(w.id);
        }}
        className={`relative z-[1] flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-card ${
          isSelected
            ? 'z-20 border-[#14b8a6] shadow-lg shadow-[#14b8a6]/10 ring-2 ring-[#14b8a6]/30'
            : 'border-[#252525] hover:border-[#3f3f3f]'
        }`}
        style={{
          gridColumn: `${w.x + 1} / span ${w.w}`,
          gridRow: `${w.y + 1} / span ${w.h}`,
        }}
      >
        <div
          role="toolbar"
          className="flex shrink-0 cursor-grab items-center gap-1 border-b border-border bg-muted px-2 py-1.5 active:cursor-grabbing"
          onPointerDown={(e) => onDragStart(w.id, e)}
        >
          <GripHorizontal className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground/80">
            {title}
          </span>
          <button
            type="button"
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-[#252525] hover:text-red-400"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onDelete(w.id)}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>

        <div className="pointer-events-none min-h-0 flex-1 overflow-hidden">
          <StudioWidget
            type={w.type}
            props={w.props}
            metrics={metrics}
            logs={logs}
            widgetData={widgetData}
          />
        </div>

        <div
          role="presentation"
          className="absolute bottom-6 right-0 top-8 z-30 w-2 cursor-e-resize touch-none"
          onPointerDown={(e) => onResizeStart(w.id, 'e', e)}
        />
        <div
          role="presentation"
          className="absolute bottom-0 left-0 right-6 z-30 h-2 cursor-s-resize touch-none"
          onPointerDown={(e) => onResizeStart(w.id, 's', e)}
        />
        <div
          role="presentation"
          className="absolute bottom-0 right-0 z-40 size-5 cursor-se-resize touch-none"
          onPointerDown={(e) => onResizeStart(w.id, 'se', e)}
        >
          <div className="absolute bottom-1 right-1 size-3 rounded-sm border border-[#14b8a6] bg-[#14b8a6]/25" />
        </div>

        {isSelected && (
          <div
            data-size-label
            className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[9px] text-[#14b8a6]"
          >
            {w.w} × {w.h}
          </div>
        )}
      </div>
    );
  },
  (prev, next) =>
    prev.widget === next.widget &&
    prev.isSelected === next.isSelected &&
    prev.containerWidth === next.containerWidth &&
    prev.metrics === next.metrics &&
    prev.logs === next.logs &&
    prev.widgetData === next.widgetData,
);

export function DashboardBuilder() {
  const gridRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<LayoutWidget[]>([]);
  const dragRef = useRef<ActiveDrag | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerWidthRef = useRef(0);
  const dragGhostRef = useRef<HTMLDivElement>(null);
  const resizeGhostRef = useRef<HTMLDivElement>(null);

  const [layout, setLayout] = useState<LayoutWidget[]>([]);
  const [metrics, setMetrics] = useState<StudioMetrics | null>(null);
  const [widgetData, setWidgetData] = useState<StudioWidgetData | null>(null);
  const [logs, setLogs] = useState<QALog[]>([]);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [libraryDragType, setLibraryDragType] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  layoutRef.current = layout;
  containerWidthRef.current = containerWidth;

  const load = useCallback(async () => {
    const [layoutRes, metricsRes, logsRes, widgetRes] = await Promise.all([
      fetch('/api/studio/layout'),
      fetch('/api/studio/metrics'),
      fetch('/api/admin/logs'),
      fetch('/api/studio/widget-data'),
    ]);
    if (layoutRes.ok) {
      const d = (await layoutRes.json()) as { layout: LayoutWidget[] };
      setLayout(d.layout ?? []);
    }
    if (metricsRes.ok) setMetrics((await metricsRes.json()) as StudioMetrics);
    if (widgetRes.ok) setWidgetData((await widgetRes.json()) as StudioWidgetData);
    if (logsRes.ok) {
      const d = (await logsRes.json()) as { logs: QALog[] };
      setLogs(d.logs ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => {
      const w = getContentWidth(el);
      containerWidthRef.current = w;
      setContainerWidth(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scheduleSave = useCallback((next: LayoutWidget[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaving(true);
      void fetch('/api/studio/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: next }),
      }).finally(() => setSaving(false));
    }, 350);
  }, []);

  const addWidget = useCallback(
    (type: string, atX?: number, atY?: number) => {
      const id = `w-${type}-${Date.now()}`;
      const next: LayoutWidget = {
        id,
        type,
        x: atX ?? 0,
        y: atY ?? Math.max(0, ...layoutRef.current.map((w) => w.y + w.h), 0),
        w: type === 'divider' ? 12 : type === 'email-digest' || type === 'velocity-tracker' ? 5 : 4,
        h: type === 'divider' ? 1 : type === 'metric' || type === 'ai-usage' ? 2 : 3,
        props:
          type === 'metric'
            ? { label: 'Documents indexed', metricKey: 'documents' }
            : type === 'text'
              ? { text: 'Add a note for your team…' }
              : type === 'bar-chart'
                ? { title: 'Desk activity' }
                : type === 'email-digest'
                  ? { title: 'Exec email digest (7d)' }
                  : type === 'velocity-tracker'
                    ? { title: 'Shipping velocity' }
                    : undefined,
      };
      const updated = resolveCollisions([...layoutRef.current, next], next);
      const preserved = preserveWidgetRefs(layoutRef.current, updated);
      setLayout(preserved);
      scheduleSave(preserved);
      setSelected(id);
    },
    [scheduleSave],
  );

  const removeWidget = useCallback(
    (id: string) => {
      const updated = layoutRef.current.filter((w) => w.id !== id);
      setLayout(updated);
      scheduleSave(updated);
      setSelected(null);
    },
    [scheduleSave],
  );

  const onSelect = useCallback((id: string) => {
    setSelected(id);
  }, []);

  const clearTileInteractionStyles = useCallback((el: HTMLElement) => {
    el.style.transform = '';
    el.style.width = '';
    el.style.height = '';
    el.style.zIndex = '';
  }, []);

  const commitLayout = useCallback(
    (moved: LayoutWidget) => {
      const resolved = resolveCollisions(layoutRef.current, moved);
      const preserved = preserveWidgetRefs(layoutRef.current, resolved);
      layoutRef.current = preserved;
      setLayout(preserved);
      scheduleSave(preserved);
    },
    [scheduleSave],
  );

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;

      const gridEl = gridRef.current;
      if (!gridEl) return;

      const cw = containerWidthRef.current;
      const { padL, padT } = getGridPadding(gridEl);
      const colStep = colWidth(cw) + GAP;
      const rowStep = ROW_H + GAP;

      if (drag.kind === 'move') {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        drag.el.style.transform = `translate(${dx}px, ${dy}px)`;
        drag.el.style.zIndex = '30';

        const colDelta = Math.round(dx / colStep);
        const rowDelta = Math.round(dy / rowStep);
        const widget = layoutRef.current.find((w) => w.id === drag.id);
        if (!widget) return;

        const provisional: LayoutWidget = {
          ...widget,
          x: clamp(drag.origX + colDelta, 0, COLS - widget.w),
          y: Math.max(0, drag.origY + rowDelta),
        };
        const resolved = resolveCollisions(layoutRef.current, provisional);
        const placed = resolved.find((w) => w.id === drag.id) ?? provisional;

        const dragGhost = dragGhostRef.current;
        if (dragGhost) {
          positionGhostEl(dragGhost, placed, cw, padL, padT);
        }

        const sizeLabel = drag.el.querySelector('[data-size-label]');
        if (sizeLabel) {
          sizeLabel.textContent = `${placed.w} × ${placed.h}`;
        }
        return;
      }

      const widget = layoutRef.current.find((w) => w.id === drag.id);
      if (!widget) return;

      let newPxW = drag.origPixelW;
      let newPxH = drag.origPixelH;

      if (drag.axis === 'e' || drag.axis === 'se') {
        newPxW = Math.max(colStep, drag.origPixelW + (e.clientX - drag.startX));
      }
      if (drag.axis === 's' || drag.axis === 'se') {
        newPxH = Math.max(rowStep, drag.origPixelH + (e.clientY - drag.startY));
      }

      drag.el.style.width = `${newPxW}px`;
      drag.el.style.height = `${newPxH}px`;
      drag.el.style.zIndex = '30';

      const minW = minWidgetWidth(widget.type);
      const minH = minWidgetHeight(widget.type);
      const snappedW =
        drag.axis === 's' ? drag.origW : clamp(toGridW(newPxW, cw), minW, COLS - drag.origX);
      const snappedH = drag.axis === 'e' ? drag.origH : Math.max(minH, toGridH(newPxH));

      const resizeGhost = resizeGhostRef.current;
      if (resizeGhost) {
        positionGhostEl(
          resizeGhost,
          { ...widget, x: drag.origX, y: drag.origY, w: snappedW, h: snappedH },
          cw,
          padL,
          padT,
        );
      }

      const sizeLabel = drag.el.querySelector('[data-size-label]');
      if (sizeLabel) {
        sizeLabel.textContent = `${snappedW} × ${snappedH}`;
      }
    }

    function onPointerUp(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;

      const cw = containerWidthRef.current;
      const colStep = colWidth(cw) + GAP;
      const rowStep = ROW_H + GAP;
      const widget = layoutRef.current.find((w) => w.id === drag.id);

      hideGhost(dragGhostRef.current);
      hideGhost(resizeGhostRef.current);

      if (widget) {
        if (drag.kind === 'move') {
          const dx = e.clientX - drag.startX;
          const dy = e.clientY - drag.startY;
          const colDelta = Math.round(dx / colStep);
          const rowDelta = Math.round(dy / rowStep);
          const moved: LayoutWidget = {
            ...widget,
            x: clamp(drag.origX + colDelta, 0, COLS - widget.w),
            y: Math.max(0, drag.origY + rowDelta),
          };
          commitLayout(moved);
        } else {
          const style = window.getComputedStyle(drag.el);
          const currentW = parseFloat(style.width) || drag.origPixelW;
          const currentH = parseFloat(style.height) || drag.origPixelH;
          const minW = minWidgetWidth(widget.type);
          const minH = minWidgetHeight(widget.type);
          const newW =
            drag.axis === 's' ? drag.origW : clamp(toGridW(currentW, cw), minW, COLS - drag.origX);
          const newH = drag.axis === 'e' ? drag.origH : Math.max(minH, toGridH(currentH));
          const moved: LayoutWidget = { ...widget, w: newW, h: newH };
          commitLayout(moved);
        }
      }

      clearTileInteractionStyles(drag.el);
      dragRef.current = null;
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [clearTileInteractionStyles, commitLayout]);

  const onDragStart = useCallback((id: string, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const el = (e.currentTarget as HTMLElement).closest('[data-tile-id]') as HTMLElement | null;
    if (!el) return;

    const widget = layoutRef.current.find((w) => w.id === id);
    if (!widget) return;

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSelected(id);

    const sizeLabel = el.querySelector('[data-size-label]');
    if (!sizeLabel) {
      const label = document.createElement('div');
      label.setAttribute('data-size-label', '');
      label.className =
        'pointer-events-none absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[9px] text-[#14b8a6]';
      el.appendChild(label);
    }

    dragRef.current = {
      kind: 'move',
      id,
      el,
      startX: e.clientX,
      startY: e.clientY,
      origX: widget.x,
      origY: widget.y,
      pointerId: e.pointerId,
    };
  }, []);

  const onResizeStart = useCallback((id: string, axis: 'e' | 's' | 'se', e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const el = (e.currentTarget as HTMLElement).closest('[data-tile-id]') as HTMLElement | null;
    if (!el) return;

    const widget = layoutRef.current.find((w) => w.id === id);
    if (!widget) return;

    const cw = containerWidthRef.current;

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSelected(id);

    const sizeLabel = el.querySelector('[data-size-label]');
    if (!sizeLabel) {
      const label = document.createElement('div');
      label.setAttribute('data-size-label', '');
      label.className =
        'pointer-events-none absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[9px] text-[#14b8a6]';
      el.appendChild(label);
    }

    dragRef.current = {
      kind: 'resize',
      axis,
      id,
      el,
      startX: e.clientX,
      startY: e.clientY,
      origX: widget.x,
      origY: widget.y,
      origW: widget.w,
      origH: widget.h,
      origPixelW: toPixelW(widget.w, cw),
      origPixelH: toPixelH(widget.h),
      pointerId: e.pointerId,
    };
  }, []);

  const onGridDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('widget-type') || libraryDragType;
      if (!type) return;
      const gridEl = gridRef.current;
      if (!gridEl) return;

      const rect = gridEl.getBoundingClientRect();
      const { padL, padT } = getGridPadding(gridEl);
      const cw = containerWidthRef.current;
      const colStep = colWidth(cw) + GAP;
      const rowStep = ROW_H + GAP;

      const x = clamp(Math.floor((e.clientX - rect.left - padL) / colStep), 0, COLS - 2);
      const y = Math.max(0, Math.floor((e.clientY - rect.top - padT) / rowStep));
      addWidget(type, x, y);
      setLibraryDragType(null);
    },
    [addWidget, libraryDragType],
  );

  const maxRow = Math.max(8, ...layout.map((w) => w.y + w.h));

  const ghostStyle: React.CSSProperties = {
    display: 'none',
    position: 'absolute',
    pointerEvents: 'none',
    border: '1.5px dashed var(--color-border-info, var(--border))',
    borderRadius: 8,
    backgroundColor: 'rgba(20, 184, 166, 0.06)',
    zIndex: 25,
  };

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <CollaborationCursors page="/studio-dashboard" />

      <aside className="shrink-0 border-b border-border bg-card p-3 lg:w-56 lg:border-b-0 lg:border-r lg:overflow-y-auto">
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Widget library
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Drag onto canvas — not all are on the board by default
        </p>
        <div className="mt-3 space-y-4">
          {STUDIO_WIDGET_GROUPS.map((group) => (
            <div key={group.id}>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              <ul className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                {group.items.map((item) => {
                  const Icon = ICON_BY_TYPE[item.type] ?? Hash;
                  return (
                    <li key={item.type}>
                      <button
                        type="button"
                        draggable
                        onDragStart={(ev) => {
                          ev.dataTransfer.setData('widget-type', item.type);
                          ev.dataTransfer.effectAllowed = 'copy';
                          setLibraryDragType(item.type);
                        }}
                        onDragEnd={() => setLibraryDragType(null)}
                        onClick={() => addWidget(item.type)}
                        className="flex w-full cursor-grab items-start gap-2.5 rounded-lg border border-border bg-card px-2.5 py-2.5 text-left active:cursor-grabbing hover:border-[#14b8a6]/50"
                      >
                        <Icon className="mt-0.5 size-4 shrink-0 text-[#14b8a6]" />
                        <span>
                          <span className="block text-xs font-medium text-foreground">
                            {item.label}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">
                            {item.description}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <p className="text-xs text-muted-foreground">
            Drag the top bar to move · drag edges or corner to resize
          </p>
          <span className="text-[10px] text-muted-foreground">{saving ? 'Saving…' : 'Saved'}</span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
          <div
            ref={gridRef}
            className="relative w-full min-w-[320px] rounded-xl border border-border bg-muted p-2"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
              gridAutoRows: `${ROW_H}px`,
              gap: `${GAP}px`,
              minHeight: maxRow * (ROW_H + GAP),
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={onGridDrop}
            onClick={() => setSelected(null)}
          >
            <div
              className="pointer-events-none absolute inset-2 rounded-lg opacity-25"
              style={{
                backgroundImage: `
                  linear-gradient(to right, #27272a 1px, transparent 1px),
                  linear-gradient(to bottom, #27272a 1px, transparent 1px)
                `,
                backgroundSize: `calc((100% - ${GAP * (COLS - 1)}px) / ${COLS} + ${GAP}px) ${ROW_H + GAP}px`,
              }}
            />

            <div ref={dragGhostRef} style={ghostStyle} aria-hidden />
            <div id="resize-ghost" ref={resizeGhostRef} style={ghostStyle} aria-hidden />

            {layout.map((w) => (
              <TileMemo
                key={w.id}
                widget={w}
                isSelected={selected === w.id}
                containerWidth={containerWidth}
                metrics={metrics}
                logs={logs}
                widgetData={widgetData}
                onDragStart={onDragStart}
                onResizeStart={onResizeStart}
                onDelete={removeWidget}
                onSelect={onSelect}
              />
            ))}

            {!layout.length && (
              <div
                className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground"
                style={{ gridColumn: '1 / -1' }}
              >
                Add a tile from the left →
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
