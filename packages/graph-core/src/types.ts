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
  type?: string;
};
