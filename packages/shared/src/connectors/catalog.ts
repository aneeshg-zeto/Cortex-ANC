/** Canonical connector catalogue for the Connectors Gallery. */
export type ConnectorAuthType = 'oauth2' | 'api_key' | 'env_token';

export type ConnectorCategory =
  | 'communication'
  | 'project'
  | 'docs'
  | 'calendar'
  | 'storage'
  | 'crm'
  | 'support'
  | 'design'
  | 'productivity';

export type ConnectorDefinition = {
  id: string;
  name: string;
  category: ConnectorCategory;
  authType: ConnectorAuthType;
  /** Activepieces piece folder name, if adapted */
  activepiecesId?: string;
  logoUrl?: string;
  description: string;
  /** OAuth provider id passed to /api/auth/connect/[provider] */
  oauthProvider?: string;
  /** Whether ingestion activity exists */
  ingestReady: boolean;
  /** Disables connect in gallery when true */
  comingSoon?: boolean;
  priority: 'A' | 'B';
};

const AP_CDN = 'https://cdn.activepieces.com/pieces';

export const CONNECTOR_CATALOG: ConnectorDefinition[] = [
  // Existing core (shown in gallery)
  {
    id: 'google-workspace',
    name: 'Google Workspace',
    category: 'productivity',
    authType: 'oauth2',
    oauthProvider: 'google',
    description: 'Gmail, Drive, Calendar, Contacts, Tasks',
    ingestReady: true,
    priority: 'A',
    logoUrl: `${AP_CDN}/gmail.png`,
  },
  {
    id: 'github',
    name: 'GitHub',
    category: 'project',
    authType: 'oauth2',
    oauthProvider: 'github',
    activepiecesId: 'github',
    description: 'Repos, issues, PRs, commits',
    ingestReady: true,
    priority: 'A',
    logoUrl: `${AP_CDN}/github.png`,
  },
  {
    id: 'notion',
    name: 'Notion',
    category: 'docs',
    authType: 'env_token',
    activepiecesId: 'notion',
    description: 'Pages and databases',
    ingestReady: true,
    priority: 'A',
    logoUrl: `${AP_CDN}/notion.png`,
  },
  {
    id: 'linear',
    name: 'Linear',
    category: 'project',
    authType: 'oauth2',
    oauthProvider: 'linear',
    activepiecesId: 'linear',
    description: 'Issues and projects',
    ingestReady: false,
    comingSoon: true,
    priority: 'A',
    logoUrl: `${AP_CDN}/linear.png`,
  },
  // Priority A
  {
    id: 'slack',
    name: 'Slack',
    category: 'communication',
    authType: 'oauth2',
    oauthProvider: 'slack',
    activepiecesId: 'slack',
    description: 'Channels, messages, search',
    ingestReady: true,
    priority: 'A',
    logoUrl: `${AP_CDN}/slack.png`,
  },
  {
    id: 'jira',
    name: 'Jira',
    category: 'project',
    authType: 'oauth2',
    oauthProvider: 'jira',
    description: 'Issues, boards, sprints',
    ingestReady: true,
    priority: 'A',
    logoUrl: `${AP_CDN}/jira.png`,
  },
  {
    id: 'confluence',
    name: 'Confluence',
    category: 'docs',
    authType: 'oauth2',
    oauthProvider: 'confluence',
    activepiecesId: 'confluence',
    description: 'Pages, spaces, comments',
    ingestReady: true,
    priority: 'A',
    logoUrl: `${AP_CDN}/confluence.png`,
  },
  {
    id: 'microsoft-365',
    name: 'Microsoft 365',
    category: 'productivity',
    authType: 'oauth2',
    oauthProvider: 'microsoft',
    activepiecesId: 'microsoft-outlook',
    description: 'Outlook, Calendar, OneDrive, Teams chat',
    ingestReady: false,
    priority: 'A',
    logoUrl: `${AP_CDN}/microsoft-outlook.png`,
  },
  {
    id: 'zoom',
    name: 'Zoom',
    category: 'communication',
    authType: 'oauth2',
    oauthProvider: 'zoom',
    activepiecesId: 'zoom',
    description: 'Meetings and recordings',
    ingestReady: true,
    priority: 'A',
    logoUrl: `${AP_CDN}/zoom.png`,
  },
  {
    id: 'calendly',
    name: 'Calendly',
    category: 'calendar',
    authType: 'oauth2',
    oauthProvider: 'calendly',
    activepiecesId: 'calendly',
    description: 'Scheduled events',
    ingestReady: true,
    priority: 'A',
    logoUrl: `${AP_CDN}/calendly.png`,
  },
];

export function getConnectorById(id: string): ConnectorDefinition | undefined {
  return CONNECTOR_CATALOG.find((c) => c.id === id);
}

/** Map OAuth provider slug to catalog connector id. */
export function connectorIdFromOAuthProvider(provider: string): string {
  if (provider === 'google') return 'google-workspace';
  if (provider === 'microsoft') return 'microsoft-365';
  const match = CONNECTOR_CATALOG.find((c) => c.oauthProvider === provider || c.id === provider);
  return match?.id ?? provider;
}

export function isConnectorComingSoon(id: string): boolean {
  return getConnectorById(id)?.comingSoon === true;
}

export function isConnectorConnectEnabled(id: string): boolean {
  const def = getConnectorById(id);
  if (!def || def.comingSoon) return false;
  return def.authType === 'oauth2' || def.authType === 'api_key' || def.authType === 'env_token';
}

export const CONNECTOR_IDS = CONNECTOR_CATALOG.map((c) => c.id) as readonly string[];

export const CONNECTOR_CATEGORIES: { id: ConnectorCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'communication', label: 'Communication' },
  { id: 'project', label: 'Project' },
  { id: 'docs', label: 'Docs' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'storage', label: 'Storage' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'crm', label: 'CRM' },
  { id: 'support', label: 'Support' },
  { id: 'design', label: 'Design' },
];
