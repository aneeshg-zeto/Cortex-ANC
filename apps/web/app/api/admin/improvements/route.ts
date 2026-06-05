import { NextResponse } from 'next/server';
import pg from 'pg';

const { Pool } = pg;

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return NextResponse.json({ suggestions: [] });
  const pool = new Pool({ connectionString: dbUrl });
  try {
    const { rows } = await pool.query(
      `SELECT id, category, suggestion, confidence, status, created_at
       FROM improvement_suggestions
       ORDER BY created_at DESC
       LIMIT 50`,
    );
    return NextResponse.json({ suggestions: rows });
  } finally {
    await pool.end();
  }
}

export async function POST(request: Request) {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return NextResponse.json({ ok: false }, { status: 503 });
  const body = (await request.json()) as { id?: string; status?: 'applied' | 'dismissed' };
  if (!body.id || !body.status) {
    return NextResponse.json({ error: 'id and status required' }, { status: 400 });
  }
  const pool = new Pool({ connectionString: dbUrl });
  try {
    await pool.query(`UPDATE improvement_suggestions SET status = $1 WHERE id = $2`, [
      body.status,
      body.id,
    ]);
    return NextResponse.json({ ok: true });
  } finally {
    await pool.end();
  }
}
