'use client';

import type { MeetingBriefing, MeetingIntelligence } from '@cortex/shared/meetings/types';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  Printer,
  Sparkles,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import { GradientDivider, Skeleton } from '@/components/design-system';
import {
  CONFERENCE_PLATFORM_LABELS,
  type ConferencePlatform,
} from '@cortex/shared/meetings/constants';

type SerializedMeeting = Omit<
  MeetingIntelligence,
  'startAt' | 'endAt' | 'briefingGeneratedAt' | 'actionItems' | 'briefing'
> & {
  startAt: string;
  endAt: string;
  briefingGeneratedAt: string | null;
  actionItems: Array<{
    description: string;
    ownerEmail: string | null;
    dueDate: string | null;
    status: 'open' | 'done';
  }>;
  briefing:
    | (Omit<MeetingBriefing, 'attendeeProfiles' | 'callRecordingSummaries'> & {
        attendeeProfiles: Array<
          Omit<MeetingBriefing['attendeeProfiles'][number], 'lastInteractionAt'> & {
            lastInteractionAt: string | null;
          }
        >;
        callRecordingSummaries: Array<
          Omit<MeetingBriefing['callRecordingSummaries'][number], 'recordedAt'> & {
            recordedAt: string | null;
          }
        >;
      })
    | null;
};

export function MeetingDetail({ meetingId }: { meetingId: string }) {
  const [meeting, setMeeting] = useState<SerializedMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [followUpDraft, setFollowUpDraft] = useState('');
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [outcomeSaved, setOutcomeSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/meetings/${meetingId}`);
      const data = (await res.json()) as { meeting?: SerializedMeeting; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to load meeting');
      setMeeting(data.meeting ?? null);
      if (data.meeting?.followUpEmailDraft) {
        setFollowUpDraft(data.meeting.followUpEmailDraft);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleGenerateBriefing() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/briefing`, { method: 'POST' });
      if (!res.ok && res.status !== 202) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? 'Briefing failed');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Briefing failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveOutcome() {
    if (!outcomeNotes.trim()) return;
    setSavingOutcome(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcomeNotes: outcomeNotes.trim(), actionItems: [] }),
      });
      const data = (await res.json()) as { followUpDraft?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to save outcome');
      setFollowUpDraft(data.followUpDraft ?? '');
      setOutcomeSaved(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingOutcome(false);
    }
  }

  function copyBriefing() {
    if (!meeting?.briefing) return;
    const b = meeting.briefing;
    const text = [
      `# ${meeting.title}`,
      '',
      b.executiveSummary,
      '',
      '## Suggested agenda',
      ...b.suggestedAgenda.map((s) => `- ${s}`),
      '',
      '## Questions to ask',
      ...b.questionsToAsk.map((q) => `- ${q}`),
      '',
      '## Risks & flags',
      ...b.risksAndFlags.map((r) => `- ${r}`),
      '',
      '## Open items',
      ...b.openItems.map((o) => `- ${o}`),
    ].join('\n');
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <AppShell title="Meeting" subtitle="Loading…">
        <div className="mx-auto max-w-4xl space-y-4 p-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AppShell>
    );
  }

  if (!meeting) {
    return (
      <AppShell title="Meeting" subtitle="Not found">
        <div className="p-6 text-sm text-muted-foreground">
          <Link href="/meetings" className="inline-flex items-center gap-1 text-primary">
            <ArrowLeft className="size-4" />
            Back to meetings
          </Link>
        </div>
      </AppShell>
    );
  }

  const briefing = meeting.briefing;
  const briefingFailed =
    meeting.briefingStatus === 'failed' || briefing?.executiveSummary?.includes('partially failed');

  return (
    <AppShell
      title={meeting.title}
      subtitle={new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(meeting.startAt))}
      badge={
        <div className="flex flex-wrap items-center gap-2">
          {meeting.meetingUrl && (
            <a
              href={meeting.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
            >
              <Video className="size-3.5" />
              Join
            </a>
          )}
          <button
            type="button"
            onClick={() => void handleGenerateBriefing()}
            disabled={generating}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {meeting.briefingStatus === 'ready' ? 'Regenerate' : 'Generate briefing'}
          </button>
        </div>
      }
    >
      <div className="meetings-print mx-auto max-w-4xl space-y-6 p-6">
        <Link
          href="/meetings"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground print:hidden"
        >
          <ArrowLeft className="size-3.5" />
          All meetings
        </Link>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive print:hidden">
            {error}
          </div>
        )}

        {briefingFailed && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            Briefing generation had issues — review linked documents below.
          </div>
        )}

        {meeting.location && (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-4" />
            {meeting.location}
          </p>
        )}

        {meeting.conferencePlatform &&
          meeting.conferencePlatform !== 'none' &&
          meeting.conferencePlatform !== 'unknown' && (
            <p className="text-xs text-muted-foreground">
              {CONFERENCE_PLATFORM_LABELS[meeting.conferencePlatform as ConferencePlatform] ??
                meeting.conferencePlatform}
              {meeting.calendarSource && meeting.calendarSource !== 'unknown'
                ? ` · ${meeting.calendarSource.replace(/_/g, ' ')}`
                : ''}
            </p>
          )}

        {briefing && (
          <div className="space-y-6">
            <section className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">Executive summary</h2>
                <div className="flex gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={copyBriefing}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="size-3.5" />
                    {copied ? 'Copied' : 'Copy briefing'}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Printer className="size-3.5" />
                    Print
                  </button>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {briefing.executiveSummary}
              </p>
              {briefing.dealStage && (
                <p className="mt-2 text-xs text-primary">Deal stage: {briefing.dealStage}</p>
              )}
            </section>

            <BriefingList
              title="Who you're meeting"
              items={briefing.attendeeProfiles.map(
                (p) => `${p.name} (${p.email}) — ${p.relationshipSummary}`,
              )}
            />

            <BriefingList title="Suggested agenda" items={briefing.suggestedAgenda} />
            <BriefingList title="Questions to ask" items={briefing.questionsToAsk} />
            <BriefingList title="Risks & flags" items={briefing.risksAndFlags} />
            <BriefingList title="Open items from past meetings" items={briefing.openItems} />

            {briefing.contextDocuments.length > 0 && (
              <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold text-foreground">Context documents</h2>
                <ul className="mt-3 space-y-2">
                  {briefing.contextDocuments.map((doc, i) => (
                    <li key={doc.documentId ?? i} className="rounded-lg border border-border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">{doc.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {doc.source} · {doc.relevanceReason}
                          </p>
                          {doc.snippet && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {doc.snippet}
                            </p>
                          )}
                        </div>
                        {doc.url && (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-muted-foreground hover:text-primary print:hidden"
                          >
                            <ExternalLink className="size-4" />
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {briefing.callRecordingSummaries.length === 0 && (
              <section className="rounded-xl border border-dashed border-border bg-card/50 p-5 print:hidden">
                <h2 className="text-sm font-semibold text-foreground">Call recordings</h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  No recordings indexed yet. Connect Google Meet, Zoom, or upload a recording
                  (coming soon).
                </p>
              </section>
            )}
          </div>
        )}

        {!briefing && meeting.briefingStatus !== 'generating' && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center print:hidden">
            <Sparkles className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No briefing yet for this meeting.</p>
            <button
              type="button"
              onClick={() => void handleGenerateBriefing()}
              disabled={generating}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              Generate briefing
            </button>
          </div>
        )}

        {meeting.status === 'completed' || meeting.outcomeNotes ? (
          <section className="rounded-xl border border-border bg-card p-5 print:hidden">
            <h2 className="text-sm font-semibold text-foreground">Meeting outcome</h2>
            {meeting.outcomeNotes ? (
              <p className="mt-2 text-sm text-muted-foreground">{meeting.outcomeNotes}</p>
            ) : null}
          </section>
        ) : (
          <section className="rounded-xl border border-border bg-card p-5 print:hidden">
            <h2 className="text-sm font-semibold text-foreground">Capture outcome</h2>
            <textarea
              value={outcomeNotes}
              onChange={(e) => setOutcomeNotes(e.target.value)}
              placeholder="What was decided? Key takeaways…"
              rows={4}
              className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => void handleSaveOutcome()}
              disabled={savingOutcome || !outcomeNotes.trim()}
              className="mt-3 inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              {savingOutcome ? (
                <Loader2 className="size-4 animate-spin" />
              ) : outcomeSaved ? (
                <CheckCircle2 className="size-4" />
              ) : null}
              Save outcome & draft follow-up
            </button>
          </section>
        )}

        {followUpDraft && (
          <section className="rounded-xl border border-border bg-card p-5 print:hidden">
            <h2 className="text-sm font-semibold text-foreground">Follow-up email draft</h2>
            <pre className="mt-3 whitespace-pre-wrap rounded-md bg-muted p-4 text-xs text-foreground">
              {followUpDraft}
            </pre>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(followUpDraft);
              }}
              className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Copy className="size-3.5" />
              Copy draft
            </button>
          </section>
        )}

        <GradientDivider className="print:hidden" />
      </div>

      <style jsx global>{`
        @media print {
          .meetings-print {
            max-width: 100%;
          }
          nav,
          aside,
          header button,
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </AppShell>
  );
}

function BriefingList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted-foreground">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
