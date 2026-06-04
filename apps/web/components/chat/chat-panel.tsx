'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ChatInput,
  ChatMessage,
  ChatMessageAvatar,
  ChatMessageContent,
  ChatWindow,
  CortexLogo,
  Spinner,
} from '@cortex/ui';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Welcome to Cortex — the Single Brain for Your Entire Business. Ask me anything about your company data.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const prompt = input.trim();
    if (!prompt || loading) return;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content: prompt }]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Failed to get response');
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: data.answer ?? 'No response.' },
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
    <div className="mx-auto flex h-[calc(100vh-4rem)] w-full max-w-4xl flex-col gap-4 p-4 md:p-6">
      <div className="glass flex items-center justify-between p-4">
        <CortexLogo />
        <Link href="/executive-desk" className="btn-outline-glass px-3 py-1.5 text-xs">
          Executive Desk →
        </Link>
      </div>
      <div className="glass flex min-h-0 flex-1 flex-col overflow-hidden">
        <ChatWindow>
          {messages.map((message) => (
            <ChatMessage key={message.id} role={message.role}>
              {message.role === 'assistant' && (
                <ChatMessageAvatar fallback="CX" variant="cortex" />
              )}
              <ChatMessageContent markdown={message.role === 'assistant'} role={message.role}>
                {message.content}
              </ChatMessageContent>
              {message.role === 'user' && (
                <ChatMessageAvatar fallback="You" variant="user" />
              )}
            </ChatMessage>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-cyan-300/80">
              <Spinner />
              Thinking…
            </div>
          )}
        </ChatWindow>
        <div className="border-t border-white/5 p-4">
          <ChatInput
            value={input}
            onValueChange={setInput}
            onSubmit={handleSubmit}
            isLoading={loading}
            placeholder="Ask Cortex about project status, team updates…"
          />
        </div>
      </div>
    </div>
  );
}
