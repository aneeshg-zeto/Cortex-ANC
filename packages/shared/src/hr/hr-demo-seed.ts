import type pg from 'pg';

import { getPool } from '../db/tenant-pool';

export type DemoEmployeeSeed = {
  fullName: string;
  department: string;
  designation: string;
  salaryMonthly: number;
  email?: string;
};

/** Zeto Studio roster — ~30 INR employees for demo HR. */
export const DEMO_HR_EMPLOYEES: DemoEmployeeSeed[] = [
  {
    fullName: 'Aarav Mehta',
    department: 'Engineering',
    designation: 'Staff Engineer',
    salaryMonthly: 285000,
  },
  {
    fullName: 'Priya Nair',
    department: 'Engineering',
    designation: 'Senior Engineer',
    salaryMonthly: 210000,
  },
  {
    fullName: 'Rohan Kapoor',
    department: 'Engineering',
    designation: 'Senior Engineer',
    salaryMonthly: 205000,
  },
  {
    fullName: 'Sneha Iyer',
    department: 'Engineering',
    designation: 'Engineer',
    salaryMonthly: 165000,
  },
  {
    fullName: 'Vikram Das',
    department: 'Engineering',
    designation: 'Engineer',
    salaryMonthly: 158000,
  },
  {
    fullName: 'Ananya Reddy',
    department: 'Engineering',
    designation: 'Engineer',
    salaryMonthly: 162000,
  },
  {
    fullName: 'Karthik Menon',
    department: 'Engineering',
    designation: 'Engineer',
    salaryMonthly: 155000,
  },
  {
    fullName: 'Divya Pillai',
    department: 'Engineering',
    designation: 'QA Lead',
    salaryMonthly: 175000,
  },
  {
    fullName: 'Arjun Bose',
    department: 'Engineering',
    designation: 'DevOps Engineer',
    salaryMonthly: 190000,
  },
  {
    fullName: 'Meera Shah',
    department: 'Engineering',
    designation: 'Frontend Engineer',
    salaryMonthly: 168000,
  },
  {
    fullName: 'Nikhil Verma',
    department: 'Engineering',
    designation: 'Backend Engineer',
    salaryMonthly: 172000,
  },
  {
    fullName: 'Isha Gupta',
    department: 'Engineering',
    designation: 'ML Engineer',
    salaryMonthly: 220000,
  },
  {
    fullName: 'Aditya Khanna',
    department: 'Product',
    designation: 'Head of Product',
    salaryMonthly: 310000,
  },
  {
    fullName: 'Ritika Malhotra',
    department: 'Product',
    designation: 'Product Manager',
    salaryMonthly: 195000,
  },
  {
    fullName: 'Sameer Joshi',
    department: 'Product',
    designation: 'Product Manager',
    salaryMonthly: 188000,
  },
  {
    fullName: 'Pooja Saxena',
    department: 'Product',
    designation: 'Associate PM',
    salaryMonthly: 140000,
  },
  {
    fullName: 'Neha Bansal',
    department: 'Design',
    designation: 'Design Lead',
    salaryMonthly: 200000,
  },
  {
    fullName: 'Tarun Agarwal',
    department: 'Design',
    designation: 'Product Designer',
    salaryMonthly: 155000,
  },
  {
    fullName: 'Kavya Srinivasan',
    department: 'Design',
    designation: 'UX Researcher',
    salaryMonthly: 145000,
  },
  {
    fullName: 'Rahul Choudhury',
    department: 'Sales',
    designation: 'Sales Director',
    salaryMonthly: 275000,
  },
  {
    fullName: 'Shreya Patel',
    department: 'Sales',
    designation: 'Account Executive',
    salaryMonthly: 165000,
  },
  {
    fullName: 'Manish Tiwari',
    department: 'Sales',
    designation: 'Account Executive',
    salaryMonthly: 158000,
  },
  { fullName: 'Lakshmi Rao', department: 'Sales', designation: 'SDR', salaryMonthly: 95000 },
  { fullName: 'Deepak Singh', department: 'HR', designation: 'HR Manager', salaryMonthly: 175000 },
  { fullName: 'Anjali Desai', department: 'HR', designation: 'People Ops', salaryMonthly: 120000 },
  {
    fullName: 'Suresh Kumar',
    department: 'Finance',
    designation: 'Finance Lead',
    salaryMonthly: 240000,
  },
  {
    fullName: 'Nandini Krishnan',
    department: 'Finance',
    designation: 'Accountant',
    salaryMonthly: 110000,
  },
  {
    fullName: 'Harsh Vora',
    department: 'Operations',
    designation: 'Ops Manager',
    salaryMonthly: 185000,
  },
  {
    fullName: 'Yash Mittal',
    department: 'Operations',
    designation: 'Office Manager',
    salaryMonthly: 85000,
  },
  {
    fullName: 'Zara Ahmed',
    department: 'Operations',
    designation: 'IT Support',
    salaryMonthly: 78000,
  },
];

export type SeedHrDemoOptions = {
  employees?: DemoEmployeeSeed[];
  devEmployeeEmail?: string;
  publishedByUserId?: string | null;
};

async function withTenantTx<T>(
  client: pg.PoolClient,
  tenantId: string,
  fn: () => Promise<T>,
): Promise<T> {
  await client.query('BEGIN');
  await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
  await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
  try {
    const result = await fn();
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

function slugEmail(fullName: string, domain = 'zetostudio.com'): string {
  return `${fullName.toLowerCase().replace(/\s+/g, '.')}@${domain}`;
}

function payslipDeductions(gross: number) {
  return [
    { label: 'PF (12%)', amount: Math.round(gross * 0.12) },
    { label: 'Professional Tax', amount: 200 },
  ];
}

export async function seedHrDemoData(
  tenantId: string,
  options: SeedHrDemoOptions & { force?: boolean } = {},
): Promise<{ employeeCount: number }> {
  const pool = getPool();
  const client = await pool.connect();
  const employees = options.employees ?? DEMO_HR_EMPLOYEES;
  const devEmployeeEmail = options.devEmployeeEmail ?? 'employee@cortex.local';

  try {
    return await withTenantTx(client, tenantId, async () => {
      const existing = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM hr_employees WHERE tenant_id = $1`,
        [tenantId],
      );
      const existingCount = Number(existing.rows[0]?.count ?? 0);

      if (existingCount === 0 || options.force) {
        if (options.force && existingCount > 0) {
          await client.query(`DELETE FROM hr_payslips WHERE tenant_id = $1`, [tenantId]);
          await client.query(`DELETE FROM hr_payroll_runs WHERE tenant_id = $1`, [tenantId]);
          await client.query(`DELETE FROM hr_leave_requests WHERE tenant_id = $1`, [tenantId]);
          await client.query(`DELETE FROM hr_emergency_notices WHERE tenant_id = $1`, [tenantId]);
          await client.query(`DELETE FROM hr_employees WHERE tenant_id = $1`, [tenantId]);
        }

        const now = new Date();
        const joinBase = new Date(now);
        joinBase.setFullYear(joinBase.getFullYear() - 2);

        for (let i = 0; i < employees.length; i++) {
          const emp = employees[i];
          const empId = `emp-demo-${tenantId.slice(0, 8)}-${String(i + 1).padStart(2, '0')}`;
          const join = new Date(joinBase);
          join.setMonth(join.getMonth() + i);
          const email =
            i === 0 && devEmployeeEmail
              ? devEmployeeEmail
              : (emp.email ??
                slugEmail(
                  emp.fullName,
                  tenantId.includes('hr-dev') ? 'cortex.local' : 'zetostudio.com',
                ));

          await client.query(
            `INSERT INTO hr_employees (
               id, tenant_id, employee_code, full_name, email, department, designation,
               join_date, status, salary_monthly, currency, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, 'active', $9, 'INR', NOW())
             ON CONFLICT (tenant_id, employee_code) DO UPDATE SET
               full_name = EXCLUDED.full_name,
               email = EXCLUDED.email,
               department = EXCLUDED.department,
               designation = EXCLUDED.designation,
               salary_monthly = EXCLUDED.salary_monthly,
               status = 'active',
               updated_at = NOW()`,
            [
              empId,
              tenantId,
              `ZS-${String(i + 1).padStart(3, '0')}`,
              emp.fullName,
              email,
              emp.department,
              emp.designation,
              join.toISOString().slice(0, 10),
              emp.salaryMonthly,
            ],
          );
        }
      }

      const empRows = await client.query<{ id: string; salary_monthly: string }>(
        `SELECT id, salary_monthly::text FROM hr_employees WHERE tenant_id = $1 AND status = 'active' ORDER BY employee_code`,
        [tenantId],
      );
      if (!empRows.rows.length) return { employeeCount: 0 };

      const now = new Date();
      const periodLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      const payrollId = `payroll-demo-${tenantId.slice(0, 8)}-${now.toISOString().slice(0, 7)}`;

      const payrollExists = await client.query(`SELECT 1 FROM hr_payroll_runs WHERE id = $1`, [
        payrollId,
      ]);
      if (!payrollExists.rows.length) {
        const slipRows = empRows.rows.map((row) => {
          const gross = Number(row.salary_monthly);
          const deductions = payslipDeductions(gross);
          const net = Math.max(0, gross - deductions.reduce((s, d) => s + d.amount, 0));
          return { row, gross, deductions, net };
        });
        const totalGross = slipRows.reduce((s, r) => s + r.gross, 0);
        const totalNet = slipRows.reduce((s, r) => s + r.net, 0);

        await client.query(
          `INSERT INTO hr_payroll_runs (
             id, tenant_id, period_label, period_start, period_end, status,
             total_gross, total_net, employee_count, processed_at, updated_at
           ) VALUES ($1, $2, $3, date_trunc('month', NOW())::date,
             (date_trunc('month', NOW()) + INTERVAL '1 month - 1 day')::date,
             'completed', $4, $5, $6, NOW(), NOW())
           ON CONFLICT (id) DO NOTHING`,
          [payrollId, tenantId, periodLabel, totalGross, totalNet, empRows.rows.length],
        );

        for (const { row, gross, deductions, net } of slipRows) {
          const slipId = `slip-${row.id}-${now.toISOString().slice(0, 7)}`;
          await client.query(
            `INSERT INTO hr_payslips (
               id, tenant_id, employee_id, payroll_run_id, period_label,
               gross_pay, deductions, net_pay, status, issued_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, 'issued', NOW(), NOW())
             ON CONFLICT (id) DO NOTHING`,
            [
              slipId,
              tenantId,
              row.id,
              payrollId,
              periodLabel,
              gross,
              JSON.stringify(deductions),
              net,
            ],
          );
        }
      }

      const leaveExists = await client.query(
        `SELECT 1 FROM hr_leave_requests WHERE tenant_id = $1 LIMIT 1`,
        [tenantId],
      );
      if (!leaveExists.rows.length) {
        const ids = empRows.rows.map((r) => r.id);
        const leaveSpecs: {
          empIdx: number;
          type: string;
          days: number;
          offsetStart: number;
          status: 'pending' | 'approved' | 'rejected';
          reason: string;
        }[] = [
          {
            empIdx: 3,
            type: 'annual',
            days: 3,
            offsetStart: 7,
            status: 'pending',
            reason: 'Family visit',
          },
          {
            empIdx: 8,
            type: 'sick',
            days: 1,
            offsetStart: 2,
            status: 'pending',
            reason: 'Medical appointment',
          },
          {
            empIdx: 12,
            type: 'annual',
            days: 5,
            offsetStart: 14,
            status: 'pending',
            reason: 'Vacation',
          },
          {
            empIdx: 1,
            type: 'annual',
            days: 2,
            offsetStart: -5,
            status: 'approved',
            reason: 'Long weekend',
          },
          {
            empIdx: 5,
            type: 'sick',
            days: 2,
            offsetStart: -12,
            status: 'approved',
            reason: 'Flu recovery',
          },
          {
            empIdx: 18,
            type: 'annual',
            days: 4,
            offsetStart: 21,
            status: 'approved',
            reason: 'Wedding',
          },
          {
            empIdx: 22,
            type: 'casual',
            days: 1,
            offsetStart: 4,
            status: 'approved',
            reason: 'Personal errand',
          },
          {
            empIdx: 9,
            type: 'annual',
            days: 6,
            offsetStart: 30,
            status: 'rejected',
            reason: 'Peak sprint overlap',
          },
        ];

        for (let i = 0; i < leaveSpecs.length; i++) {
          const spec = leaveSpecs[i];
          const empId = ids[spec.empIdx % ids.length];
          const start = new Date(now);
          start.setDate(start.getDate() + spec.offsetStart);
          const end = new Date(start);
          end.setDate(end.getDate() + spec.days - 1);
          const leaveId = `leave-demo-${tenantId.slice(0, 8)}-${i + 1}`;

          await client.query(
            `INSERT INTO hr_leave_requests (
               id, tenant_id, employee_id, leave_type, start_date, end_date, days, reason, status, updated_at
             ) VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8, $9, NOW())
             ON CONFLICT (id) DO NOTHING`,
            [
              leaveId,
              tenantId,
              empId,
              spec.type,
              start.toISOString().slice(0, 10),
              end.toISOString().slice(0, 10),
              spec.days,
              spec.reason,
              spec.status,
            ],
          );
        }
      }

      const noticeExists = await client.query(
        `SELECT 1 FROM hr_emergency_notices WHERE tenant_id = $1 LIMIT 1`,
        [tenantId],
      );
      if (!noticeExists.rows.length) {
        const publishedBy = options.publishedByUserId ?? null;
        await client.query(
          `INSERT INTO hr_emergency_notices (
             id, tenant_id, title, body, severity, target_scope, published_by, expires_at, updated_at
           ) VALUES ($1, $2, $3, $4, 'warning', 'all', $5, NOW() + INTERVAL '30 days', NOW())
           ON CONFLICT (id) DO NOTHING`,
          [
            `notice-demo-${tenantId.slice(0, 8)}-1`,
            tenantId,
            'Monsoon office safety advisory',
            'Please avoid non-essential travel during heavy rain. WFH is available for affected zones — confirm with your manager.',
            publishedBy,
          ],
        );
        await client.query(
          `INSERT INTO hr_emergency_notices (
             id, tenant_id, title, body, severity, target_scope, published_by, expires_at, updated_at
           ) VALUES ($1, $2, $3, $4, 'info', 'all', $5, NULL, NOW())
           ON CONFLICT (id) DO NOTHING`,
          [
            `notice-demo-${tenantId.slice(0, 8)}-2`,
            tenantId,
            'Q2 benefits enrollment open',
            'Health insurance add-ons and flexi benefits close on the 25th. Visit the HR portal or email people-ops.',
            publishedBy,
          ],
        );
      }

      return { employeeCount: empRows.rows.length };
    });
  } finally {
    client.release();
  }
}

export async function tenantHasHrData(tenantId: string): Promise<boolean> {
  const pool = getPool();
  const r = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM hr_employees WHERE tenant_id = $1`,
    [tenantId],
  );
  return Number(r.rows[0]?.count ?? 0) > 0;
}
