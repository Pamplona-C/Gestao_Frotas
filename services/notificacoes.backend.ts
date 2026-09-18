/**
 * Notificações in-app via moovia-backend (REST).
 *
 *   app                backend
 *   ---                -------
 *   title           ↔  titulo
 *   body            ↔  corpo
 *   read            ↔  lida
 *   createdAt       ↔  criadoEm
 *   type            ↔  tipo (o backend tem mais tipos — veja abaixo)
 *
 * O backend só devolve as notificações do usuário logado (o id vem do token),
 * então o `uid` que as telas passam deixa de ser necessário — mas continua na
 * assinatura para não mexer nelas.
 */
import { api } from '../lib/api';
import { Notificacao } from '../types';

type TipoBackend =
  | 'OS_CRIADA'
  | 'VINCULO_CRIADO'
  | 'OS_ASSUMIDA'
  | 'OS_STATUS_ALTERADO'
  | 'OS_ANOTACAO'
  | 'OS_TRANSFERIDA'
  | 'ABASTECIMENTO_LANCADO';

interface NotificacaoResponse {
  id: string;
  tipo: TipoBackend;
  titulo: string;
  corpo: string;
  osId: string | null;
  lida: boolean;
  criadoEm: string;
}

/**
 * O app conhece três tipos; o backend, sete. Os que não têm correspondência
 * caem em 'status_atualizado', que é o rótulo genérico de "algo mudou na OS".
 * O `type` só decide o ícone da lista — nenhum comportamento depende dele.
 */
function tipoParaApp(tipo: TipoBackend): Notificacao['type'] {
  if (tipo === 'OS_CRIADA') return 'os_criada';
  return 'status_atualizado';
}

const NOVENTA_DIAS_MS = 90 * 24 * 60 * 60 * 1000;

function paraNotificacao(n: NotificacaoResponse, userId: string): Notificacao {
  return {
    id: n.id,
    userId,
    type: tipoParaApp(n.tipo),
    title: n.titulo ?? '',
    body: n.corpo ?? '',
    osId: n.osId ?? '',
    createdAt: n.criadoEm,
    // O backend gerencia o descarte por conta própria (job diário de 90 dias);
    // o campo existe só porque o tipo do app o exige.
    expiresAt: new Date(new Date(n.criadoEm).getTime() + NOVENTA_DIAS_MS).toISOString(),
    read: n.lida,
  };
}

export async function getNotifications(userId: string): Promise<Notificacao[]> {
  const lista = await api.get<NotificacaoResponse[]>('/notificacoes?page=0&size=50');
  return lista.map((n) => paraNotificacao(n, userId));
}

export async function contarNaoLidas(): Promise<number> {
  const r = await api.get<{ contagem: number }>('/notificacoes/nao-lidas/contagem');
  return r?.contagem ?? 0;
}

export async function markAsRead(id: string): Promise<void> {
  await api.patch(`/notificacoes/${id}/lida`);
}

/** Uma chamada só — o backend marca todas as não lidas do usuário logado. */
export async function markAllAsRead(): Promise<void> {
  await api.patch('/notificacoes/lidas');
}
