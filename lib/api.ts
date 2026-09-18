/**
 * Cliente HTTP do moovia-backend. Toda chamada ao backend passa por aqui —
 * telas e services nunca fazem `fetch` direto.
 *
 * Responsabilidades:
 *  - injetar o access token no header Authorization;
 *  - renovar a sessão sozinho quando o token expira (401) e repetir a chamada;
 *  - traduzir o JSON de erro do backend numa exceção tipada (`ApiError`).
 */
import { carregarSessao, limparSessao, salvarSessao, sessaoEmMemoria } from './session';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

/** Rotas que não levam token nem tentam renovar sessão. */
const ROTAS_PUBLICAS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/esqueci-senha',
  '/auth/redefinir-senha',
];

/**
 * Erro vindo do backend, já com o `errorCode` do GlobalExceptionHandler
 * (ex.: 'CREDENCIAIS_INVALIDAS', 'CODIGO_INVALIDO', 'HODOMETRO_INVALIDO').
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly errorCode: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Falha de rede — o aparelho não conseguiu falar com o servidor. */
export class NetworkError extends Error {
  constructor() {
    super('Sem conexão com o servidor. Verifique sua internet.');
    this.name = 'NetworkError';
  }
}

/**
 * Avisado quando a sessão morre de vez (refresh recusado). Quem escuta é o
 * auth.store, que limpa o usuário e manda para a tela de login.
 */
type OnSessaoExpirada = () => void;
let onSessaoExpirada: OnSessaoExpirada = () => {};

export function registrarOnSessaoExpirada(cb: OnSessaoExpirada): void {
  onSessaoExpirada = cb;
}

// ── Renovação de sessão ────────────────────────────────────────────────────────

/**
 * O backend **rotaciona** o refresh token: cada uso revoga o anterior. Se duas
 * requisições tomarem 401 ao mesmo tempo e cada uma chamar /auth/refresh, a
 * segunda usaria um token já revogado e o usuário seria deslogado sem motivo.
 *
 * Por isso a renovação é *single-flight*: a primeira dispara, as demais esperam
 * a mesma promessa.
 */
let renovacaoEmAndamento: Promise<string | null> | null = null;

async function renovarSessao(): Promise<string | null> {
  if (renovacaoEmAndamento) return renovacaoEmAndamento;

  renovacaoEmAndamento = (async () => {
    try {
      const sessao = await carregarSessao();
      if (!sessao) return null;

      const resposta = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: sessao.refreshToken }),
      });

      if (!resposta.ok) {
        // Refresh expirado, revogado ou usuário desativado: fim da sessão.
        await limparSessao();
        onSessaoExpirada();
        return null;
      }

      const dados = await resposta.json();
      await salvarSessao({
        accessToken: dados.accessToken,
        refreshToken: dados.refreshToken,
      });
      return dados.accessToken as string;
    } catch {
      // Falha de rede na renovação não é sessão inválida — não desloga ninguém.
      return null;
    } finally {
      renovacaoEmAndamento = null;
    }
  })();

  return renovacaoEmAndamento;
}

// ── Núcleo ─────────────────────────────────────────────────────────────────────

interface Opcoes {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Não envia Authorization nem tenta renovar (rotas públicas). */
  publico?: boolean;
}

async function executar(caminho: string, opcoes: Opcoes, token: string | null): Promise<Response> {
  const ehFormData = opcoes.body instanceof FormData;

  // Em multipart o Content-Type carrega o `boundary`, que só o runtime sabe
  // gerar. Definir 'multipart/form-data' à mão omitiria o boundary e o servidor
  // não conseguiria separar as partes — por isso aqui o header é deixado de fora.
  const headers: Record<string, string> = ehFormData ? {} : { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (ehFormData) body = opcoes.body as FormData;
  else if (opcoes.body !== undefined) body = JSON.stringify(opcoes.body);

  try {
    return await fetch(`${BASE_URL}${caminho}`, {
      method: opcoes.method ?? 'GET',
      headers,
      body,
    });
  } catch {
    throw new NetworkError();
  }
}

async function lancarErro(resposta: Response): Promise<never> {
  let errorCode = 'ERRO_DESCONHECIDO';
  let message = 'Erro inesperado. Tente novamente.';

  try {
    const corpo = await resposta.json();
    // Formato do GlobalExceptionHandler: {timestamp,status,error,message,errorCode}
    if (corpo?.errorCode) errorCode = corpo.errorCode;
    if (corpo?.message) message = corpo.message;
  } catch {
    // 500 sem corpo, HTML de proxy etc. — mantém a mensagem genérica.
  }

  throw new ApiError(resposta.status, errorCode, message);
}

async function request<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const publico = opcoes.publico ?? ROTAS_PUBLICAS.some((r) => caminho.startsWith(r));

  let token: string | null = null;
  if (!publico) {
    token = sessaoEmMemoria()?.accessToken ?? (await carregarSessao())?.accessToken ?? null;
  }

  let resposta = await executar(caminho, opcoes, token);

  // Access token vencido: renova uma vez e repete a chamada original.
  if (resposta.status === 401 && !publico) {
    const novoToken = await renovarSessao();
    if (!novoToken) return lancarErro(resposta);
    resposta = await executar(caminho, opcoes, novoToken);
  }

  if (!resposta.ok) return lancarErro(resposta);

  // 204 (logout, esqueci-senha, desativar…) não tem corpo.
  if (resposta.status === 204) return undefined as T;

  const texto = await resposta.text();
  return (texto ? JSON.parse(texto) : undefined) as T;
}

export const api = {
  get: <T>(caminho: string) => request<T>(caminho),
  post: <T>(caminho: string, body?: unknown, publico?: boolean) =>
    request<T>(caminho, { method: 'POST', body, publico }),
  put: <T>(caminho: string, body?: unknown) => request<T>(caminho, { method: 'PUT', body }),
  patch: <T>(caminho: string, body?: unknown) => request<T>(caminho, { method: 'PATCH', body }),
  delete: <T>(caminho: string, body?: unknown) => request<T>(caminho, { method: 'DELETE', body }),
  /** Envio multipart (imagens). O FormData atravessa sem virar JSON. */
  upload: <T>(caminho: string, form: FormData) => request<T>(caminho, { method: 'POST', body: form }),
};

export { BASE_URL };
