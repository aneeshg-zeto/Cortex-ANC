/** Connector ingestion adapter types — implementations live in per-source adapters. */

import type { ConnectorSource } from './constants';

export type { ConnectorSource };

export type DocumentType =
  | 'email'
  | 'issue'
  | 'pull_request'
  | 'page'
  | 'message'
  | 'thread'
  | 'calendar_event'
  | 'file'
  | 'commit'
  | 'comment'
  | 'ticket';

export interface ACLPolicy {
  visibility: 'public' | 'role' | 'user' | 'team';
  allowedRoles?: string[];
  allowedUserIds?: string[];
  allowedTeamIds?: string[];
  sourcePermission: string;
}

export interface ContentChunk {
  index: number;
  text: string;
  tokenCount: number;
  heading?: string;
}

export interface EntityRef {
  type: 'person' | 'project' | 'ticket' | 'repo';
  id: string;
  displayName: string;
  email?: string;
}

export interface UnifiedDocument {
  /** Deterministic: sha256(source + sourceId + tenantId) */
  id: string;
  tenantId: string;
  source: ConnectorSource;
  sourceId: string;
  sourceUrl: string;
  title: string;
  contentChunks: ContentChunk[];
  embedding?: number[];
  acl: ACLPolicy;
  entityRefs: EntityRef[];
  parentDocId?: string;
  cursor: string;
  /** sha256 of raw content, for dedup */
  contentHash: string;
  type: DocumentType;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface RawItem {
  id: string;
  raw: unknown;
  fetchedAt: Date;
}

export interface ConnectorCreds {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  extra?: Record<string, unknown>;
}

export interface TenantContext {
  tenantId: string;
  userId: string;
  userRole: string;
}

export interface ConnectorAdapter {
  source: ConnectorSource;
  fetchSince(
    cursor: string | null,
    creds: ConnectorCreds,
    ctx: TenantContext,
  ): AsyncGenerator<RawItem>;
  normalize(raw: RawItem, ctx: TenantContext): Omit<UnifiedDocument, 'embedding'>;
  parseACL(raw: RawItem, ctx: TenantContext): ACLPolicy;
  nextCursor(lastItem: RawItem): string;
}
