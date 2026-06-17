'use client';

import { useEffect, useState } from 'react';
import { Mail, Reply, Send } from 'lucide-react';
import { type SourceCitationProps } from '@cortex/ui';

import { AppShell, ProjectBadge } from '@/components/app-shell';
import { GradientDivider, Skeleton, SkeletonTable } from '@/components/design-system';
import { useCortexUser } from '@/hooks/use-cortex-user';

type ThreadSummary = {
  threadId: string;
  snippet: string;
  from: string;
  subject: string;
  date: string;
  unread: boolean;
};

type ThreadDetail = {
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
};

function formatDate(raw: string): string {
  try {
    return new Date(raw).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return raw;
  }
}

export function EmailDeskPage() {
  const { tenantId } = useCortexUser();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [inboxError, setInboxError] = useState('');
  const [draft, setDraft] = useState('');
  const [sources, setSources] = useState<SourceCitationProps[]>([]);
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendOk, setSendOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/email/inbox');
        const data = (await res.json()) as ThreadSummary[] & { error?: string };
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? 'Failed to load inbox');
        setThreads(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) {
          setInboxError(e instanceof Error ? e.message : 'Failed to load inbox');
          setThreads([]);
        }
      } finally {
        if (!cancelled) setLoadingInbox(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function selectThread(threadId: string) {
    setSelectedId(threadId);
    setThread(null);
    setDraft('');
    setSources([]);
    setSendOk(false);
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/email/thread?threadId=${encodeURIComponent(threadId)}`);
      const data = (await res.json()) as ThreadDetail & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to load email');
      setThread(data);
    } catch {
      setThread(null);
    } finally {
      setLoadingThread(false);
    }
  }

  async function handleAiReply() {
    if (!thread) return;
    setDrafting(true);
    setDraft('');
    setSendOk(false);
    try {
      const res = await fetch('/api/email/ai-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: thread.threadId,
          emailBody: thread.body,
          subject: thread.subject,
        }),
      });
      const data = (await res.json()) as {
        draft?: string;
        sources?: SourceCitationProps[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? 'Failed to draft reply');
      setDraft(data.draft ?? '');
      setSources(data.sources ?? []);
    } catch (e) {
      setDraft(e instanceof Error ? e.message : 'Failed to draft reply');
    } finally {
      setDrafting(false);
    }
  }

  async function handleSend() {
    if (!thread || !draft.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: thread.threadId,
          replyText: draft,
          to: thread.from,
          subject: thread.subject,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Send failed');
      setSendOk(true);
    } catch (e) {
      setDraft(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell
      title="Email Desk"
      subtitle="Real Gmail inbox with AI-drafted replies"
      badge={<ProjectBadge tenantId={tenantId} />}
    >
      <div className="flex h-full flex-col lg:flex-row">
        <div className="shell-sidebar flex h-64 shrink-0 flex-col lg:h-full lg:w-96 lg:border-b-0 lg:border-r">
          <div className="px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Inbox
            </p>
          </div>
          <GradientDivider />
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {loadingInbox && (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="glass-card space-y-2 p-3">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-2 w-full" />
                    <Skeleton className="h-2 w-5/6" />
                  </div>
                ))}
              </div>
            )}
            {inboxError && (
              <p className="rounded border border-red-900/40 bg-red-950/20 p-3 text-sm text-red-300">
                {inboxError}
              </p>
            )}
            {!loadingInbox && !inboxError && threads.length === 0 && (
              <p className="body-muted p-4">No threads found.</p>
            )}
            <ul className="space-y-2">
              {threads.map((t) => (
                <li key={t.threadId}>
                  <button
                    type="button"
                    onClick={() => selectThread(t.threadId)}
                    className={`glass-card-interactive w-full p-3 text-left transition-all duration-200 ${
                      selectedId === t.threadId ? 'border-teal-500/40 bg-teal-500/10' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {t.unread && <span className="status-dot-live mt-1.5 size-2 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {t.from.replace(/<.*>/, '').trim() || t.from}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{t.subject}</p>
                        <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground/80">
                          {t.snippet}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground/60">
                          {formatDate(t.date)}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          {!selectedId && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Mail className="size-10 opacity-40" />
              <p className="body-muted">Select an email to read</p>
            </div>
          )}

          {selectedId && loadingThread && (
            <div className="flex flex-1 flex-col gap-4 p-6">
              <SkeletonTable rows={4} />
            </div>
          )}

          {thread && !loadingThread && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="shell-frosted shrink-0 px-6 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="card-title text-lg">{thread.subject}</p>
                    <p className="body-muted mt-1">{thread.from}</p>
                    <p className="text-xs text-muted-foreground/70">{formatDate(thread.date)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAiReply}
                    disabled={drafting}
                    className="btn-primary inline-flex shrink-0 items-center gap-2 px-5 py-2.5 text-sm font-semibold"
                  >
                    <Reply className="size-4" />
                    {drafting ? 'Drafting…' : 'Reply with AI'}
                  </button>
                </div>

                {(drafting || draft) && (
                  <div className="glass-card mt-4 border-teal-500/20 p-4 md:p-6">
                    <p className="text-xs font-medium uppercase tracking-wider text-primary">
                      Your reply
                    </p>
                    {drafting ? (
                      <div className="mt-3 space-y-2">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-5/6" />
                        <Skeleton className="h-3 w-4/6" />
                      </div>
                    ) : (
                      <>
                        <textarea
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          rows={6}
                          className="input-dark mt-3 resize-y text-sm"
                        />
                        <div className="mt-3 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={handleSend}
                            disabled={sending || !draft.trim()}
                            className="btn-primary inline-flex items-center gap-2 px-5 py-2"
                          >
                            <Send className="size-4" />
                            {sending ? 'Sending…' : 'Send'}
                          </button>
                          {sendOk && <span className="text-sm text-emerald-400">Sent.</span>}
                        </div>
                        {sources.length > 0 && (
                          <p className="mt-2 text-[10px] text-zinc-600">
                            Sources: {sources.map((s) => s.title).join(' · ')}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <div className="glass-card p-5 md:p-6">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Message
                  </p>
                  <pre className="body-muted whitespace-pre-wrap font-sans">
                    {thread.body || '(empty body)'}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
