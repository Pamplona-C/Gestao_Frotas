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
import { USAR_BACKEND } from '../lib/flags';
import { Fornecedor } from '../types';
import * as backend from './fornecedor.backend';

const FORNECEDORES_LIMIT = 500;
export const FORNECEDORES_PAGE_SIZE = 25;

/**
 * Marcador de posição da paginação: documento do Firestore ou deslocamento no
 * backend. As telas só guardam e devolvem, sem inspecionar.
 */
export type CursorFornecedores = QueryDocumentSnapshot<DocumentData> | string | null;

export type PaginaFornecedores = {
  items: Fornecedor[];
  cursor: CursorFornecedores;
  hasMore: boolean;
};

function docToFornecedor(id: string, data: DocumentData): Fornecedor {
  return { ...(data as Omit<Fornecedor, 'id'>), id };
}

/**
 * No backend não há tempo real: busca uma vez e devolve cancelamento vazio.
 * As telas assinam em `useFocusEffect`, então a lista recarrega ao ganhar foco.
 */
export function subscribeToAllFornecedores(
  callback: (fornecedores: Fornecedor[]) => void
): Unsubscribe {
  if (USAR_BACKEND) {
    let cancelado = false;
    backend.getAllFornecedores()
      .then((fs) => { if (!cancelado) callback(fs); })
      .catch((err) => console.warn('[fornecedores] falha ao carregar:', err));
    return () => { cancelado = true; };
  }

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
  cursor?: CursorFornecedores
): Promise<PaginaFornecedores> {
  if (USAR_BACKEND) {
    // O backend ainda não pagina: fatiamos a lista completa aqui.
    const todos = await backend.getAllFornecedores();
    const inicio = typeof cursor === 'string' ? Number(cursor) : 0;
    const fim = inicio + FORNECEDORES_PAGE_SIZE;
    return {
      items: todos.slice(inicio, fim),
      cursor: String(fim),
      hasMore: fim < todos.length,
    };
  }

  const anterior = cursor as QueryDocumentSnapshot<DocumentData> | null | undefined;
  const q = anterior
    ? query(collection(db, 'fornecedores'), orderBy('nome'), startAfter(anterior), limit(FORNECEDORES_PAGE_SIZE + 1))
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
  if (USAR_BACKEND) return backend.getAllFornecedores();

  const q = query(collection(db, 'fornecedores'), orderBy('nome'), limit(FORNECEDORES_LIMIT));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToFornecedor(d.id, d.data()));
}

export async function getFornecedorById(id: string): Promise<Fornecedor | null> {
  if (USAR_BACKEND) return backend.getFornecedorById(id);

  const snap = await getDoc(doc(db, 'fornecedores', id));
  if (!snap.exists()) return null;
  return docToFornecedor(snap.id, snap.data());
}

export async function createFornecedor(f: Omit<Fornecedor, 'id'>): Promise<Fornecedor> {
  if (USAR_BACKEND) return backend.createFornecedor(f);

  const ref = await addDoc(collection(db, 'fornecedores'), f);
  return { ...f, id: ref.id };
}

export async function updateFornecedor(id: string, updates: Partial<Omit<Fornecedor, 'id'>>): Promise<void> {
  if (USAR_BACKEND) return backend.updateFornecedor(id, updates);

  const data = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
  await updateDoc(doc(db, 'fornecedores', id), data);
}

export async function deleteFornecedor(id: string): Promise<void> {
  if (USAR_BACKEND) return backend.deleteFornecedor(id);

  await deleteDoc(doc(db, 'fornecedores', id));
}
