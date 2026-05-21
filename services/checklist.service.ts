import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Checklist } from '../types';
import { updateVinculo, encerrarVinculo } from './vinculo.service';
import { uploadFotosGenerica } from './storage.service';

function docToChecklist(id: string, data: Record<string, unknown>): Checklist {
  return { ...(data as Omit<Checklist, 'id'>), id };
}

export async function createChecklist(
  data: Omit<Checklist, 'id'>,
  fotosUris: Record<string, string>,
  onProgress?: (pct: number) => void,
): Promise<Checklist> {
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

  const ref = await addDoc(collection(db, 'checklists'), payload);
  const checklist: Checklist = { ...payload, id: ref.id };

  if (data.tipo === 'entrada') {
    await updateVinculo(data.vinculoId, { checklistEntradaId: ref.id });
  } else {
    await updateVinculo(data.vinculoId, { checklistSaidaId: ref.id });
    const vinculoSnap = await getDoc(doc(db, 'vinculos', data.vinculoId));
    if (vinculoSnap.data()?.status === 'ativo') {
      await encerrarVinculo(data.vinculoId);
    }
  }

  return checklist;
}

export async function getChecklistsByVinculo(vinculoId: string): Promise<Checklist[]> {
  const q = query(collection(db, 'checklists'), where('vinculoId', '==', vinculoId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToChecklist(d.id, d.data()));
}
