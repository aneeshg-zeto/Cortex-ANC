/**
 * Minimal stubs adapted from @activepieces/shared.
 * Copied types only – full shared package not needed for Cortex Phase 0/1.
 */

export enum PieceCategory {
  ARTIFICIAL_INTELLIGENCE = 'ARTIFICIAL_INTELLIGENCE',
  COMMUNICATION = 'COMMUNICATION',
  COMMERCE = 'COMMERCE',
  CORE = 'CORE',
  UNIVERSAL_AI = 'UNIVERSAL_AI',
  FLOW_CONTROL = 'FLOW_CONTROL',
  BUSINESS_INTELLIGENCE = 'BUSINESS_INTELLIGENCE',
  ACCOUNTING = 'ACCOUNTING',
  PRODUCTIVITY = 'PRODUCTIVITY',
  CONTENT_AND_FILES = 'CONTENT_AND_FILES',
  DEVELOPER_TOOLS = 'DEVELOPER_TOOLS',
  CUSTOMER_SUPPORT = 'CUSTOMER_SUPPORT',
  FORMS_AND_SURVEYS = 'FORMS_AND_SURVEYS',
  HUMAN_RESOURCES = 'HUMAN_RESOURCES',
  PAYMENT_PROCESSING = 'PAYMENT_PROCESSING',
  MARKETING = 'MARKETING',
  SALES_AND_CRM = 'SALES_AND_CRM',
}

export enum AppConnectionType {
  OAUTH2 = 'OAUTH2',
  PLATFORM_OAUTH2 = 'PLATFORM_OAUTH2',
  CLOUD_OAUTH2 = 'CLOUD_OAUTH2',
  SECRET_TEXT = 'SECRET_TEXT',
  BASIC_AUTH = 'BASIC_AUTH',
  CUSTOM_AUTH = 'CUSTOM_AUTH',
  NO_AUTH = 'NO_AUTH',
}

export enum ExecutionType {
  BEGIN = 'BEGIN',
  RESUME = 'RESUME',
}

export enum TriggerStrategy {
  POLLING = 'POLLING',
  WEBHOOK = 'WEBHOOK',
  APP_WEBHOOK = 'APP_WEBHOOK',
  MANUAL = 'MANUAL',
}

export enum TriggerTestStrategy {
  TEST_FUNCTION = 'TEST_FUNCTION',
  SIMULATION = 'SIMULATION',
}

export enum WebhookHandshakeStrategy {
  NONE = 'NONE',
  HEADER_PRESENT = 'HEADER_PRESENT',
  QUERY_PRESENT = 'QUERY_PRESENT',
  BODY_PARAM_PRESENT = 'BODY_PARAM_PRESENT',
}

export enum PauseType {
  DELAY = 'DELAY',
  WEBHOOK = 'WEBHOOK',
}

export enum OAuth2GrantType {
  AUTHORIZATION_CODE = 'authorization_code',
  CLIENT_CREDENTIALS = 'client_credentials',
}

export enum MarkdownVariant {
  INFO = 'INFO',
  WARNING = 'WARNING',
  TIP = 'TIP',
}

export const BOTH_CLIENT_CREDENTIALS_AND_AUTHORIZATION_CODE = 'both';

export type WebhookHandshakeConfiguration = {
  strategy: WebhookHandshakeStrategy;
  paramName?: string;
};

export type EventPayload<B = unknown> = {
  body: B;
  rawBody?: unknown;
  method: string;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
};

export type ParseEventResponse = {
  event?: string;
  identifierValue?: string;
  reply?: {
    headers: Record<string, string>;
    body: unknown;
  };
};

export type AppConnectionValue<
  _T extends AppConnectionType = AppConnectionType,
  _Props extends Record<string, unknown> = Record<string, unknown>,
> = {
  type: AppConnectionType;
  [key: string]: unknown;
};

export type TriggerPayload = Record<string, unknown>;
export type RespondResponse = { status?: number; body?: unknown; headers?: Record<string, string> };
export type ResumePayload = {
  queryParams?: Record<string, string>;
  [key: string]: unknown;
};
export type FlowRunId = string;
export type ProjectId = string;
export type PopulatedFlow = Record<string, unknown>;
export type SeekPage<T> = { data: T[]; next?: string | null; previous?: string | null };
export type AgentPieceTool = Record<string, unknown>;

export type DelayPauseMetadata = { type: PauseType.DELAY; resumeDateTime: string };
export type WebhookPauseMetadata = { type: PauseType.WEBHOOK; response?: RespondResponse };
export type PauseMetadata = DelayPauseMetadata | WebhookPauseMetadata;

export const AUTHENTICATION_PROPERTY_NAME = 'auth';
export const MAX_KEY_LENGTH_FOR_CORWDIN = 500;

export enum LocalesEnum {
  EN = 'en',
}

export enum PackageType {
  ARCHIVE = 'ARCHIVE',
  REGISTRY = 'REGISTRY',
}

export enum PieceType {
  CUSTOM = 'CUSTOM',
  OFFICIAL = 'OFFICIAL',
}

export function assertNotNullOrUndefined<T>(
  value: T | null | undefined,
  fieldName: string,
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`${fieldName} is null or undefined`);
  }
}

export function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export function isEmpty(value: string | unknown[] | null | undefined | object): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}
