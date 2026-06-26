'use client';

import {
  Calendar,
  MapPin,
  Users,
  Video,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { CalendarEventRow } from '@/app/api/executive/today/route';

type MeetingWithBriefing = CalendarEventRow & {
  briefing?: string;
  briefingLoading?: boolean;
};

function formatTime(start: CalendarEventRow['start'], end: CalendarEventRow['end']): string {
  if (!start) return 'All day';
  const startStr = start.dateTime ?? start.date;
  const endStr = end?.dateTime ?? end?.date;
  if (!startStr) return 'All day';
  const s = new Date(startStr);
  const e = endStr ? new Date(endStr) : null;
  const opts: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
  };
  const fmt = new Intl.DateTimeFormat('en-US', opts);
  if (e && startStr.includes('T')) {
    return `${fmt.format(s)} – ${fmt.format(e)}`;
  }
  if (!startStr.includes('T')) return 'All day';
  return fmt.format(s);
}

function meetingUrl(event: CalendarEventRow): string | null {
  if (event.conferenceData?.entryPoints) {
    const meet = event.conferenceData.entryPoints.find((ep) => ep.entryPointType === 'video');
    if (meet) return meet.uri;
  }
  return null;
}

function MeetingCard({
  event,
  onBriefing,
}: {
  event: MeetingWithBriefing;
  onBriefing: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const vidUrl = meetingUrl(event);
  const time = formatTime(event.start, event.end);

  return (
    <div className="group rounded-lg border border-border bg-card transition-all hover:border-primary/30">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="flex shrink-0 flex-col items-center gap-0.5">
          <span className="text-xs font-semibold text-foreground">
            {time.split('–')[0]?.trim() ?? time}
          </span>
          {time.includes('–') && (
            <span className="text-[10px] text-muted-foreground">{time.split('–')[1]?.trim()}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
          {event.location && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{event.location}</span>
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {vidUrl && (
            <a
              href={vidUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-md border border-border p-1.5 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              title="Join video call"
            >
              <Video className="size-3.5" />
            </a>
          )}
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 pb-3 pt-2">
          {event.attendees.length > 0 && (
            <div className="mb-2">
              <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Users className="size-3" />
                Attendees ({event.attendees.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {event.attendees.map((a) => (
                  <span
                    key={a.email}
                    className="rounded-full border border-border px-2 py-0.5 text-[11px] text-foreground/80"
                  >
                    {a.displayName ?? a.email}
                  </span>
                ))}
              </div>
            </div>
          )}

          {event.description && (
            <p className="mb-2 text-xs text-muted-foreground">
              {event.description.slice(0, 200)}
              {event.description.length > 200 ? '…' : ''}
            </p>
          )}

          <div className="flex gap-2">
            {event.htmlLink && (
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Open in Calendar
              </a>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onBriefing();
              }}
              disabled={event.briefingLoading}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
            >
              {event.briefingLoading ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Sparkles className="size-3" />
              )}
              Briefing
            </button>
          </div>

          {event.briefing && (
            <div className="mt-2 rounded-md bg-muted/30 p-2 text-xs text-muted-foreground">
              {event.briefing}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BriefingModal({ event, onClose }: { event: CalendarEventRow; onClose: () => void }) {
  const [briefing, setBriefing] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/executive/briefing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: event.title,
            attendees: event.attendees,
            description: event.description,
            location: event.location,
          }),
        });
        if (!res.ok) throw new Error('Briefing failed');
        const data = (await res.json()) as { briefing?: string; error?: string };
        if (!cancelled) {
          if (data.error) setError(data.error);
          else setBriefing(data.briefing ?? '');
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load briefing');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [event.title, event.attendees, event.description, event.location]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X className="size-5" />
        </button>

        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Meeting Briefing</h2>
        </div>

        <p className="mb-4 text-sm font-medium text-foreground">{event.title}</p>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </p>
        )}

        {briefing && (
          <div className="prose prose-sm prose-invert max-w-none">
            {briefing.split('\n').map((line, i) => (
              <p key={i} className="text-sm text-muted-foreground">
                {line}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TodayCompass() {
  const [events, setEvents] = useState<MeetingWithBriefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [error, setError] = useState('');
  const [briefingEvent, setBriefingEvent] = useState<CalendarEventRow | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/executive/today');
        if (!res.ok) return;
        const data = (await res.json()) as {
          events: CalendarEventRow[];
          error?: string;
        };
        if (!cancelled) {
          setEvents(
            data.events.map((e) => ({
              ...e,
              briefing: undefined,
              briefingLoading: false,
            })),
          );
          setLoading(false);
          setError('');
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
          setError('Could not load today');
        }
      }
    }
    void load();
    pollRef.current = setInterval(load, 30000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleBriefing(event: MeetingWithBriefing) {
    setBriefingEvent(event);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  if (error && events.length === 0) return null;
  if (events.length === 0) return null;

  const today = new Date();
  const dateStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(today);

  return (
    <>
      <div className="mb-4 rounded-xl border border-border bg-card">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-between px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Today&apos;s Compass</span>
            <span className="text-xs text-muted-foreground">{dateStr}</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
              {events.length} meeting{events.length > 1 ? 's' : ''}
            </span>
          </div>
          {collapsed ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="size-4 text-muted-foreground" />
          )}
        </button>

        {!collapsed && (
          <div className="space-y-2 px-4 pb-4">
            {events.map((event) => (
              <MeetingCard
                key={event.id}
                event={event}
                onBriefing={() => void handleBriefing(event)}
              />
            ))}
          </div>
        )}
      </div>

      {briefingEvent && (
        <BriefingModal event={briefingEvent} onClose={() => setBriefingEvent(null)} />
      )}
    </>
  );
}
