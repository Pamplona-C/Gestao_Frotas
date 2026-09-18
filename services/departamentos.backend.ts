/**
 * Departamentos via moovia-backend.
 *
 * Diferença estrutural entre os dois mundos: no Firestore o departamento era
 * **texto** repetido em cada usuário e veículo; no backend é uma **entidade**
 * com id próprio. Este módulo concentra a tradução nome ↔ id, para que o resto
 * do app continue trabalhando com texto.
 */
import { api } from '../lib/api';

export interface Departamento {
  id: string;
  name: string;
}

let cache: Departamento[] | null = null;

export function normalizarNome(texto: string): string {
  return texto.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export async function listar(forcar = false): Promise<Departamento[]> {
  if (!cache || forcar) {
    const lista = await api.get<Departamento[]>('/departamentos');
    cache = [...lista].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }
  return cache;
}

export function invalidarCache(): void {
  cache = null;
}

/**
 * Converte o nome digitado no formulário no id que o backend exige. Cria o
 * departamento quando ele ainda não existe — que é o que o Firestore fazia na
 * prática, já que lá qualquer texto era aceito.
 *
 * O ideal é o formulário virar um seletor fechado; enquanto isso não acontece,
 * criar sob demanda evita perder o dado que a pessoa digitou.
 */
export async function resolverIdPorNome(nome: string | undefined): Promise<string | null> {
  if (!nome || !nome.trim()) return null;

  const alvo = normalizarNome(nome);

  const noCache = (await listar()).find((d) => normalizarNome(d.name) === alvo);
  if (noCache) return noCache.id;

  // Pode ter sido criado por outra pessoa desde o último carregamento.
  const recarregado = (await listar(true)).find((d) => normalizarNome(d.name) === alvo);
  if (recarregado) return recarregado.id;

  const criado = await api.post<Departamento>('/departamentos', { name: nome.trim() });
  cache = [...(cache ?? []), criado].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  return criado.id;
}
