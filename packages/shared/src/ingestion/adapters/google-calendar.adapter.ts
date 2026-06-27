import { parseGoogleCalendarACL } from '../acl-parsers';
import type {
  ACLPolicy,
  ConnectorAdapter,
  ConnectorCreds,
  EntityRef,
  RawItem,
  TenantContext,
  UnifiedDocument,
} from '../adapter';
import { computeContentHash, computeDocId, semanticChunk } from '../normaliser';
import { inferConferencePlatform } from '../../meetings/constants';

import { connectorFetch } from './connector-http';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

type CalendarPerson = {
  email?: string;
  displayName?: string;
};

type CalendarEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  status?: string;
  updated?: string;
  created?: string;
  visibility?: string;
  start?: Record<string, unknown>;
  end?: Record<string, unknown>;
  attendees?: CalendarPerson[];
  organizer?: CalendarPerson;
  conferenceData?: Record<string, unknown>;
};

function calendarHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

function listEventsUrl(cursor: string | null): string {
  const url = new URL(CALENDAR_API_BASE);
  url.searchParams.set('timeMin', cursor ?? new Date().toISOString());
  url.searchParams.set('maxResults', '100');
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  return url.toString();
}

function attendeeEntityRefs(attendees: CalendarPerson[] | undefined): EntityRef[] {
  if (!attendees?.length) return [];

  const refs: EntityRef[] = [];
  const seen = new Set<string>();

  for (const attendee of attendees) {
    const email = attendee.email?.trim();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    refs.push({
      type: 'person',
      id: email,
      displayName: attendee.displayName?.trim() || email,
      email,
    });
  }

  return refs;
}

function extractMeetingUrlFromConference(conf: Record<string, unknown> | undefined): string | null {
  const entries = conf?.entryPoints;
  if (!Array.isArray(entries)) return null;
  for (const ep of entries) {
    const e = ep as Record<string, unknown>;
    const uri = e.uri;
    if (typeof uri === 'string' && uri.trim()) return uri.trim();
  }
  return null;
}

function isoFromCalendarField(field: unknown): string | undefined {
  if (!field || typeof field !== 'object') return undefined;
  const f = field as Record<string, unknown>;
  const dt = f.dateTime ?? f.date;
  return typeof dt === 'string' ? dt : undefined;
}

export default class GoogleCalendarAdapter implements ConnectorAdapter {
  readonly source = 'google_calendar' as const;

  async *fetchSince(
    cursor: string | null,
    creds: ConnectorCreds,
    _ctx: TenantContext,
  ): AsyncGenerator<RawItem> {
    const headers = calendarHeaders(creds.accessToken);

    // TODO: paginate beyond the first 100 events when incremental sync is expanded.

    const listRes = await connectorFetch(listEventsUrl(cursor), { headers });
    let listData: unknown;
    try {
      listData = await listRes.json();
    } catch (e) {
      throw new Error(`[google_calendar] Invalid JSON response for event list: ${e}`);
    }
    const list = listData as { items?: CalendarEvent[] };

    for (const event of list.items ?? []) {
      yield {
        id: `google_calendar:${event.id}`,
        raw: event,
        fetchedAt: new Date(),
      };
    }
  }

  normalize(raw: RawItem, ctx: TenantContext): Omit<UnifiedDocument, 'embedding'> {
    const event = asCalendarEvent(raw.raw);
    if (!event) {
      throw new Error('Invalid Google Calendar raw item');
    }

    const body = [event.description, event.location].filter(Boolean).join('\n\n');
    const contentChunks = semanticChunk(body);
    const contentText = contentChunks.map((chunk) => chunk.text).join('\n\n');
    const title = event.summary ?? 'Untitled event';
    const updatedAt = event.updated ? new Date(event.updated) : new Date();
    const createdAt = event.created ? new Date(event.created) : updatedAt;

    const startIso = isoFromCalendarField(event.start);
    const endIso = isoFromCalendarField(event.end);
    const meetingUrl = extractMeetingUrlFromConference(event.conferenceData);
    const conferencePlatform = inferConferencePlatform(meetingUrl, {
      conferenceData: event.conferenceData,
      location: event.location,
    });

    return {
      id: computeDocId('google_calendar', event.id, ctx.tenantId),
      tenantId: ctx.tenantId,
      source: 'google_calendar',
      sourceId: event.id,
      sourceUrl: event.htmlLink ?? '',
      title,
      contentChunks,
      acl: this.parseACL(raw, ctx),
      entityRefs: attendeeEntityRefs(event.attendees),
      cursor: this.nextCursor(raw),
      contentHash: computeContentHash(contentText || title),
      type: 'calendar_event',
      metadata: {
        title,
        start: event.start,
        end: event.end,
        start_time: startIso,
        end_time: endIso,
        meeting_url: meetingUrl,
        conference_platform: conferencePlatform,
        location: event.location,
        attendees: event.attendees,
        organizer: event.organizer,
        status: event.status,
        conferenceData: event.conferenceData,
        source: 'google_calendar',
        type: 'calendar_event',
      },
      createdAt,
      updatedAt,
    };
  }

  parseACL(raw: RawItem, ctx: TenantContext): ACLPolicy {
    return parseGoogleCalendarACL(raw, ctx);
  }

  nextCursor(raw: RawItem): string {
    const event = asCalendarEvent(raw.raw);
    return event?.updated ?? new Date().toISOString();
  }
}

function asCalendarEvent(raw: unknown): CalendarEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as CalendarEvent;
}
