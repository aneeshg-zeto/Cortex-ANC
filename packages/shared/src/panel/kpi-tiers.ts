export type CompanyTier = 1 | 2 | 3;

export type KpiCategory =
  | 'finance'
  | 'growth'
  | 'team'
  | 'projects'
  | 'support'
  | 'ops'
  | 'sales'
  | 'compliance';

export type KpiDefinition = {
  id: string;
  label: string;
  description: string;
  minTier: CompanyTier;
  category: KpiCategory;
  connector?: string;
  href?: string;
  hero?: boolean;
};

export const TIER_LABELS: Record<CompanyTier, { name: string; range: string }> = {
  1: { name: 'Startup', range: '1–30 employees' },
  2: { name: 'Scaling', range: '30–100 employees' },
  3: { name: 'Growth', range: '100–500 employees' },
};

export function tierFromEmployeeCount(count: number): CompanyTier {
  if (count >= 100) return 3;
  if (count >= 30) return 2;
  return 1;
}

/** Cortex-internal: infer maturity from HR + ingested operational signals. */
export function inferCompanyTier(signals: {
  employeeCount: number;
  connectedConnectors: number;
  documentCount: number;
  projectCount: number;
  qaSessions7d: number;
}): CompanyTier {
  const { employeeCount, connectedConnectors, documentCount, projectCount, qaSessions7d } = signals;

  if (employeeCount > 0) {
    return tierFromEmployeeCount(employeeCount);
  }

  let score = 0;
  score += connectedConnectors * 2;
  score += Math.min(6, Math.floor(documentCount / 200));
  score += Math.min(4, projectCount);
  score += Math.min(3, qaSessions7d);

  if (score >= 12) return 3;
  if (score >= 5) return 2;
  return 1;
}

export const CEO_KPI_DEFINITIONS: KpiDefinition[] = [
  // Tier 1
  {
    id: 'cash_runway',
    label: 'Cash runway',
    description: 'Months of cash left at current burn',
    minTier: 1,
    category: 'finance',
    hero: true,
  },
  {
    id: 'monthly_revenue_expenses',
    label: 'Monthly revenue & expenses',
    description: 'Revenue vs operating spend',
    minTier: 1,
    category: 'finance',
    hero: true,
  },
  {
    id: 'active_projects_overdue',
    label: 'Active projects & overdue tasks',
    description: 'From Linear / GitHub',
    minTier: 1,
    category: 'projects',
    connector: 'github',
    href: '/executive-desk',
    hero: true,
  },
  {
    id: 'team_mood',
    label: 'Team mood',
    description: 'Weekly 1-question pulse',
    minTier: 1,
    category: 'team',
    hero: true,
  },
  {
    id: 'open_support_tickets',
    label: 'Open support tickets',
    description: 'Zendesk / Intercom',
    minTier: 1,
    category: 'support',
    connector: 'zendesk',
  },
  {
    id: 'recent_critical_emails',
    label: 'Recent critical emails',
    description: 'Gmail / Outlook priority inbox',
    minTier: 1,
    category: 'ops',
    connector: 'google-workspace',
    href: '/email-desk',
  },
  {
    id: 'connected_tools_health',
    label: 'Connected tools health',
    description: 'Integration sync status',
    minTier: 1,
    category: 'ops',
    href: '/connectors',
  },
  // Tier 2
  {
    id: 'revenue_growth_mom',
    label: 'Revenue growth (MoM)',
    description: 'Month-over-month revenue change',
    minTier: 2,
    category: 'growth',
    connector: 'quickbooks',
  },
  {
    id: 'cac_ltv',
    label: 'CAC & LTV',
    description: 'Customer acquisition cost vs lifetime value',
    minTier: 2,
    category: 'growth',
    connector: 'hubspot',
  },
  {
    id: 'dept_headcount_attrition',
    label: 'Dept headcount & attrition',
    description: 'By department, voluntary vs involuntary',
    minTier: 2,
    category: 'team',
    href: '/hr',
  },
  {
    id: 'project_delivery_velocity',
    label: 'Project delivery velocity',
    description: 'Cycle time & throughput',
    minTier: 2,
    category: 'projects',
    connector: 'github',
  },
  {
    id: 'enps',
    label: 'Employee NPS',
    description: 'eNPS from latest survey',
    minTier: 2,
    category: 'team',
  },
  {
    id: 'sales_pipeline',
    label: 'Sales pipeline & win rate',
    description: 'CRM pipeline value',
    minTier: 2,
    category: 'sales',
    connector: 'hubspot',
  },
  {
    id: 'support_resolution_time',
    label: 'Support resolution time',
    description: 'Avg hours to close tickets',
    minTier: 2,
    category: 'support',
    connector: 'zendesk',
  },
  // Tier 3
  {
    id: 'gross_margin',
    label: 'Gross margin by product',
    description: 'Margin per product line',
    minTier: 3,
    category: 'finance',
    connector: 'quickbooks',
  },
  {
    id: 'customer_churn_expansion',
    label: 'Churn & expansion revenue',
    description: 'Net revenue retention',
    minTier: 3,
    category: 'growth',
    connector: 'stripe',
  },
  {
    id: 'hiring_funnel',
    label: 'Hiring funnel',
    description: 'Time-to-hire & offer acceptance',
    minTier: 3,
    category: 'team',
    href: '/hr',
  },
  {
    id: 'okr_progress',
    label: 'OKR progress',
    description: 'Department OKR completion',
    minTier: 3,
    category: 'projects',
    connector: 'notion',
  },
  {
    id: 'infra_costs_ai_tokens',
    label: 'Infra & AI token usage',
    description: 'Cloud spend and LLM tokens',
    minTier: 3,
    category: 'ops',
  },
  {
    id: 'compliance_audit',
    label: 'Compliance & security audits',
    description: 'Audit status and open findings',
    minTier: 3,
    category: 'compliance',
  },
  {
    id: 'multi_region_latency',
    label: 'Multi-region performance',
    description: 'Latency across regions',
    minTier: 3,
    category: 'ops',
  },
];

export function kpisForTier(tier: CompanyTier): KpiDefinition[] {
  return CEO_KPI_DEFINITIONS.filter((k) => k.minTier <= tier);
}

export const CATEGORY_LABELS: Record<KpiCategory, string> = {
  finance: 'Finance',
  growth: 'Growth',
  team: 'People',
  projects: 'Projects',
  support: 'Support',
  ops: 'Operations',
  sales: 'Sales',
  compliance: 'Compliance',
};
