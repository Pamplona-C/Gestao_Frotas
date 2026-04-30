import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Fornecedor } from '../types';

const FORNECEDORES_LIMIT = 500;
export const FORNECEDORES_PAGE_SIZE = 25;

export type PaginaFornecedores = {
  items: Fornecedor[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
};

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

export async function getFornecedoresPaginados(
  cursor?: QueryDocumentSnapshot<DocumentData> | null
): Promise<PaginaFornecedores> {
  const q = cursor
    ? query(collection(db, 'fornecedores'), orderBy('nome'), startAfter(cursor), limit(FORNECEDORES_PAGE_SIZE + 1))
    : query(collection(db, 'fornecedores'), orderBy('nome'), limit(FORNECEDORES_PAGE_SIZE + 1));
  const snap = await getDocs(q);
  const hasMore = snap.docs.length > FORNECEDORES_PAGE_SIZE;
  const docs = hasMore ? snap.docs.slice(0, FORNECEDORES_PAGE_SIZE) : snap.docs;
  return {
    items: docs.map((d) => docToFornecedor(d.id, d.data())),
    cursor: (docs[docs.length - 1] as QueryDocumentSnapshot<DocumentData>) ?? null,
    hasMore,
  };
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

export async function updateFornecedor(id: string, updates: Partial<Omit<Fornecedor, 'id'>>): Promise<void> {
  const data = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
  await updateDoc(doc(db, 'fornecedores', id), data);
}

export async function deleteFornecedor(id: string): Promise<void> {
  await deleteDoc(doc(db, 'fornecedores', id));
}
