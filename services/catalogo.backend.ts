/**
 * Catálogo de serviços via moovia-backend (REST).
 *
 *   app                              backend
 *   ---                              -------
 *   nome                          ↔  name
 *   tipo: preventiva | corretiva  ↔  categoria: PREVENTIVA | CORRETIVA
 *   ativo                         ↔  ativo
 */
import { api } from '../lib/api';
import { CatalogoServico, TipoServico } from '../types';

interface ItemServicoResponse {
  id: string;
  name: string | null;
  categoria: 'PREVENTIVA' | 'CORRETIVA' | null;
  ativo: boolean;
}

function paraServico(i: ItemServicoResponse): CatalogoServico {
  return {
    id: i.id,
    nome: i.name ?? '',
    tipo: (i.categoria === 'CORRETIVA' ? 'corretiva' : 'preventiva') as TipoServico,
    ativo: i.ativo,
  };
}

function paraRequest(s: Partial<Omit<CatalogoServico, 'id'>>) {
  return {
    name: s.nome,
    categoria: s.tipo ? (s.tipo.toUpperCase() as 'PREVENTIVA' | 'CORRETIVA') : undefined,
    ativo: s.ativo,
  };
}

/** Catálogo completo, ativos e inativos — é a visão da tela de administração. */
export async function listarTodos(): Promise<CatalogoServico[]> {
  const lista = await api.get<ItemServicoResponse[]>('/itens-servico?incluirInativos=true');
  return lista.map(paraServico).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Só os lançáveis numa OS — o backend já filtra por padrão. */
export async function getServicosAtivos(): Promise<CatalogoServico[]> {
  const lista = await api.get<ItemServicoResponse[]>('/itens-servico');
  return lista.map(paraServico).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function createServico(
  data: Omit<CatalogoServico, 'id'>,
): Promise<CatalogoServico> {
  return paraServico(await api.post<ItemServicoResponse>('/itens-servico', paraRequest(data)));
}

/**
 * O backend usa PUT (substituição total), então lemos o item atual e mesclamos:
 * renomear um serviço não pode zerar a categoria nem reativá-lo sem querer.
 */
export async function updateServico(
  id: string,
  updates: Partial<Omit<CatalogoServico, 'id'>>,
): Promise<void> {
  const atual = paraServico(await api.get<ItemServicoResponse>(`/itens-servico/${id}`));
  await api.put(`/itens-servico/${id}`, paraRequest({ ...atual, ...updates }));
}

/** Ativar/desativar. Desativado, o item some do catálogo mas segue nas OS antigas. */
export async function toggleServico(id: string, ativo: boolean): Promise<void> {
  await updateServico(id, { ativo });
}
