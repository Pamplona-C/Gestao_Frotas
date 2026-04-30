/**
 * Lista todas as placas de veículos cadastrados no Firestore.
 *
 * Uso:
 *   node scripts/listar-placas.mjs
 */

import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dir   = dirname(fileURLToPath(import.meta.url));

let admin;
try {
  admin = require('firebase-admin');
} catch {
  console.error('Erro: firebase-admin não instalado. Rode:\n  npm install --save-dev firebase-admin');
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

const snap = await db.collection('veiculos').orderBy('frota').get();

if (snap.empty) {
  console.log('Nenhum veículo encontrado.');
  process.exit(0);
}

console.log(`\nFrotaAtiva — Placas cadastradas (${snap.size} veículos)\n`);
console.log('Frota  Placa        Modelo                        Ano   Departamento     Ativo');
console.log('─────  ───────────  ────────────────────────────  ────  ───────────────  ─────');

for (const doc of snap.docs) {
  const v = doc.data();
  const frota  = String(v.frota ?? '').padEnd(5);
  const placa  = String(v.placa ?? '').padEnd(11);
  const modelo = String(v.modelo ?? '').padEnd(28);
  const ano    = String(v.ano ?? '').padEnd(4);
  const depto  = String(v.departamento ?? '').padEnd(15);
  const ativo  = v.ativo ? 'sim' : 'não';
  console.log(`${frota}  ${placa}  ${modelo}  ${ano}  ${depto}  ${ativo}`);
}

console.log();
process.exit(0);
