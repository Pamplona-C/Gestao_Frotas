import {
  collection,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppUser } from '../types';

function docToAppUser(id: string, data: Record<string, unknown>): AppUser {
  return { ...(data as Omit<AppUser, 'uid' | 'id'>), uid: id, id };
}

export function subscribeToCondutores(
  callback: (condutores: AppUser[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'usuarios'),
    where('perfil', '==', 'condutor'),
  );
  return onSnapshot(q, (snap) => {
    const todos = snap.docs.map((d) => docToAppUser(d.id, d.data()));
    // ativo pode ser undefined em documentos antigos — trata ausência como ativo
    callback(todos.filter((u) => u.ativo !== false));
  });
}
