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
  updateDoc,
  where,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { OrdemServico, OSStatus, StatusEntry } from '../types';

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
    ...(data as Omit<OrdemServico, 'id' | 'criadoEm'>),
    id,
    criadoEm: data.criadoEm?.toDate?.()?.toISOString() ?? data.criadoEm ?? new Date().toISOString(),
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
  return onSnapshot(doc(db, 'ordens-servico', id), (snap) => {
    callback(snap.exists() ? docToOS(snap.id, snap.data()) : null);
  });
}

// ── One-shot reads ─────────────────────────────────────────────────────────────

export async function getOSById(id: string): Promise<OrdemServico | null> {
  const snap = await getDoc(doc(db, 'ordens-servico', id));
  if (!snap.exists()) return null;
  return docToOS(snap.id, snap.data());
}

export async function getAllOS(): Promise<OrdemServico[]> {
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
  const firstEntry: StatusEntry = {
    status: 'nova',
    changedAt: new Date().toISOString(),
    changedBy: os.condutorNome,
  };
  const payload = Object.fromEntries(
    Object.entries({
      ...os,
      status: 'nova',
      criadoEm: serverTimestamp(),
      statusHistory: [firstEntry],
    }).filter(([, v]) => v !== undefined)
  );
  const ref = await addDoc(collection(db, 'ordens-servico'), payload);
  return { ...os, id: ref.id, status: 'nova', criadoEm: new Date().toISOString(), statusHistory: [firstEntry] };
}

export async function appendStatusEntry(osId: string, entry: StatusEntry): Promise<void> {
  await updateDoc(doc(db, 'ordens-servico', osId), {
    statusHistory: arrayUnion(entry),
  });
}

export async function updateOS(id: string, updates: Partial<OrdemServico>): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, criadoEm: _ts, ...rest } = updates as any;
  const data = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  await updateDoc(doc(db, 'ordens-servico', id), data);
}
