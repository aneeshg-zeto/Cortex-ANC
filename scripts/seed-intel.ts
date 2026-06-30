/**
 * Seed demo data for the CEO Intelligence Layer v2 modules:
 * customers, deals, finance, tickets, investors, board, OKRs, hiring,
 * competitive signals, people signals, attention.
 *
 * Imported by seed-zeto-studio.ts; safe to re-run (clears its own rows first).
 */
import { randomUUID } from 'node:crypto';

import type pg from 'pg';

async function withTenant(
  client: pg.PoolClient,
  tenantId: string,
  fn: () => Promise<void>,
): Promise<void> {
  await client.query('BEGIN');
  await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
  await client.query(`SELECT set_config('app.is_platform_admin', $1, true)`, ['true']);
  try {
    await fn();
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
}

const COMPANIES = [
  'Northwind Labs',
  'Acme Robotics',
  'Globex Health',
  'Initech Cloud',
  'Umbrella AI',
  'Stark Industries',
  'Wayne Data',
  'Hooli Systems',
  'Pied Piper',
  'Soylent Foods',
];

export async function clearIntelDemo(client: pg.PoolClient, tenantId: string): Promise<void> {
  await withTenant(client, tenantId, async () => {
    for (const table of [
      'key_results',
      'objectives',
      'candidates',
      'tickets',
      'deals',
      'transactions',
      'finance_accounts',
      'competitive_signals',
      'people_signals',
      'attention_weekly',
      'board_updates',
      'investors',
      'customers',
      'digest_runs',
    ]) {
      await client.query(`DELETE FROM ${table} WHERE tenant_id = $1`, [tenantId]);
    }
    await client.query(
      `DELETE FROM cortex_approvals WHERE tenant_id = $1 AND entity_type <> 'action'`,
      [tenantId],
    );
  });
}

export async function seedIntel(
  client: pg.PoolClient,
  tenantId: string,
  userId: string | null,
): Promise<void> {
  await withTenant(client, tenantId, async () => {
    const customerIds: string[] = [];
    const sources = ['hubspot', 'stripe', 'salesforce', 'intercom', 'zendesk'];

    // Customers
    for (let i = 0; i < COMPANIES.length; i++) {
      const id = randomUUID();
      customerIds.push(id);
      const mrr = 1500 + Math.round(Math.random() * 18000);
      const health = 30 + Math.round(Math.random() * 70);
      const risk = health >= 70 ? 'low' : health >= 45 ? 'medium' : 'high';
      await client.query(
        `INSERT INTO customers (id, tenant_id, source, external_id, name, email, domain, mrr, arr, status, health_score, churn_risk, last_contact, owner)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10,$11, now() - ($12 || ' days')::interval, 'CEO')`,
        [
          id,
          tenantId,
          sources[i % sources.length],
          `ext-${i}`,
          COMPANIES[i],
          `ops@${COMPANIES[i]!.toLowerCase().replace(/\s+/g, '')}.com`,
          `${COMPANIES[i]!.toLowerCase().replace(/\s+/g, '')}.com`,
          mrr,
          mrr * 12,
          health,
          risk,
          String(Math.round(Math.random() * 60)),
        ],
      );
    }

    // Deals
    const stages = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
    for (let i = 0; i < 18; i++) {
      const stage = stages[i % stages.length]!;
      const prob =
        stage === 'closed_won' ? 100 : stage === 'closed_lost' ? 0 : 20 + ((i * 13) % 70);
      await client.query(
        `INSERT INTO deals (tenant_id, customer_id, source, external_id, name, stage, amount, probability, close_date, owner)
         VALUES ($1,$2,'hubspot',$3,$4,$5,$6,$7, CURRENT_DATE + ($8 || ' days')::interval, 'CEO')`,
        [
          tenantId,
          customerIds[i % customerIds.length],
          `deal-${i}`,
          `${COMPANIES[i % COMPANIES.length]} expansion`,
          stage,
          5000 + Math.round(Math.random() * 60000),
          prob,
          String((i % 6) * 15),
        ],
      );
    }

    // Finance: opening balance + 6 months of txns
    await client.query(
      `INSERT INTO finance_accounts (tenant_id, source, name, opening_balance) VALUES ($1,'mercury','Operating', $2)`,
      [tenantId, 1800000],
    );
    for (let m = 0; m < 6; m++) {
      await client.query(
        `INSERT INTO transactions (tenant_id, source, external_id, amount, direction, category, txn_date, description)
         VALUES ($1,'stripe',$2,$3,'credit','revenue', date_trunc('month', now()) - ($4 || ' months')::interval, 'MRR collection')`,
        [tenantId, `rev-${m}`, 60000 + m * 4000, String(m)],
      );
      await client.query(
        `INSERT INTO transactions (tenant_id, source, external_id, amount, direction, category, txn_date, vendor, description)
         VALUES ($1,'mercury',$2,$3,'debit','payroll', date_trunc('month', now()) - ($4 || ' months')::interval, 'Payroll', 'Monthly payroll')`,
        [tenantId, `burn-${m}`, 95000 + m * 1500, String(m)],
      );
    }

    // Tickets
    const subjects = [
      'Login fails after password reset',
      'Cannot reset my password',
      'Billing invoice is wrong',
      'Invoice overcharged this month',
      'Export to CSV is broken',
      'CSV export missing columns',
      'Mobile app crashes on open',
      'App crash on Android startup',
    ];
    for (let i = 0; i < subjects.length; i++) {
      await client.query(
        `INSERT INTO tickets (tenant_id, source, external_id, customer_id, subject, body, status, priority, requester_email, created_at)
         VALUES ($1,'zendesk',$2,$3,$4,$5,$6,$7,$8, now() - ($9 || ' days')::interval)`,
        [
          tenantId,
          `tic-${i}`,
          customerIds[i % customerIds.length],
          subjects[i],
          subjects[i],
          i % 3 === 0 ? 'closed' : 'open',
          i % 4 === 0 ? 'high' : 'normal',
          `user${i}@example.com`,
          String(i * 2),
        ],
      );
    }

    // Investors + board update
    const investors = [
      ['Sequoia', 'Sequoia Capital', 'series_a', 'invested', 12.5, 3000000],
      ['a16z', 'Andreessen Horowitz', 'seed', 'prospect', 0, 0],
      ['Accel', 'Accel Partners', 'series_a', 'committed', 8, 2000000],
    ] as const;
    for (const [name, fund, stage, status, pct, amt] of investors) {
      await client.query(
        `INSERT INTO investors (tenant_id, name, fund, stage, status, ownership_pct, amount_invested, last_contact)
         VALUES ($1,$2,$3,$4,$5,$6,$7, now() - interval '10 days')`,
        [tenantId, name, fund, stage, status, pct, amt],
      );
    }

    // OKRs
    const objId = randomUUID();
    await client.query(
      `INSERT INTO objectives (id, tenant_id, owner_id, owner_name, title, description, level, period, status)
       VALUES ($1,$2,$3,'CEO','Reach $1M ARR','Grow revenue sustainably','company',$4,'on_track')`,
      [
        objId,
        tenantId,
        userId,
        `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`,
      ],
    );
    const krs = [
      ['Grow MRR to $85k', 85000, 62000, 'USD'],
      ['Close 10 new logos', 10, 6, 'logos'],
      ['Keep churn under 3%', 3, 4, '%'],
    ] as const;
    for (const [title, target, current, unit] of krs) {
      await client.query(
        `INSERT INTO key_results (tenant_id, objective_id, title, target, current, start_value, unit)
         VALUES ($1,$2,$3,$4,$5,0,$6)`,
        [tenantId, objId, title, target, current, unit],
      );
    }
    const childObj = randomUUID();
    await client.query(
      `INSERT INTO objectives (id, tenant_id, owner_name, title, level, period, parent_id, status)
       VALUES ($1,$2,'VP Sales','Build repeatable sales motion','team',$3,$4,'at_risk')`,
      [
        childObj,
        tenantId,
        `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`,
        objId,
      ],
    );

    // Hiring candidates
    const roles = ['Senior Engineer', 'Product Designer', 'Account Executive', 'Data Scientist'];
    const stagesC = ['applied', 'screen', 'interview', 'offer', 'hired', 'rejected'];
    for (let i = 0; i < 12; i++) {
      await client.query(
        `INSERT INTO candidates (tenant_id, source, external_id, name, email, role, stage, applied_at, last_activity)
         VALUES ($1,'greenhouse',$2,$3,$4,$5,$6, now() - ($7 || ' days')::interval, now() - ($8 || ' days')::interval)`,
        [
          tenantId,
          `cand-${i}`,
          `Candidate ${i + 1}`,
          `cand${i}@example.com`,
          roles[i % roles.length],
          stagesC[i % stagesC.length],
          String(20 + i),
          String(i),
        ],
      );
    }

    // Competitive signals
    const competitors = ['Rival Co', 'Challenger Inc', 'Upstart AI'];
    for (let i = 0; i < competitors.length; i++) {
      await client.query(
        `INSERT INTO competitive_signals (tenant_id, competitor, signal_type, value, numeric_value, source_url, diff_from_last, is_alert)
         VALUES ($1,$2,'pricing',$3,$4,'https://example.com/pricing',$5,$6)`,
        [
          tenantId,
          competitors[i],
          `$${49 + i * 10}/mo`,
          49 + i * 10,
          i === 0 ? '+$10 (25.6%)' : null,
          i === 0,
        ],
      );
    }

    // People signals
    const people = [
      ['emp-1', 'Aarav Mehta', 'workload', 82, 'high'],
      ['emp-2', 'Priya Nair', 'flight_risk', 68, 'elevated'],
      ['emp-3', 'Rohan Kapoor', 'promotion_signal', 74, 'elevated'],
      ['dept:Engineering', 'Engineering', 'team_health', 71, 'normal'],
    ] as const;
    for (const [uid, name, type, score, level] of people) {
      await client.query(
        `INSERT INTO people_signals (tenant_id, user_id, subject_name, signal_type, score, level, evidence)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
         ON CONFLICT (tenant_id, user_id, signal_type) DO UPDATE SET score = EXCLUDED.score`,
        [
          tenantId,
          uid,
          name,
          type,
          score,
          level,
          JSON.stringify([{ label: 'seeded', detail: 'demo' }]),
        ],
      );
    }

    // Attention (current week)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    await client.query(
      `INSERT INTO attention_weekly (tenant_id, user_id, subject_name, week_start, metrics)
       VALUES ($1,'org','Organization',$2,$3::jsonb)
       ON CONFLICT (tenant_id, user_id, week_start) DO UPDATE SET metrics = EXCLUDED.metrics`,
      [
        tenantId,
        weekStart.toISOString().slice(0, 10),
        JSON.stringify({
          meetingHours: 18.5,
          meetingCount: 14,
          meetingCost: 42000,
          reactiveRatio: 0.57,
          longestDeepBlockHours: 2.5,
          currency: 'INR',
        }),
      ],
    );

    // Sample business approvals (F14)
    for (const [type, title] of [
      ['expense', 'AWS reserved instances — $24,000/yr'],
      ['vendor', 'New analytics vendor: Amplitude'],
      ['contract', 'Renew office lease (12 months)'],
    ] as const) {
      await client.query(
        `INSERT INTO cortex_approvals (id, tenant_id, entity_type, action_type, connector, title, payload, status)
         VALUES ($1,$2,$3,$3,'internal',$4,'{}'::jsonb,'pending')`,
        [randomUUID(), tenantId, type, title],
      );
    }

    // A couple of decisions so the decision log + brain have content
    for (const [title, body] of [
      ['Adopt usage-based pricing', 'Move from seat-based to usage-based to align with value.'],
      ['Hire a VP of Sales', 'Build a repeatable outbound motion before Series A.'],
    ] as const) {
      await client.query(
        `INSERT INTO decision_logs (id, tenant_id, title, body, decided_at, created_by)
         VALUES ($1,$2,$3,$4, now(), $5)`,
        [randomUUID(), tenantId, title, body, userId],
      );
    }
  });
}
