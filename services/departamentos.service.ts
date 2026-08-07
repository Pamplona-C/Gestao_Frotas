import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { USAR_BACKEND } from '../lib/flags';
import * as backend from './departamentos.backend';

let _cache: { data: string[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

/**
 * Lista os nomes dos departamentos. O app trabalha com texto puro em todo lugar
 * (formulários, cartões, filtros), então mesmo no backend — onde departamento é
 * uma entidade com id — devolvemos só os nomes. A conversão nome → id acontece
 * dentro de cada service que escreve, via `departamentos.backend`.
 */
export async function getDepartamentos(): Promise<string[]> {
  if (_cache && Date.now() < _cache.expiresAt) return _cache.data;

  let data: string[];

  if (USAR_BACKEND) {
    data = (await backend.listar()).map((d) => d.name.trim()).filter(Boolean);
  } else {
    const snap = await getDocs(query(collection(db, 'departamentos'), orderBy('nome')));
    data = snap.docs
      .map((d) => (d.data().nome as string | undefined)?.trim() ?? '')
      .filter(Boolean);
  }

  _cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}

export function invalidateDepartamentosCache() {
  _cache = null;
  backend.invalidarCache();
}
