import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Notificacao } from '../types';

export function subscribeToNotificacoes(
  uid: string,
  callback: (items: Notificacao[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'notificacoes'),
    where('userId', '==', uid),
  );

  return onSnapshot(q, (snap) => {
    const items: Notificacao[] = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: data.userId,
          type: data.type,
          title: data.title,
          body: data.body,
          osId: data.osId,
          sentAt: data.sentAt?.toDate?.().toISOString() ?? new Date().toISOString(),
          readAt: data.readAt?.toDate?.().toISOString(),
        } satisfies Notificacao;
      })
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt)); // mais recentes primeiro, client-side
    callback(items);
  });
}

export async function marcarComoLida(id: string): Promise<void> {
  await updateDoc(doc(db, 'notificacoes', id), {
    readAt: new Date(),
  });
}

export async function marcarTodasComoLidas(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => marcarComoLida(id)));
}
