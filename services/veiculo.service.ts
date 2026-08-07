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
  where,
  orderBy,
  limit,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { USAR_BACKEND } from '../lib/flags';
import { Veiculo } from '../types';
import * as backend from './veiculo.backend';

const VEICULOS_LIMIT = 500;
export const VEICULOS_PAGE_SIZE = 25;

/**
 * Marcador de posição da paginação. No Firestore é o último documento da página;
 * no backend é um deslocamento numérico em texto. As telas só o guardam e
 * devolvem, sem inspecionar — por isso o tipo é opaco.
 */
export type CursorVeiculos = QueryDocumentSnapshot<DocumentData> | string | null;

export type PaginaVeiculos = {
  items: Veiculo[];
  cursor: CursorVeiculos;
  hasMore: boolean;
};

function docToVeiculo(id: string, data: DocumentData): Veiculo {
  return { ...(data as Omit<Veiculo, 'id'>), id };
}

/**
 * No Firestore isto é uma assinatura viva: a lista se atualiza sozinha.
 *
 * No backend **não existe tempo real**. Buscamos uma vez, entregamos ao
 * callback e devolvemos um cancelamento vazio. Como as telas assinam dentro de
 * `useFocusEffect`, a lista recarrega toda vez que a tela ganha foco — o que
 * cobre bem a tela de veículos. A perda real de tempo real está no painel do
 * gestor, que é decisão à parte.
 */
export function subscribeToAllVeiculos(
  callback: (veiculos: Veiculo[]) => void
): Unsubscribe {
  if (USAR_BACKEND) {
    let cancelado = false;
    backend.getAllVeiculos()
      .then((vs) => { if (!cancelado) callback(vs); })
      .catch((err) => console.warn('[veiculos] falha ao carregar:', err));
    return () => { cancelado = true; };
  }

  const q = query(
    collection(db, 'veiculos'),
    orderBy('frota'),
    limit(VEICULOS_LIMIT),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => docToVeiculo(d.id, d.data())));
  });
}

/**
 * O backend ainda não pagina (`GET /veiculos` devolve a frota inteira), então
 * paginamos aqui sobre a lista completa. Para uma frota de centenas de veículos
 * isso é aceitável; se crescer muito, o certo é `?page&size` no backend.
 */
export async function getVeiculosPaginados(
  cursor?: CursorVeiculos
): Promise<PaginaVeiculos> {
  if (USAR_BACKEND) {
    const todos = await backend.getAllVeiculos();
    const inicio = typeof cursor === 'string' ? Number(cursor) : 0;
    const fim = inicio + VEICULOS_PAGE_SIZE;
    const items = todos.slice(inicio, fim);
    return {
      items,
      cursor: String(fim),
      hasMore: fim < todos.length,
    };
  }

  const anterior = cursor as QueryDocumentSnapshot<DocumentData> | null | undefined;
  const q = anterior
    ? query(collection(db, 'veiculos'), orderBy('frota'), startAfter(anterior), limit(VEICULOS_PAGE_SIZE + 1))
    : query(collection(db, 'veiculos'), orderBy('frota'), limit(VEICULOS_PAGE_SIZE + 1));
  const snap = await getDocs(q);
  const hasMore = snap.docs.length > VEICULOS_PAGE_SIZE;
  const docs = hasMore ? snap.docs.slice(0, VEICULOS_PAGE_SIZE) : snap.docs;
  return {
    items: docs.map((d) => docToVeiculo(d.id, d.data())),
    cursor: (docs[docs.length - 1] as QueryDocumentSnapshot<DocumentData>) ?? null,
    hasMore,
  };
}

export async function getAllVeiculos(): Promise<Veiculo[]> {
  if (USAR_BACKEND) return backend.getAllVeiculos();

  const q = query(collection(db, 'veiculos'), orderBy('frota'), limit(VEICULOS_LIMIT));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToVeiculo(d.id, d.data()));
}

export async function getVeiculoById(id: string): Promise<Veiculo | null> {
  if (USAR_BACKEND) return backend.getVeiculoById(id);

  const snap = await getDoc(doc(db, 'veiculos', id));
  if (!snap.exists()) return null;
  return docToVeiculo(snap.id, snap.data());
}

export async function getVeiculoByPlaca(placa: string): Promise<Veiculo | null> {
  if (USAR_BACKEND) return backend.getVeiculoByPlaca(placa);

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
  if (USAR_BACKEND) return backend.createVeiculo(v);

  const ref = await addDoc(collection(db, 'veiculos'), v);
  return { ...v, id: ref.id };
}

export async function updateVeiculo(id: string, updates: Partial<Omit<Veiculo, 'id'>>): Promise<void> {
  if (USAR_BACKEND) return backend.updateVeiculo(id, updates);

  await updateDoc(doc(db, 'veiculos', id), updates);
}

export async function deleteVeiculo(id: string): Promise<void> {
  if (USAR_BACKEND) return backend.deleteVeiculo(id);

  await deleteDoc(doc(db, 'veiculos', id));
}
