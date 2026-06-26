import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';

type Attendee = { email: string; displayName?: string };

export const POST = withAuth(
  async (request, { user: _user }) => {
    try {
      const body = (await request.json()) as {
        title?: string;
        attendees?: Attendee[];
        description?: string;
        location?: string;
      };

      if (!body.title?.trim()) {
        return NextResponse.json({ error: 'title is required' }, { status: 400 });
      }

      const groqKey = process.env.GROQ_API_KEY;
      if (!groqKey) {
        return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
      }

      const attendeeList =
        body.attendees?.map((a) => `  - ${a.displayName ?? a.email} (${a.email})`).join('\n') ?? '';

      const systemPrompt = `You are Cortex, an executive briefing assistant. 
Given a meeting title, attendees, description, and location, produce a concise briefing.
Include:
1. **Context** — what this meeting is about based on the title and description
2. **Attendees** — who is there and their likely role/interest
3. **Talking points** — 2–4 bullet points the CEO should be ready to discuss
4. **Prep** — one thing to review beforehand

Be direct. No fluff. 3–4 short paragraphs max.`;

      const userPrompt = `Meeting: ${body.title}
${body.description ? `Description: ${body.description}` : ''}
${body.location ? `Location: ${body.location}` : ''}
${attendeeList ? `Attendees:\n${attendeeList}` : ''}

Write a briefing for the CEO.`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 512,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error');
        return NextResponse.json({ error: `Groq API error: ${errText}` }, { status: 502 });
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const briefing = data.choices?.[0]?.message?.content?.trim() ?? '';

      return NextResponse.json({ briefing });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },
  ['desk:read'],
);
