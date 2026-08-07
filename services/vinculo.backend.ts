/**
 * Vínculos via moovia-backend (REST).
 *
 * ⚠️ ATENÇÃO AO GLOSSÁRIO INVERTIDO — é o erro mais fácil de cometer aqui.
 * As mesmas palavras significam coisas opostas nos dois sistemas:
 *
 *   momento real                        app          backend
 *   ------------                        ---          -------
 *   condutor RECEBE o veículo        →  'entrada'    checklist-SAÍDA
 *   condutor DEVOLVE o veículo       →  'saida'      checklist-RETORNO
 *
 * O app nomeia pela ótica do condutor ("entra na minha posse"); o backend pela
 * ótica da garagem ("sai da loja"). Toda tradução abaixo respeita isso.
 *
 * O status também não bate um-para-um. O app usa dois campos onde o backend usa
 * um enum:
 *
 *   backend            app.status   app.pendenciaChecklist
 *   -------            ----------   ----------------------
 *   PENDENTE_SAIDA  →  'ativo'      'entrada'   (recebeu, falta fotografar)
 *   ATIVO           →  'ativo'      null        (com o condutor, tudo em dia)
 *   ENCERRADO       →  'inativo'    null        (devolvido)
 */
import { api } from '../lib/api';
import { ChecklistPendencia, Vinculo, VeiculoTipo } from '../types';

interface CondutorResumo {
  id: string;
  nome?: string | null;
  name?: string | null;
}

interface ChecklistResponse {
  data: string;
  condutor: CondutorResumo | null;
  fotos: Record<string, string> | null;
}

interface VinculoResponse {
  id: string;
  veiculo: {
    id: string;
    marca: string | null;
    modelo: string | null;
    placa: string | null;
    numeroFrota: string | null;
    categoria: 'CARRO' | 'MOTO' | 'CAMINHONETE' | 'CAMINHAO' | null;
  } | null;
  condutores: CondutorResumo[];
  status: 'PENDENTE_SAIDA' | 'ATIVO' | 'ENCERRADO';
  dataCriacao: string;
  checklistSaida: ChecklistResponse | null;
  checklistRetorno: ChecklistResponse | null;
  encerradoForcadoEm: string | null;
  encerradoPor: CondutorResumo | null;
}

function nomeDe(c: CondutorResumo | null | undefined): string {
  return c?.nome ?? c?.name ?? '';
}

function paraVinculo(v: VinculoResponse): Vinculo {
  const [c1, c2] = v.condutores ?? [];
  const veiculo = v.veiculo;

  return {
    id: v.id,
    condutorId: c1?.id ?? '',
    condutorNome: nomeDe(c1),
    condutorId2: c2?.id,
    condutorNome2: c2 ? nomeDe(c2) : undefined,
    condutorIds: (v.condutores ?? []).map((c) => c.id),

    // O app guardava esses campos desnormalizados no próprio vínculo; o backend
    // devolve o veículo aninhado, então achatamos aqui.
    veiculoId: veiculo?.id ?? '',
    veiculoFrota: veiculo?.numeroFrota ?? '',
    veiculoModelo: veiculo?.modelo ?? '',
    veiculoMarca: veiculo?.marca ?? '',
    veiculoPlaca: veiculo?.placa ?? undefined,
    // Caminhonete e caminhão contam como carro: é o que decide o nº de fotos.
    veiculoTipo: (veiculo?.categoria === 'MOTO' ? 'moto' : 'carro') as VeiculoTipo,

    // Nomes invertidos de propósito — veja o cabeçalho.
    checklistEntradaId: v.checklistSaida ? `${v.id}:saida` : undefined,
    checklistSaidaId: v.checklistRetorno ? `${v.id}:retorno` : undefined,

    status: v.status === 'ENCERRADO' ? 'inativo' : 'ativo',
    pendenciaChecklist: (v.status === 'PENDENTE_SAIDA' ? 'entrada' : null) as ChecklistPendencia,

    criadoEm: v.dataCriacao,
    // O backend não guarda quem criou o vínculo; o app só usa isso para exibir.
    gestorId: '',
    encerradoEm: v.checklistRetorno?.data ?? v.encerradoForcadoEm ?? undefined,
  };
}

// ── Leitura ───────────────────────────────────────────────────────────────────

export async function listarPorCondutor(condutorId: string): Promise<Vinculo[]> {
  const lista = await api.get<VinculoResponse[]>(`/condutores/${condutorId}/vinculos`);
  return lista.map(paraVinculo);
}

export async function listarPorVeiculo(veiculoId: string): Promise<Vinculo[]> {
  const lista = await api.get<VinculoResponse[]>(`/veiculos/${veiculoId}/vinculos`);
  return lista.map(paraVinculo);
}

export async function getVinculoById(id: string): Promise<Vinculo | null> {
  try {
    return paraVinculo(await api.get<VinculoResponse>(`/vinculos/${id}`));
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

/**
 * O Firestore obrigava a quebrar a busca em blocos de 10 ids (limite do
 * operador `in`). Aqui basta uma requisição por id, em paralelo — e ids
 * inexistentes são simplesmente ignorados.
 */
export async function getVinculosByIds(ids: string[]): Promise<Vinculo[]> {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (unicos.length === 0) return [];

  const resultados = await Promise.all(unicos.map((id) => getVinculoById(id)));
  return resultados.filter((v): v is Vinculo => v !== null);
}

/**
 * Vínculos aguardando checklist. O backend não tem filtro por pendência, mas a
 * pendência é derivável do status, então filtramos sobre a listagem geral.
 *
 * Só existe pendência de 'entrada' (PENDENTE_SAIDA no backend): a de 'saida'
 * era um estado que o app criava ao encerrar à força, e que o backend não
 * reproduz — lá, encerrado é terminal.
 */
export async function getVinculosComPendenciaChecklist(
  tipo?: Exclude<ChecklistPendencia, null>,
): Promise<Vinculo[]> {
  if (tipo === 'saida') return [];

  const todos = await api.get<VinculoResponse[]>('/vinculos');
  return todos.filter((v) => v.status === 'PENDENTE_SAIDA').map(paraVinculo);
}

// ── Escrita ───────────────────────────────────────────────────────────────────

export async function createVinculo(data: {
  veiculoId: string;
  condutorId: string;
}): Promise<Vinculo> {
  return paraVinculo(
    await api.post<VinculoResponse>('/vinculos', {
      veiculoId: data.veiculoId,
      condutorId: data.condutorId,
    }),
  );
}

export async function addCondutorToVinculo(
  vinculoId: string,
  condutorId: string,
): Promise<void> {
  await api.post(`/vinculos/${vinculoId}/condutores`, { condutorId });
}

/** Gestor encerra sem checklist de retorno. Fica registrado quem forçou. */
export async function encerrarVinculo(id: string): Promise<void> {
  await api.post(`/vinculos/${id}/encerrar`);
}
