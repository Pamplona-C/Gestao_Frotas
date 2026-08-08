/**
 * Ordens de serviço via moovia-backend (REST).
 *
 *   app                      backend
 *   ---                      -------
 *   'em_diagnostico'      ↔  DIAGNOSTICO
 *   'orcamento_aprovado'  ↔  APROVADA
 *   criadoEm              ↔  dataCriacao
 *   fotos                 ↔  fotosProblema
 *   observacoes           ↔  observacao
 *   servicos              ↔  servicosSolicitados  (pedidos na abertura)
 *   servicosRealizados    ↔  itens                (executados, com valor)
 *   statusHistory         ↔  historico
 *
 * **Dois conceitos que o app achatava num só:** `servicos` é o que o condutor
 * pediu na abertura (texto livre); `servicosRealizados` é o que o gestor de fato
 * lançou, com valor. No backend são coisas separadas — `servicosSolicitados` e
 * `itens` — e é `itens` que alimenta o `valorTotal`.
 *
 * **O que o backend calcula sozinho:** `valorTotal` vem dos itens. Já
 * `gastoPreventiva` / `gastoCorretiva` não existem lá: derivamos aqui a partir
 * da categoria de cada item, que é de onde o Firestore também os tirava.
 *
 * **O que se perde:** `lembreteEnviado` / `lembreteEnviadoEm` (o lembrete diário
 * nunca saiu do Firestore) e o campo `tipo` da OS, que era redundante com a
 * categoria dos serviços.
 */
import { api } from '../lib/api';
import {
  OrdemServico,
  OSStatus,
  ServicoRealizado,
  StatusEntry,
  TipoServico,
  VeiculoTipo,
} from '../types';

type StatusBackend = 'NOVA' | 'EM_ANDAMENTO' | 'DIAGNOSTICO' | 'APROVADA' | 'CONCLUIDA';

const STATUS_PARA_APP: Record<StatusBackend, OSStatus> = {
  NOVA: 'nova',
  EM_ANDAMENTO: 'em_andamento',
  DIAGNOSTICO: 'em_diagnostico',
  APROVADA: 'orcamento_aprovado',
  CONCLUIDA: 'concluida',
};

const STATUS_PARA_BACKEND: Record<OSStatus, StatusBackend> = {
  nova: 'NOVA',
  em_andamento: 'EM_ANDAMENTO',
  em_diagnostico: 'DIAGNOSTICO',
  orcamento_aprovado: 'APROVADA',
  concluida: 'CONCLUIDA',
};

/** Statuses que exigem atenção — as concluídas ficam de fora das listagens. */
const STATUS_ATIVOS: StatusBackend[] = ['NOVA', 'EM_ANDAMENTO', 'DIAGNOSTICO', 'APROVADA'];

interface UsuarioResumo {
  id: string;
  nome?: string | null;
  name?: string | null;
  photoUrl?: string | null;
  departamento?: { id: string; nome?: string; name?: string } | null;
}

interface ItemResponse {
  id: string;
  itemServico: { id: string; name: string; categoria: 'PREVENTIVA' | 'CORRETIVA' | null } | null;
  valorCobrado: number;
  quantidade: number;
}

interface HistoricoResponse {
  id: string;
  tipoEvento: string;
  statusAnterior: StatusBackend | null;
  statusNovo: StatusBackend | null;
  descricao: string | null;
  usuario: UsuarioResumo | null;
  dataEvento: string;
}

interface OSResponse {
  id: string;
  numero: number;
  veiculo: {
    id: string;
    marca: string | null;
    modelo: string | null;
    placa: string | null;
    numeroFrota: string | null;
    categoria: 'CARRO' | 'MOTO' | 'CAMINHONETE' | 'CAMINHAO' | null;
  } | null;
  condutor: UsuarioResumo | null;
  gestor: UsuarioResumo | null;
  fornecedor: { id: string; nome: string } | null;
  status: StatusBackend;
  descricao: string | null;
  cidade: string | null;
  observacao: string | null;
  notaInterna: string | null;
  hodometro: number | null;
  servicosSolicitados: string[] | null;
  dataDesejada: string | null;
  horario: string | null;
  fotosProblema: string[] | null;
  dataCriacao: string;
  dataFechamento: string | null;
  valorTotal: number;
  itens: ItemResponse[] | null;
  historico: HistoricoResponse[] | null;
  entregueOficinaEm: string | null;
  retornouOficinaEm: string | null;
  origemVinculoId: string | null;
  origemChecklistId: string | null;
}

function nomeDe(u: UsuarioResumo | null | undefined): string | undefined {
  return u ? (u.nome ?? u.name ?? '') : undefined;
}

function departamentoDe(u: UsuarioResumo | null | undefined): string | undefined {
  const d = u?.departamento;
  return d ? (d.nome ?? d.name ?? '') : undefined;
}

function itemParaServicoRealizado(i: ItemResponse): ServicoRealizado {
  return {
    catalogoId: i.itemServico?.id ?? '',
    nome: i.itemServico?.name ?? '',
    tipo: (i.itemServico?.categoria === 'CORRETIVA' ? 'corretiva' : 'preventiva') as TipoServico,
    // O app trabalha com o valor da linha; o backend guarda unitário × quantidade.
    valor: (i.valorCobrado ?? 0) * (i.quantidade ?? 1),
  };
}

/**
 * O histórico do backend é mais rico que o do app: registra assunção e
 * transferência além das mudanças de status. O app só sabe desenhar transições,
 * então ficam de fora os eventos sem `statusNovo`.
 */
function historicoParaStatusEntries(historico: HistoricoResponse[]): StatusEntry[] {
  return historico
    .filter((h) => h.statusNovo != null)
    .map((h) => ({
      status: STATUS_PARA_APP[h.statusNovo as StatusBackend],
      changedAt: h.dataEvento,
      changedBy: nomeDe(h.usuario) || '—',
    }));
}

export function paraOS(o: OSResponse): OrdemServico {
  const itens = o.itens ?? [];
  const servicosRealizados = itens.map(itemParaServicoRealizado);
  const somaPor = (tipo: TipoServico) =>
    servicosRealizados.filter((s) => s.tipo === tipo).reduce((acc, s) => acc + s.valor, 0);

  return {
    id: o.id,
    numero: o.numero,
    veiculoId: o.veiculo?.id,
    veiculoMarca: o.veiculo?.marca ?? undefined,
    veiculoModelo: o.veiculo?.modelo ?? undefined,
    veiculoTipo: (o.veiculo?.categoria === 'MOTO' ? 'moto' : 'carro') as VeiculoTipo,
    placa: o.veiculo?.placa ?? undefined,
    frota: o.veiculo?.numeroFrota ?? '',

    condutorId: o.condutor?.id,
    condutorNome: nomeDe(o.condutor),
    condutorPhotoURL: o.condutor?.photoUrl ?? null,
    condutorDepartamento: departamentoDe(o.condutor),

    gestorId: o.gestor?.id,
    gestorNome: nomeDe(o.gestor),
    gestorPhotoURL: o.gestor?.photoUrl ?? null,
    gestorDepartamento: departamentoDe(o.gestor),

    fornecedorId: o.fornecedor?.id,
    fornecedorNome: o.fornecedor?.nome,

    status: STATUS_PARA_APP[o.status],
    descricao: o.descricao ?? undefined,
    cidade: o.cidade ?? undefined,
    observacoes: o.observacao ?? undefined,
    notaInterna: o.notaInterna ?? undefined,
    hodometro: o.hodometro ?? undefined,
    servicos: o.servicosSolicitados ?? undefined,
    dataDesejada: o.dataDesejada ?? undefined,
    horario: o.horario ?? undefined,
    fotos: o.fotosProblema ?? undefined,
    criadoEm: o.dataCriacao,

    servicosRealizados: servicosRealizados.length > 0 ? servicosRealizados : undefined,
    valorTotal: o.valorTotal,
    gastoPreventiva: somaPor('preventiva'),
    gastoCorretiva: somaPor('corretiva'),

    statusHistory: historicoParaStatusEntries(o.historico ?? []),

    entregueOficinaEm: o.entregueOficinaEm ?? undefined,
    retornouOficinaEm: o.retornouOficinaEm ?? undefined,
    origemVinculoId: o.origemVinculoId ?? undefined,
    origemChecklistId: o.origemChecklistId ?? undefined,
  };
}

function ordenarPorData(a: OrdemServico, b: OrdemServico) {
  return new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime();
}

// ── Leitura ───────────────────────────────────────────────────────────────────

/**
 * O backend filtra status server-side via `?status=`, repetido por valor. As
 * concluídas ficam de fora — a tela mostra o que exige atenção.
 */
function queryStatusAtivos(): string {
  return STATUS_ATIVOS.map((s) => `status=${s}`).join('&');
}

export async function getAllOS(): Promise<OrdemServico[]> {
  const lista = await api.get<OSResponse[]>(`/ordens-servico?${queryStatusAtivos()}`);
  return lista.map(paraOS).sort(ordenarPorData);
}

export async function getOSByCondutor(condutorId: string): Promise<OrdemServico[]> {
  const lista = await api.get<OSResponse[]>(`/condutores/${condutorId}/ordens-servico`);
  return lista
    .map(paraOS)
    .filter((o) => o.status !== 'concluida')
    .sort(ordenarPorData);
}

export async function getOSById(id: string): Promise<OrdemServico | null> {
  try {
    return paraOS(await api.get<OSResponse>(`/ordens-servico/${id}`));
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

// ── Escrita ───────────────────────────────────────────────────────────────────

/**
 * Abre a OS. Quem abre é o usuário do token — o endpoint muda conforme o perfil,
 * porque as regras diferem: condutor só abre para veículo com vínculo ativo dele;
 * gestor abre para qualquer um, indicando o condutor.
 */
export async function createOS(
  os: Omit<OrdemServico, 'id' | 'criadoEm' | 'status'>,
  ehGestor: boolean,
): Promise<OrdemServico> {
  // As fotos já vêm como URLs em `os.fotos`: elas sobem ANTES da criação, com o
  // veículo como referência de pasta, porque a OS ainda não tem id. Era o
  // contrário no Firestore, onde o documento nascia e as URLs entravam depois
  // num update — e uma falha no upload deixava a OS sem as fotos do problema.
  const corpo = {
    veiculoId: os.veiculoId,
    descricao: os.descricao,
    cidade: os.cidade,
    fotos: os.fotos ?? [],
    observacao: os.observacoes,
    hodometro: os.hodometro,
    servicosSolicitados: os.servicos ?? [],
    dataDesejada: os.dataDesejada ? os.dataDesejada.slice(0, 10) : null,
    horario: os.horario,
    origemVinculoId: os.origemVinculoId ?? null,
    origemChecklistId: os.origemChecklistId ?? null,
    ...(ehGestor ? { condutorId: os.condutorId ?? null } : {}),
  };

  const criada = await api.post<OSResponse>(
    ehGestor ? '/ordens-servico/gestor' : '/ordens-servico/condutor',
    corpo,
  );
  return paraOS(criada);
}

export interface DadosGestao {
  status?: OSStatus;
  fornecedorId?: string;
  notaInterna?: string;
  assumir?: boolean;
  servicosRealizados?: ServicoRealizado[];
}

/**
 * O "Salvar" da tela de gerenciar: uma requisição só, aplicada numa transação.
 *
 * Antes eram um `runTransaction` (ao assumir) ou um `writeBatch` no Firestore.
 * Encadear os endpoints granulares deixaria a OS pela metade se um falhasse no
 * meio — e dois gestores poderiam assumir a mesma OS entre a leitura e a escrita.
 */
export async function salvarGestao(osId: string, dados: DadosGestao): Promise<OrdemServico> {
  const corpo = {
    status: dados.status ? STATUS_PARA_BACKEND[dados.status] : null,
    fornecedorId: dados.fornecedorId ?? null,
    notaInterna: dados.notaInterna ?? null,
    assumir: dados.assumir ?? false,
    // Ausente = não mexe nos itens; presente = substitui a lista inteira, que é
    // como a tela funciona (edita uma cópia local e salva o resultado).
    itens: dados.servicosRealizados
      ? dados.servicosRealizados.map((s) => ({
          itemServicoId: s.catalogoId,
          quantidade: 1,
          valorCobrado: s.valor,
        }))
      : null,
  };

  return paraOS(await api.patch<OSResponse>(`/ordens-servico/${osId}`, corpo));
}

export async function transferirOS(osId: string, novoGestorId: string): Promise<OrdemServico> {
  return paraOS(
    await api.post<OSResponse>(`/ordens-servico/${osId}/transferir`, { novoGestorId }),
  );
}

export async function marcarEntregueOficina(osId: string): Promise<void> {
  await api.post(`/ordens-servico/${osId}/entrega-oficina`);
}

export async function marcarRetornoOficina(osId: string): Promise<void> {
  await api.post(`/ordens-servico/${osId}/retorno-oficina`);
}
