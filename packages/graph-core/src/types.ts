export type DocumentMetadata = {
  source: string;
  title: string;
  type?: string;
  url?: string;
  project?: string;
  [key: string]: unknown;
};

export type IndexedDocument = {
  id: string;
  text: string;
  metadata: DocumentMetadata;
  embedding?: number[];
};

export type SearchResult = {
  id: string;
  text: string;
  metadata: DocumentMetadata;
  score: number;
};

export type SearchFilters = {
  source?: string;
  project?: string;
  projectIds?: string[];
  /** When true with projectIds, also match tenant-wide docs (HR, roster, workspace catalog). */
  includeCompanyScope?: boolean;
  type?: string;
  tenantId?: string;
};
