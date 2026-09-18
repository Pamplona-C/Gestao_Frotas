import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  where,
  type DocumentData,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { USAR_BACKEND } from '../lib/flags';
import * as backend from './checklist.backend';
import { Checklist } from '../types';
import { uploadFotosGenerica } from './storage.service';

function toIsoDate(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toDate' in value) {
    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === 'function') {
      return maybeTimestamp.toDate().toISOString();
    }
  }
  return new Date().toISOString();
}

function docToChecklist(id: string, data: DocumentData): Checklist {
  return {
    ...(data as Omit<Checklist, 'id' | 'completadoEm'>),
    id,
    completadoEm: toIsoDate(data.completadoEm),
  };
}

export async function createChecklist(
  data: Omit<Checklist, 'id'>,
  fotosUris: Record<string, string>,
  onProgress?: (pct: number) => void,
): Promise<Checklist> {
  if (USAR_BACKEND) return backend.createChecklist(data, fotosUris, onProgress);

  const angulos = Object.keys(fotosUris);
  const uris    = Object.values(fotosUris);

  const storagePath = `checklists/${data.vinculoId}/${data.tipo}`;
  const urls = await uploadFotosGenerica(uris, storagePath, onProgress);

  const fotosMap: Record<string, string> = {};
  angulos.forEach((angulo, i) => { fotosMap[angulo] = urls[i]; });

  const rawPayload = {
    ...data,
    fotos:        fotosMap,
    completadoEm: new Date().toISOString(),
  };
  const payload = Object.fromEntries(
    Object.entries(rawPayload).filter(([, v]) => v !== undefined),
  ) as Omit<Checklist, 'id'>;

  // Gera ref antecipadamente para obter o ID antes da transação
  const checklistRef = doc(collection(db, 'checklists'));
  const vinculoRef   = doc(db, 'vinculos', data.vinculoId);

  // Cria checklist + atualiza vínculo atomicamente
  await runTransaction(db, async (tx) => {
    const vinculoSnap = await tx.get(vinculoRef);

    tx.set(checklistRef, payload);

    if (data.tipo === 'entrada') {
      tx.update(vinculoRef, { checklistEntradaId: checklistRef.id, pendenciaChecklist: null });
    } else {
      const updates: Record<string, unknown> = {
        checklistSaidaId: checklistRef.id,
        pendenciaChecklist: null,
      };
      if (vinculoSnap.data()?.status === 'ativo') {
        updates.status      = 'inativo';
        updates.encerradoEm = new Date().toISOString();
      }
      tx.update(vinculoRef, updates);
    }
  });

  return { ...payload, id: checklistRef.id };
}

export async function skipChecklistDev(
  vinculoId: string,
  tipo: 'entrada' | 'saida',
  condutorId: string,
  veiculoId: string,
  veiculoTipo: Checklist['veiculoTipo'],
): Promise<void> {
  if (!__DEV__) return;
  if (USAR_BACKEND) {
    return backend.skipChecklistDev(vinculoId, tipo, condutorId, veiculoId, veiculoTipo);
  }

  const checklistRef = doc(collection(db, 'checklists'));
  const vinculoRef   = doc(db, 'vinculos', vinculoId);

  const payload: Omit<Checklist, 'id'> = {
    tipo,
    vinculoId,
    condutorId,
    veiculoId,
    veiculoTipo,
    fotos: {},
    completadoEm: new Date().toISOString(),
  };

  await runTransaction(db, async (tx) => {
    const vinculoSnap = await tx.get(vinculoRef);
    tx.set(checklistRef, payload);

    if (tipo === 'entrada') {
      tx.update(vinculoRef, { checklistEntradaId: checklistRef.id, pendenciaChecklist: null });
    } else {
      const updates: Record<string, unknown> = {
        checklistSaidaId: checklistRef.id,
        pendenciaChecklist: null,
      };
      if (vinculoSnap.data()?.status === 'ativo') {
        updates.status      = 'inativo';
        updates.encerradoEm = new Date().toISOString();
      }
      tx.update(vinculoRef, updates);
    }
  });
}

export async function getChecklistsByVinculo(vinculoId: string): Promise<Checklist[]> {
  if (USAR_BACKEND) return backend.getChecklistsByVinculo(vinculoId);

  const q = query(collection(db, 'checklists'), where('vinculoId', '==', vinculoId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToChecklist(d.id, d.data()));
}

export function subscribeToRecentChecklists(
  callback: (checklists: Checklist[]) => void,
  pageSize = 300,
): Unsubscribe {
  if (USAR_BACKEND) {
    // Sem tempo real no REST: uma busca só, e o unsubscribe apenas impede que
    // uma resposta atrasada chame o callback depois que a tela já saiu.
    let cancelado = false;
    backend
      .getRecentChecklists({ pageSize })
      .then((items) => {
        if (!cancelado) callback(items);
      })
      .catch((err) => console.warn('[checklist] falha ao listar recentes:', err));
    return () => {
      cancelado = true;
    };
  }

  const q = query(
    collection(db, 'checklists'),
    orderBy('completadoEm', 'desc'),
    limit(pageSize),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => docToChecklist(d.id, d.data())));
  });
}

export type FiltroChecklists = {
  /** Limite inferior inclusivo, ISO. Omitido = sem piso. */
  inicioIso?: string;
  /** Limite superior inclusivo, ISO. Quem chama manda o **fim do dia**. */
  fimIso?: string;
  pageSize?: number;
};

/**
 * Checklists concluídos dentro de um intervalo.
 *
 * Os dois limites e o `orderBy` são no mesmo campo (`completadoEm`), então nenhuma
 * combinação aqui exige índice composto. `completadoEm` é sempre gravado como
 * `new Date().toISOString()` — comparar com string é comparação de mesmo tipo.
 */
export async function getRecentChecklists(
  filtro: FiltroChecklists = {},
): Promise<Checklist[]> {
  const { inicioIso, fimIso, pageSize = 200 } = filtro;
  if (USAR_BACKEND) return backend.getRecentChecklists(filtro);

  const restricoes: QueryConstraint[] = [];
  if (inicioIso) restricoes.push(where('completadoEm', '>=', inicioIso));
  if (fimIso) restricoes.push(where('completadoEm', '<=', fimIso));
  restricoes.push(orderBy('completadoEm', 'desc'), limit(pageSize));

  const snap = await getDocs(query(collection(db, 'checklists'), ...restricoes));
  return snap.docs.map((d) => docToChecklist(d.id, d.data()));
}

export async function getChecklistById(id: string): Promise<Checklist | null> {
  if (USAR_BACKEND) return backend.getChecklistById(id);

  const snap = await getDoc(doc(db, 'checklists', id));
  if (!snap.exists()) return null;
  return docToChecklist(snap.id, snap.data());
}
