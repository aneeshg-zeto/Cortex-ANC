import type { ConnectorAdapter, ConnectorSource } from '../adapter';
import { CONNECTOR_SOURCES } from '../constants';

import GmailAdapter from './gmail.adapter';
import GitHubAdapter from './github.adapter';
import GoogleCalendarAdapter from './google-calendar.adapter';
import GoogleDriveAdapter from './google-drive.adapter';
import { createStubAdapter } from './stubs/stub.adapter';

export { ConnectorAuthError, ConnectorRateLimitError } from './connector-http';
export { default as GitHubAdapter } from './github.adapter';
export { default as GmailAdapter } from './gmail.adapter';
export { default as GoogleCalendarAdapter } from './google-calendar.adapter';
export { default as GoogleDriveAdapter } from './google-drive.adapter';

/*
 * ADAPTER_REGISTRY
 *
 * When you add a new ConnectorSource to constants.ts, TypeScript will NOT
 * automatically error if you forget to add it here (Partial<> allows gaps).
 * To verify completeness, run:
 *   Object.keys(ADAPTER_REGISTRY).length === CONNECTOR_SOURCES.length
 * or add an exhaustiveness test in __tests__/adapters.test.ts.
 *
 * Sources currently without full adapters use stubs until real adapters land.
 * Until adapters exist, runConnectorIngest returns gracefully for these sources.
 */

const STUB_SOURCES = CONNECTOR_SOURCES.filter(
  (s) => !['github', 'gmail', 'google_calendar', 'google_drive'].includes(s),
);

export const ADAPTER_REGISTRY: Partial<Record<ConnectorSource, ConnectorAdapter>> = {
  github: new GitHubAdapter(),
  gmail: new GmailAdapter(),
  google_calendar: new GoogleCalendarAdapter(),
  google_drive: new GoogleDriveAdapter(),
  ...Object.fromEntries(STUB_SOURCES.map((source) => [source, createStubAdapter(source)])),
};
