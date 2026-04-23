import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  onSnapshot,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Fornecedor } from '../types';

function docToFornecedor(id: string, data: DocumentData): Fornecedor {
  return { ...(data as Omit<Fornecedor, 'id'>), id };
}

export function subscribeToAllFornecedores(
  callback: (fornecedores: Fornecedor[]) => void
): Unsubscribe {
  return onSnapshot(collection(db, 'fornecedores'), (snap) => {
    callback(snap.docs.map((d) => docToFornecedor(d.id, d.data())));
  });
}

export async function getAllFornecedores(): Promise<Fornecedor[]> {
  const snap = await getDocs(collection(db, 'fornecedores'));
  return snap.docs.map((d) => docToFornecedor(d.id, d.data()));
}

export async function getFornecedoresByCidade(cidade: string): Promise<Fornecedor[]> {
  const all = await getAllFornecedores();
  return all.filter((f) => f.cidade.toLowerCase().includes(cidade.toLowerCase()));
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
