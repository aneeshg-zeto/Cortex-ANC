import { NextResponse } from 'next/server';
import { askQuestion } from '@cortex/agent-core';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { question?: string };

    if (!body.question?.trim()) {
      return NextResponse.json({ error: 'question is required' }, { status: 400 });
    }

    const result = await askQuestion(body.question.trim());

    return NextResponse.json({
      answer: result.answer,
      sources: result.sources.map((s) => ({
        id: s.id,
        title: s.title,
        source: s.source,
        excerpt: s.excerpt,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
