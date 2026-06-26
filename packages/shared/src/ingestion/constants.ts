import type { ACLPolicy } from './adapter';

/** Canonical Cortex roles — keep in sync with @cortex/auth CortexRole. */
export const CORTEX_ROLES = ['super_admin', 'ceo', 'client', 'hr', 'employee', 'member'] as const;

export type CortexRole = (typeof CORTEX_ROLES)[number];

export const CONNECTOR_SOURCES = [
  'gmail',
  'google_drive',
  'google_calendar',
  'github',
  'notion',
  'slack',
  'linear',
  'jira',
  'confluence',
  'zoom',
  'calendly',
  'microsoft_365',
] as const;

export type ConnectorSource = (typeof CONNECTOR_SOURCES)[number];

export const DEFAULT_ACL: ACLPolicy = {
  visibility: 'role',
  allowedRoles: ['ceo', 'client', 'super_admin'],
  sourcePermission: 'unknown',
};

export const SOURCE_METADATA_KEY = 'source' as const;
export const SOURCE_TYPE_KEY = 'type' as const;
