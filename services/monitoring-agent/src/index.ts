import { createLogger, llmClient } from '@cortex/shared';
import pg from 'pg';

const log = createLogger('monitoring-agent');
const { Pool } = pg;

type Interaction = {
  id: string;
  query: string;
  answer?: string;
  success?: boolean;
  feedback?: string;
};

async function evaluateFailure(interaction: Interaction): Promise<string> {
  return llmClient.complete(
    `Classify this Q&A failure and suggest ONE fix (missing tool / stale graph / prompt):
Q: ${interaction.query}
A: ${interaction.answer ?? 'none'}
Feedback: ${interaction.feedback ?? 'negative'}
Fix:`,
    { temperature: 0.2 },
  );
}

async function maybeOpenRemediationPr(fix: string, query: string): Promise<void> {
  if (!process.env.GITHUB_TOKEN) {
    log.info({ fix }, 'Remediation suggestion (no GITHUB_TOKEN for auto-PR)');
    return;
  }
  log.info({ query, fix }, 'Would open GitHub PR via connector — stub for local dev');
}

async function runEvaluationSweep(pool: pg.Pool): Promise<void> {
  const { rows } = await pool.query<Interaction>(
    `SELECT id, query, answer, success, feedback
     FROM cortex_agent_interactions
     ORDER BY created_at DESC
     LIMIT 100`,
  );

  for (const interaction of rows) {
    const shouldEvaluate = interaction.success === false || !interaction.feedback;
    if (!shouldEvaluate) continue;

    const fix = await evaluateFailure(interaction);
    await maybeOpenRemediationPr(fix, interaction.query);

    const confidence = /missing tool|stale graph|prompt/i.test(fix) ? 0.82 : 0.63;
    await pool.query(`UPDATE cortex_agent_interactions SET feedback = $1 WHERE id = $2`, [
      `remediation: ${fix}`,
      interaction.id,
    ]);
    await pool.query(
      `INSERT INTO improvement_suggestions (id, category, suggestion, confidence, status)
       VALUES ($1, $2, $3, $4, 'pending')
       ON CONFLICT (id) DO NOTHING`,
      [interaction.id, 'qa_failure', fix, confidence],
    );
  }
}

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is required for monitoring-agent');
  const pool = new Pool({ connectionString: dbUrl });

  log.info('Monitoring agent active (scheduled DB sweep every 24h)');
  await runEvaluationSweep(pool);
  setInterval(
    () =>
      void runEvaluationSweep(pool).catch((err) => log.error({ err }, 'evaluation sweep failed')),
    24 * 60 * 60 * 1000,
  );
}

main().catch((err) => {
  log.error({ err }, 'monitoring-agent failed');
  process.exit(1);
});
