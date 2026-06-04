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
import { ChecklistPendencia, Vinculo, VinculoStatus } from '../types';

function docToVinculo(id: string, data: Record<string, unknown>): Vinculo {
  const condutorIds = (data.condutorIds as string[] | undefined) ?? [data.condutorId as string];
  return { ...(data as Omit<Vinculo, 'id'>), id, condutorIds };
}

export function subscribeToVinculosByCondutorId(
  condutorId: string,
  callback: (vinculos: Vinculo[]) => void,
): Unsubscribe {
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
  const q = query(collection(db, 'vinculos'), where('veiculoId', '==', veiculoId));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => docToVinculo(d.id, d.data())));
  });
}


export async function getVinculosByIds(ids: string[]): Promise<Vinculo[]> {
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
  const q = tipo
    ? query(collection(db, 'vinculos'), where('pendenciaChecklist', '==', tipo))
    : query(collection(db, 'vinculos'), where('pendenciaChecklist', 'in', ['entrada', 'saida']));

  const snap = await getDocs(q);
  return snap.docs.map((d) => docToVinculo(d.id, d.data()));
}

export async function createVinculo(
  data: Omit<Vinculo, 'id' | 'criadoEm'>,
): Promise<Vinculo> {
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
  // arrayUnion com condutor1Id garante que docs antigos (sem condutorIds) incluam ambos
  await updateDoc(doc(db, 'vinculos', vinculoId), {
    condutorId2:   condutor2.uid,
    condutorNome2: condutor2.nome,
    condutorIds:   arrayUnion(condutor1Id, condutor2.uid),
  });
}


export async function updateVinculo(
  id: string,
  updates: Partial<Omit<Vinculo, 'id'>>,
): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries(updates).filter(([, v]) => v !== undefined),
  );
  await updateDoc(doc(db, 'vinculos', id), clean);
}

export async function getVinculoById(id: string): Promise<Vinculo | null> {
  const snap = await getDoc(doc(db, 'vinculos', id));
  if (!snap.exists()) return null;
  return docToVinculo(snap.id, snap.data() as Record<string, unknown>);
}

export async function encerrarVinculo(
  id: string,
  pendenciaChecklist: ChecklistPendencia = 'saida',
): Promise<void> {
  await updateDoc(doc(db, 'vinculos', id), {
    status: 'inativo' as VinculoStatus,
    pendenciaChecklist,
    encerradoEm: new Date().toISOString(),
  });
}
