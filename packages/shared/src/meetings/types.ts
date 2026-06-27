import type { ConnectorSource, DocumentType } from '../ingestion/adapter';

import type { CallRecordingSource, ConferencePlatform, MeetingCalendarSource } from './constants';

export type { CallRecordingSource, ConferencePlatform, MeetingCalendarSource } from './constants';

export type MeetingStatus = 'upcoming' | 'in_progress' | 'completed' | 'cancelled';
export type MeetingType = 'internal' | 'external' | 'unknown';
export type BriefingStatus = 'pending' | 'generating' | 'ready' | 'failed';
export type AttendeeSentiment = 'positive' | 'neutral' | 'cautious' | 'unknown';

export type AttendeeProfile = {
  email: string;
  name: string;
  role: string;
  company: string;
  relationshipSummary: string;
  lastInteractionAt: Date | null;
  lastInteractionTopic: string | null;
  sentiment: AttendeeSentiment;
  totalMeetings: number;
  totalEmails: number;
};

export type ContextDocument = {
  source: ConnectorSource | string;
  type: DocumentType | string;
  title: string;
  url: string;
  relevanceReason: string;
  snippet: string;
  relevanceScore: number;
  documentId?: string;
};

export type CallRecordingSummary = {
  source: CallRecordingSource | string;
  recordedAt: Date | null;
  durationMins: number;
  summary: string;
  keyDecisions: string[];
  actionItems: string[];
};

export type MeetingBriefing = {
  executiveSummary: string;
  attendeeProfiles: AttendeeProfile[];
  contextDocuments: ContextDocument[];
  openItems: string[];
  suggestedAgenda: string[];
  questionsToAsk: string[];
  risksAndFlags: string[];
  dealStage: string | null;
  callRecordingSummaries: CallRecordingSummary[];
};

export type ActionItem = {
  description: string;
  ownerEmail: string | null;
  dueDate: Date | null;
  status: 'open' | 'done';
};

export type MeetingIntelligence = {
  id: string;
  calendarEventId: string;
  title: string;
  startAt: Date;
  endAt: Date;
  location: string | null;
  meetingUrl: string | null;
  calendarSource: MeetingCalendarSource;
  conferencePlatform: ConferencePlatform;
  status: MeetingStatus;
  meetingType: MeetingType;
  briefingStatus: BriefingStatus;
  organizerEmail: string | null;
  attendeeEmails: string[];
  attendeeCount: number;
  briefing: MeetingBriefing | null;
  briefingGeneratedAt: Date | null;
  outcomeNotes: string | null;
  actionItems: ActionItem[];
  followUpEmailDraft: string | null;
  relevantDocuments: ContextDocument[];
};

export type MeetingContact = {
  id: string;
  tenantId: string;
  email: string;
  name: string | null;
  company: string | null;
  roleTitle: string | null;
  linkedinUrl: string | null;
  firstInteractionAt: Date | null;
  lastInteractionAt: Date | null;
  totalMeetings: number;
  totalEmails: number;
  relationshipStatus: string;
  notes: string | null;
  tags: string[];
};

export type MeetingSummary = {
  id: string;
  title: string;
  startAt: Date;
  status: MeetingStatus;
  summary: string;
  meetingType: MeetingType;
  conferencePlatform: ConferencePlatform;
  hasBriefing: boolean;
};

export type MeetingMetrics = {
  upcomingCount: number;
  completedThisMonth: number;
  openActionItems: number;
  avgMeetingsPerWeek: number;
  topContacts: MeetingContact[];
  dealsPipeline: {
    discovery: number;
    proposalSent: number;
    negotiation: number;
    closedWon: number;
  };
  meetingsToday: number;
  needsBriefing: number;
  recentMeetings: MeetingSummary[];
};

export type MeetingsFilter = {
  status?: 'upcoming' | 'completed' | 'all';
  todayOnly?: boolean;
  limit?: number;
  offset?: number;
};
