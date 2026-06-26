'use client';

import { useEffect, useState } from 'react';
import {
  ChatInput,
  ChatMessage,
  ChatMessageAvatar,
  ChatMessageContent,
  ChatWindow,
  SourceCitations,
  TypingIndicator,
  type SourceCitationProps,
} from '@cortex/ui';

import { AppShell } from '@/components/app-shell';
import { DeskToolbar } from '@/components/desk-toolbar';
import { TodayCompass } from '@/components/executive-desk/compass';
import { useActiveWorkspace } from '@/hooks/use-active-workspace';
import { useCortexUser } from '@/hooks/use-cortex-user';

type DeskMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceCitationProps[];
};

export function ExecutiveDeskPage() {
  const { user } = useCortexUser();
  const { effectiveProjectIds } = useActiveWorkspace();

  const [syncing, setSyncing] = useState(false);
  const [messages, setMessages] = useState<DeskMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Welcome${user?.name ? `, ${user.name.split(' ')[0]}` : ''}. Ask about emails, GitHub, HR, client workspaces, or anything connected — I'll cite sources.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/ingestion/status')
      .then((r) => r.json())
      .then((d: { active: boolean }) => setSyncing(d.active))
      .catch(() => null);
  }, []);

  async function handleAsk() {
    const question = input.trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content: question }]);
    setInput('');
    setLoading(true);

    try {
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const response = await fetch('/api/executive-ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          history,
          timezone,
          userName: user?.name?.split(' ')[0],
          projectIds: effectiveProjectIds,
        }),
      });
      const data = (await response.json()) as {
        answer?: string;
        sources?: SourceCitationProps[];
        error?: string;
      };

      if (!response.ok) throw new Error(data.error ?? 'Request failed');

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.answer ?? '',
          sources: data.sources,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: error instanceof Error ? error.message : 'Something went wrong.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const deskTitle = user?.role === 'client' ? 'Client Desk' : 'Executive Desk';
  const deskSubtitle =
    user?.role === 'client'
      ? 'Ask about your project — answers scoped to your workspace'
      : 'Cross-tool intelligence for leadership';

  return (
    <AppShell
      title={deskTitle}
      subtitle={deskSubtitle}
      badge={<DeskToolbar />}
      footer={
        <ChatInput
          value={input}
          onValueChange={setInput}
          onSubmit={handleAsk}
          isLoading={loading}
          placeholder="Ask about status, emails, repos, HR, or blockers…"
          variant="dark"
        />
      }
    >
      <div className="mx-auto w-full max-w-4xl px-4 pt-2">
        {syncing && (
          <div className="mb-2 rounded-lg border border-[#14b8a6]/20 bg-[#14b8a6]/5 px-3 py-2 text-center text-xs text-[#14b8a6]">
            Syncing your data… questions may not have full context until sync completes.
          </div>
        )}
        <TodayCompass />
      </div>
      <ChatWindow variant="dark" className="h-full">
        {messages.map((message) => (
          <ChatMessage key={message.id} role={message.role} variant="dark">
            {message.role === 'assistant' && (
              <ChatMessageAvatar fallback="CX" variant="cortex" theme="dark" />
            )}
            <div className="min-w-0 max-w-3xl flex-1">
              <ChatMessageContent
                markdown={message.role === 'assistant'}
                role={message.role}
                variant="dark"
              >
                {message.content}
              </ChatMessageContent>
              {message.sources && message.sources.length > 0 && (
                <SourceCitations sources={message.sources} variant="dark" />
              )}
            </div>
            {message.role === 'user' && (
              <ChatMessageAvatar fallback="You" variant="user" theme="dark" />
            )}
          </ChatMessage>
        ))}
        {loading && <TypingIndicator className="px-2 py-1" />}
      </ChatWindow>
    </AppShell>
  );
}
