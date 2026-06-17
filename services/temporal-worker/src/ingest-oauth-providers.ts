import {
  getConnectedAccount,
  getLastSyncedAt,
  getValidAccessToken,
  updateLastSyncedAt,
  upsertIngestionProgress,
} from '@cortex/shared';
import { searchAllConfluencePages } from '@cortex/integration-core/confluence';
import { searchAllJiraIssues } from '@cortex/integration-core/jira';
import { listLinearIssues } from '@cortex/integration-core/linear-read';
import { listLoomVideos } from '@cortex/integration-core/loom';
import { fetchAllMiroContent } from '@cortex/integration-core/miro';

import { indexIngestDocs, type IngestDocInput } from './ingest-index';
import type { IngestActivityInput } from './types';

function chunkText(text: string, maxChars = 2000): string[] {
  const clean = text.replace(/\0/g, '').trim();
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += maxChars) {
    chunks.push(clean.slice(i, i + maxChars));
  }
  return chunks.length ? chunks : clean ? [clean] : [];
}

async function resolveSince(
  tenantId: string,
  provider: string,
  since?: string,
): Promise<string | undefined> {
  if (since) return since;
  const last = await getLastSyncedAt(tenantId, provider);
  return last ? last.toISOString() : undefined;
}

export async function ingestSlackActivity(input: IngestActivityInput): Promise<number> {
  const token = await getValidAccessToken('slack', input.tenantId);
  if (!token) return 0;

  await upsertIngestionProgress(input.tenantId, 'slack', {
    status: 'running',
    total_documents: 100,
    processed_documents: 0,
  });

  const since = await resolveSince(input.tenantId, 'slack', input.since);
  const sinceTs = since ? String(Math.floor(new Date(since).getTime() / 1000)) : undefined;

  const listRes = await fetch(
    'https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=50',
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const list = (await listRes.json()) as {
    ok?: boolean;
    channels?: Array<{ id: string; name: string }>;
  };
  if (!list.ok || !list.channels) {
    await upsertIngestionProgress(input.tenantId, 'slack', { status: 'failed' });
    return 0;
  }

  const docs: IngestDocInput[] = [];
  for (const ch of list.channels.slice(0, 20)) {
    const histUrl = sinceTs
      ? `https://slack.com/api/conversations.history?channel=${ch.id}&limit=100&oldest=${sinceTs}`
      : `https://slack.com/api/conversations.history?channel=${ch.id}&limit=100`;
    const histRes = await fetch(histUrl, { headers: { Authorization: `Bearer ${token}` } });
    const hist = (await histRes.json()) as {
      ok?: boolean;
      messages?: Array<{ ts: string; text?: string; user?: string }>;
    };
    if (!hist.ok) continue;
    for (const msg of hist.messages ?? []) {
      if (!msg.text?.trim()) continue;
      docs.push({
        tenantId: input.tenantId,
        docId: `${input.tenantId}:slack:${ch.id}:${msg.ts}`,
        text: msg.text,
        title: `#${ch.name}`,
        source: 'slack',
        type: 'message',
        extraMeta: { channel: ch.name, user: msg.user },
      });
    }
  }

  const count = await indexIngestDocs(docs, chunkText);
  await upsertIngestionProgress(input.tenantId, 'slack', {
    status: 'completed',
    total_documents: count,
    processed_documents: count,
  });
  await updateLastSyncedAt(input.tenantId, 'slack');
  return count;
}

export async function ingestDiscordActivity(input: IngestActivityInput): Promise<number> {
  const token = await getValidAccessToken('discord', input.tenantId);
  if (!token) return 0;

  await upsertIngestionProgress(input.tenantId, 'discord', {
    status: 'running',
    total_documents: 50,
    processed_documents: 0,
  });

  const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!guildsRes.ok) {
    await upsertIngestionProgress(input.tenantId, 'discord', { status: 'failed' });
    return 0;
  }
  const guilds = (await guildsRes.json()) as Array<{ id: string; name: string }>;
  const docs: IngestDocInput[] = [];

  for (const guild of guilds.slice(0, 5)) {
    const chRes = await fetch(`https://discord.com/api/guilds/${guild.id}/channels`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!chRes.ok) continue;
    const channels = (await chRes.json()) as Array<{ id: string; name: string; type: number }>;
    for (const ch of channels.filter((c) => c.type === 0).slice(0, 5)) {
      const msgRes = await fetch(`https://discord.com/api/channels/${ch.id}/messages?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!msgRes.ok) continue;
      const messages = (await msgRes.json()) as Array<{ id: string; content: string }>;
      for (const msg of messages) {
        if (!msg.content?.trim()) continue;
        docs.push({
          tenantId: input.tenantId,
          docId: `${input.tenantId}:discord:${guild.id}:${msg.id}`,
          text: msg.content,
          title: `${guild.name} / #${ch.name}`,
          source: 'discord',
          type: 'message',
          extraMeta: { guild: guild.name, channel: ch.name },
        });
      }
    }
  }

  const count = await indexIngestDocs(docs, chunkText);
  await upsertIngestionProgress(input.tenantId, 'discord', {
    status: 'completed',
    total_documents: count,
    processed_documents: count,
  });
  await updateLastSyncedAt(input.tenantId, 'discord');
  return count;
}

export async function ingestTrelloActivity(input: IngestActivityInput): Promise<number> {
  const creds = await getConnectedAccount(input.tenantId, 'trello');
  if (!creds) return 0;
  const apiKey = creds.refreshToken ?? '';
  const apiToken = creds.accessToken;
  if (!apiKey || !apiToken) return 0;

  await upsertIngestionProgress(input.tenantId, 'trello', {
    status: 'running',
    total_documents: 50,
    processed_documents: 0,
  });

  const boardsRes = await fetch(
    `https://api.trello.com/1/members/me/boards?key=${encodeURIComponent(apiKey)}&token=${encodeURIComponent(apiToken)}`,
  );
  if (!boardsRes.ok) {
    await upsertIngestionProgress(input.tenantId, 'trello', { status: 'failed' });
    return 0;
  }
  const boards = (await boardsRes.json()) as Array<{ id: string; name: string }>;
  const docs: IngestDocInput[] = [];

  for (const board of boards.slice(0, 10)) {
    const cardsRes = await fetch(
      `https://api.trello.com/1/boards/${board.id}/cards?key=${encodeURIComponent(apiKey)}&token=${encodeURIComponent(apiToken)}`,
    );
    if (!cardsRes.ok) continue;
    const cards = (await cardsRes.json()) as Array<{ id: string; name: string; desc?: string }>;
    for (const card of cards) {
      docs.push({
        tenantId: input.tenantId,
        docId: `${input.tenantId}:trello:${card.id}`,
        text: `${card.name}\n${card.desc ?? ''}`,
        title: card.name,
        source: 'trello',
        type: 'card',
        extraMeta: { board: board.name },
      });
    }
  }

  const count = await indexIngestDocs(docs, chunkText);
  await upsertIngestionProgress(input.tenantId, 'trello', {
    status: 'completed',
    total_documents: count,
    processed_documents: count,
  });
  await updateLastSyncedAt(input.tenantId, 'trello');
  return count;
}

export async function ingestJiraActivity(input: IngestActivityInput): Promise<number> {
  const token = await getValidAccessToken('jira', input.tenantId);
  if (!token) return 0;

  await upsertIngestionProgress(input.tenantId, 'jira', {
    status: 'running',
    total_documents: 100,
    processed_documents: 0,
  });

  const since = await resolveSince(input.tenantId, 'jira', input.since);
  const issues = await searchAllJiraIssues(token, since);
  const docs: IngestDocInput[] = issues.map((issue) => ({
    tenantId: input.tenantId,
    docId: `${input.tenantId}:jira:${issue.key}`,
    text: `${issue.summary}\n${issue.description}`,
    title: issue.summary,
    source: 'jira',
    type: 'issue',
    url: issue.url,
    extraMeta: { site: issue.siteName },
  }));

  const count = await indexIngestDocs(docs, chunkText);
  await upsertIngestionProgress(input.tenantId, 'jira', {
    status: 'completed',
    total_documents: count,
    processed_documents: count,
  });
  await updateLastSyncedAt(input.tenantId, 'jira');
  return count;
}

export async function ingestMicrosoft365Activity(input: IngestActivityInput): Promise<number> {
  const token = await getValidAccessToken('microsoft-365', input.tenantId);
  if (!token) return 0;

  await upsertIngestionProgress(input.tenantId, 'microsoft-365', {
    status: 'running',
    total_documents: 100,
    processed_documents: 0,
  });

  const docs: IngestDocInput[] = [];
  const mailRes = await fetch(
    'https://graph.microsoft.com/v1.0/me/messages?$top=100&$select=subject,bodyPreview,receivedDateTime,webLink',
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (mailRes.ok) {
    const mail = (await mailRes.json()) as {
      value?: Array<{ id: string; subject?: string; bodyPreview?: string; webLink?: string }>;
    };
    for (const m of mail.value ?? []) {
      docs.push({
        tenantId: input.tenantId,
        docId: `${input.tenantId}:m365:mail:${m.id}`,
        text: `${m.subject ?? 'Email'}\n${m.bodyPreview ?? ''}`,
        title: m.subject ?? 'Email',
        source: 'microsoft-365',
        type: 'email',
        url: m.webLink,
      });
    }
  }

  const count = await indexIngestDocs(docs, chunkText);
  await upsertIngestionProgress(input.tenantId, 'microsoft-365', {
    status: 'completed',
    total_documents: count,
    processed_documents: count,
  });
  await updateLastSyncedAt(input.tenantId, 'microsoft-365');
  return count;
}

export async function ingestOAuthPlaceholderActivity(
  input: IngestActivityInput & { provider: string },
): Promise<number> {
  const token = await getValidAccessToken(input.provider, input.tenantId);
  if (!token) return 0;

  await upsertIngestionProgress(input.tenantId, input.provider, {
    status: 'running',
    total_documents: 0,
    processed_documents: 0,
  });

  console.error({
    section: 'ingest-oauth-placeholder',
    tenantId: input.tenantId,
    provider: input.provider,
    message: 'Connected; bespoke ingest pending',
  });

  await upsertIngestionProgress(input.tenantId, input.provider, {
    status: 'completed',
    total_documents: 0,
    processed_documents: 0,
  });
  await updateLastSyncedAt(input.tenantId, input.provider);
  return 0;
}

async function ingestFromNativeClient(
  input: IngestActivityInput,
  provider: string,
  fetchDocs: () => Promise<IngestDocInput[]>,
): Promise<number> {
  await upsertIngestionProgress(input.tenantId, provider, {
    status: 'running',
    total_documents: 50,
    processed_documents: 0,
  });
  try {
    const docs = await fetchDocs();
    const count = await indexIngestDocs(docs, chunkText);
    await upsertIngestionProgress(input.tenantId, provider, {
      status: 'completed',
      total_documents: count,
      processed_documents: count,
    });
    await updateLastSyncedAt(input.tenantId, provider);
    return count;
  } catch (error) {
    console.error({ section: 'ingest-native', tenantId: input.tenantId, provider, error });
    await upsertIngestionProgress(input.tenantId, provider, { status: 'failed' });
    return 0;
  }
}

export async function ingestConfluenceActivity(input: IngestActivityInput): Promise<number> {
  const token = await getValidAccessToken('confluence', input.tenantId);
  if (!token) return 0;
  const since = await resolveSince(input.tenantId, 'confluence', input.since);
  return ingestFromNativeClient(input, 'confluence', async () => {
    const pages = await searchAllConfluencePages(token, since);
    return pages.map((p) => ({
      tenantId: input.tenantId,
      docId: `${input.tenantId}:confluence:${p.id}`,
      text: `${p.title}\n${p.text}`,
      title: p.title,
      source: 'confluence',
      type: 'page',
      url: p.url,
      extraMeta: { space: p.spaceKey },
    }));
  });
}

export async function ingestMiroActivity(input: IngestActivityInput): Promise<number> {
  const token = await getValidAccessToken('miro', input.tenantId);
  if (!token) return 0;
  return ingestFromNativeClient(input, 'miro', async () => {
    const items = await fetchAllMiroContent(token);
    return items.map((item) => ({
      tenantId: input.tenantId,
      docId: `${input.tenantId}:miro:${item.id}`,
      text: `${item.title}\n${item.text}`,
      title: item.title,
      source: 'miro',
      type: 'board_item',
      url: item.url,
    }));
  });
}

export async function ingestLoomActivity(input: IngestActivityInput): Promise<number> {
  const token = await getValidAccessToken('loom', input.tenantId);
  if (!token) return 0;
  return ingestFromNativeClient(input, 'loom', async () => {
    const videos = await listLoomVideos(token);
    return videos.map((v) => ({
      tenantId: input.tenantId,
      docId: `${input.tenantId}:loom:${v.id}`,
      text: `${v.title}\n${v.description}`,
      title: v.title,
      source: 'loom',
      type: 'video',
      url: v.url,
    }));
  });
}

export async function ingestLinearActivity(input: IngestActivityInput): Promise<number> {
  const token = await getValidAccessToken('linear', input.tenantId);
  if (!token) return 0;
  const since = await resolveSince(input.tenantId, 'linear', input.since);
  return ingestFromNativeClient(input, 'linear', async () => {
    const issues = await listLinearIssues(token, { since, first: 100 });
    return issues.map((issue) => ({
      tenantId: input.tenantId,
      docId: `${input.tenantId}:linear:${issue.id}`,
      text: `${issue.title}\n${issue.description}`,
      title: issue.title,
      source: 'linear',
      type: 'issue',
      url: issue.url,
    }));
  });
}

export async function ingestAsanaActivity(input: IngestActivityInput): Promise<number> {
  const token = await getValidAccessToken('asana', input.tenantId);
  if (!token) return 0;
  const since = await resolveSince(input.tenantId, 'asana', input.since);
  const modifiedSince = since ? since.slice(0, 10) : undefined;

  return ingestFromNativeClient(input, 'asana', async () => {
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
    const wsRes = await fetch('https://app.asana.com/api/1.0/workspaces', { headers });
    if (!wsRes.ok) return [];
    const wsData = (await wsRes.json()) as { data?: Array<{ gid: string; name: string }> };
    const docs: IngestDocInput[] = [];

    for (const ws of (wsData.data ?? []).slice(0, 2)) {
      const projRes = await fetch(
        `https://app.asana.com/api/1.0/projects?workspace=${ws.gid}&limit=10&opt_fields=name`,
        { headers },
      );
      if (!projRes.ok) continue;
      const projData = (await projRes.json()) as { data?: Array<{ gid: string; name: string }> };
      for (const project of (projData.data ?? []).slice(0, 5)) {
        const params = new URLSearchParams({
          project: project.gid,
          limit: '50',
          opt_fields: 'name,notes,completed,modified_at',
        });
        if (modifiedSince) params.set('modified_since', modifiedSince);
        const taskRes = await fetch(`https://app.asana.com/api/1.0/tasks?${params}`, { headers });
        if (!taskRes.ok) continue;
        const taskData = (await taskRes.json()) as {
          data?: Array<{ gid: string; name?: string; notes?: string }>;
        };
        for (const task of taskData.data ?? []) {
          docs.push({
            tenantId: input.tenantId,
            docId: `${input.tenantId}:asana:${task.gid}`,
            text: `${task.name ?? 'Task'}\n${task.notes ?? ''}`,
            title: task.name ?? 'Task',
            source: 'asana',
            type: 'task',
            extraMeta: { workspace: ws.name, project: project.name },
          });
        }
      }
    }
    return docs;
  });
}

export async function ingestClickUpActivity(input: IngestActivityInput): Promise<number> {
  const token = await getValidAccessToken('clickup', input.tenantId);
  if (!token) return 0;

  return ingestFromNativeClient(input, 'clickup', async () => {
    const headers = { Authorization: token, Accept: 'application/json' };
    const teamRes = await fetch('https://api.clickup.com/api/v2/team', { headers });
    if (!teamRes.ok) return [];
    const teamData = (await teamRes.json()) as {
      teams?: Array<{ id: string; name: string }>;
    };
    const docs: IngestDocInput[] = [];

    for (const team of (teamData.teams ?? []).slice(0, 3)) {
      const taskRes = await fetch(
        `https://api.clickup.com/api/v2/team/${team.id}/task?page=0&include_closed=false&subtasks=true`,
        { headers },
      );
      if (!taskRes.ok) continue;
      const taskData = (await taskRes.json()) as {
        tasks?: Array<{ id: string; name?: string; description?: string; url?: string }>;
      };
      for (const task of taskData.tasks ?? []) {
        docs.push({
          tenantId: input.tenantId,
          docId: `${input.tenantId}:clickup:${task.id}`,
          text: `${task.name ?? 'Task'}\n${task.description ?? ''}`,
          title: task.name ?? 'Task',
          source: 'clickup',
          type: 'task',
          url: task.url,
          extraMeta: { workspace: team.name },
        });
      }
    }
    return docs;
  });
}

export async function ingestAirtableActivity(input: IngestActivityInput): Promise<number> {
  const token = await getValidAccessToken('airtable', input.tenantId);
  if (!token) return 0;

  return ingestFromNativeClient(input, 'airtable', async () => {
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
    const basesRes = await fetch('https://api.airtable.com/v0/meta/bases', { headers });
    if (!basesRes.ok) return [];
    const basesData = (await basesRes.json()) as {
      bases?: Array<{ id: string; name: string }>;
    };
    const docs: IngestDocInput[] = [];

    for (const base of (basesData.bases ?? []).slice(0, 5)) {
      const schemaRes = await fetch(`https://api.airtable.com/v0/meta/bases/${base.id}/tables`, {
        headers,
      });
      if (!schemaRes.ok) continue;
      const schemaData = (await schemaRes.json()) as {
        tables?: Array<{ id: string; name: string }>;
      };
      for (const table of (schemaData.tables ?? []).slice(0, 5)) {
        const recRes = await fetch(
          `https://api.airtable.com/v0/${base.id}/${table.id}?maxRecords=50`,
          { headers },
        );
        if (!recRes.ok) continue;
        const recData = (await recRes.json()) as {
          records?: Array<{ id: string; fields?: Record<string, unknown> }>;
        };
        for (const rec of recData.records ?? []) {
          const text = Object.entries(rec.fields ?? {})
            .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
            .join('\n');
          docs.push({
            tenantId: input.tenantId,
            docId: `${input.tenantId}:airtable:${rec.id}`,
            text,
            title: `${base.name} / ${table.name}`,
            source: 'airtable',
            type: 'record',
            extraMeta: { base: base.name, table: table.name },
          });
        }
      }
    }
    return docs;
  });
}

export async function ingestTodoistActivity(input: IngestActivityInput): Promise<number> {
  const token = await getValidAccessToken('todoist', input.tenantId);
  if (!token) return 0;

  return ingestFromNativeClient(input, 'todoist', async () => {
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
    const docsById = new Map<string, IngestDocInput>();

    const addTask = (
      task: { id: string; content?: string; description?: string },
      extra?: { project?: string },
    ) => {
      const docId = `${input.tenantId}:todoist:${task.id}`;
      if (docsById.has(docId)) return;
      docsById.set(docId, {
        tenantId: input.tenantId,
        docId,
        text: `${task.content ?? 'Task'}\n${task.description ?? ''}`,
        title: task.content ?? 'Task',
        source: 'todoist',
        type: 'task',
        extraMeta: extra,
      });
    };

    const activeRes = await fetch('https://api.todoist.com/rest/v2/tasks?filter=today|overdue', {
      headers,
    });
    if (activeRes.ok) {
      const tasks = (await activeRes.json()) as Array<{
        id: string;
        content?: string;
        description?: string;
      }>;
      for (const task of tasks.slice(0, 100)) addTask(task);
    }

    const projRes = await fetch('https://api.todoist.com/rest/v2/projects', { headers });
    const projects = projRes.ok
      ? ((await projRes.json()) as Array<{ id: string; name: string }>)
      : [];
    for (const project of projects.slice(0, 10)) {
      const taskRes = await fetch(
        `https://api.todoist.com/rest/v2/tasks?project_id=${project.id}`,
        { headers },
      );
      if (!taskRes.ok) continue;
      const tasks = (await taskRes.json()) as Array<{
        id: string;
        content?: string;
        description?: string;
      }>;
      for (const task of tasks.slice(0, 30)) addTask(task, { project: project.name });
    }
    return [...docsById.values()];
  });
}

export async function ingestDropboxActivity(input: IngestActivityInput): Promise<number> {
  const token = await getValidAccessToken('dropbox', input.tenantId);
  if (!token) return 0;

  return ingestFromNativeClient(input, 'dropbox', async () => {
    const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: '', recursive: true, limit: 100 }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      entries?: Array<{ '.tag'?: string; name?: string; path_display?: string; id?: string }>;
    };
    return (data.entries ?? [])
      .filter((e) => e['.tag'] === 'file')
      .map((file) => ({
        tenantId: input.tenantId,
        docId: `${input.tenantId}:dropbox:${file.id ?? file.path_display}`,
        text: file.path_display ?? file.name ?? 'File',
        title: file.name ?? 'File',
        source: 'dropbox',
        type: 'file',
        extraMeta: { path: file.path_display },
      }));
  });
}

export async function ingestBoxActivity(input: IngestActivityInput): Promise<number> {
  const token = await getValidAccessToken('box', input.tenantId);
  if (!token) return 0;

  return ingestFromNativeClient(input, 'box', async () => {
    const res = await fetch('https://api.box.com/2.0/folders/0/items?limit=100', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      entries?: Array<{ id: string; type?: string; name?: string; description?: string }>;
    };
    return (data.entries ?? []).map((item) => ({
      tenantId: input.tenantId,
      docId: `${input.tenantId}:box:${item.id}`,
      text: `${item.name ?? 'Item'}\n${item.description ?? ''}`,
      title: item.name ?? 'Item',
      source: 'box',
      type: item.type ?? 'item',
    }));
  });
}

export async function ingestCalendlyActivity(input: IngestActivityInput): Promise<number> {
  const token = await getValidAccessToken('calendly', input.tenantId);
  if (!token) return 0;

  return ingestFromNativeClient(input, 'calendly', async () => {
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
    const meRes = await fetch('https://api.calendly.com/users/me', { headers });
    if (!meRes.ok) return [];
    const me = (await meRes.json()) as { resource?: { uri?: string } };
    const userUri = me.resource?.uri;
    if (!userUri) return [];

    const eventsRes = await fetch(
      `https://api.calendly.com/scheduled_events?user=${encodeURIComponent(userUri)}&count=50&status=active`,
      { headers },
    );
    if (!eventsRes.ok) return [];
    const events = (await eventsRes.json()) as {
      collection?: Array<{
        uri?: string;
        name?: string;
        start_time?: string;
        end_time?: string;
        location?: { join_url?: string };
      }>;
    };
    return (events.collection ?? []).map((ev) => ({
      tenantId: input.tenantId,
      docId: `${input.tenantId}:calendly:${ev.uri?.split('/').pop() ?? ev.name}`,
      text: `${ev.name ?? 'Event'}\nStart: ${ev.start_time ?? ''}\nEnd: ${ev.end_time ?? ''}`,
      title: ev.name ?? 'Event',
      source: 'calendly',
      type: 'event',
      url: ev.location?.join_url,
    }));
  });
}

export async function ingestZoomActivity(input: IngestActivityInput): Promise<number> {
  const token = await getValidAccessToken('zoom', input.tenantId);
  if (!token) return 0;

  return ingestFromNativeClient(input, 'zoom', async () => {
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
    const res = await fetch(
      'https://api.zoom.us/v2/users/me/meetings?type=scheduled&page_size=50',
      { headers },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      meetings?: Array<{
        id?: number;
        topic?: string;
        agenda?: string;
        start_time?: string;
        join_url?: string;
      }>;
    };
    return (data.meetings ?? []).map((m) => ({
      tenantId: input.tenantId,
      docId: `${input.tenantId}:zoom:${m.id}`,
      text: `${m.topic ?? 'Meeting'}\n${m.agenda ?? ''}\nStart: ${m.start_time ?? ''}`,
      title: m.topic ?? 'Meeting',
      source: 'zoom',
      type: 'meeting',
      url: m.join_url,
    }));
  });
}

export async function ingestFigmaActivity(input: IngestActivityInput): Promise<number> {
  const token = await getValidAccessToken('figma', input.tenantId);
  if (!token) return 0;

  return ingestFromNativeClient(input, 'figma', async () => {
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
    const res = await fetch('https://api.figma.com/v1/me/files', { headers });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      files?: Array<{ key?: string; name?: string; last_modified?: string }>;
    };
    return (data.files ?? []).slice(0, 50).map((file) => ({
      tenantId: input.tenantId,
      docId: `${input.tenantId}:figma:${file.key}`,
      text: `${file.name ?? 'File'}\nLast modified: ${file.last_modified ?? ''}`,
      title: file.name ?? 'Figma file',
      source: 'figma',
      type: 'file',
      url: file.key ? `https://www.figma.com/file/${file.key}` : undefined,
    }));
  });
}
