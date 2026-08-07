/**
 * Autenticação contra o moovia-backend (REST + JWT).
 *
 * Existe em paralelo ao caminho do Firebase enquanto a migração acontece: o
 * `auth.service.ts` escolhe um dos dois pela flag EXPO_PUBLIC_AUTH_BACKEND.
 * Quando o Firebase Auth sair de vez, este arquivo vira o único.
 */
import { ApiError, api, registrarOnSessaoExpirada } from '../lib/api';
import { limparSessao, salvarSessao } from '../lib/session';
import { AppUser, UserPerfil } from '../types';
import type { AuthServiceError } from './auth.service';

// ── Contratos do backend ───────────────────────────────────────────────────────

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  perfil: 'GESTOR' | 'CONDUTOR';
}

interface UsuarioResponse {
  id: string;
  nome: string;
  email: string;
  photoUrl: string | null;
  perfil: 'GESTOR' | 'CONDUTOR';
  // Atenção: em /usuarios/me o campo é `nome` (DepartamentoResumo). Outros
  // endpoints devolvem DepartamentoResponse, onde o campo se chama `name`.
  departamento: { id: string; nome: string } | null;
  ativo: boolean;
}

// O backend usa MAIÚSCULAS; o app usa minúsculas em todo lugar.
function perfilDoBackend(perfil: 'GESTOR' | 'CONDUTOR'): UserPerfil {
  return perfil === 'GESTOR' ? 'gestor' : 'condutor';
}

function paraAppUser(u: UsuarioResponse): AppUser {
  return {
    uid: u.id,
    id: u.id,
    nome: u.nome ?? '',
    email: u.email ?? '',
    perfil: perfilDoBackend(u.perfil),
    departamento: u.departamento?.nome ?? '',
    photoURL: u.photoUrl,
    ativo: u.ativo,
  };
}

// ── Tradução de erros ──────────────────────────────────────────────────────────

/**
 * Converte o `errorCode` do backend na mensagem que a tela mostra — o
 * equivalente do `mapFirebaseError`, mas para a API REST.
 */
export function mapBackendError(err: unknown): AuthServiceError {
  if (err instanceof ApiError) {
    switch (err.errorCode) {
      case 'CREDENCIAIS_INVALIDAS':
        return { code: err.errorCode, message: 'E-mail ou senha incorretos.' };
      case 'NAO_AUTENTICADO':
      case 'REFRESH_TOKEN_INVALIDO':
        return { code: err.errorCode, message: 'Sua sessão expirou. Entre novamente.' };
      case 'ACESSO_NEGADO':
        return { code: err.errorCode, message: 'Você não tem permissão para esta ação.' };
      case 'CODIGO_INVALIDO':
        return { code: err.errorCode, message: 'Código inválido ou expirado.' };
      case 'CODIGO_BLOQUEADO':
        return {
          code: err.errorCode,
          message: 'Muitas tentativas erradas. Peça um novo código.',
        };
      case 'SENHA_MUITO_CURTA':
        return { code: err.errorCode, message: 'A senha precisa ter ao menos 6 caracteres.' };
      case 'SENHA_ATUAL_INCORRETA':
        return { code: err.errorCode, message: 'A senha atual está incorreta.' };
      case 'EMAIL_JA_CADASTRADO':
        return { code: err.errorCode, message: 'E-mail já cadastrado.' };
      default:
        // A mensagem do backend já vem em português e costuma ser específica.
        return { code: err.errorCode, message: err.message };
    }
  }

  if (err instanceof Error && err.name === 'NetworkError') {
    return { code: 'network', message: err.message };
  }

  return { code: 'unknown', message: 'Erro inesperado. Tente novamente.' };
}

// ── Sessão ─────────────────────────────────────────────────────────────────────

export function aoExpirarSessao(cb: () => void): void {
  registrarOnSessaoExpirada(cb);
}

export async function signInWithEmail(email: string, senha: string): Promise<AppUser> {
  const login = await api.post<LoginResponse>('/auth/login', { email, senha }, true);
  await salvarSessao({
    accessToken: login.accessToken,
    refreshToken: login.refreshToken,
  });
  return meuPerfil();
}

export async function meuPerfil(): Promise<AppUser> {
  const usuario = await api.get<UsuarioResponse>('/usuarios/me');
  return paraAppUser(usuario);
}

/**
 * Restaura a sessão guardada no aparelho. Devolve null quando não há sessão
 * válida — o cliente HTTP já cuida de renovar o token se ele tiver vencido.
 */
export async function restaurarSessao(): Promise<AppUser | null> {
  const { carregarSessao } = await import('../lib/session');
  if (!(await carregarSessao())) return null;

  try {
    return await meuPerfil();
  } catch (err) {
    // 401 aqui significa que nem o refresh salvou: sessão morta.
    if (err instanceof ApiError && err.status === 401) {
      await limparSessao();
      return null;
    }
    // Falha de rede: não apaga a sessão, o usuário pode estar sem sinal.
    throw err;
  }
}

export async function signOut(): Promise<void> {
  const { carregarSessao } = await import('../lib/session');
  const sessao = await carregarSessao();

  if (sessao) {
    try {
      await api.post('/auth/logout', { refreshToken: sessao.refreshToken }, true);
    } catch {
      // Servidor fora do ar não pode impedir o logout local.
    }
  }

  await limparSessao();
}

// ── Senha ──────────────────────────────────────────────────────────────────────

/** Pede o código de 6 dígitos por e-mail. Nunca falha por e-mail inexistente. */
export async function esqueciSenha(email: string): Promise<void> {
  await api.post('/auth/esqueci-senha', { email }, true);
}

export async function redefinirSenha(
  email: string,
  codigo: string,
  novaSenha: string,
): Promise<void> {
  await api.post('/auth/redefinir-senha', { email, codigo, novaSenha }, true);
}

/** Troca a senha do usuário logado. Derruba a sessão — é preciso logar de novo. */
export async function changePassword(
  senhaAtual: string,
  novaSenha: string,
): Promise<void> {
  await api.put('/usuarios/me/senha', { senhaAtual, novaSenha });
  await limparSessao();
}
