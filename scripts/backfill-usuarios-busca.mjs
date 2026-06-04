/**
 * Backfill — preenche usuarios.nomeBusca, usuarios.departamentoBusca e
 * usuarios.ativo para habilitar busca limitada de condutores no Firestore.
 *
 * Pré-requisitos:
 *   1. npm install
 *   2. Baixe a chave de serviço como scripts/serviceAccountKey.json
 *
 * Uso:
 *   node scripts/backfill-usuarios-busca.mjs        # dry-run
 *   node scripts/backfill-usuarios-busca.mjs --write
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

function normalizeSearchText(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const snap = await db.collection('usuarios').get();
let alterados = 0;
let batch = db.batch();
let batchCount = 0;

for (const doc of snap.docs) {
  const atual = doc.data();
  const updates = {
    nomeBusca: normalizeSearchText(atual.nome),
    departamentoBusca: normalizeSearchText(atual.departamento),
  };

  if (atual.ativo === undefined) {
    updates.ativo = true;
  }

  const precisaAtualizar = Object.entries(updates).some(([key, value]) => atual[key] !== value);
  if (!precisaAtualizar) continue;

  alterados += 1;

  if (WRITE) {
    batch.update(doc.ref, updates);
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

console.log(`${WRITE ? 'Atualizados' : 'Atualizaria'} ${alterados} de ${snap.size} usuários.`);
if (!WRITE) {
  console.log('Dry-run concluído. Rode com --write para gravar.');
}
