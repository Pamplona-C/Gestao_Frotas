/**
 * Script one-time para popular metricas-frota/atual com dados existentes.
 * Uso: npx ts-node --project tsconfig.json src/seed-metricas.ts
 */

import * as admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'frotaativa-96ffb',
});

const db = admin.firestore();

const ACTIVE_STATUSES = ['nova', 'em_andamento', 'em_diagnostico', 'orcamento_aprovado'];
const SP_OFFSET_MS = -3 * 60 * 60 * 1000;

function mesAtualBRT(): string {
  const agora = new Date(Date.now() + SP_OFFSET_MS);
  const y = agora.getUTCFullYear();
  const m = String(agora.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function inicioProximoMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

async function seed() {
  const mes = mesAtualBRT();
  console.log(`Calculando métricas para o mês: ${mes}`);

  const activeSnap = await db
    .collection('ordens-servico')
    .where('status', 'in', ACTIVE_STATUSES)
    .get();

  const activeOS = activeSnap.docs.map((d) => d.data());
  const osAguardando = activeOS.filter((os) => os.status === 'nova').length;

  const veiculosEmOficinaSet = new Set(
    activeOS
      .filter((os) => os.entregueOficinaEm && !os.retornouOficinaEm)
      .map((os) => os.veiculoId as string | undefined)
      .filter((id): id is string => !!id),
  );

  const mesSnap = await db
    .collection('ordens-servico')
    .where('criadoEm', '>=', mes)
    .where('criadoEm', '<', inicioProximoMes(mes))
    .get();

  let gastoPreventiva = 0;
  let gastoCorretiva  = 0;
  let countPreventiva = 0;
  let countCorretiva  = 0;

  mesSnap.docs.forEach((d) => {
    const os = d.data();
    gastoPreventiva += (os.gastoPreventiva as number) ?? 0;
    gastoCorretiva  += (os.gastoCorretiva  as number) ?? 0;
    if (os.tipo === 'preventiva') countPreventiva++;
    else if (os.tipo === 'corretiva') countCorretiva++;
  });

  const payload = {
    osAguardando,
    veiculosEmOficina: veiculosEmOficinaSet.size,
    gastoMes: {
      total:      gastoPreventiva + gastoCorretiva,
      preventiva: gastoPreventiva,
      corretiva:  gastoCorretiva,
      mes,
    },
    prevVsCorr: {
      preventiva: countPreventiva,
      corretiva:  countCorretiva,
      mes,
    },
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  };

  console.log('Resultado:', JSON.stringify({ ...payload, atualizadoEm: 'serverTimestamp' }, null, 2));

  await db.collection('metricas-frota').doc('atual').set(payload);
  console.log('✓ metricas-frota/atual atualizado com sucesso.');
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
