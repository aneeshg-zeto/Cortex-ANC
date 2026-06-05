import { NextResponse } from 'next/server';
import pg from 'pg';

const { Pool } = pg;

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return NextResponse.json({ logs: [] });
  const pool = new Pool({ connectionString: dbUrl });
  try {
    const { rows } = await pool.query(
      `SELECT id, query, answer, success, feedback, created_at
       FROM cortex_agent_interactions
       ORDER BY created_at DESC
       LIMIT 100`,
    );
    return NextResponse.json({ logs: rows });
  } finally {
    await pool.end();
  }
}
