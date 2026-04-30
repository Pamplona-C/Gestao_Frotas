import AsyncStorage from '@react-native-async-storage/async-storage';

const TTL_MS = 10 * 60 * 1000; // 10 minutos

type Entry<T> = { data: T; ts: number };

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const entry: Entry<T> = JSON.parse(raw);
    if (Date.now() - entry.ts > TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ data, ts: Date.now() } satisfies Entry<T>));
  } catch {}
}

export async function cacheInvalidate(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
}
