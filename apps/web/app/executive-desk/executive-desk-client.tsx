'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, Mail, MessageSquare } from 'lucide-react';
import {
  Badge,
  ChatInput,
  ChatMessage,
  ChatMessageAvatar,
  ChatMessageContent,
  ChatWindow,
  CortexLogo,
  PanelGroup,
  Panel,
  PanelHandle,
  SourceCitations,
  Spinner,
  type SourceCitationProps,
} from '@cortex/ui';

type DeskMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceCitationProps[];
};

const NAV = [
  { href: '/executive-desk', label: 'Executive Desk', icon: LayoutDashboard, active: true },
  { href: '/clients-desk', label: 'Clients Desk', icon: Mail, active: false },
  { href: '/chat', label: 'Brain Chat', icon: MessageSquare, active: false },
];

export function ExecutiveDeskPage() {
  const [messages, setMessages] = useState<DeskMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Welcome to the Executive Desk. Ask about project status, risks, or cross-tool updates — I will cite sources from Linear, Slack, GitHub, and more.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleAsk() {
    const question = input.trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content: question }]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/executive-ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
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

  return (
    <div className="flex h-screen flex-col">
      <PanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <Panel defaultSize={20} minSize={16} maxSize={28}>
          <aside className="flex h-full flex-col border-r border-white/5 bg-[#0a0b14]/90 backdrop-blur-xl">
            <div className="border-b border-white/5 p-5">
              <Link href="/">
                <CortexLogo />
              </Link>
              <p className="mt-2 text-xs text-[#94a3b8]">Single Brain OS</p>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {NAV.map(({ href, label, icon: Icon, active }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
                    active
                      ? 'bg-gradient-to-r from-blue-500/20 to-purple-600/20 text-white shadow-[0_0_16px_rgba(59,130,246,0.15)]'
                      : 'text-[#94a3b8] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              ))}
            </nav>
            <div className="space-y-3 border-t border-white/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-[#94a3b8]">
                Integrations
              </p>
              {['Slack', 'Linear', 'GitHub', 'Gmail', 'Notion'].map((tool) => (
                <div
                  key={tool}
                  className="glass flex items-center gap-2 px-3 py-2 text-sm text-[#cbd5e1]"
                >
                  <span className="size-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
                  {tool}
                </div>
              ))}
              <Badge variant="live">Vector RAG active</Badge>
            </div>
          </aside>
        </Panel>
        <PanelHandle withHandle />
        <Panel defaultSize={80} minSize={55}>
          <div className="flex h-full flex-col">
            <header className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <div>
                <h1 className="gradient-text gradient-text-glow text-xl font-bold tracking-tight">
                  Executive Desk
                </h1>
                <p className="text-sm text-[#94a3b8]">Cross-tool intelligence for leadership</p>
              </div>
              <Badge variant="cyan">Groq / Ollama</Badge>
            </header>
            <ChatWindow>
              {messages.map((message) => (
                <ChatMessage key={message.id} role={message.role}>
                  {message.role === 'assistant' && (
                    <ChatMessageAvatar fallback="CX" variant="cortex" />
                  )}
                  <div className="max-w-[85%]">
                    <ChatMessageContent
                      markdown={message.role === 'assistant'}
                      role={message.role}
                    >
                      {message.content}
                    </ChatMessageContent>
                    {message.sources && message.sources.length > 0 && (
                      <SourceCitations sources={message.sources} />
                    )}
                  </div>
                  {message.role === 'user' && (
                    <ChatMessageAvatar fallback="CEO" variant="user" />
                  )}
                </ChatMessage>
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-sm text-cyan-300/80">
                  <Spinner />
                  Cortex is thinking…
                </div>
              )}
            </ChatWindow>
            <div className="border-t border-white/5 p-5">
              <ChatInput
                value={input}
                onValueChange={setInput}
                onSubmit={handleAsk}
                isLoading={loading}
                placeholder="What is the status of the Acme project?"
              />
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
