import { NextResponse } from 'next/server';
import { askQuestion } from '@cortex/agent-core';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { prompt?: string };

    if (!body.prompt?.trim()) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const result = await askQuestion(body.prompt.trim());
    return NextResponse.json({ answer: result.answer, sources: result.sources });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
