/**
 * Seed script — popula veículos e fornecedores no Firestore para testes de performance.
 *
 * Pré-requisitos:
 *   1. npm install --save-dev firebase-admin
 *   2. Baixe a chave de serviço: Firebase Console → Configurações → Contas de serviço
 *      → "Gerar nova chave privada" → salve como scripts/serviceAccountKey.json
 *
 * Uso:
 *   node scripts/seed-firebase.mjs [--veiculos 50] [--fornecedores 30] [--limpar]
 *
 * Flags:
 *   --veiculos N      Quantidade de veículos a criar (padrão: 50)
 *   --fornecedores N  Quantidade de fornecedores a criar (padrão: 30)
 *   --limpar          Apaga todos os docs existentes antes de inserir
 */

import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dir   = dirname(fileURLToPath(import.meta.url));

// ── Firebase Admin ───────────────────────────────────────────────────────────
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
  console.error(`Erro: chave de serviço não encontrada em:\n  ${keyPath}\n\nBaixe em: Firebase Console → Configurações → Contas de serviço → Gerar nova chave privada`);
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(name);
  return i !== -1 ? Number(args[i + 1]) || def : def;
};
const TOTAL_VEICULOS     = flag('--veiculos', 50);
const TOTAL_FORNECEDORES = flag('--fornecedores', 30);
const LIMPAR             = args.includes('--limpar');

// ── Dados de exemplo ─────────────────────────────────────────────────────────
const MODELOS = [
  'Volkswagen Amarok', 'Fiat Strada', 'Chevrolet S10', 'Toyota Hilux',
  'Ford Ranger', 'Mitsubishi L200', 'Nissan Frontier', 'Renault Duster',
  'Jeep Renegade', 'Hyundai HB20', 'Volkswagen Gol', 'Fiat Uno',
  'Chevrolet Onix', 'Toyota Corolla', 'Honda Civic', 'Fiat Toro',
  'Ford Ka', 'Volkswagen Polo', 'Hyundai Creta', 'Jeep Compass',
];

const DEPARTAMENTOS = ['Comercial', 'Logística', 'Operações', 'Administrativo', 'TI', 'RH'];

const CIDADES = [
  'Goiânia - GO', 'São Paulo - SP', 'Curitiba - PR', 'Belo Horizonte - MG',
  'Rio de Janeiro - RJ', 'Porto Alegre - RS', 'Brasília - DF', 'Salvador - BA',
  'Fortaleza - CE', 'Manaus - AM', 'Recife - PE', 'Belém - PA',
];

const PREFIXOS_OFICINA = [
  'Auto Center', 'Mecânica', 'Oficina', 'Centro Automotivo', 'Serviços Auto',
  'Reparação', 'Revisa+', 'AutoTec', 'MotoFácil', 'PneuMax',
];

const SOBRENOMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Carvalho',
  'Ferreira', 'Rodrigues', 'Almeida', 'Costa', 'Nascimento', 'Mendes',
];

const NOMES = [
  'Carlos', 'Roberto', 'José', 'Paulo', 'Anderson', 'Fernanda',
  'Mariana', 'Juliana', 'Thiago', 'Lucas', 'Rafael', 'Beatriz',
];

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fmtPlaca(n) {
  const letras = () => Array.from({ length: 3 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]).join('');
  if (n % 2 === 0) {
    return `${letras()}-${String(Math.floor(1000 + Math.random() * 9000))}`;
  }
  const d1 = Math.floor(Math.random() * 10);
  const letraMeio = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
  const d2 = String(Math.floor(10 + Math.random() * 90));
  return `${letras()}${d1}${letraMeio}${d2}`;
}

function gerarVeiculo(i) {
  return {
    placa:        fmtPlaca(i),
    frota:        String(i + 1).padStart(2, '0'),
    modelo:       rand(MODELOS),
    ano:          2018 + Math.floor(Math.random() * 7),
    departamento: rand(DEPARTAMENTOS),
    ativo:        Math.random() > 0.1,
  };
}

function gerarFornecedor() {
  const cidade = rand(CIDADES);
  const uf = cidade.split(' - ')[1];
  const nome = `${rand(PREFIXOS_OFICINA)} ${rand(['Norte', 'Sul', 'Leste', 'Oeste', 'Centro', 'Prime', 'Total', ''])} ${uf}`.trim();
  const ddd = { GO: 62, SP: 11, PR: 41, MG: 31, RJ: 21, RS: 51, DF: 61, BA: 71, CE: 85, AM: 92, PE: 81, PA: 91 }[uf] ?? 11;
  const tel = `(${ddd}) 9${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
  const abre = `${6 + Math.floor(Math.random() * 2)}h`;
  const fecha = `${17 + Math.floor(Math.random() * 3)}h`;
  return {
    nome,
    cidade,
    endereco: `Rua ${rand(['das Flores', 'do Comércio', 'Principal', 'XV de Novembro', 'Sete de Setembro'])}, ${Math.floor(1 + Math.random() * 999)}`,
    horario:  Math.random() > 0.3 ? `Seg-Sex ${abre}-${fecha}` : `Seg-Sab ${abre}-${fecha}`,
    responsavel: `${rand(NOMES)} ${rand(SOBRENOMES)}`,
    telefone: tel,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
async function limparColecao(nome) {
  const snap = await db.collection(nome).get();
  if (snap.empty) return;
  const CHUNK = 500;
  const docs  = snap.docs;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = db.batch();
    docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  console.log(`  🗑  ${docs.length} docs apagados de "${nome}"`);
}

async function inserirEmLotes(colNome, gerador, total) {
  const CHUNK = 500;
  let inseridos = 0;
  for (let i = 0; i < total; i += CHUNK) {
    const batch = db.batch();
    const fim   = Math.min(i + CHUNK, total);
    for (let j = i; j < fim; j++) {
      batch.set(db.collection(colNome).doc(), gerador(j));
    }
    await batch.commit();
    inseridos += fim - i;
    process.stdout.write(`\r  ✔  ${inseridos}/${total} inseridos em "${colNome}"   `);
  }
  console.log();
}

// ── Main ─────────────────────────────────────────────────────────────────────
console.log(`\nFrotaAtiva — Seed de dados\n`);
console.log(`  Veículos:     ${TOTAL_VEICULOS}`);
console.log(`  Fornecedores: ${TOTAL_FORNECEDORES}`);
console.log(`  Limpar antes: ${LIMPAR ? 'sim' : 'não'}\n`);

if (LIMPAR) {
  console.log('Limpando coleções existentes...');
  await limparColecao('veiculos');
  await limparColecao('fornecedores');
  console.log();
}

console.log('Inserindo veículos...');
await inserirEmLotes('veiculos', gerarVeiculo, TOTAL_VEICULOS);

console.log('Inserindo fornecedores...');
await inserirEmLotes('fornecedores', gerarFornecedor, TOTAL_FORNECEDORES);

console.log('\nConcluído!\n');
process.exit(0);
