import { draftClientReply } from '@cortex/agent-core';
import { startHandleClientReplyWorkflow } from '@cortex/shared/temporal/client';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { emailContent?: string; subject?: string };

    if (!body.emailContent?.trim()) {
      return NextResponse.json({ error: 'emailContent is required' }, { status: 400 });
    }

    const emailWithSubject = body.subject
      ? `Subject: ${body.subject}\n\n${body.emailContent.trim()}`
      : body.emailContent.trim();

    const result = await draftClientReply(emailWithSubject);

    if (result.pendingApprovalId) {
      await startHandleClientReplyWorkflow({
        approvalId: result.pendingApprovalId,
        emailContent: emailWithSubject,
        draft: result.draft,
      });
    }

    return NextResponse.json({
      draft: result.draft,
      pendingApprovalId: result.pendingApprovalId,
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
