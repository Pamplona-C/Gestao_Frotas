import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Fornecedor } from '../types';

const FORNECEDORES_LIMIT = 500;

function docToFornecedor(id: string, data: DocumentData): Fornecedor {
  return { ...(data as Omit<Fornecedor, 'id'>), id };
}

export function subscribeToAllFornecedores(
  callback: (fornecedores: Fornecedor[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'fornecedores'),
    orderBy('nome'),
    limit(FORNECEDORES_LIMIT),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => docToFornecedor(d.id, d.data())));
  });
}

export async function getAllFornecedores(): Promise<Fornecedor[]> {
  const q = query(collection(db, 'fornecedores'), orderBy('nome'), limit(FORNECEDORES_LIMIT));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToFornecedor(d.id, d.data()));
}

export async function getFornecedorById(id: string): Promise<Fornecedor | null> {
  const snap = await getDoc(doc(db, 'fornecedores', id));
  if (!snap.exists()) return null;
  return docToFornecedor(snap.id, snap.data());
}

export async function createFornecedor(f: Omit<Fornecedor, 'id'>): Promise<Fornecedor> {
  const ref = await addDoc(collection(db, 'fornecedores'), f);
  return { ...f, id: ref.id };
}
