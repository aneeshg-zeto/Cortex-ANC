'use client';

import type { MeetingBriefing, MeetingIntelligence } from '@cortex/shared/meetings/types';
import {
  CONFERENCE_PLATFORM_LABELS,
  type ConferencePlatform,
} from '@cortex/shared/meetings/constants';
import { AlertTriangle, Clock, MapPin, Sparkles, Users, Video } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

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

function formatTimeRange(startAt: string, endAt: string): string {
  const s = new Date(startAt);
  const e = new Date(endAt);
  const fmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${fmt.format(s)} – ${fmt.format(e)}`;
}

function formatDate(startAt: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(startAt));
}

const TYPE_BADGE: Record<string, string> = {
  internal: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  external: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  unknown: 'bg-muted text-muted-foreground',
};

const BRIEFING_BADGE: Record<string, string> = {
  ready: 'bg-emerald-500/10 text-emerald-600',
  generating: 'bg-amber-500/10 text-amber-600',
  pending: 'bg-muted text-muted-foreground',
  failed: 'bg-destructive/10 text-destructive',
};

export function MeetingCard({
  meeting,
  tightSchedule = false,
  compact = false,
}: {
  meeting: SerializedMeeting;
  tightSchedule?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);

  function openMeeting(e: React.MouseEvent | React.KeyboardEvent) {
    if (compact) return;
    if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return;
    if ('key' in e) e.preventDefault();
    router.push(`/meetings/${meeting.id}`);
  }

  async function generateBriefing(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setGenerating(true);
    try {
      await fetch(`/api/meetings/${meeting.id}/briefing`, { method: 'POST' });
    } finally {
      setGenerating(false);
    }
  }

  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  const mapUrl =
    mapsKey && meeting.location
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(meeting.location)}&zoom=14&size=120x80&markers=color:red%7C${encodeURIComponent(meeting.location)}&key=${mapsKey}`
      : null;

  const content = (
    <div
      className={`group rounded-xl border border-border bg-card transition-colors hover:border-primary/40 ${
        compact ? 'p-3' : 'cursor-pointer p-4'
      }`}
      role={compact ? undefined : 'button'}
      tabIndex={compact ? undefined : 0}
      onClick={compact ? undefined : openMeeting}
      onKeyDown={compact ? undefined : openMeeting}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-[72px] shrink-0">
          {!compact && (
            <p className="text-[11px] text-muted-foreground">{formatDate(meeting.startAt)}</p>
          )}
          <p className="text-sm font-semibold text-foreground">
            {formatTimeRange(meeting.startAt, meeting.endAt)}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-medium text-foreground">{meeting.title}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${TYPE_BADGE[meeting.meetingType] ?? TYPE_BADGE.unknown}`}
            >
              {meeting.meetingType}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] ${BRIEFING_BADGE[meeting.briefingStatus] ?? BRIEFING_BADGE.pending}`}
            >
              {meeting.briefingStatus}
            </span>
            {meeting.conferencePlatform &&
              meeting.conferencePlatform !== 'none' &&
              meeting.conferencePlatform !== 'unknown' && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {CONFERENCE_PLATFORM_LABELS[meeting.conferencePlatform as ConferencePlatform] ??
                    meeting.conferencePlatform}
                </span>
              )}
            {tightSchedule && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600">
                <Clock className="size-3" />
                tight
              </span>
            )}
          </div>

          {meeting.location && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{meeting.location}</span>
            </p>
          )}

          {meeting.attendeeCount > 0 && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-3 shrink-0" />
              {meeting.attendeeCount} attendee{meeting.attendeeCount !== 1 ? 's' : ''}
            </p>
          )}

          {meeting.briefing?.executiveSummary && !compact && (
            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
              {meeting.briefing.executiveSummary}
            </p>
          )}
        </div>

        {mapUrl && !compact && (
          <img
            src={mapUrl}
            alt=""
            className="hidden h-14 w-20 shrink-0 rounded border border-border object-cover sm:block"
          />
        )}

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          {meeting.meetingUrl && (
            <a
              href={meeting.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Video className="size-3.5" />
              Join
            </a>
          )}
          {meeting.briefingStatus !== 'ready' && meeting.briefingStatus !== 'generating' && (
            <button
              type="button"
              onClick={(e) => void generateBriefing(e)}
              disabled={generating}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <Sparkles className="size-3.5" />
              Brief
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return content;
}

export type { SerializedMeeting };
