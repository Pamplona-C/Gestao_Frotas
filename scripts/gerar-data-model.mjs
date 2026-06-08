/**
 * Gera docs/data_model.md inspecionando documentos reais do Firestore.
 *
 * Para cada coleção, lê até MAX_DOCS documentos e faz a união de todos
 * os campos encontrados, anotando tipo e se é opcional.
 *
 * Pré-requisitos:
 *   npm install --save-dev firebase-admin
 *   Arquivo scripts/serviceAccountKey.json presente
 *
 * Uso:
 *   node scripts/gerar-data-model.mjs
 */

import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync } from 'fs';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const COLLECTIONS = [
  'usuarios',
  'veiculos',
  'fornecedores',
  'ordens-servico',
  'vinculos',
  'checklists',
  'categorias-fornecedores',
  'departamentos',
  'despesas-veiculo',
  'notificacoes',
];

const MAX_DOCS = 30;

function inferType(value) {
  if (value === null) return 'null';
  if (value instanceof admin.firestore.Timestamp) return 'Timestamp';
  if (value instanceof admin.firestore.DocumentReference) return 'DocumentReference';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'array';
    const inner = inferType(value[0]);
    return `array<${inner}>`;
  }
  if (typeof value === 'object') return 'map';
  return typeof value;
}

async function inspecionarColecao(nome) {
  let snapshot;
  try {
    snapshot = await db.collection(nome).limit(MAX_DOCS).get();
  } catch (e) {
    return { nome, erro: e.message, campos: {} };
  }

  if (snapshot.empty) {
    return { nome, total: 0, campos: {} };
  }

  // campo → { tipos: Set, count: number }
  const campos = {};

  for (const doc of snapshot.docs) {
    const data = doc.data();
    for (const [chave, valor] of Object.entries(data)) {
      if (!campos[chave]) campos[chave] = { tipos: new Set(), count: 0 };
      campos[chave].tipos.add(inferType(valor));
      campos[chave].count++;
    }
  }

  return { nome, total: snapshot.size, campos };
}

function renderTabela({ nome, erro, total, campos }) {
  const linhas = [`## \`${nome}\``];

  if (erro) {
    linhas.push(``, `> Erro ao acessar a coleção: ${erro}`, ``);
    return linhas.join('\n');
  }

  linhas.push(``, `Documentos amostrados: **${total}**`, ``);

  if (total === 0 || Object.keys(campos).length === 0) {
    linhas.push(`_Coleção vazia ou sem documentos._`, ``);
    return linhas.join('\n');
  }

  linhas.push(`| Campo | Tipo(s) | Obrigatório |`);
  linhas.push(`|---|---|---|`);

  for (const [chave, meta] of Object.entries(campos).sort(([a], [b]) => a.localeCompare(b))) {
    const tipos = [...meta.tipos].join(' \\| ');
    const obrigatorio = meta.count === total ? 'sim' : `não (${meta.count}/${total})`;
    linhas.push(`| \`${chave}\` | ${tipos} | ${obrigatorio} |`);
  }

  linhas.push(``);
  return linhas.join('\n');
}

async function main() {
  console.log(`Conectando ao Firestore (${serviceAccount.project_id})...\n`);

  const resultados = [];
  for (const nome of COLLECTIONS) {
    process.stdout.write(`  Inspecionando ${nome}... `);
    const resultado = await inspecionarColecao(nome);
    process.stdout.write(`${resultado.erro ? 'ERRO' : resultado.total + ' docs'}\n`);
    resultados.push(resultado);
  }

  const hoje = new Date().toISOString().split('T')[0];

  const md = [
    `# Data Model — Firestore`,
    ``,
    `Gerado automaticamente em ${hoje} via \`scripts/gerar-data-model.mjs\`.`,
    `Cada tabela mostra os campos encontrados nos primeiros ${MAX_DOCS} documentos de cada coleção.`,
    `"Obrigatório" significa presente em todos os documentos amostrados.`,
    ``,
    `---`,
    ``,
    ...resultados.map(renderTabela),
  ].join('\n');

  const saida = resolve(__dirname, '../docs/data_model.md');
  writeFileSync(saida, md, 'utf-8');
  console.log(`\nArquivo salvo em docs/data_model.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
