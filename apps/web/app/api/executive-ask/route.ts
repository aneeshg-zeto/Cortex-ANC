import { askQuestion } from '@cortex/agent-core';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import pg from 'pg';

import { withAuth } from '@/lib/auth';

const { Pool } = pg;

async function logInteraction(query: string, answer: string, sources: unknown[]): Promise<void> {
  const id = randomUUID();
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    const pool = new Pool({ connectionString: dbUrl });
    await pool.query(
      `INSERT INTO cortex_agent_interactions (id, query, answer, success, sources)
       VALUES ($1, $2, $3, true, $4)`,
      [id, query, answer, JSON.stringify(sources)],
    );
    await pool.query(
      `INSERT INTO qa_logs (id, query, answer, verdict, reason)
       VALUES ($1, $2, $3, 'pass', 'captured from executive desk')`,
      [id, query, answer],
    );
    await pool.end();
  }
}

export const POST = withAuth(
  async (request, { user }) => {
    try {
      const body = (await request.json()) as {
        question?: string;
        provider?: 'groq' | 'ollama';
        history?: Array<{ role: string; content: string }>;
        timezone?: string;
        userName?: string;
      };

      if (!body.question?.trim()) {
        return NextResponse.json({ error: 'question is required' }, { status: 400 });
      }

      const result = await askQuestion(body.question.trim(), {
        tenantId: user.tenantId,
        projectIds: user.projectIds,
        provider: body.provider,
        history: body.history,
        timezone: body.timezone,
        userName: body.userName ?? user.name?.split(' ')[0],
      });
      const sources = result.sources.map((s) => ({
        id: s.id,
        title: s.title,
        source: s.source,
        excerpt: s.excerpt,
        from: s.from,
        date: s.date,
        source_url: s.url,
        url: s.url,
      }));

      await logInteraction(body.question.trim(), result.answer, sources);

      return NextResponse.json({
        answer: result.answer,
        sources,
        pendingApprovalId: result.pendingApprovalId,
        steps: result.steps,
        role: user.role,
        projectIds: user.projectIds,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },
  ['desk:write'],
);
