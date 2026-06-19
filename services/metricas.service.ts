import { onSnapshot, doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, app } from '../lib/firebase';
import { MetricasFrota } from '../types';

const METRICAS_DOC = doc(db, 'metricas-frota', 'geral');

const METRICAS_VAZIO: MetricasFrota = {
  osAguardando: 0,
  veiculosEmOficina: 0,
  gastoMes: { total: 0, preventiva: 0, corretiva: 0, mes: '' },
  prevVsCorr: { preventiva: 0, corretiva: 0, mes: '' },
};

/** Chama a Cloud Function para popular o documento caso ainda não exista. */
export async function seedMetricasSeNecessario(): Promise<void> {
  const snap = await getDoc(METRICAS_DOC);
  if (snap.exists()) return;
  const fn = httpsCallable(getFunctions(app, 'southamerica-east1'), 'recalcularMetricasManual');
  await fn({});
}

export function subscribeToMetricas(
  callback: (metricas: MetricasFrota) => void,
): () => void {
  return onSnapshot(METRICAS_DOC, (snap) => {
    if (!snap.exists()) {
      callback(METRICAS_VAZIO);
      return;
    }
    const data = snap.data();
    callback({
      osAguardando:          data.osAguardando          ?? 0,
      veiculosEmOficina:     data.veiculosEmOficina      ?? 0,
      gastoMes: {
        total:      data.gastoMes?.total      ?? 0,
        preventiva: data.gastoMes?.preventiva ?? 0,
        corretiva:  data.gastoMes?.corretiva  ?? 0,
        mes:        data.gastoMes?.mes        ?? '',
      },
      prevVsCorr: {
        preventiva: data.prevVsCorr?.preventiva ?? 0,
        corretiva:  data.prevVsCorr?.corretiva  ?? 0,
        mes:        data.prevVsCorr?.mes        ?? '',
      },
      atualizadoEm:          data.atualizadoEm,
      osEmAndamento:         data.osEmAndamento         ?? 0,
      osEmDiagnostico:       data.osEmDiagnostico       ?? 0,
      osAguardandoAprovacao: data.osAguardandoAprovacao ?? 0,
      osConcluidasHoje:      data.osConcluidasHoje      ?? 0,
      totalOSAtivas:         data.totalOSAtivas         ?? 0,
    });
  });
}
