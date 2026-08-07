/**
 * Veículos via moovia-backend (REST).
 *
 * Aqui mora a tradução entre os dois modelos, que não são iguais:
 *
 *   app                        backend
 *   ---                        -------
 *   tipo: 'carro' | 'moto'  ↔  categoria: CARRO | MOTO | CAMINHONETE | CAMINHAO
 *   frota: string           ↔  numeroFrota: string
 *   ano: number             ↔  ano: string
 *   departamento: string    ↔  departamento: { id, name }   (FK de verdade)
 *   kmAtual: number         ↔  hodometro: number
 */
import { api } from '../lib/api';
import { resolverIdPorNome } from './departamentos.backend';
import { Veiculo, VeiculoTipo } from '../types';

interface VeiculoResponse {
  id: string;
  marca: string | null;
  categoria: 'CARRO' | 'MOTO' | 'CAMINHONETE' | 'CAMINHAO' | null;
  modelo: string | null;
  ano: string | null;
  placa: string | null;
  numeroFrota: string | null;
  hodometro: number | null;
  departamento: { id: string; name: string } | null;
  ativo: boolean;
}

// ── Tradução de tipo/categoria ────────────────────────────────────────────────

/**
 * O backend tem quatro categorias; o app conhece duas. CAMINHONETE e CAMINHAO
 * viram 'carro' porque é o que decide o checklist (20 fotos de carro, 6 de moto)
 * — e uma caminhonete se fotografa como carro.
 *
 * Consequência: editar uma caminhonete pelo app a rebaixa para CARRO. Enquanto
 * o app não conhecer as quatro categorias, isso é inevitável.
 */
function tipoDoBackend(categoria: VeiculoResponse['categoria']): VeiculoTipo {
  return categoria === 'MOTO' ? 'moto' : 'carro';
}

function categoriaDoApp(tipo: VeiculoTipo): 'CARRO' | 'MOTO' {
  return tipo === 'moto' ? 'MOTO' : 'CARRO';
}

function paraVeiculo(v: VeiculoResponse): Veiculo {
  return {
    id: v.id,
    tipo: tipoDoBackend(v.categoria),
    marca: v.marca ?? '',
    modelo: v.modelo ?? '',
    frota: v.numeroFrota ?? '',
    placa: v.placa ?? undefined,
    ano: v.ano ? Number(v.ano) : 0,
    departamento: v.departamento?.name ?? '',
    kmAtual: v.hodometro ?? undefined,
    ativo: v.ativo,
  };
}

// ── Departamento ──────────────────────────────────────────────────────────────
// A tradução nome ↔ id vive em `departamentos.backend`, usada também pelo
// seletor de departamentos e pelos demais cadastros.

async function paraRequest(v: Partial<Omit<Veiculo, 'id'>>) {
  return {
    marca: v.marca,
    modelo: v.modelo,
    ano: v.ano != null ? String(v.ano) : undefined,
    placa: v.placa,
    numeroFrota: v.frota,
    categoria: v.tipo ? categoriaDoApp(v.tipo) : undefined,
    departamentoId: await resolverIdPorNome(v.departamento),
    hodometro: v.kmAtual,
    ativo: v.ativo,
  };
}

// ── Leitura ───────────────────────────────────────────────────────────────────

export async function getAllVeiculos(): Promise<Veiculo[]> {
  const lista = await api.get<VeiculoResponse[]>('/veiculos');
  // O backend não ordena; o app sempre mostrou por número de frota.
  return lista.map(paraVeiculo).sort((a, b) => a.frota.localeCompare(b.frota, 'pt-BR'));
}

export async function getVeiculoById(id: string): Promise<Veiculo | null> {
  try {
    return paraVeiculo(await api.get<VeiculoResponse>(`/veiculos/${id}`));
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

/**
 * O backend não tem busca por placa. A frota cabe numa requisição, então
 * filtramos aqui — tolerando placa com e sem hífen, como o Firestore fazia.
 */
export async function getVeiculoByPlaca(placa: string): Promise<Veiculo | null> {
  if (!placa) return null;
  const alvo = placa.toUpperCase().replace('-', '');
  const todos = await getAllVeiculos();
  return todos.find((v) => (v.placa ?? '').toUpperCase().replace('-', '') === alvo) ?? null;
}

// ── Escrita ───────────────────────────────────────────────────────────────────

export async function createVeiculo(v: Omit<Veiculo, 'id'>): Promise<Veiculo> {
  return paraVeiculo(await api.post<VeiculoResponse>('/veiculos', await paraRequest(v)));
}

/**
 * O backend usa PUT (substituição total): campo ausente vira nulo. O app chama
 * isto com um objeto parcial, então lemos o veículo atual e mesclamos antes de
 * enviar — senão editar só a placa apagaria marca, modelo e departamento.
 */
export async function updateVeiculo(
  id: string,
  updates: Partial<Omit<Veiculo, 'id'>>,
): Promise<void> {
  const atual = await getVeiculoById(id);
  if (!atual) throw new Error('Veículo não encontrado');

  const { id: _ignorado, ...campos } = { ...atual, ...updates } as Veiculo;
  await api.put(`/veiculos/${id}`, await paraRequest(campos));
}

/** Exclusão lógica no backend: o veículo sai das listas e o histórico fica. */
export async function deleteVeiculo(id: string): Promise<void> {
  await api.delete(`/veiculos/${id}`);
}
