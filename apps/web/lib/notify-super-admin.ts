import type { HrEmployeeApproval } from '@cortex/shared';
import { Pool } from 'pg';

import { sendGmailEmail } from './gmail';

export async function notifyApproversEmployeeApproval(
  tenantId: string,
  approval: HrEmployeeApproval,
  requestedByName: string,
): Promise<{ sent: boolean; warning?: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const link = `${baseUrl}/panel/approvals`;
  const d = approval.employeeData;
  const body = [
    'A new employee onboarding request needs approval.',
    '',
    `Requested by: ${requestedByName}`,
    `Name: ${d.fullName}`,
    `Email: ${d.email}`,
    `Department: ${d.department || '—'}`,
    `Designation: ${d.designation || '—'}`,
    `Salary: ${d.salaryMonthly} ${d.currency}`,
    '',
    `Review and approve: ${link}`,
  ].join('\n');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let recipients: string[] = [];
  try {
    const r = await pool.query<{ email: string }>(
      `SELECT email FROM "user"
       WHERE "tenantId" = $1 AND role IN ('ceo', 'client')
       ORDER BY CASE role WHEN 'ceo' THEN 0 ELSE 1 END, email`,
      [tenantId],
    );
    recipients = r.rows.map((row) => row.email).filter(Boolean);
  } finally {
    await pool.end();
  }

  if (!recipients.length) {
    return { sent: false, warning: 'No CEO or client approver email found for this company.' };
  }

  let sentAny = false;
  let lastError: string | undefined;

  for (const to of recipients) {
    try {
      await sendGmailEmail(tenantId, {
        to,
        subject: 'New employee approval request',
        body,
      });
      sentAny = true;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(
        JSON.stringify({
          level: 'warn',
          event: 'approval_email_failed',
          tenantId,
          approvalId: approval.id,
          to,
          error: lastError,
        }),
      );
    }
  }

  if (sentAny) return { sent: true };
  return {
    sent: false,
    warning:
      lastError ??
      'Could not send approval email — connect Google Workspace in Connectors, or check server logs.',
  };
}

/** @deprecated Use notifyApproversEmployeeApproval */
export const notifySuperAdminEmployeeApproval = notifyApproversEmployeeApproval;
