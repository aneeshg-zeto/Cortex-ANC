import type { HrEmployeeApproval } from '@cortex/shared';

import { sendGmailEmail } from './gmail';

const PLATFORM_NOTIFY_EMAIL = process.env.PLATFORM_NOTIFY_EMAIL?.trim() || 'aneeshg@zeto.studio';

export async function notifySuperAdminEmployeeApproval(
  tenantId: string,
  approval: HrEmployeeApproval,
  requestedByName: string,
): Promise<{ sent: boolean; warning?: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const link = `${baseUrl}/panel/approvals`;
  const d = approval.employeeData;
  const body = [
    'A new employee onboarding request needs your approval.',
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

  try {
    await sendGmailEmail(tenantId, {
      to: PLATFORM_NOTIFY_EMAIL,
      subject: 'New Employee Approval Request',
      body,
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'approval_email_failed',
        tenantId,
        approvalId: approval.id,
        to: PLATFORM_NOTIFY_EMAIL,
        error: message,
      }),
    );
    return {
      sent: false,
      warning:
        'Could not send approval email — connect Google Workspace in Connectors, or check server logs.',
    };
  }
}
