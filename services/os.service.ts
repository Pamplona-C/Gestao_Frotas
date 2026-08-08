import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { USAR_BACKEND } from '../lib/flags';
import * as backend from './os.backend';
import { OrdemServico, OSStatus, StatusEntry } from '../types';

/**
 * Sem tempo real no REST: busca uma vez e devolve um unsubscribe que apenas
 * impede o callback de rodar depois que a tela saiu. As telas recarregam ao
 * ganhar foco e no puxar-para-baixo.
 */
function buscaUnica<T>(
  buscar: () => Promise<T>,
  entregar: (dados: T) => void,
  rotulo: string,
): Unsubscribe {
  let cancelado = false;
  buscar()
    .then((dados) => { if (!cancelado) entregar(dados); })
    .catch((err) => console.warn(`[os] falha ao carregar ${rotulo}:`, err));
  return () => { cancelado = true; };
}

/** Statuses que exigem atenção — excluídas as concluídas. */
const ACTIVE_STATUSES: OSStatus[] = [
  'nova',
  'em_andamento',
  'em_diagnostico',
  'orcamento_aprovado',
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function docToOS(id: string, data: DocumentData): OrdemServico {
  return {
    ...(data as Omit<OrdemServico, 'id' | 'criadoEm' | 'dataDesejada' | 'lembreteEnviadoEm'>),
    id,
    criadoEm:         data.criadoEm?.toDate?.()?.toISOString()         ?? data.criadoEm         ?? new Date().toISOString(),
    dataDesejada:     data.dataDesejada?.toDate?.()?.toISOString()      ?? data.dataDesejada,
    lembreteEnviadoEm: data.lembreteEnviadoEm?.toDate?.()?.toISOString() ?? data.lembreteEnviadoEm ?? null,
  };
}

function byDate(a: OrdemServico, b: OrdemServico) {
  return new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime();
}

export function computeMetrics(all: OrdemServico[]) {
  return {
    total: all.length,
    emAndamento: all.filter((o) => o.status === 'em_andamento').length,
    emDiagnostico: all.filter((o) => o.status === 'em_diagnostico').length,
    orcamentoAprovado: all.filter((o) => o.status === 'orcamento_aprovado').length,
    novas: all.filter((o) => o.status === 'nova').length,
    gastoPreventiva: all.reduce((acc, o) =>
      acc + (o.servicosRealizados
        ?.filter((s) => s.tipo === 'preventiva')
        .reduce((a, s) => a + s.valor, 0) ?? 0), 0),
    gastoCorretiva: all.reduce((acc, o) =>
      acc + (o.servicosRealizados
        ?.filter((s) => s.tipo === 'corretiva')
        .reduce((a, s) => a + s.valor, 0) ?? 0), 0),
  };
}

// ── Real-time subscriptions ────────────────────────────────────────────────────

/**
 * OS mais recentes para o gestor — limitado a 100 documentos, ordenado
 * server-side. Usa índice automático do Firestore em criadoEm (campo único).
 *
 * Aumentar o limite conforme necessário; para frotas muito grandes considerar
 * paginação com startAfter.
 */
export function subscribeToAllOS(
  callback: (ordens: OrdemServico[], metrics: ReturnType<typeof computeMetrics>) => void,
  pageSize = 100,
): Unsubscribe {
  if (USAR_BACKEND) {
    return buscaUnica(backend.getAllOS, (ordens) => callback(ordens, computeMetrics(ordens)), 'todas as OS');
  }

  // where('status', 'in', ...) + orderBy requires a composite index — sort client-side instead.
  const q = query(
    collection(db, 'ordens-servico'),
    where('status', 'in', ACTIVE_STATUSES),
    limit(pageSize),
  );
  return onSnapshot(q, (snap) => {
    const ordens = snap.docs.map((d) => docToOS(d.id, d.data())).sort(byDate);
    callback(ordens, computeMetrics(ordens));
  });
}

/**
 * OS de um condutor específico — filtrada server-side por condutorId.
 * Ordenação client-side para evitar índice composto.
 *
 * Nota: se a frota crescer muito, crie um índice composto no Firebase Console:
 * Collection: ordens-servico | Fields: condutorId ASC, criadoEm DESC
 */
export function subscribeToOSByCondutorId(
  condutorId: string,
  callback: (ordens: OrdemServico[]) => void,
): Unsubscribe {
  if (USAR_BACKEND) {
    return buscaUnica(() => backend.getOSByCondutor(condutorId), callback, 'OS do condutor');
  }

  const q = query(
    collection(db, 'ordens-servico'),
    where('condutorId', '==', condutorId),
    where('status', 'in', ACTIVE_STATUSES),
  );
  return onSnapshot(q, (snap) => {
    const ordens = snap.docs.map((d) => docToOS(d.id, d.data())).sort(byDate);
    callback(ordens);
  });
}

/** Uma OS específica em tempo real. */
export function subscribeToOSById(
  id: string,
  callback: (os: OrdemServico | null) => void,
): Unsubscribe {
  if (USAR_BACKEND) {
    return buscaUnica(() => backend.getOSById(id), callback, 'a OS');
  }

  return onSnapshot(doc(db, 'ordens-servico', id), (snap) => {
    callback(snap.exists() ? docToOS(snap.id, snap.data()) : null);
  });
}

// ── One-shot reads ─────────────────────────────────────────────────────────────

export async function getOSById(id: string): Promise<OrdemServico | null> {
  if (USAR_BACKEND) return backend.getOSById(id);

  const snap = await getDoc(doc(db, 'ordens-servico', id));
  if (!snap.exists()) return null;
  return docToOS(snap.id, snap.data());
}

export async function getAllOS(): Promise<OrdemServico[]> {
  if (USAR_BACKEND) return backend.getAllOS();

  const snap = await getDocs(query(
    collection(db, 'ordens-servico'),
    where('status', 'in', ACTIVE_STATUSES),
    limit(100),
  ));
  return snap.docs.map((d) => docToOS(d.id, d.data())).sort(byDate);
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function createOS(
  os: Omit<OrdemServico, 'id' | 'criadoEm' | 'status'>
): Promise<OrdemServico> {
  if (USAR_BACKEND) {
    // O endpoint muda conforme o perfil: o condutor só abre para veículo com
    // vínculo ativo dele; o gestor abre para qualquer um, indicando o condutor.
    const { useAuthStore } = await import('../store/auth.store');
    const ehGestor = useAuthStore.getState().currentUser?.perfil === 'gestor';
    return backend.createOS(os, ehGestor);
  }

  const firstEntry: StatusEntry = {
    status: 'nova',
    changedAt: new Date().toISOString(),
    changedBy: os.gestorNome ?? os.condutorNome ?? '—',
  };
  const payload = Object.fromEntries(
    Object.entries({
      ...os,
      status:            'nova',
      criadoEm:          serverTimestamp(),
      statusHistory:     [firstEntry],
      lembreteEnviado:   false,
      lembreteEnviadoEm: null,
      // converte dataDesejada string → Timestamp para queries no Firestore
      ...(os.dataDesejada
        ? { dataDesejada: Timestamp.fromDate(new Date(os.dataDesejada)) }
        : {}),
    }).filter(([, v]) => v !== undefined)
  );
  const ref = await addDoc(collection(db, 'ordens-servico'), payload);
  return { ...os, id: ref.id, status: 'nova', criadoEm: new Date().toISOString(), statusHistory: [firstEntry] };
}

export async function appendStatusEntry(osId: string, entry: StatusEntry): Promise<void> {
  if (USAR_BACKEND) {
    // O backend grava o histórico sozinho a cada transição — não há como (nem
    // por que) inserir uma entrada à mão.
    console.warn('[os] appendStatusEntry não existe no backend: o histórico é automático');
    return;
  }

  await updateDoc(doc(db, 'ordens-servico', osId), {
    statusHistory: arrayUnion(entry),
  });
}


export async function updateOS(id: string, updates: Partial<OrdemServico>): Promise<void> {
  if (USAR_BACKEND) {
    // Escrita genérica não tem equivalente: o backend expõe caminhos com regra
    // (status, fornecedor, itens, nota) em vez de um "grave estes campos".
    // Quem gerencia a OS usa `salvarGestao`; quem abre já manda tudo no create.
    console.warn('[os] updateOS não existe no backend; use salvarGestao', Object.keys(updates));
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, criadoEm: _ts, ...rest } = updates as any;
  const data = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  await updateDoc(doc(db, 'ordens-servico', id), data);
}

export async function marcarEntregueOficina(osId: string): Promise<void> {
  if (USAR_BACKEND) return backend.marcarEntregueOficina(osId);

  await updateDoc(doc(db, 'ordens-servico', osId), {
    entregueOficinaEm: new Date().toISOString(),
  });
}

export async function marcarRetornoOficina(osId: string): Promise<void> {
  if (USAR_BACKEND) return backend.marcarRetornoOficina(osId);

  await updateDoc(doc(db, 'ordens-servico', osId), {
    retornouOficinaEm: new Date().toISOString(),
  });
}

/** Salvar da tela de gerenciar — só existe no backend (veja `os.backend`). */
export const salvarGestao = backend.salvarGestao;
export const transferirOS = backend.transferirOS;
export type { DadosGestao } from './os.backend';
