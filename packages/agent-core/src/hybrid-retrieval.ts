import { GraphClient, searchSimilar, type SearchResult } from '@cortex/graph-core';
import type { LlmProvider } from '@cortex/shared';
import {
  fetchLiveGmailMessages,
  formatLiveEmailForContext,
  fetchLiveGitHubContext,
} from '@cortex/shared';
import { searchTenantEs } from '@cortex/shared/graph/elasticsearch-client';

import { toCitations, type SourceCitation } from './retrieval';

export type RetrieveOptions = {
  tenantId?: string;
  projectIds?: string[];
  includeCompanyScope?: boolean;
  provider?: LlmProvider;
  history?: Array<{ role: string; content: string }>;
};

function isGitHubQuery(query: string, history?: RetrieveOptions['history']): boolean {
  const recent = (history ?? [])
    .slice(-4)
    .map((m) => m.content)
    .join(' ');
  const combined = `${query} ${recent}`;
  return (
    /\b(github|git hub|repo|repository|commit|pull request|\bpr\b|merge|branch)\b/i.test(
      combined,
    ) ||
    /\b(access|connect).*\bgithub\b/i.test(combined) ||
    /\b(open|pending).*\b(pr|pull request)/i.test(combined) ||
    /\b(last|latest|recent).*\b(commit|push)/i.test(combined)
  );
}

function isEmailQuery(query: string, history?: RetrieveOptions['history']): boolean {
  const recent = (history ?? [])
    .slice(-4)
    .map((m) => m.content)
    .join(' ');
  const combined = `${query} ${recent}`;
  return (
    /\b(mail|email|gmail|inbox)\b/i.test(combined) ||
    /\b(latest|recent|last|newest)\b.*\b(email|mail|message)\b/i.test(combined) ||
    /\b(from who|who sent|who is it from|when was it|that email|this email|the sender|sent it)\b/i.test(
      query,
    )
  );
}

const ENTITY_PATTERNS = [
  /\b(?:project|feature|ticket|issue)\s+([A-Za-z0-9_-]+)/gi,
  /\bAcme\b/gi,
  /\bBetaCorp\b/gi,
  /\bGlobal Dynamics\b/gi,
  /\b([A-Z]{2,}-\d+)\b/g,
];

function extractEntityHints(query: string): string[] {
  const hints = new Set<string>();
  for (const pattern of ENTITY_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    for (const m of query.matchAll(re)) {
      const val = (m[1] ?? m[0]).trim();
      if (val.length > 1) hints.add(val);
    }
  }
  if (/\bacme\b/i.test(query)) hints.add('Acme');
  if (/\bbetacorp\b/i.test(query)) hints.add('BetaCorp');
  if (/global\s*dynamics/i.test(query)) hints.add('Global Dynamics');
  return [...hints];
}

function rankResults(results: SearchResult[], query: string): SearchResult[] {
  const q = query.toLowerCase();
  return [...results].sort((a, b) => {
    const aBoost =
      (a.metadata.project?.toLowerCase().includes('acme') && q.includes('acme') ? 0.15 : 0) +
      (a.text.toLowerCase().includes('blocked') && q.includes('status') ? 0.1 : 0);
    const bBoost =
      (b.metadata.project?.toLowerCase().includes('acme') && q.includes('acme') ? 0.15 : 0) +
      (b.text.toLowerCase().includes('blocked') && q.includes('status') ? 0.1 : 0);
    const scoreA = a.score + aBoost;
    const scoreB = b.score + bBoost;
    return scoreB - scoreA;
  });
}

/** @deprecated Use retrieval-router.ts and queryDocumentsForUser() instead. */
export async function hybridRetrieveContext(
  query: string,
  topK = 5,
  options?: RetrieveOptions,
): Promise<{ context: string; sources: SourceCitation[]; graphContext: string }> {
  const filters = {
    ...(options?.tenantId ? { tenantId: options.tenantId } : {}),
    ...(options?.projectIds?.length ? { projectIds: options.projectIds } : {}),
    ...(options?.includeCompanyScope ? { includeCompanyScope: true } : {}),
  };
  const hasFilters = Object.keys(filters).length > 0;
  const qLower = query.toLowerCase();
  const wantsGitHub = isGitHubQuery(query, options?.history);
  const sourceHint = wantsGitHub
    ? 'github'
    : /\b(mail|email|gmail|inbox)\b/.test(qLower)
      ? 'gmail'
      : /\b(drive|file|document)\b/.test(qLower)
        ? 'drive'
        : /\b(meeting|calendar|schedule)\b/.test(qLower)
          ? 'calendar'
          : /\b(notion|wiki|page|database)\b/.test(qLower)
            ? 'notion'
            : undefined;

  let vectorResults = rankResults(
    await searchSimilar(query, topK * 2, hasFilters ? filters : undefined),
    query,
  );

  if (sourceHint && options?.tenantId) {
    const focused = await searchSimilar(query, topK, { ...filters, source: sourceHint });
    if (focused.length > 0) {
      const seen = new Set(focused.map((r) => r.id));
      vectorResults = [...focused, ...vectorResults.filter((r) => !seen.has(r.id))].slice(0, topK);
    } else {
      vectorResults = vectorResults.slice(0, topK);
    }
  } else {
    vectorResults = vectorResults.slice(0, topK);
  }

  if (vectorResults.length === 0 && options?.tenantId) {
    const esHits = await searchTenantEs(options.tenantId, query, topK);
    vectorResults = esHits.map((h) => ({
      id: h.id,
      text: h.excerpt,
      metadata: { title: h.title, source: h.source, tenant_id: options.tenantId },
      score: h.score,
    }));
  }
  const hints = extractEntityHints(query);

  const graphLines: string[] = [];
  const graphSources: SourceCitation[] = [];
  const seenNodeIds = new Set<string>();
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && hints.length > 0) {
    try {
      const graph = new GraphClient(dbUrl);
      for (const hint of hints.slice(0, 3)) {
        const nodes = await graph.findNodesByLabel(hint, 5, options?.projectIds);
        for (const node of nodes) {
          if (seenNodeIds.has(node.id)) continue;
          seenNodeIds.add(node.id);
          const { nodes: related, edges } = await graph.traverse(node.id, 2);
          graphLines.push(
            `Entity [${node.type}] ${node.label}: ${JSON.stringify(node.properties)}`,
          );
          graphSources.push({
            id: node.id,
            title: `${node.type} ${node.label}`,
            source: 'graph',
            excerpt: JSON.stringify(node.properties).slice(0, 160),
            score: 1,
          });
          for (const edge of edges) {
            graphLines.push(`  → ${edge.type} → ${edge.toId}`);
          }
          if (related.length > 1) {
            graphLines.push(`  Related: ${related.map((n) => n.label).join(', ')}`);
          }
        }
      }
      await graph.close();
    } catch {
      // graph optional when DB offline
    }
  }

  const dedupedVector = vectorResults.filter(
    (r, i, arr) => arr.findIndex((x) => x.id === r.id) === i,
  );
  const sources = [...toCitations(dedupedVector), ...graphSources];
  let vectorContext = vectorResults
    .map((r, i) => `[${i + 1}] (${r.metadata.source}) ${r.metadata.title}: ${r.text}`)
    .join('\n\n');

  const wantsMail = isEmailQuery(query, options?.history);
  const wantsLatestMail =
    wantsMail &&
    (/\b(latest|recent|last|newest|most recent|just received)\b/i.test(qLower) ||
      /\b(from who|who sent|who is it from|when was it|the sender)\b/i.test(query));

  if (wantsMail && options?.tenantId) {
    const emails = await fetchLiveGmailMessages(options.tenantId, wantsLatestMail ? 1 : 3);
    if (emails.length > 0) {
      const liveBlock = emails.map(formatLiveEmailForContext).join('\n\n');
      vectorContext = [
        `Live Gmail (newest first — use From and Date fields):\n${liveBlock}`,
        vectorContext,
      ]
        .filter(Boolean)
        .join('\n\n');
      for (const email of emails) {
        sources.unshift({
          id: `live-gmail-${email.id}`,
          title: email.subject,
          source: 'gmail',
          excerpt: email.snippet.slice(0, 120),
          score: 1,
          from: email.from,
          date: email.date,
        });
      }
    }
  }

  if (wantsGitHub && options?.tenantId) {
    const liveGitHub = await fetchLiveGitHubContext(options.tenantId);
    if (liveGitHub) {
      vectorContext = [
        `Live GitHub (connected — use this for commits & open PRs):\n${liveGitHub}`,
        vectorContext,
      ]
        .filter(Boolean)
        .join('\n\n');
      sources.unshift({
        id: 'live-github',
        title: 'GitHub (live)',
        source: 'github',
        excerpt: liveGitHub.slice(0, 200),
        score: 1,
      });
    }
  }

  const graphContext = graphLines.length ? graphLines.join('\n') : '';
  const context = [vectorContext, graphContext ? `Knowledge graph:\n${graphContext}` : '']
    .filter(Boolean)
    .join('\n\n');

  return { context, sources, graphContext };
}
