/**
 * Calendar connectors that can seed meeting_intelligence rows.
 * Extend when Calendly, Microsoft 365, etc. adapters land.
 */
export const MEETING_CALENDAR_SOURCES = [
  'calendar',
  'google_calendar',
  'google_meet',
  'calendly',
  'microsoft_365',
  'zoom',
  'manual',
  'unknown',
] as const;

export type MeetingCalendarSource = (typeof MEETING_CALENDAR_SOURCES)[number];

/**
 * Video / dial-in platform for a meeting (from URL or recording ingest).
 * google_meet + zoom are first-class; add providers here as connectors ship.
 */
export const CONFERENCE_PLATFORMS = [
  'google_meet',
  'zoom',
  'microsoft_teams',
  'calendly',
  'webex',
  'unknown',
  'none',
] as const;

export type ConferencePlatform = (typeof CONFERENCE_PLATFORMS)[number];

/** Sources that populate call_recordings (ingest or manual upload). */
export const CALL_RECORDING_SOURCES = [
  'manual',
  'google_meet',
  'zoom',
  'google_calendar',
  'microsoft_teams',
  'calendly',
  'upload',
] as const;

export type CallRecordingSource = (typeof CALL_RECORDING_SOURCES)[number];

const CONFERENCE_URL_PATTERNS: Array<{ platform: ConferencePlatform; test: RegExp }> = [
  { platform: 'google_meet', test: /meet\.google\.com/i },
  { platform: 'zoom', test: /zoom\.us|zoomgov\.com/i },
  { platform: 'microsoft_teams', test: /teams\.microsoft\.com|teams\.live\.com/i },
  { platform: 'calendly', test: /calendly\.com/i },
  { platform: 'webex', test: /webex\.com/i },
];

export function isMeetingCalendarSource(value: string): value is MeetingCalendarSource {
  return (MEETING_CALENDAR_SOURCES as readonly string[]).includes(value);
}

export function isConferencePlatform(value: string): value is ConferencePlatform {
  return (CONFERENCE_PLATFORMS as readonly string[]).includes(value);
}

export function inferConferencePlatformFromUrl(url: string | null | undefined): ConferencePlatform {
  if (!url?.trim()) return 'none';
  for (const { platform, test } of CONFERENCE_URL_PATTERNS) {
    if (test.test(url)) return platform;
  }
  return 'unknown';
}

export function inferConferencePlatform(
  meetingUrl: string | null | undefined,
  metadata?: Record<string, unknown>,
): ConferencePlatform {
  const fromMeta = metadata?.conference_platform ?? metadata?.conferencePlatform;
  if (typeof fromMeta === 'string' && isConferencePlatform(fromMeta)) {
    return fromMeta;
  }

  const explicit = metadata?.meeting_url ?? metadata?.meetingUrl;
  const url =
    (typeof meetingUrl === 'string' && meetingUrl) ||
    (typeof explicit === 'string' ? explicit : null);

  const fromUrl = inferConferencePlatformFromUrl(url);
  if (fromUrl !== 'none' && fromUrl !== 'unknown') return fromUrl;

  const conf = metadata?.conferenceData as Record<string, unknown> | undefined;
  const provider = conf?.conferenceSolution as Record<string, unknown> | undefined;
  const name = String(provider?.name ?? provider?.key ?? '').toLowerCase();
  if (name.includes('meet')) return 'google_meet';
  if (name.includes('zoom')) return 'zoom';
  if (name.includes('teams')) return 'microsoft_teams';

  const loc = metadata?.location;
  if (typeof loc === 'string') {
    const fromLoc = inferConferencePlatformFromUrl(loc);
    if (fromLoc !== 'none' && fromLoc !== 'unknown') return fromLoc;
  }

  return fromUrl;
}

/** Pull join URL from calendar metadata; supports Meet, Zoom, Teams, Calendly, etc. */
export function extractConferenceUrl(metadata: Record<string, unknown>): string | null {
  const fromMeta = metadata.meeting_url ?? metadata.meetingUrl;
  if (typeof fromMeta === 'string' && fromMeta.trim()) return fromMeta.trim();

  const conf = metadata.conferenceData as Record<string, unknown> | undefined;
  const entries = conf?.entryPoints;
  if (Array.isArray(entries)) {
    for (const ep of entries) {
      const e = ep as Record<string, unknown>;
      const uri = e.uri;
      if (typeof uri === 'string' && uri.trim()) return uri.trim();
    }
  }

  const loc = metadata.location;
  if (typeof loc === 'string') {
    const urlMatch = loc.match(/https?:\/\/[^\s]+/gi);
    if (urlMatch) {
      for (const candidate of urlMatch) {
        const platform = inferConferencePlatformFromUrl(candidate);
        if (platform !== 'none' && platform !== 'unknown') return candidate;
      }
    }
  }

  return null;
}

export const CONFERENCE_PLATFORM_LABELS: Record<ConferencePlatform, string> = {
  google_meet: 'Google Meet',
  zoom: 'Zoom',
  microsoft_teams: 'Microsoft Teams',
  calendly: 'Calendly',
  webex: 'Webex',
  unknown: 'Video call',
  none: 'In person',
};

export const CALENDAR_SOURCE_LABELS: Record<MeetingCalendarSource, string> = {
  calendar: 'Calendar',
  google_calendar: 'Google Calendar',
  google_meet: 'Google Meet',
  calendly: 'Calendly',
  microsoft_365: 'Microsoft 365',
  zoom: 'Zoom',
  manual: 'Manual',
  unknown: 'Calendar',
};
