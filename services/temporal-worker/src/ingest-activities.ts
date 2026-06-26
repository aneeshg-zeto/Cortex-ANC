import {
  listDatabases,
  pageTitleFromProperties,
  queryDatabase,
  searchAllPages,
  getPageContent,
} from '@cortex/integration-core/notion';
import {
  getLastSyncedAt,
  getValidAccessToken,
  getGitHubIngestRepos,
  listConnectedProviders,
  listTenantProjects,
  llmClient,
  projectIdForRepo,
  updateLastSyncedAt,
  upsertIngestionProgress,
  workerTenantContext,
  type AccountProvider,
} from '@cortex/shared';
import { upsertNeo4jNode } from '@cortex/shared/graph/neo4j-client';
import pg from 'pg';

import {
  indexChunksBatch,
  indexIngestDocs,
  mapInParallel,
  type IngestDocInput,
} from './ingest-index';
import type { IngestActivityInput } from './types';

const GOOGLE_PROVIDERS = ['google-workspace', 'gmail', 'google'];
const GITHUB_PROVIDERS = ['github'];
const FETCH_CONCURRENCY = 25;
const NOTION_PAGE_CONCURRENCY = 12;
const GITHUB_REPO_CONCURRENCY = 8;

type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

function extractGmailBody(part: GmailPart | undefined): string {
  if (!part) return '';
  if (part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  if (part.parts?.length) {
    const plain = part.parts.find((p) => p.mimeType === 'text/plain');
    if (plain) return extractGmailBody(plain);
    return part.parts
      .map((p) => extractGmailBody(p))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function sanitizeText(text: string): string {
  return text.replace(/\0/g, '').trim();
}

function chunkText(text: string, maxChars = 2000): string[] {
  const clean = sanitizeText(text);
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += maxChars) {
    chunks.push(clean.slice(i, i + maxChars));
  }
  return chunks.length ? chunks : clean ? [clean] : [];
}

function chunkTextWithOverlap(text: string, maxChars = 2048, overlapRatio = 0.1): string[] {
  const clean = sanitizeText(text);
  if (!clean) return [];
  const overlap = Math.floor(maxChars * overlapRatio);
  const step = Math.max(1, maxChars - overlap);
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += step) {
    chunks.push(clean.slice(i, i + maxChars));
    if (i + maxChars >= clean.length) break;
  }
  return chunks.length ? chunks : clean ? [clean] : [];
}

async function resolveSince(
  tenantId: string,
  provider: AccountProvider,
  since?: string,
): Promise<string | undefined> {
  if (since) return since;
  const last = await getLastSyncedAt(tenantId, provider);
  return last ? last.toISOString() : undefined;
}

function gmailSinceQuery(since?: string): string {
  if (!since) return '';
  const d = new Date(since);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `after:${y}/${m}/${day}`;
}

async function updateOnboarding(tenantId: string, patch: Record<string, unknown>): Promise<void> {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(
    `UPDATE tenant_onboarding SET progress = progress || $2::jsonb, updated_at = NOW() WHERE tenant_id = $1`,
    [tenantId, JSON.stringify(patch)],
  );
  await pool.end();
}

export async function resolveIngestProvidersActivity(tenantId: string): Promise<string[]> {
  const connected = await listConnectedProviders(tenantId);
  const providers: string[] = [];
  for (const p of connected) {
    if (p === 'google') providers.push('google-workspace');
    else providers.push(p);
  }
  return providers;
}

export async function ingestGoogleWorkspaceActivity(input: IngestActivityInput): Promise<number> {
  const since = await resolveSince(input.tenantId, 'google', input.since);

  await upsertIngestionProgress(input.tenantId, 'google-workspace', {
    status: 'running',
    total_documents: 0,
    processed_documents: 0,
  });

  const [gmail, drive, calendar, contacts, tasks] = await Promise.all([
    ingestGmailActivity({ tenantId: input.tenantId, since }),
    ingestGoogleDriveActivity({ tenantId: input.tenantId, since }),
    ingestGoogleCalendarActivity({ tenantId: input.tenantId, since }),
    ingestGoogleContactsActivity({ tenantId: input.tenantId, since }),
    ingestGoogleTasksActivity({ tenantId: input.tenantId, since }),
  ]);

  const total = gmail + drive + calendar + contacts + tasks;
  await upsertIngestionProgress(input.tenantId, 'google-workspace', {
    status: 'completed',
    total_documents: total,
    processed_documents: total,
  });
  await updateLastSyncedAt(input.tenantId, 'google');
  return total;
}

export async function ingestGmailActivity(input: IngestActivityInput): Promise<number> {
  const token = await getValidAccessToken('google', input.tenantId);
  if (!token) return 0;

  const since = await resolveSince(input.tenantId, 'google', input.since);
  const q = gmailSinceQuery(since);
  const messages: Array<{ id: string }> = [];
  let pageToken: string | undefined;

  do {
    const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    url.searchParams.set('maxResults', '500');
    if (q) url.searchParams.set('q', q);
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const listRes = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (!listRes.ok) break;

    const list = (await listRes.json()) as {
      messages?: Array<{ id: string }>;
      nextPageToken?: string;
    };
    messages.push(...(list.messages ?? []));
    pageToken = list.nextPageToken;
  } while (pageToken);

  const docs: IngestDocInput[] = [];

  await mapInParallel(messages, FETCH_CONCURRENCY, async (msg) => {
    const detail = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!detail.ok) return;
    const data = (await detail.json()) as {
      snippet?: string;
      payload?: GmailPart & { headers?: Array<{ name: string; value: string }> };
    };
    const subject =
      data.payload?.headers?.find((h) => h.name.toLowerCase() === 'subject')?.value ?? 'Email';
    const body = extractGmailBody(data.payload).trim() || (data.snippet ?? '');
    if (!body.trim()) return;
    docs.push({
      tenantId: input.tenantId,
      docId: `${input.tenantId}:gmail:${msg.id}`,
      text: body.slice(0, 100_000),
      title: subject,
      source: 'gmail',
      type: 'email',
      url: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`,
    });
  });

  const count = await indexIngestDocs(docs, chunkText);

  await updateOnboarding(input.tenantId, { gmail: count });
  return count;
}

export async function ingestGoogleDriveActivity(input: IngestActivityInput): Promise<number> {
  const token = await getValidAccessToken('google', input.tenantId);
  if (!token) return 0;

  const since = await resolveSince(input.tenantId, 'google', input.since);
  const driveQ = since ? `trashed=false and modifiedTime > '${since}'` : 'trashed=false';

  const allFiles: Array<{ id: string; name: string; mimeType: string }> = [];
  let pageToken: string | undefined;

  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('pageSize', '200');
    url.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType)');
    url.searchParams.set('q', driveQ);
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const listRes = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!listRes.ok) break;
    const list = (await listRes.json()) as {
      files?: Array<{ id: string; name: string; mimeType: string }>;
      nextPageToken?: string;
    };
    allFiles.push(...(list.files ?? []));
    pageToken = list.nextPageToken;
  } while (pageToken);

  const GOOGLE_EXPORT: Record<string, string> = {
    'application/vnd.google-apps.document': 'text/plain',
    'application/vnd.google-apps.spreadsheet': 'text/csv',
    'application/vnd.google-apps.presentation': 'text/plain',
  };

  const docResults = await mapInParallel(allFiles, FETCH_CONCURRENCY, async (file) => {
    let text = '';
    const exportMime = GOOGLE_EXPORT[file.mimeType];
    if (exportMime) {
      const exportRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=${encodeURIComponent(exportMime)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (exportRes.ok) text = (await exportRes.text()).slice(0, 50_000);
    } else {
      const exportable =
        file.mimeType.startsWith('text/') ||
        file.mimeType === 'application/json' ||
        file.mimeType === 'application/javascript' ||
        file.mimeType === 'application/pdf';
      if (!exportable) return null;
      const contentRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!contentRes.ok) return null;
      text = (await contentRes.text()).slice(0, 50_000);
    }
    if (!text.trim()) return null;
    const doc: IngestDocInput = {
      tenantId: input.tenantId,
      docId: `${input.tenantId}:drive:${file.id}`,
      text,
      title: file.name,
      source: 'drive',
      type: 'file',
      url: `https://drive.google.com/file/d/${file.id}/view`,
    };
    return doc;
  });

  const docs = docResults.filter((d): d is IngestDocInput => d !== null);

  const count = await indexIngestDocs(docs, chunkText);
  await updateOnboarding(input.tenantId, { drive: count });
  return count;
}

export async function ingestGoogleCalendarActivity(input: IngestActivityInput): Promise<number> {
  const token = await getValidAccessToken('google', input.tenantId);
  if (!token) return 0;

  const since = await resolveSince(input.tenantId, 'google', input.since);
  const now = new Date();
  const min = since ?? new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const max = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();

  const docs: IngestDocInput[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.set('timeMin', min);
    url.searchParams.set('timeMax', max);
    url.searchParams.set('maxResults', '250');
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const listRes = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!listRes.ok) break;

    type CalendarEvent = {
      id: string;
      summary?: string;
      description?: string;
      htmlLink?: string;
      start?: { dateTime?: string; date?: string; timeZone?: string };
      end?: { dateTime?: string; date?: string; timeZone?: string };
      location?: string;
      status?: string;
      attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
      organizer?: { email?: string; displayName?: string };
      conferenceData?: { entryPoints?: Array<{ uri: string; entryPointType: string }> };
    };

    const list = (await listRes.json()) as {
      items?: CalendarEvent[];
      nextPageToken?: string;
    };

    for (const event of list.items ?? []) {
      docs.push({
        tenantId: input.tenantId,
        docId: `${input.tenantId}:calendar:${event.id}`,
        text: `${event.summary ?? 'Event'}\n${event.description ?? ''}`,
        title: event.summary ?? 'Calendar event',
        source: 'calendar',
        type: 'event',
        url: event.htmlLink,
        extraMeta: {
          start: event.start,
          end: event.end,
          location: event.location,
          status: event.status,
          attendees: event.attendees,
          organizer: event.organizer,
          conferenceData: event.conferenceData,
        },
      });
    }
    pageToken = list.nextPageToken;
  } while (pageToken);

  const count = await indexIngestDocs(docs, chunkText);
  await updateOnboarding(input.tenantId, { calendar: count });
  return count;
}

export async function ingestGoogleContactsActivity(input: IngestActivityInput): Promise<number> {
  const token = await getValidAccessToken('google', input.tenantId);
  if (!token) return 0;

  const listRes = await fetch(
    'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,organizations&pageSize=500',
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!listRes.ok) return 0;
  const list = (await listRes.json()) as {
    connections?: Array<{
      resourceName?: string;
      names?: Array<{ displayName?: string }>;
      emailAddresses?: Array<{ value?: string }>;
      organizations?: Array<{ name?: string }>;
    }>;
  };

  const docs: IngestDocInput[] = [];
  for (const person of list.connections ?? []) {
    const name = person.names?.[0]?.displayName ?? 'Contact';
    const email = person.emailAddresses?.[0]?.value ?? '';
    const org = person.organizations?.[0]?.name ?? '';
    const id = person.resourceName?.replace('people/', '') ?? name;
    docs.push({
      tenantId: input.tenantId,
      docId: `${input.tenantId}:contact:${id}`,
      text: `${name}\n${email}\n${org}`,
      title: name,
      source: 'contacts',
      type: 'contact',
    });
    await upsertNeo4jNode(input.tenantId, 'Person', {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
    });
  }

  const count = await indexIngestDocs(docs, chunkText);

  await updateOnboarding(input.tenantId, { contacts: count });
  return count;
}

export async function ingestGoogleTasksActivity(input: IngestActivityInput): Promise<number> {
  const token = await getValidAccessToken('google', input.tenantId);
  if (!token) return 0;

  const listsRes = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listsRes.ok) return 0;
  const lists = (await listsRes.json()) as { items?: Array<{ id: string; title: string }> };

  const docs: IngestDocInput[] = [];
  for (const list of lists.items ?? []) {
    const tasksRes = await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/${list.id}/tasks?maxResults=100`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!tasksRes.ok) continue;
    const tasks = (await tasksRes.json()) as {
      items?: Array<{ id: string; title?: string; notes?: string; updated?: string }>;
    };
    for (const task of tasks.items ?? []) {
      if (input.since && task.updated && task.updated < input.since) continue;
      docs.push({
        tenantId: input.tenantId,
        docId: `${input.tenantId}:task:${list.id}:${task.id}`,
        text: `${task.title ?? 'Task'}\n${task.notes ?? ''}`,
        title: task.title ?? 'Task',
        source: 'tasks',
        type: 'task',
        extraMeta: { list: list.title },
      });
    }
  }

  const count = await indexIngestDocs(docs, chunkText);
  await updateOnboarding(input.tenantId, { tasks: count });
  return count;
}

export async function ingestGitHubActivity(input: IngestActivityInput): Promise<number> {
  const token = await getValidAccessToken('github', input.tenantId);
  if (!token) return 0;

  const since = await resolveSince(input.tenantId, 'github', input.since);
  const tenantCtx = workerTenantContext(input.tenantId);
  const scopedRepos = await getGitHubIngestRepos(tenantCtx);
  const projects = await listTenantProjects(tenantCtx);

  if (!scopedRepos.length) {
    await upsertIngestionProgress(input.tenantId, 'github', {
      status: 'pending',
      total_documents: 0,
      processed_documents: 0,
    });
    return 0;
  }

  await upsertIngestionProgress(input.tenantId, 'github', {
    status: 'running',
    total_documents: scopedRepos.length * 20,
    processed_documents: 0,
  });

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
  };
  const reposRes = await fetch(
    'https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member',
    { headers },
  );
  if (!reposRes.ok) {
    await upsertIngestionProgress(input.tenantId, 'github', { status: 'failed' });
    return 0;
  }
  const allRepos = (await reposRes.json()) as Array<{
    full_name: string;
    html_url: string;
    default_branch?: string;
  }>;
  const allowed = new Set(scopedRepos);
  const repos = allRepos.filter((repo) => allowed.has(repo.full_name));

  const repoCounts = await mapInParallel(repos, GITHUB_REPO_CONCURRENCY, async (repo) => {
    const clientProjectId = projectIdForRepo(projects, repo.full_name);
    const repoMeta = {
      project: repo.full_name,
      ...(clientProjectId ? { clientProjectId } : {}),
    };
    await upsertNeo4jNode(input.tenantId, 'Project', {
      id: repo.full_name,
      name: repo.full_name,
      ...(clientProjectId ? { clientProjectId } : {}),
    });

    const sinceParam = since ? `&since=${encodeURIComponent(since)}` : '';
    const [issuesRes, prsRes, commitsRes, contentsRes] = await Promise.all([
      fetch(
        `https://api.github.com/repos/${repo.full_name}/issues?state=all&per_page=100${sinceParam}`,
        { headers },
      ),
      fetch(`https://api.github.com/repos/${repo.full_name}/pulls?state=all&per_page=100`, {
        headers,
      }),
      fetch(`https://api.github.com/repos/${repo.full_name}/commits?per_page=100${sinceParam}`, {
        headers,
      }),
      fetch(`https://api.github.com/repos/${repo.full_name}/contents`, { headers }),
    ]);

    const repoDocs: IngestDocInput[] = [];

    if (issuesRes.ok) {
      const issues = (await issuesRes.json()) as Array<{
        number: number;
        title: string;
        body?: string;
        html_url: string;
        pull_request?: unknown;
      }>;
      for (const issue of issues) {
        if (issue.pull_request) continue;
        repoDocs.push({
          tenantId: input.tenantId,
          docId: `${input.tenantId}:github:issue:${repo.full_name}:${issue.number}`,
          text: `${issue.title}\n${issue.body ?? ''}`,
          title: issue.title,
          source: 'github',
          type: 'issue',
          url: issue.html_url,
          extraMeta: repoMeta,
        });
      }
    }

    if (prsRes.ok) {
      const prs = (await prsRes.json()) as Array<{
        number: number;
        title: string;
        body?: string;
        html_url: string;
        updated_at?: string;
      }>;
      for (const pr of prs) {
        if (since && pr.updated_at && pr.updated_at < since) continue;
        repoDocs.push({
          tenantId: input.tenantId,
          docId: `${input.tenantId}:github:pr:${repo.full_name}:${pr.number}`,
          text: `${pr.title}\n${pr.body ?? ''}`,
          title: pr.title,
          source: 'github',
          type: 'pull_request',
          url: pr.html_url,
          extraMeta: repoMeta,
        });
      }
    }

    if (commitsRes.ok) {
      const commits = (await commitsRes.json()) as Array<{
        sha: string;
        commit: { message: string };
        html_url: string;
      }>;
      for (const commit of commits) {
        repoDocs.push({
          tenantId: input.tenantId,
          docId: `${input.tenantId}:github:commit:${repo.full_name}:${commit.sha}`,
          text: commit.commit.message,
          title: commit.commit.message.split('\n')[0] ?? 'Commit',
          source: 'github',
          type: 'commit',
          url: commit.html_url,
          extraMeta: repoMeta,
        });
      }
    }

    if (contentsRes.ok) {
      const entries = (await contentsRes.json()) as Array<{
        name: string;
        path: string;
        type: string;
        download_url?: string;
      }>;
      const fileDocs = await mapInParallel(
        entries.filter((e) => e.type === 'file'),
        FETCH_CONCURRENCY,
        async (entry): Promise<IngestDocInput | null> => {
          const ext = entry.name.split('.').pop()?.toLowerCase();
          if (!ext || !['ts', 'tsx', 'js', 'md', 'json'].includes(ext)) return null;
          if (!entry.download_url) return null;
          const fileRes = await fetch(entry.download_url, { headers });
          if (!fileRes.ok) return null;
          return {
            tenantId: input.tenantId,
            docId: `${input.tenantId}:github:file:${repo.full_name}:${entry.path}`,
            text: (await fileRes.text()).slice(0, 30_000),
            title: entry.path,
            source: 'github',
            type: 'source_file',
            url: `https://github.com/${repo.full_name}/blob/${repo.default_branch ?? 'main'}/${entry.path}`,
            extraMeta: repoMeta,
          };
        },
      );
      repoDocs.push(...fileDocs.filter((d): d is IngestDocInput => d !== null));
    }

    return indexIngestDocs(repoDocs, chunkText);
  });

  const count = repoCounts.reduce((sum, n) => sum + n, 0);

  await upsertIngestionProgress(input.tenantId, 'github', {
    status: 'completed',
    total_documents: count,
    processed_documents: count,
  });
  await updateLastSyncedAt(input.tenantId, 'github');
  await updateOnboarding(input.tenantId, { github: count });
  return count;
}

type NotionPageRef = {
  id: string;
  title: string;
  url?: string;
  lastEdited?: string;
  properties?: Record<string, unknown>;
};

export async function ingestNotionActivity(input: IngestActivityInput): Promise<number> {
  const token = await getValidAccessToken('notion', input.tenantId);
  if (!token) return 0;

  const since = await resolveSince(input.tenantId, 'notion', input.since);
  const sinceMs = since ? new Date(since).getTime() : 0;

  await upsertIngestionProgress(input.tenantId, 'notion', {
    status: 'running',
    total_documents: 50,
    processed_documents: 0,
  });

  const pageRefs = new Map<string, NotionPageRef>();

  const standalonePages = await searchAllPages(token);
  for (const item of standalonePages) {
    if (item.object !== 'page' || !('id' in item)) continue;
    const page = item as {
      id: string;
      url?: string | null;
      last_edited_time?: string;
      properties?: Record<string, unknown>;
    };
    if (sinceMs && page.last_edited_time && new Date(page.last_edited_time).getTime() < sinceMs) {
      continue;
    }
    pageRefs.set(page.id, {
      id: page.id,
      title: pageTitleFromProperties(page.properties),
      url: page.url ?? undefined,
      lastEdited: page.last_edited_time,
      properties: page.properties,
    });
  }

  const databases = await listDatabases(token);
  for (const item of databases) {
    if (item.object !== 'database' || !('id' in item)) continue;
    const rows = await queryDatabase(token, item.id);
    for (const row of rows) {
      if (row.object !== 'page' || !('id' in row)) continue;
      const page = row as {
        id: string;
        url?: string | null;
        last_edited_time?: string;
        properties?: Record<string, unknown>;
      };
      if (sinceMs && page.last_edited_time && new Date(page.last_edited_time).getTime() < sinceMs) {
        continue;
      }
      pageRefs.set(page.id, {
        id: page.id,
        title: pageTitleFromProperties(page.properties),
        url: page.url ?? undefined,
        lastEdited: page.last_edited_time,
        properties: page.properties,
      });
    }
  }

  const pages = [...pageRefs.values()];
  const total = pages.length;
  await upsertIngestionProgress(input.tenantId, 'notion', {
    total_documents: total,
    processed_documents: 0,
    status: 'running',
  });

  const pageResults = await mapInParallel(pages, NOTION_PAGE_CONCURRENCY, async (page) => {
    try {
      const text = await getPageContent(token, page.id);
      if (!text.trim()) return { chunks: 0, processed: 1 };

      const chunks = chunkTextWithOverlap(text);
      const ingestChunks = chunks.map((chunk, i) => ({
        id:
          i === 0
            ? `${input.tenantId}:notion:${page.id}`
            : `${input.tenantId}:notion:${page.id}:${i}`,
        text: chunk,
        title: page.title,
        source: 'notion',
        type: 'page',
        tenantId: input.tenantId,
        url: page.url,
        docId: `${input.tenantId}:notion:${page.id}`,
        extraMeta: { last_edited: page.lastEdited },
      }));

      const indexed = await indexChunksBatch(ingestChunks);

      await upsertNeo4jNode(input.tenantId, 'Document', {
        id: `${input.tenantId}:notion:${page.id}`,
        title: page.title,
        source: 'notion',
      });

      if (process.env.USE_LLM_ENTITY_EXTRACTION === 'true') {
        const entityRaw = await llmClient.complete(
          `Extract JSON {people:[],projects:[],concepts:[]} from this Notion page text. Return only JSON.\n${text.slice(0, 2000)}`,
          { temperature: 0, maxTokens: 512 },
        );
        try {
          const parsed = JSON.parse(entityRaw.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as {
            people?: string[];
            projects?: string[];
            concepts?: string[];
          };
          for (const p of parsed.people ?? []) {
            await upsertNeo4jNode(input.tenantId, 'Person', {
              id: p.toLowerCase().replace(/\s+/g, '-'),
              name: p,
            });
          }
          for (const p of parsed.projects ?? []) {
            await upsertNeo4jNode(input.tenantId, 'Project', {
              id: p.toLowerCase().replace(/\s+/g, '-'),
              name: p,
            });
          }
          for (const c of parsed.concepts ?? []) {
            await upsertNeo4jNode(input.tenantId, 'Concept', {
              id: c.toLowerCase().replace(/\s+/g, '-'),
              name: c,
            });
          }
        } catch {
          // skip entity parse errors
        }
      }

      return { chunks: indexed, processed: 1 };
    } catch {
      return { chunks: 0, processed: 1 };
    }
  });

  const count = pageResults.reduce((sum, r) => sum + r.chunks, 0);
  const processed = pageResults.reduce((sum, r) => sum + r.processed, 0);

  await upsertIngestionProgress(input.tenantId, 'notion', {
    status: 'completed',
    total_documents: total,
    processed_documents: processed,
  });
  await updateLastSyncedAt(input.tenantId, 'notion');
  await updateOnboarding(input.tenantId, { notion: count });
  return count;
}

export async function extractEntitiesActivity(input: {
  tenantId: string;
  sampleText: string;
}): Promise<number> {
  const raw = await llmClient.complete(
    `Extract JSON {people:[],projects:[],departments:[]} from text:\n${input.sampleText.slice(0, 1500)}`,
    { temperature: 0, maxTokens: 512 },
  );
  let nodes = 0;
  try {
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as {
      people?: string[];
      projects?: string[];
    };
    for (const p of parsed.people ?? []) {
      await upsertNeo4jNode(input.tenantId, 'Person', {
        id: p.toLowerCase().replace(/\s+/g, '-'),
        name: p,
      });
      nodes += 1;
    }
    for (const p of parsed.projects ?? []) {
      await upsertNeo4jNode(input.tenantId, 'Project', {
        id: p.toLowerCase().replace(/\s+/g, '-'),
        name: p,
      });
      nodes += 1;
    }
  } catch {
    // skip
  }
  return nodes;
}

export async function markIngestCompleteActivity(tenantId: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query('REINDEX INDEX IF EXISTS cortex_documents_embedding_idx');
  } catch {
    // non-fatal if index missing
  }
  await pool.query(
    `UPDATE ingestion_progress SET status = 'completed', updated_at = NOW()
     WHERE tenant_id = $1 AND status = 'running'`,
    [tenantId],
  );
  await pool.query(
    `UPDATE tenant_onboarding SET status = 'complete', step = 'done', updated_at = NOW() WHERE tenant_id = $1`,
    [tenantId],
  );
  await pool.end();
}

export function providerKind(provider: string): 'google' | 'github' | 'other' {
  if (GOOGLE_PROVIDERS.includes(provider)) return 'google';
  if (GITHUB_PROVIDERS.includes(provider)) return 'github';
  return 'other';
}
