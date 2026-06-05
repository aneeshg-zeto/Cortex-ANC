'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Mail, Reply } from 'lucide-react';
import {
  Badge,
  CortexLogo,
  GlassCard,
  Markdown,
  PanelGroup,
  Panel,
  PanelHandle,
  PanelSidebar,
  Spinner,
  type SourceCitationProps,
} from '@cortex/ui';

type ClientEmail = {
  id: string;
  from: string;
  subject: string;
  preview: string;
  body: string;
  receivedAt: string;
};

const MOCK_INBOX: ClientEmail[] = [
  {
    id: 'email-1',
    from: 'Sarah Chen <sarah@acmecorp.com>',
    subject: 'Acme mobile launch — pilot timeline?',
    preview: 'When will the mobile launch be ready for our pilot users?',
    body: 'Hi team,\n\nWhen will the mobile launch be ready for our pilot users? We need a firm date for our board meeting next week.\n\nThanks,\nSarah',
    receivedAt: '2 hours ago',
  },
  {
    id: 'email-2',
    from: 'James Park <james@betaco.io>',
    subject: 'Feature X beta access',
    preview: 'When will Feature X be ready for our team to test?',
    body: 'Hi team — when will Feature X be ready for our team to test? We were told mid-June.\n\nBest,\nJames',
    receivedAt: '5 hours ago',
  },
  {
    id: 'email-3',
    from: 'Alex Rivera <alex@startup.io>',
    subject: 'Integration status update',
    preview: 'Can you share a quick status on the API integration?',
    body: 'Hello,\n\nCan you share a quick status on the API integration? Our engineers are waiting on webhook documentation.\n\nAlex',
    receivedAt: 'Yesterday',
  },
];

export function ClientsDeskPage() {
  const [selectedId, setSelectedId] = useState(MOCK_INBOX[0].id);
  const [draft, setDraft] = useState<string | null>(null);
  const [sources, setSources] = useState<SourceCitationProps[]>([]);
  const [loading, setLoading] = useState(false);
  const [approved, setApproved] = useState(false);
  const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(null);

  const selected = MOCK_INBOX.find((e) => e.id === selectedId) ?? MOCK_INBOX[0];

  async function handleReply() {
    setLoading(true);
    setDraft(null);
    setApproved(false);

    try {
      const response = await fetch('/api/client-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailContent: selected.body, subject: selected.subject }),
      });
      const data = (await response.json()) as {
        draft?: string;
        pendingApprovalId?: string;
        sources?: SourceCitationProps[];
        error?: string;
      };

      if (!response.ok) throw new Error(data.error ?? 'Failed to draft reply');
      setDraft(data.draft ?? '');
      setSources(data.sources ?? []);
      setPendingApprovalId(data.pendingApprovalId ?? null);
    } catch (error) {
      setDraft(error instanceof Error ? error.message : 'Failed to generate draft');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!pendingApprovalId) return;
    const response = await fetch('/api/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pendingApprovalId, decision: 'approved' }),
    });
    if (response.ok) {
      setApproved(true);
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-white/5 px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/">
            <CortexLogo />
          </Link>
          <div>
            <h1 className="gradient-text text-xl font-bold tracking-tight">Clients Desk</h1>
            <p className="text-sm text-[#94a3b8]">AI-drafted replies with human approval</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/executive-desk" className="btn-outline-glass px-3 py-1.5 text-xs">
            Executive
          </Link>
          <Badge variant="live">HITL enabled</Badge>
        </div>
      </header>

      <PanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <Panel defaultSize={28} minSize={22} maxSize={40}>
          <PanelSidebar title="Client inbox">
            <ul className="space-y-2">
              {MOCK_INBOX.map((email) => (
                <li key={email.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(email.id);
                      setDraft(null);
                      setApproved(false);
                    }}
                    className={`glass glass-hover w-full px-3 py-3 text-left transition-all duration-200 ${
                      selectedId === email.id
                        ? 'border-purple-500/40 shadow-[0_0_20px_rgba(139,92,246,0.15)]'
                        : ''
                    }`}
                  >
                    <p className="truncate text-sm font-medium text-white">{email.from}</p>
                    <p className="truncate text-sm text-[#cbd5e1]">{email.subject}</p>
                    <p className="mt-1 truncate text-xs text-[#94a3b8]">{email.preview}</p>
                    <p className="mt-1 font-mono text-[10px] text-cyan-400/70">
                      {email.receivedAt}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </PanelSidebar>
        </Panel>
        <PanelHandle withHandle />
        <Panel defaultSize={72} minSize={50}>
          <div className="flex h-full flex-col overflow-y-auto p-6 mesh-bg">
            <GlassCard className="animate-fade-in">
              <div className="mb-4 flex items-start gap-4">
                <div className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/30 to-purple-600/30 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                  <Mail className="size-5 text-cyan-300" />
                </div>
                <div>
                  <p className="font-medium text-white">{selected.from}</p>
                  <p className="text-lg font-semibold tracking-tight text-white">
                    {selected.subject}
                  </p>
                  <p className="font-mono text-xs text-[#94a3b8]">{selected.receivedAt}</p>
                </div>
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-[#cbd5e1]">
                {selected.body}
              </div>
              <div className="mt-5">
                <button
                  type="button"
                  onClick={handleReply}
                  disabled={loading}
                  className="btn-gradient inline-flex items-center gap-2 px-5 py-2.5 text-sm"
                >
                  {loading ? <Spinner className="size-4" /> : <Reply className="size-4" />}
                  Reply with AI
                </button>
              </div>
            </GlassCard>

            {draft && (
              <GlassCard className="animate-fade-in mt-4 border-dashed border-cyan-500/20">
                <p className="mb-3 text-sm font-semibold text-cyan-300">AI Draft Reply</p>
                <Markdown>{draft}</Markdown>
                {sources.length > 0 && (
                  <ul className="mt-4 space-y-1 border-t border-white/5 pt-3 font-mono text-xs text-[#94a3b8]">
                    {sources.map((s) => (
                      <li key={s.id}>
                        <span className="text-cyan-400">[{s.source}]</span> {s.title}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleApprove}
                    className="btn-gradient inline-flex items-center gap-2 px-5 py-2.5 text-sm"
                  >
                    <CheckCircle2 className="size-4" />
                    Approve & Send
                  </button>
                  {approved && (
                    <span className="text-sm text-emerald-400">
                      Sent (approval workflow completed)
                    </span>
                  )}
                </div>
              </GlassCard>
            )}
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
