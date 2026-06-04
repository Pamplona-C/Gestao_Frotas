import {
  collection,
  onSnapshot,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  doc,
  updateDoc,
  writeBatch,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Notificacao } from '../types';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function docToNotificacao(id: string, data: Record<string, any>): Notificacao {
  return {
    id,
    userId: data.userId,
    type: data.type,
    title: data.title,
    body: data.body,
    osId: data.osId,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    expiresAt: data.expiresAt?.toDate?.().toISOString() ?? new Date(Date.now() + NINETY_DAYS_MS).toISOString(),
    read: data.read ?? false,
  };
}

export function subscribeToNotificacoes(
  uid: string,
  callback: (items: Notificacao[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'notificacoes'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(50),
  );

  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => docToNotificacao(d.id, d.data())));
  });
}

export async function getNotifications(userId: string): Promise<Notificacao[]> {
  const q = query(
    collection(db, 'notificacoes'),
    where('userId', '==', userId),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => docToNotificacao(d.id, d.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function markAsRead(id: string): Promise<void> {
  await updateDoc(doc(db, 'notificacoes', id), { read: true });
}

export async function markAllAsRead(ids: string[]): Promise<void> {
  const batch = writeBatch(db);
  ids.forEach((id) => batch.update(doc(db, 'notificacoes', id), { read: true }));
  await batch.commit();
}

export async function createNotification(
  payload: Omit<Notificacao, 'id' | 'createdAt' | 'expiresAt' | 'read'>,
): Promise<void> {
  const now = new Date();
  await addDoc(collection(db, 'notificacoes'), {
    ...payload,
    createdAt: Timestamp.fromDate(now),
    expiresAt: Timestamp.fromDate(new Date(now.getTime() + NINETY_DAYS_MS)),
    read: false,
  });
}
