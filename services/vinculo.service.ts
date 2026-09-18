import {
  collection,
  doc,
  addDoc,
  arrayUnion,
  documentId,
  getDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { USAR_BACKEND } from '../lib/flags';
import { ChecklistPendencia, Vinculo, VinculoStatus } from '../types';
import * as backend from './vinculo.backend';

function docToVinculo(id: string, data: Record<string, unknown>): Vinculo {
  const condutorIds = (data.condutorIds as string[] | undefined) ?? [data.condutorId as string];
  return { ...(data as Omit<Vinculo, 'id'>), id, condutorIds };
}

export function subscribeToVinculosByCondutorId(
  condutorId: string,
  callback: (vinculos: Vinculo[]) => void,
): Unsubscribe {
  if (USAR_BACKEND) {
    // Some a query dupla: no backend o vínculo tem uma lista de condutores só.
    let cancelado = false;
    backend.listarPorCondutor(condutorId)
      .then((vs) => { if (!cancelado) callback(vs); })
      .catch((err) => console.warn('[vinculos] falha ao carregar:', err));
    return () => { cancelado = true; };
  }

  // Duas queries para cobrir docs antigos (só condutorId) e novos (condutorIds array)
  const qNew = query(collection(db, 'vinculos'), where('condutorIds', 'array-contains', condutorId));
  const qOld = query(collection(db, 'vinculos'), where('condutorId', '==', condutorId));

  const state: { new: Vinculo[]; old: Vinculo[] } = { new: [], old: [] };

  function emit() {
    const merged = new Map<string, Vinculo>();
    for (const v of [...state.old, ...state.new]) merged.set(v.id, v);
    callback([...merged.values()]);
  }

  const unsubNew = onSnapshot(qNew, (snap) => {
    state.new = snap.docs.map((d) => docToVinculo(d.id, d.data()));
    emit();
  });

  const unsubOld = onSnapshot(qOld, (snap) => {
    state.old = snap.docs.map((d) => docToVinculo(d.id, d.data()));
    emit();
  });

  return () => { unsubNew(); unsubOld(); };
}

export function subscribeToVinculosByVeiculoId(
  veiculoId: string,
  callback: (vinculos: Vinculo[]) => void,
): Unsubscribe {
  if (USAR_BACKEND) {
    let cancelado = false;
    backend.listarPorVeiculo(veiculoId)
      .then((vs) => { if (!cancelado) callback(vs); })
      .catch((err) => console.warn('[vinculos] falha ao carregar:', err));
    return () => { cancelado = true; };
  }

  const q = query(collection(db, 'vinculos'), where('veiculoId', '==', veiculoId));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => docToVinculo(d.id, d.data())));
  });
}


export async function getVinculosByIds(ids: string[]): Promise<Vinculo[]> {
  if (USAR_BACKEND) return backend.getVinculosByIds(ids);

  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += 10) {
    chunks.push(uniqueIds.slice(i, i + 10));
  }

  const snaps = await Promise.all(
    chunks.map((chunk) =>
      getDocs(query(collection(db, 'vinculos'), where(documentId(), 'in', chunk))),
    ),
  );

  return snaps.flatMap((snap) => snap.docs.map((d) => docToVinculo(d.id, d.data())));
}

export async function getVinculosComPendenciaChecklist(
  tipo?: Exclude<ChecklistPendencia, null>,
): Promise<Vinculo[]> {
  if (USAR_BACKEND) return backend.getVinculosComPendenciaChecklist(tipo);

  const q = tipo
    ? query(collection(db, 'vinculos'), where('pendenciaChecklist', '==', tipo))
    : query(collection(db, 'vinculos'), where('pendenciaChecklist', 'in', ['entrada', 'saida']));

  const snap = await getDocs(q);
  return snap.docs.map((d) => docToVinculo(d.id, d.data()));
}

export async function createVinculo(
  data: Omit<Vinculo, 'id' | 'criadoEm'>,
): Promise<Vinculo> {
  if (USAR_BACKEND) {
    return backend.createVinculo({ veiculoId: data.veiculoId, condutorId: data.condutorId });
  }

  const raw = {
    ...data,
    condutorIds: [data.condutorId],
    criadoEm: new Date().toISOString(),
    pendenciaChecklist: 'entrada' as ChecklistPendencia,
    status: 'ativo' as VinculoStatus,
  };
  // Firestore rejeita undefined — remove campos ausentes
  const payload = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined),
  ) as typeof raw;
  const ref = await addDoc(collection(db, 'vinculos'), payload);
  return { ...payload, id: ref.id };
}

export async function addCondutorToVinculo(
  vinculoId: string,
  condutor2: { uid: string; nome: string },
  condutor1Id: string,
): Promise<void> {
  if (USAR_BACKEND) return backend.addCondutorToVinculo(vinculoId, condutor2.uid);

  // arrayUnion com condutor1Id garante que docs antigos (sem condutorIds) incluam ambos
  await updateDoc(doc(db, 'vinculos', vinculoId), {
    condutorId2:   condutor2.uid,
    condutorNome2: condutor2.nome,
    condutorIds:   arrayUnion(condutor1Id, condutor2.uid),
  });
}


/**
 * Update genérico — sem equivalente no backend, e de propósito: lá as transições
 * de status são controladas pelos endpoints de checklist e encerramento.
 * Nenhuma tela usa esta função.
 */
export async function updateVinculo(
  id: string,
  updates: Partial<Omit<Vinculo, 'id'>>,
): Promise<void> {
  if (USAR_BACKEND) {
    throw new Error('updateVinculo não existe no backend: use os endpoints de checklist');
  }

  const clean = Object.fromEntries(
    Object.entries(updates).filter(([, v]) => v !== undefined),
  );
  await updateDoc(doc(db, 'vinculos', id), clean);
}

export async function getVinculoById(id: string): Promise<Vinculo | null> {
  if (USAR_BACKEND) return backend.getVinculoById(id);

  const snap = await getDoc(doc(db, 'vinculos', id));
  if (!snap.exists()) return null;
  return docToVinculo(snap.id, snap.data() as Record<string, unknown>);
}

export async function encerrarVinculo(
  id: string,
  pendenciaChecklist: ChecklistPendencia = 'saida',
): Promise<void> {
  // No backend, encerrado é terminal: não existe "encerrado com pendência".
  // O parâmetro `pendenciaChecklist` deixa de ter efeito.
  if (USAR_BACKEND) return backend.encerrarVinculo(id);

  await updateDoc(doc(db, 'vinculos', id), {
    status: 'inativo' as VinculoStatus,
    pendenciaChecklist,
    encerradoEm: new Date().toISOString(),
  });
}

/**
 * Deriva a pendência de checklist a partir do estado real do vínculo.
 *
 * É a mesma regra que `scripts/backfill-pendencia-checklist.mjs` grava no campo
 * `pendenciaChecklist`. Derivar em vez de ler o campo é deliberado: o campo só passou
 * a ser escrito em 22/05/2026 (commit 77aa4fc) e uma query nele omite **em silêncio**
 * todo vínculo anterior a essa data — justamente as pendências mais antigas, que são
 * as que uma auditoria precisa ver primeiro.
 */
export function pendenciaDoVinculo(v: Vinculo): ChecklistPendencia {
  if (v.checklistSaidaId) return null;
  if (v.status === 'inativo') return 'saida';
  if (v.checklistEntradaId) return null;
  return 'entrada';
}

/**
 * Lê a coleção inteira de vínculos para a auditoria de checklists (`app/checklists`).
 *
 * Um único read resolve as duas necessidades da tela: as pendências (via
 * `pendenciaDoVinculo`) e o nome do veículo/condutor de cada checklist concluído —
 * o que dispensa o `getVinculosByIds()` em lote que a tela fazia antes.
 *
 * Revisitar quando `vinculos` passar de ~1000 documentos: aí compensa rodar o backfill
 * e voltar para o caminho indexado por `pendenciaChecklist`.
 */
export async function getVinculosParaAuditoria(): Promise<Vinculo[]> {
  if (USAR_BACKEND) return backend.listarTodos();

  const snap = await getDocs(collection(db, 'vinculos'));
  return snap.docs.map((d) => docToVinculo(d.id, d.data()));
}
