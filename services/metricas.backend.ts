/**
 * Métricas do painel do gestor via moovia-backend (REST).
 *
 * **Mudança de origem:** no Firebase os números vinham de um documento
 * (`metricas-frota/geral`) que uma Cloud Function recalculava de tempos em
 * tempos — a tela lia um valor pré-computado, possivelmente defasado. Aqui o
 * `GET /relatorios/dashboard` **calcula na hora**, direto das OS. Some a
 * defasagem e some também o `seedMetricasSeNecessario`: não há documento para
 * semear.
 *
 * O dashboard traz mais do que estes quatro cartões usam (série por dia, OS
 * recentes, maior custo por veículo). Fica de propósito: é uma requisição só, e
 * o resto já está pronto para uma tela de relatórios de verdade.
 */
import { api } from '../lib/api';
import { MetricasFrota } from '../types';

interface DashboardResponse {
  cards: {
    ativas: number;
    emAndamento: number;
    agAprovacao: number;
    concluidasHoje: number;
    aguardando: number;
    veiculosEmOficina: number;
  };
  financeiroMes: {
    mes: number;
    ano: number;
    gastoMes: number;
    custoMedio: number;
    corretiva: number;
    osSemValor: number;
  };
  prevVsCorrMes: {
    preventivas: number;
    corretivas: number;
  };
}

export async function getMetricas(): Promise<MetricasFrota> {
  const d = await api.get<DashboardResponse>('/relatorios/dashboard');
  const { cards, financeiroMes: fin, prevVsCorrMes: pvc } = d;

  const mes = `${fin.ano}-${String(fin.mes).padStart(2, '0')}`;

  return {
    osAguardando: cards.aguardando,
    veiculosEmOficina: cards.veiculosEmOficina,
    gastoMes: {
      total: fin.gastoMes,
      // O backend devolve só a fatia corretiva; a preventiva é o restante.
      // Pedir as duas separadas deixaria de fora o gasto de OS sem item
      // classificado, e a soma não bateria com o total.
      preventiva: Math.max(0, fin.gastoMes - fin.corretiva),
      corretiva: fin.corretiva,
      mes,
    },
    prevVsCorr: {
      preventiva: pvc.preventivas,
      corretiva: pvc.corretivas,
      mes,
    },
    osEmAndamento: cards.emAndamento,
    osAguardandoAprovacao: cards.agAprovacao,
    osConcluidasHoje: cards.concluidasHoje,
    totalOSAtivas: cards.ativas,
  };
}
