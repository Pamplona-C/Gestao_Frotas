import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';

let _cache: { data: string[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function getDepartamentos(): Promise<string[]> {
  if (_cache && Date.now() < _cache.expiresAt) return _cache.data;

  const snap = await getDocs(query(collection(db, 'departamentos'), orderBy('nome')));
  const data = snap.docs
    .map((d) => (d.data().nome as string | undefined)?.trim() ?? '')
    .filter(Boolean);

  _cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}

export function invalidateDepartamentosCache() {
  _cache = null;
}
