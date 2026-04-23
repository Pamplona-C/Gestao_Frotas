import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  onSnapshot,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Veiculo } from '../types';

function docToVeiculo(id: string, data: DocumentData): Veiculo {
  return { ...(data as Omit<Veiculo, 'id'>), id };
}

export function subscribeToAllVeiculos(
  callback: (veiculos: Veiculo[]) => void
): Unsubscribe {
  return onSnapshot(collection(db, 'veiculos'), (snap) => {
    callback(snap.docs.map((d) => docToVeiculo(d.id, d.data())));
  });
}

export async function getAllVeiculos(): Promise<Veiculo[]> {
  const snap = await getDocs(collection(db, 'veiculos'));
  return snap.docs.map((d) => docToVeiculo(d.id, d.data()));
}

export async function getVeiculoByPlaca(placa: string): Promise<Veiculo | null> {
  if (!placa) return null;
  const normalized = placa.replace('-', '').toUpperCase();
  const all = await getAllVeiculos();
  return all.find((v) => v.placa.replace('-', '').toUpperCase() === normalized) ?? null;
}

export async function createVeiculo(v: Omit<Veiculo, 'id'>): Promise<Veiculo> {
  const ref = await addDoc(collection(db, 'veiculos'), v);
  return { ...v, id: ref.id };
}
