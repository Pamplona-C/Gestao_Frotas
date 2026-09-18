import {
  collection,
  endAt,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAt,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { USAR_BACKEND } from '../lib/flags';
import { AppUser } from '../types';
import * as backend from './usuarios.backend';

const CONDUTORES_LIMIT = 30;

function docToAppUser(id: string, data: Record<string, unknown>): AppUser {
  return { ...(data as Omit<AppUser, 'uid' | 'id'>), uid: id, id };
}

function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * No backend não há tempo real: busca uma vez e devolve cancelamento vazio.
 */
export function subscribeToCondutores(
  callback: (condutores: AppUser[]) => void,
): Unsubscribe {
  if (USAR_BACKEND) {
    let cancelado = false;
    backend.getCondutoresAtivos({ limite: 500 })
      .then((us) => { if (!cancelado) callback(us); })
      .catch((err) => console.warn('[condutores] falha ao carregar:', err));
    return () => { cancelado = true; };
  }

  const q = query(
    collection(db, 'usuarios'),
    where('perfil', '==', 'condutor'),
    where('ativo', '==', true),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => docToAppUser(d.id, d.data())));
  });
}

export async function getGestoresAtivos(): Promise<AppUser[]> {
  if (USAR_BACKEND) return backend.getGestoresAtivos();

  const snap = await getDocs(
    query(
      collection(db, 'usuarios'),
      where('perfil', '==', 'gestor'),
      where('ativo', '==', true),
    )
  );
  return snap.docs
    .map((d) => docToAppUser(d.id, d.data()))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function getCondutoresAtivos({
  busca = '',
  limite = CONDUTORES_LIMIT,
}: {
  busca?: string;
  limite?: number;
} = {}): Promise<AppUser[]> {
  if (USAR_BACKEND) return backend.getCondutoresAtivos({ busca, limite });

  const termo = normalizeSearchText(busca);

  if (termo) {
    const nomeQuery = query(
      collection(db, 'usuarios'),
      where('perfil', '==', 'condutor'),
      where('ativo', '==', true),
      orderBy('nomeBusca'),
      startAt(termo),
      endAt(`${termo}\uf8ff`),
      limit(limite),
    );
    const departamentoQuery = query(
      collection(db, 'usuarios'),
      where('perfil', '==', 'condutor'),
      where('ativo', '==', true),
      orderBy('departamentoBusca'),
      startAt(termo),
      endAt(`${termo}\uf8ff`),
      limit(limite),
    );

    const [nomeSnap, departamentoSnap] = await Promise.all([
      getDocs(nomeQuery),
      getDocs(departamentoQuery),
    ]);

    const dedup = new Map<string, AppUser>();
    [...nomeSnap.docs, ...departamentoSnap.docs].forEach((docSnap) => {
      dedup.set(docSnap.id, docToAppUser(docSnap.id, docSnap.data()));
    });

    return [...dedup.values()]
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .slice(0, limite);
  }

  const q = query(
    collection(db, 'usuarios'),
    where('perfil', '==', 'condutor'),
    where('ativo', '==', true),
    limit(limite),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => docToAppUser(d.id, d.data()))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
