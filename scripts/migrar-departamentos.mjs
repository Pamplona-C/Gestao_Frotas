/**
 * Lê todos os valores únicos do campo `departamento` de `usuarios` e `veiculos`,
 * e cadastra na coleção `departamentos` os que ainda não existirem lá.
 *
 * Uso:
 *   node scripts/migrar-departamentos.mjs
 *
 * Flags:
 *   --dry-run   Mostra o que seria feito sem gravar nada
 */

import { createRequire } from 'module';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

const DRY_RUN = process.argv.includes('--dry-run');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

function normalize(value) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

async function main() {
  console.log(`Projeto: ${serviceAccount.project_id}`);
  if (DRY_RUN) console.log('** DRY RUN — nada será gravado **\n');

  // 1. Coleta departamentos em uso
  const [usuariosSnap, veiculosSnap] = await Promise.all([
    db.collection('usuarios').get(),
    db.collection('veiculos').get(),
  ]);

  const emUso = new Map(); // normalize(nome) → nome original mais frequente
  for (const doc of [...usuariosSnap.docs, ...veiculosSnap.docs]) {
    const dep = (doc.data().departamento ?? '').trim();
    if (!dep) continue;
    const key = normalize(dep);
    if (!emUso.has(key)) emUso.set(key, dep);
  }

  console.log(`Departamentos encontrados em usuarios/veiculos: ${emUso.size}`);
  for (const [, nome] of emUso) console.log(`  • ${nome}`);

  // 2. Carrega o que já existe na coleção departamentos
  const depSnap = await db.collection('departamentos').get();
  const jaCadastrados = new Map(); // normalize(nome) → doc.id
  for (const doc of depSnap.docs) {
    const nome = (doc.data().nome ?? '').trim();
    if (nome) jaCadastrados.set(normalize(nome), doc.id);
  }

  console.log(`\nJá cadastrados na coleção: ${jaCadastrados.size}`);

  // 3. Determina quais precisam ser criados
  const faltando = [...emUso.entries()].filter(([key]) => !jaCadastrados.has(key));

  if (faltando.length === 0) {
    console.log('\nNada a fazer — todos os departamentos já estão cadastrados.');
    process.exit(0);
  }

  console.log(`\nA cadastrar: ${faltando.length}`);
  for (const [, nome] of faltando) console.log(`  + ${nome}`);

  if (DRY_RUN) {
    console.log('\nDry run concluído. Rode sem --dry-run para aplicar.');
    process.exit(0);
  }

  // 4. Grava em batch
  const batch = db.batch();
  for (const [, nome] of faltando) {
    const ref = db.collection('departamentos').doc();
    batch.set(ref, {
      nome,
      nomeBusca: normalize(nome),
      ativo: true,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();

  console.log(`\n${faltando.length} departamento(s) cadastrado(s) com sucesso.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
