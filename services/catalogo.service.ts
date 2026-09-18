import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { USAR_BACKEND } from '../lib/flags';
import { CatalogoServico } from '../types';
import * as backend from './catalogo.backend';

function docToServico(id: string, data: Record<string, any>): CatalogoServico {
  return {
    id,
    nome: data.nome,
    tipo: data.tipo,
    ativo: data.ativo ?? true,
  };
}

/**
 * No backend não há tempo real: busca uma vez e devolve cancelamento vazio.
 * A tela do catálogo assina em `useFocusEffect`, então recarrega ao ganhar foco.
 */
export function subscribeToServicos(
  callback: (items: CatalogoServico[]) => void,
): Unsubscribe {
  if (USAR_BACKEND) {
    let cancelado = false;
    backend.listarTodos()
      .then((items) => { if (!cancelado) callback(items); })
      .catch((err) => console.warn('[catalogo] falha ao carregar:', err));
    return () => { cancelado = true; };
  }

  const q = query(collection(db, 'catalogo-servicos'), orderBy('nome'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => docToServico(d.id, d.data())));
  });
}

export async function getServicosAtivos(): Promise<CatalogoServico[]> {
  if (USAR_BACKEND) return backend.getServicosAtivos();

  const q = query(collection(db, 'catalogo-servicos'), orderBy('nome'));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => docToServico(d.id, d.data()))
    .filter((s) => s.ativo);
}

export async function createServico(
  data: Omit<CatalogoServico, 'id'>,
): Promise<CatalogoServico> {
  if (USAR_BACKEND) return backend.createServico(data);

  const ref = await addDoc(collection(db, 'catalogo-servicos'), data);
  return { ...data, id: ref.id };
}

export async function updateServico(
  id: string,
  updates: Partial<Omit<CatalogoServico, 'id'>>,
): Promise<void> {
  if (USAR_BACKEND) return backend.updateServico(id, updates);

  await updateDoc(doc(db, 'catalogo-servicos', id), updates);
}

export async function toggleServico(id: string, ativo: boolean): Promise<void> {
  if (USAR_BACKEND) return backend.toggleServico(id, ativo);

  await updateDoc(doc(db, 'catalogo-servicos', id), { ativo });
}
