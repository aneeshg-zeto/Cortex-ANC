#!/usr/bin/env bun
/**
 * Universal Activepieces → Cortex connector adapter.
 * Run once: bun run adapt:connectors
 *
 * Copies piece folders from activepieces-main, rewrites imports, generates registry.
 */
import { mkdir, readdir, readFile, writeFile, cp, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dir, '..');
const AP_PIECES = path.resolve(ROOT, '../activepieces-main/packages/pieces/community');
const OUT_DIR = path.join(ROOT, 'packages/integration-core/src/connectors-adapted');
const REGISTRY_PATH = path.join(
  ROOT,
  'packages/integration-core/src/connectors/registry.generated.ts',
);

/** Top connectors to adapt from activepieces-main. */
const DEFAULT_MANIFEST = [
  'slack',
  'github',
  'gmail',
  'linear',
  'notion',
  'confluence',
  'microsoft-outlook',
  'microsoft-teams',
  'trello',
  'asana',
  'clickup',
  'airtable',
  'monday',
  'todoist',
  'dropbox',
  'box',
  'calendly',
  'zoom',
  'figma',
  'salesforce',
  'zendesk',
  'intercom',
  'discord',
  'google-drive',
  'google-calendar',
];

const IMPORT_REPLACEMENTS: [RegExp, string][] = [
  [/@activepieces\/pieces-framework/g, '@cortex/integration-core/framework'],
  [/@activepieces\/pieces-common/g, '@cortex/integration-core/common'],
  [/@activepieces\/shared/g, '@cortex/integration-core/shared-stubs'],
  [/@activepieces\/piece-[\w-]+/g, '@cortex/integration-core/connectors-adapted'],
];

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function rewriteFile(filePath: string): Promise<void> {
  let content = await readFile(filePath, 'utf8');
  for (const [re, replacement] of IMPORT_REPLACEMENTS) {
    content = content.replace(re, replacement);
  }
  await writeFile(filePath, content);
}

async function walkAndRewrite(dir: string): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkAndRewrite(full);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      await rewriteFile(full);
    }
  }
}

async function adaptPiece(name: string): Promise<boolean> {
  const src = path.join(AP_PIECES, name);
  if (!(await exists(src))) {
    console.warn(`  skip ${name} (not found)`);
    return false;
  }
  const dest = path.join(OUT_DIR, name);
  await mkdir(OUT_DIR, { recursive: true });
  await cp(src, dest, { recursive: true, force: true });
  await walkAndRewrite(dest);
  return true;
}

async function main(): Promise<void> {
  const useAll = process.argv.includes('--all');
  if (!(await exists(AP_PIECES))) {
    console.error(`Activepieces not found at ${AP_PIECES}`);
    console.error('Place activepieces-main next to cortex-platform or set AP_PIECES path.');
    process.exit(1);
  }

  let manifest = DEFAULT_MANIFEST;
  if (useAll) {
    manifest = (await readdir(AP_PIECES)).filter((n) => !n.startsWith('.'));
  }

  const adapted: string[] = [];
  for (const name of manifest) {
    if (await adaptPiece(name)) {
      adapted.push(name);
      console.log(`  ✓ ${name}`);
    }
  }

  const registryLines = [
    '// AUTO-GENERATED — do not edit. Run: bun run adapt:connectors',
    'export const CONNECTOR_CATALOG = [',
    ...adapted.map(
      (n) =>
        `  { id: '${n}', name: '${n}', status: 'adapted' as const, path: './connectors-adapted/${n}' },`,
    ),
    `  { id: 'slack', name: 'Slack', status: 'ready' as const, path: './connectors/slack' },`,
    `  { id: 'github', name: 'GitHub', status: 'ready' as const, path: './connectors/github' },`,
    `  { id: 'gmail', name: 'Gmail', status: 'ready' as const, path: './connectors/gmail' },`,
    `  { id: 'linear', name: 'Linear', status: 'ready' as const, path: './connectors/linear' },`,
    `  { id: 'notion', name: 'Notion', status: 'ready' as const, path: './connectors/notion' },`,
    '] as const;',
    `export const CONNECTOR_COUNT = ${adapted.length + 5};`,
  ];

  await mkdir(path.dirname(REGISTRY_PATH), { recursive: true });
  await writeFile(REGISTRY_PATH, registryLines.join('\n') + '\n');
  console.log(`\n✅ Adapted ${adapted.length} pieces. Registry: ${REGISTRY_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
