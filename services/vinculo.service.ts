import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Vinculo, VinculoStatus } from '../types';

function docToVinculo(id: string, data: Record<string, unknown>): Vinculo {
  return { ...(data as Omit<Vinculo, 'id'>), id };
}

export function subscribeToVinculosByCondutorId(
  condutorId: string,
  callback: (vinculos: Vinculo[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'vinculos'), where('condutorId', '==', condutorId));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => docToVinculo(d.id, d.data())));
  });
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

export async function createVinculo(
  data: Omit<Vinculo, 'id' | 'criadoEm'>,
): Promise<Vinculo> {
  const existente = await getDocs(
    query(collection(db, 'vinculos'),
      where('veiculoId', '==', data.veiculoId),
      where('status', '==', 'ativo'),
    ),
  );
  if (!existente.empty) {
    throw new Error('Este veículo já possui um condutor ativo vinculado.');
  }
  const raw = {
    ...data,
    criadoEm: new Date().toISOString(),
    status: 'ativo' as VinculoStatus,
  };
  // Firestore rejeita undefined — remove campos ausentes
  const payload = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined),
  ) as typeof raw;
  const ref = await addDoc(collection(db, 'vinculos'), payload);
  return { ...payload, id: ref.id };
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

export async function encerrarVinculo(id: string): Promise<void> {
  await updateDoc(doc(db, 'vinculos', id), {
    status: 'inativo' as VinculoStatus,
    encerradoEm: new Date().toISOString(),
  });
}
