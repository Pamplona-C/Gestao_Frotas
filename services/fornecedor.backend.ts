/**
 * Fornecedores via moovia-backend (REST).
 *
 * A tradução aqui é mais funda que a de veículos:
 *
 *   app                     backend
 *   ---                     -------
 *   cidade: string       ↔  endereco.cidade   (endereço estruturado)
 *   endereco: string     ↔  endereco.logradouro
 *   horario              ↔  horario           (adicionado na V18)
 *   responsavel          ↔  responsavel       (adicionado na V18)
 *   googleMapsUrl        ↔  googleMapsUrl     (adicionado na V18)
 *   (não existe)         ↔  categoriaId       — obrigatório no backend
 *   (não existe)         ↔  email, observacao
 */
import { api } from '../lib/api';
import { Fornecedor } from '../types';

interface EnderecoResponse {
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  pais: string | null;
}

interface FornecedorResponse {
  id: string;
  nome: string;
  categoria: { id: string; name: string } | null;
  email: string | null;
  telefone: string | null;
  endereco: EnderecoResponse | null;
  observacao: string | null;
  horario: string | null;
  responsavel: string | null;
  googleMapsUrl: string | null;
  ativo: boolean;
}

// ── Categoria ─────────────────────────────────────────────────────────────────

/**
 * O backend exige uma categoria por fornecedor (ela alimenta o relatório de
 * gasto por fornecedor). O app ainda não tem esse conceito na tela, então tudo
 * que ele cria entra numa categoria coringa, visível e fácil de reclassificar
 * depois — melhor do que impedir o cadastro ou inventar uma classificação.
 *
 * Quando a tela ganhar um seletor de categoria, basta passar o id escolhido.
 */
const CATEGORIA_PADRAO = 'Não classificado';

let cacheCategoriaPadraoId: string | null = null;

async function categoriaPadraoId(): Promise<string> {
  if (cacheCategoriaPadraoId) return cacheCategoriaPadraoId;

  const categorias = await api.get<{ id: string; name: string }[]>('/categorias-fornecedores');
  const existente = categorias.find(
    (c) => c.name.trim().toLowerCase() === CATEGORIA_PADRAO.toLowerCase(),
  );

  if (existente) {
    cacheCategoriaPadraoId = existente.id;
    return existente.id;
  }

  const criada = await api.post<{ id: string; name: string }>('/categorias-fornecedores', {
    name: CATEGORIA_PADRAO,
  });
  cacheCategoriaPadraoId = criada.id;
  return criada.id;
}

// ── Tradução ──────────────────────────────────────────────────────────────────

function paraFornecedor(f: FornecedorResponse): Fornecedor {
  return {
    id: f.id,
    nome: f.nome ?? '',
    // A tela agrupa a lista por cidade, então este campo não pode vir vazio à toa.
    cidade: f.endereco?.cidade ?? '',
    endereco: f.endereco?.logradouro ?? '',
    horario: f.horario ?? '',
    responsavel: f.responsavel ?? '',
    telefone: f.telefone ?? '',
    googleMapsUrl: f.googleMapsUrl ?? undefined,
  };
}

async function paraRequest(f: Partial<Omit<Fornecedor, 'id'>>, categoriaId: string) {
  return {
    nome: f.nome,
    categoriaId,
    telefone: f.telefone,
    horario: f.horario,
    responsavel: f.responsavel,
    googleMapsUrl: f.googleMapsUrl || undefined,
    // O app tem endereço como uma linha só; o backend espera estrutura. Enquanto
    // a tela não separar os campos, logradouro carrega o texto inteiro.
    endereco: {
      logradouro: f.endereco,
      cidade: f.cidade,
    },
  };
}

// ── Leitura ───────────────────────────────────────────────────────────────────

export async function getAllFornecedores(): Promise<Fornecedor[]> {
  const lista = await api.get<FornecedorResponse[]>('/fornecedores');
  return lista.map(paraFornecedor).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function getFornecedorById(id: string): Promise<Fornecedor | null> {
  try {
    return paraFornecedor(await api.get<FornecedorResponse>(`/fornecedores/${id}`));
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

// ── Escrita ───────────────────────────────────────────────────────────────────

export async function createFornecedor(f: Omit<Fornecedor, 'id'>): Promise<Fornecedor> {
  const body = await paraRequest(f, await categoriaPadraoId());
  return paraFornecedor(await api.post<FornecedorResponse>('/fornecedores', body));
}

/**
 * O backend usa PUT (substituição total). Como o app manda um objeto parcial,
 * lemos o fornecedor atual e mesclamos — senão editar só o telefone apagaria
 * endereço, horário e responsável.
 */
export async function updateFornecedor(
  id: string,
  updates: Partial<Omit<Fornecedor, 'id'>>,
): Promise<void> {
  const atualResponse = await api.get<FornecedorResponse>(`/fornecedores/${id}`);
  const atual = paraFornecedor(atualResponse);

  const { id: _ignorado, ...campos } = { ...atual, ...updates } as Fornecedor;
  const body = await paraRequest(
    campos,
    // Preserva a categoria que o fornecedor já tem; só cai no padrão se não houver.
    atualResponse.categoria?.id ?? (await categoriaPadraoId()),
  );
  await api.put(`/fornecedores/${id}`, body);
}

/** Exclusão lógica: o fornecedor sai das listas e as OS antigas continuam válidas. */
export async function deleteFornecedor(id: string): Promise<void> {
  await api.delete(`/fornecedores/${id}`);
}
