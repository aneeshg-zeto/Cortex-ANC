#!/usr/bin/env bun
/**
 * Smoke test Cortex brain (no web server required).
 * Usage: bun run test:brain
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(import.meta.dir, '../.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim();
  }
}

const { runBrain } = await import('../packages/agent-core/src/brain/index.ts');

const question = process.argv[2] ?? 'What is the status of the Acme project?';
console.log('🧠 Question:', question);
console.log('---');

const result = await runBrain(question, { skipCache: true });

console.log('Steps:', result.steps.join(' → '));
console.log('\nAnswer:\n', result.answer);
if (result.sources.length) {
  console.log('\nSources:');
  for (const s of result.sources) {
    console.log(`  - [${s.source}] ${s.title}`);
  }
}
