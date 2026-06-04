/** Connector layer types – placeholders expanded in Phase 2 */

export interface AuthConfig {
  type: 'oauth2' | 'secret_text' | 'basic_auth' | 'custom_auth' | 'no_auth';
  credentials: Record<string, unknown>;
}

export interface ConnectorAction {
  name: string;
  displayName: string;
  description: string;
  run: (context: ConnectorActionContext) => Promise<unknown>;
}

export interface ConnectorTrigger {
  name: string;
  displayName: string;
  description: string;
  type: string;
}

export interface ConnectorActionContext {
  auth: unknown;
  props: Record<string, unknown>;
}
