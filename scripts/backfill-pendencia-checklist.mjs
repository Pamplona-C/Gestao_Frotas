/**
 * Backfill — preenche vinculos.pendenciaChecklist para habilitar relatórios eficientes.
 *
 * Pré-requisitos:
 *   1. npm install
 *   2. Baixe a chave de serviço como scripts/serviceAccountKey.json
 *
 * Uso:
 *   node scripts/backfill-pendencia-checklist.mjs        # dry-run
 *   node scripts/backfill-pendencia-checklist.mjs --write
 */

import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dir = dirname(fileURLToPath(import.meta.url));
const WRITE = process.argv.includes('--write');

let admin;
try {
  admin = require('firebase-admin');
} catch {
  console.error('Erro: firebase-admin não instalado. Rode npm install.');
  process.exit(1);
}

const keyPath = resolve(__dir, 'serviceAccountKey.json');
let serviceAccount;
try {
  serviceAccount = require(keyPath);
} catch {
  console.error(`Erro: chave de serviço não encontrada em:\n  ${keyPath}`);
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

function calcularPendencia(vinculo) {
  if (vinculo.checklistSaidaId) return null;
  if (vinculo.status === 'inativo') return 'saida';
  if (vinculo.checklistEntradaId) return null;
  return 'entrada';
}

const snap = await db.collection('vinculos').get();
let alterados = 0;
let batch = db.batch();
let batchCount = 0;

for (const doc of snap.docs) {
  const atual = doc.data();
  const pendenciaChecklist = calcularPendencia(atual);
  const precisaAtualizar = atual.pendenciaChecklist !== pendenciaChecklist;

  if (!precisaAtualizar) continue;
  alterados += 1;

  if (WRITE) {
    batch.update(doc.ref, { pendenciaChecklist });
    batchCount += 1;
    if (batchCount === 450) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }
}

if (WRITE && batchCount > 0) {
  await batch.commit();
}

console.log(`${WRITE ? 'Atualizados' : 'Atualizaria'} ${alterados} de ${snap.size} vínculos.`);
if (!WRITE) {
  console.log('Dry-run concluído. Rode com --write para gravar.');
}
