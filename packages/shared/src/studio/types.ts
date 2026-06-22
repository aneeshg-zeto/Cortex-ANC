export type WidgetType =
  | 'metric'
  | 'bar-chart'
  | 'pie-chart'
  | 'table'
  | 'text'
  | 'divider'
  | 'sparkline-list'
  | 'email-digest'
  | 'velocity-tracker'
  | 'org-heatmap'
  | 'ai-usage';

export type LayoutWidget = {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  props?: Record<string, unknown>;
};

export type WorkflowNodeType = 'trigger' | 'action' | 'condition';

export type WorkflowNode = {
  id: string;
  type: WorkflowNodeType;
  label: string;
  x: number;
  y: number;
  config?: Record<string, string>;
};

export type WorkflowEdge = {
  id: string;
  from: string;
  to: string;
};

export type WorkflowDefinition = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

export type NotebookBlockType = 'text' | 'heading' | 'bullet' | 'code' | 'embed';

export type NotebookBlock = {
  id: string;
  type: NotebookBlockType;
  content: string;
};

export const DEFAULT_DASHBOARD_LAYOUT: LayoutWidget[] = [
  {
    id: 'w-metric-1',
    type: 'metric',
    x: 0,
    y: 0,
    w: 3,
    h: 2,
    props: { label: 'Documents indexed', metricKey: 'documents' },
  },
  {
    id: 'w-email-digest',
    type: 'email-digest',
    x: 3,
    y: 0,
    w: 5,
    h: 4,
    props: { title: 'Exec email digest (7d)' },
  },
  {
    id: 'w-velocity',
    type: 'velocity-tracker',
    x: 8,
    y: 0,
    w: 4,
    h: 4,
    props: { title: 'Shipping velocity' },
  },
  {
    id: 'w-bar-1',
    type: 'bar-chart',
    x: 0,
    y: 2,
    w: 3,
    h: 3,
    props: { title: 'Desk activity (7d)' },
  },
];

export type WidgetCatalogGroup = {
  id: string;
  label: string;
  items: { type: WidgetType; label: string; description: string }[];
};

export const STUDIO_WIDGET_GROUPS: WidgetCatalogGroup[] = [
  {
    id: 'core',
    label: 'Core blocks',
    items: [
      { type: 'metric', label: 'Headline number', description: 'One big KPI' },
      { type: 'bar-chart', label: 'Activity trend', description: 'Last 7 days Q&A' },
      { type: 'pie-chart', label: 'Source mix', description: 'Connector share' },
      { type: 'table', label: 'Recent questions', description: 'Desk Q&A feed' },
      { type: 'sparkline-list', label: 'Pulse board', description: 'Metrics + sparklines' },
      { type: 'text', label: 'Annotation', description: 'Freeform note' },
      { type: 'divider', label: 'Section break', description: 'Visual separator' },
    ],
  },
  {
    id: 'executive',
    label: 'Executive analytics',
    items: [
      {
        type: 'email-digest',
        label: 'Exec email digest',
        description: 'Priority Gmail bullets (7d)',
      },
      { type: 'velocity-tracker', label: 'Velocity tracker', description: 'WoW GitHub ship rate' },
      {
        type: 'org-heatmap',
        label: 'Org activity heatmap',
        description: 'Weekly activity intensity',
      },
      { type: 'ai-usage', label: 'AI usage & cost', description: 'Q&A tokens + estimate' },
    ],
  },
];

/** @deprecated use STUDIO_WIDGET_GROUPS */
export const WIDGET_CATALOG: { type: WidgetType; label: string; description: string }[] =
  STUDIO_WIDGET_GROUPS.flatMap((g) => g.items);

export const WORKFLOW_NODE_TEMPLATES: {
  type: WorkflowNodeType;
  label: string;
  category: string;
}[] = [
  { type: 'trigger', label: 'Connector sync', category: 'Triggers' },
  { type: 'trigger', label: 'Schedule', category: 'Triggers' },
  { type: 'trigger', label: 'Webhook', category: 'Triggers' },
  { type: 'action', label: 'Send email', category: 'Actions' },
  { type: 'action', label: 'Create issue', category: 'Actions' },
  { type: 'action', label: 'Index document', category: 'Actions' },
  { type: 'condition', label: 'If / else', category: 'Logic' },
  { type: 'condition', label: 'Filter', category: 'Logic' },
];
