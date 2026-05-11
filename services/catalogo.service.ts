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
import { CatalogoServico } from '../types';

function docToServico(id: string, data: Record<string, any>): CatalogoServico {
  return {
    id,
    nome: data.nome,
    tipo: data.tipo,
    ativo: data.ativo ?? true,
  };
}

export function subscribeToServicos(
  callback: (items: CatalogoServico[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'catalogo-servicos'), orderBy('nome'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => docToServico(d.id, d.data())));
  });
}

export async function getServicosAtivos(): Promise<CatalogoServico[]> {
  const q = query(collection(db, 'catalogo-servicos'), orderBy('nome'));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => docToServico(d.id, d.data()))
    .filter((s) => s.ativo);
}

export async function createServico(
  data: Omit<CatalogoServico, 'id'>,
): Promise<CatalogoServico> {
  const ref = await addDoc(collection(db, 'catalogo-servicos'), data);
  return { ...data, id: ref.id };
}

export async function updateServico(
  id: string,
  updates: Partial<Omit<CatalogoServico, 'id'>>,
): Promise<void> {
  await updateDoc(doc(db, 'catalogo-servicos', id), updates);
}

export async function toggleServico(id: string, ativo: boolean): Promise<void> {
  await updateDoc(doc(db, 'catalogo-servicos', id), { ativo });
}
