import { indexDocument } from '../packages/graph-core/src/index';
import { MOCK_DOCUMENTS } from '../packages/graph-core/src/mock-data';

console.log('🌱 Seeding Cortex vector store…');

for (const doc of MOCK_DOCUMENTS) {
  await indexDocument(doc.id, doc.text, doc.metadata);
  console.log(`  ✓ ${doc.id} [${doc.metadata.source}]`);
}

console.log(`\n✅ Seeded ${MOCK_DOCUMENTS.length} documents`);
console.log('Tip: pull Ollama embedding model with: ollama pull nomic-embed-text');
