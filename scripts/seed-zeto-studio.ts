#!/usr/bin/env bun
/**
 * Seed Zeto Studio demo data (~30 employees, connectors, brain docs, studio metrics).
 *
 * Usage (after sign-up + Zeto CEO code):
 *   bun run seed:zeto -- --email=you@company.com
 *   bun run seed:zeto -- --tenant-id=tenant-abc12345
 *   bun run seed:zeto -- --latest
 */
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type pg from 'pg';

import { getPool } from '../packages/shared/src/db/tenant-pool.ts';
import { seedHrDemoData } from '../packages/shared/src/hr/hr-demo-seed.ts';

const envPath = path.resolve(import.meta.dir, '../.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const DB_URL = process.env.DATABASE_URL ?? 'postgresql://cortex:cortex@localhost:5434/cortex';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

const EMPLOYEES: {
  fullName: string;
  department: string;
  designation: string;
  salaryMonthly: number;
}[] = [
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

const CONNECTORS = ['google-workspace', 'github', 'slack', 'notion', 'linear'] as const;

const QA_SAMPLES = [
  'What blocked the Cortex launch last week?',
  'Summarize open GitHub PRs for platform repo',
  'Which clients asked about billing this month?',
  'Headcount by department at Zeto Studio',
  'Top risks from Slack #leadership channel',
  'Revenue pipeline status for Q2',
  'Who owns the onboarding workflow?',
  'Latest payroll exposure vs last month',
  'Engineering hiring plan for H2',
  'Customer churn signals from support email',
  'Compare sprint velocity across teams',
  'What did we commit to in the board deck?',
  'List overdue invoices from finance',
  'Security review status for new connectors',
  'Summarize Notion product roadmap changes',
];

async function resolveTenant(pool: pg.Pool): Promise<{
  tenantId: string;
  userId: string | null;
  email: string | null;
}> {
  const tenantIdArg = arg('tenant-id');
  const emailArg = arg('email');
  const latest = process.argv.includes('--latest');

  if (tenantIdArg) {
    const r = await pool.query<{ id: string }>(`SELECT id FROM tenants WHERE id = $1`, [
      tenantIdArg,
    ]);
    if (!r.rows[0]) throw new Error(`Tenant not found: ${tenantIdArg}`);
    const u = await pool.query<{ id: string; email: string }>(
      `SELECT id, email FROM "user" WHERE "tenantId" = $1 ORDER BY created_at LIMIT 1`,
      [tenantIdArg],
    );
    return {
      tenantId: tenantIdArg,
      userId: u.rows[0]?.id ?? null,
      email: u.rows[0]?.email ?? null,
    };
  }

  if (emailArg) {
    const u = await pool.query<{ id: string; tenantId: string | null; email: string }>(
      `SELECT id, "tenantId", email FROM "user" WHERE lower(email) = lower($1) LIMIT 1`,
      [emailArg],
    );
    if (!u.rows[0]?.tenantId) {
      throw new Error(`No user/tenant for email ${emailArg}. Sign up first, then re-run seed.`);
    }
    return { tenantId: u.rows[0].tenantId, userId: u.rows[0].id, email: u.rows[0].email };
  }

  if (latest) {
    const t = await pool.query<{ id: string }>(
      `SELECT id FROM tenants ORDER BY created_at DESC LIMIT 1`,
    );
    if (!t.rows[0]) throw new Error('No tenants in database. Sign up first.');
    const u = await pool.query<{ id: string; email: string }>(
      `SELECT id, email FROM "user" WHERE "tenantId" = $1 ORDER BY created_at LIMIT 1`,
      [t.rows[0].id],
    );
    return {
      tenantId: t.rows[0].id,
      userId: u.rows[0]?.id ?? null,
      email: u.rows[0]?.email ?? null,
    };
  }

  throw new Error('Pass --email=you@co.com, --tenant-id=..., or --latest');
}

async function withTenant<T>(
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

async function clearTenantDemo(client: pg.PoolClient, tenantId: string) {
  await withTenant(client, tenantId, async () => {
    await client.query(`DELETE FROM hr_payslips WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM hr_payroll_runs WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM hr_leave_requests WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM hr_emergency_notices WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM hr_employees WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM cortex_edges WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM cortex_nodes WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM cortex_documents WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM qa_logs WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM ingestion_progress WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM connector_health WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM tenant_projects WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM tenant_github_scope WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM workflows WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM studio_notebooks WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM user_layouts WHERE tenant_id = $1`, [tenantId]);
  });
}

async function seed(client: pg.PoolClient, tenantId: string, userId: string | null) {
  await client.query(`UPDATE tenants SET name = $2, slug = 'zeto-studio' WHERE id = $1`, [
    tenantId,
    'Zeto Studio',
  ]);

  if (userId) {
    await client.query(`UPDATE "user" SET role = 'ceo' WHERE id = $1`, [userId]);
  }

  await withTenant(client, tenantId, async () => {
    // Connectors + ingestion
    for (const provider of CONNECTORS) {
      const docTotal = provider === 'google-workspace' ? 420 : provider === 'github' ? 180 : 90;
      await client.query(
        `INSERT INTO connector_health (tenant_id, provider, status, last_sync_at, metadata)
         VALUES ($1, $2, 'connected', NOW() - INTERVAL '2 hours', $3::jsonb)
         ON CONFLICT (tenant_id, provider) DO UPDATE SET
           status = 'connected', last_sync_at = NOW() - INTERVAL '2 hours', metadata = EXCLUDED.metadata`,
        [tenantId, provider, JSON.stringify({ seeded: true, label: provider })],
      );
      await client.query(
        `INSERT INTO ingestion_progress (tenant_id, provider, total_documents, processed_documents, status, updated_at)
         VALUES ($1, $2, $3, $3, 'complete', NOW())
         ON CONFLICT (tenant_id, provider) DO UPDATE SET
           total_documents = EXCLUDED.total_documents,
           processed_documents = EXCLUDED.processed_documents,
           status = 'complete',
           updated_at = NOW()`,
        [tenantId, provider, docTotal],
      );
    }

    await client.query(
      `INSERT INTO tenant_github_scope (tenant_id, selected_repos, verified_at, updated_at)
       VALUES ($1, $2::jsonb, NOW(), NOW())
       ON CONFLICT (tenant_id) DO UPDATE SET
         selected_repos = EXCLUDED.selected_repos,
         verified_at = NOW(),
         updated_at = NOW()`,
      [
        tenantId,
        JSON.stringify([
          'zeto-studio/cortex-platform',
          'zeto-studio/mobile-app',
          'zeto-studio/design-system',
        ]),
      ],
    );

    const projectId = `proj-${randomUUID().slice(0, 8)}`;
    await client.query(
      `INSERT INTO tenant_projects (id, tenant_id, name, slug, github_repos, updated_at)
       VALUES ($1, $2, 'Cortex Platform', 'cortex-platform', $3::jsonb, NOW())
       ON CONFLICT (tenant_id, slug) DO UPDATE SET github_repos = EXCLUDED.github_repos, updated_at = NOW()`,
      [
        projectId,
        tenantId,
        JSON.stringify(['zeto-studio/cortex-platform', 'zeto-studio/design-system']),
      ],
    );

    await client.query(
      `INSERT INTO tenant_projects (id, tenant_id, name, slug, github_repos, updated_at)
       VALUES ($1, $2, 'Mobile App', 'mobile-app', $3::jsonb, NOW())
       ON CONFLICT (tenant_id, slug) DO NOTHING`,
      [`proj-${randomUUID().slice(0, 8)}`, tenantId, JSON.stringify(['zeto-studio/mobile-app'])],
    );

    await client.query(
      `UPDATE tenant_onboarding
       SET status = 'complete', step = 'ready',
           progress = COALESCE(progress, '{}'::jsonb) || $2::jsonb,
           updated_at = NOW()
       WHERE tenant_id = $1`,
      [
        tenantId,
        JSON.stringify({
          googleConnected: true,
          githubConnected: true,
          learnedCompanyTier: 2,
          learnedSignals: { employees: EMPLOYEES.length, connectors: CONNECTORS.length },
        }),
      ],
    );

    // HR roster, payroll, payslips, leave, notices — via seedHrDemoData in main()

    // Documents for KPIs + studio widgets
    const docSources: { source: string; type?: string; count: number }[] = [
      { source: 'gmail', count: 48 },
      { source: 'github', type: 'issue', count: 22 },
      { source: 'github', type: 'pull_request', count: 18 },
      { source: 'slack', count: 35 },
      { source: 'notion', count: 28 },
      { source: 'linear', count: 15 },
    ];

    let docIdx = 0;
    for (const spec of docSources) {
      for (let j = 0; j < spec.count; j++) {
        docIdx++;
        const daysAgo = docIdx % 14;
        await client.query(
          `INSERT INTO cortex_documents (id, content, metadata, tenant_id, created_at)
           VALUES ($1, $2, $3::jsonb, $4, NOW() - ($5 || ' days')::interval)
           ON CONFLICT (id) DO NOTHING`,
          [
            `zeto-doc-${docIdx}`,
            `Zeto Studio ${spec.source} record #${docIdx}: operational context for Cortex demo.`,
            JSON.stringify({
              source: spec.source,
              type: spec.type ?? 'message',
              title: `${spec.source} item ${docIdx}`,
              project_id: 'cortex-platform',
            }),
            tenantId,
            String(daysAgo),
          ],
        );
      }
    }

    // Knowledge graph
    const nodes: { id: string; label: string; type: string }[] = [
      { id: 'zeto-exec', label: 'Executive Desk', type: 'Project' },
      { id: 'zeto-studio', label: 'Zeto Studio', type: 'Company' },
      { id: 'zeto-cortex', label: 'Cortex Platform', type: 'Project' },
      { id: 'zeto-mobile', label: 'Mobile App', type: 'Project' },
      { id: 'zeto-ceo', label: 'Workspace CEO', type: 'Person' },
      { id: 'zeto-github', label: 'GitHub', type: 'Connector' },
      { id: 'zeto-slack', label: 'Slack', type: 'Connector' },
      { id: 'zeto-notion', label: 'Notion', type: 'Connector' },
      { id: 'zeto-eng-201', label: 'ENG-201', type: 'Ticket' },
      { id: 'zeto-deal-acme', label: 'Acme Enterprise', type: 'Deal' },
    ];
    for (const n of nodes) {
      await client.query(
        `INSERT INTO cortex_nodes (id, label, type, properties, tenant_id, updated_at)
         VALUES ($1, $2, $3, '{}'::jsonb, $4, NOW())
         ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, type = EXCLUDED.type, tenant_id = EXCLUDED.tenant_id`,
        [n.id, n.label, n.type, tenantId],
      );
    }
    const edges = [
      ['zeto-ceo', 'zeto-exec', 'OWNS'],
      ['zeto-exec', 'zeto-cortex', 'TRACKS'],
      ['zeto-cortex', 'zeto-github', 'SYNCED_FROM'],
      ['zeto-cortex', 'zeto-slack', 'SYNCED_FROM'],
      ['zeto-cortex', 'zeto-notion', 'SYNCED_FROM'],
      ['zeto-eng-201', 'zeto-cortex', 'PART_OF'],
      ['zeto-deal-acme', 'zeto-mobile', 'RELATED_TO'],
      ['zeto-studio', 'zeto-cortex', 'OWNS'],
      ['zeto-studio', 'zeto-mobile', 'OWNS'],
    ] as const;
    for (let i = 0; i < edges.length; i++) {
      const [from, to, type] = edges[i];
      await client.query(
        `INSERT INTO cortex_edges (id, from_id, to_id, type, properties, tenant_id)
         VALUES ($1, $2, $3, $4, '{}'::jsonb, $5)
         ON CONFLICT (id) DO NOTHING`,
        [`zeto-edge-${i}`, from, to, type, tenantId],
      );
    }

    // Q&A logs (studio timeline + KPI sparkline)
    for (let i = 0; i < QA_SAMPLES.length; i++) {
      const dayOffset = i % 7;
      await client.query(
        `INSERT INTO qa_logs (id, query, answer, verdict, tenant_id, created_at)
         VALUES ($1, $2, $3, 'ok', $4, NOW() - ($5 || ' days')::interval)
         ON CONFLICT (id) DO NOTHING`,
        [
          `zeto-qa-${i}`,
          QA_SAMPLES[i],
          'Seeded demo answer with citations from Gmail, GitHub, and Slack.',
          tenantId,
          String(dayOffset),
        ],
      );
    }

    // Studio workflow + notebook
    await client.query(
      `INSERT INTO workflows (id, tenant_id, name, definition, created_by, updated_at)
       VALUES ($1, $2, 'Weekly exec digest', $3::jsonb, $4, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        'wf-zeto-weekly',
        tenantId,
        JSON.stringify({
          nodes: [
            { id: 'n1', type: 'trigger', label: 'Every Monday 9am' },
            { id: 'n2', type: 'fetch', label: 'Pull Gmail + Slack' },
            { id: 'n3', type: 'summarize', label: 'Cortex summarize' },
            { id: 'n4', type: 'notify', label: 'Post to #leadership' },
          ],
          edges: [
            { from: 'n1', to: 'n2' },
            { from: 'n2', to: 'n3' },
            { from: 'n3', to: 'n4' },
          ],
        }),
        userId,
      ],
    );

    if (userId) {
      await client.query(
        `INSERT INTO studio_notebooks (id, tenant_id, user_id, title, blocks, updated_at)
         VALUES ($1, $2, $3, 'Q2 planning', $4::jsonb, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [
          'nb-zeto-q2',
          tenantId,
          userId,
          JSON.stringify([
            {
              id: 'b1',
              type: 'markdown',
              content:
                '# Zeto Studio — Q2 priorities\n\n- Ship Studio dashboard\n- Scale to 50 employees',
            },
            {
              id: 'b2',
              type: 'sql',
              content: 'SELECT department, COUNT(*) FROM hr_employees GROUP BY 1;',
            },
          ]),
        ],
      );

      const defaultLayout = [
        { id: 'w1', type: 'metric', x: 0, y: 0, w: 3, h: 2, props: { label: 'Documents indexed' } },
        { id: 'w2', type: 'metric', x: 3, y: 0, w: 3, h: 2, props: { label: 'Connectors live' } },
        { id: 'w3', type: 'bar-chart', x: 6, y: 0, w: 6, h: 3 },
        { id: 'w4', type: 'pie-chart', x: 0, y: 2, w: 4, h: 3 },
        { id: 'w5', type: 'table', x: 4, y: 3, w: 8, h: 3 },
        {
          id: 'w6',
          type: 'text',
          x: 0,
          y: 5,
          w: 12,
          h: 1,
          props: { text: 'Zeto Studio — seeded demo workspace' },
        },
      ];
      await client.query(
        `INSERT INTO user_layouts (id, tenant_id, user_id, layout_key, layout, updated_at)
         VALUES ($1, $2, $3, 'dashboard', $4::jsonb, NOW())
         ON CONFLICT (tenant_id, user_id, layout_key) DO UPDATE SET layout = EXCLUDED.layout, updated_at = NOW()`,
        [`layout-${userId}`, tenantId, userId, JSON.stringify(defaultLayout)],
      );
    }
  });
}

async function main() {
  process.env.DATABASE_URL ??= DB_URL;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { tenantId, userId, email } = await resolveTenant(pool);
    console.log(`→ Seeding Zeto Studio for tenant ${tenantId}${email ? ` (${email})` : ''}`);
    await clearTenantDemo(client, tenantId);
    await seed(client, tenantId, userId);
    await seedHrDemoData(tenantId, { publishedByUserId: userId });
    console.log('');
    console.log('✅ Zeto Studio demo seeded');
    console.log(`   • ${EMPLOYEES.length} employees (Scaling tier KPIs)`);
    console.log(`   • ${CONNECTORS.length} connectors connected`);
    console.log('   • Documents, graph nodes, Q&A logs, studio layout');
    console.log('');
    console.log('Next:');
    console.log('  1. bun run start:all   (or apps/web dev server)');
    console.log('  2. Sign in → enter code Zeto → CEO');
    console.log('  3. Visit /panel, /studio, /hr/employees');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err.message ?? err);
  process.exit(1);
});
