import {
  collection,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Veiculo } from '../types';

const VEICULOS_LIMIT = 500;

function docToVeiculo(id: string, data: DocumentData): Veiculo {
  return { ...(data as Omit<Veiculo, 'id'>), id };
}

export function subscribeToAllVeiculos(
  callback: (veiculos: Veiculo[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'veiculos'),
    orderBy('placa'),
    limit(VEICULOS_LIMIT),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => docToVeiculo(d.id, d.data())));
  });
}

export async function getAllVeiculos(): Promise<Veiculo[]> {
  const q = query(collection(db, 'veiculos'), orderBy('placa'), limit(VEICULOS_LIMIT));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToVeiculo(d.id, d.data()));
}

export async function getVeiculoByPlaca(placa: string): Promise<Veiculo | null> {
  if (!placa) return null;
  // Plates may be stored with or without dash (e.g. "ABC-1234" or "ABC1234").
  // Query both variants in a single round-trip.
  const upper = placa.toUpperCase();
  const withDash = upper.length === 7 && !upper.includes('-')
    ? `${upper.slice(0, 3)}-${upper.slice(3)}`
    : upper;
  const withoutDash = upper.replace('-', '');
  const candidates = [...new Set([withDash, withoutDash])];

  const q = query(collection(db, 'veiculos'), where('placa', 'in', candidates));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return docToVeiculo(snap.docs[0].id, snap.docs[0].data());
}

export async function createVeiculo(v: Omit<Veiculo, 'id'>): Promise<Veiculo> {
  const ref = await addDoc(collection(db, 'veiculos'), v);
  return { ...v, id: ref.id };
}

export async function updateVeiculo(id: string, updates: Partial<Omit<Veiculo, 'id'>>): Promise<void> {
  await updateDoc(doc(db, 'veiculos', id), updates);
}

export async function deleteVeiculo(id: string): Promise<void> {
  await deleteDoc(doc(db, 'veiculos', id));
}
