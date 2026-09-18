/**
 * Usuários via moovia-backend (REST).
 *
 *   app                            backend
 *   ---                            -------
 *   nome                        ↔  name
 *   perfil: gestor | condutor   ↔  perfil: GESTOR | CONDUTOR
 *   departamento: string        ↔  departamento (nome do setor)
 *   photoURL                    ↔  photoUrl
 *
 * As rotas de listagem exigem perfil GESTOR no backend — o que já reflete a
 * realidade das telas que as usam (vincular condutor, escolher gestor).
 */
import { api } from '../lib/api';
import { AppUser, UserPerfil } from '../types';

interface UsuarioResumoResponse {
  id: string;
  name: string | null;
  cpf: string | null;
  perfil: 'GESTOR' | 'CONDUTOR';
  departamento: string | null;
  photoUrl: string | null;
  ativo: boolean;
}

function paraAppUser(u: UsuarioResumoResponse): AppUser {
  return {
    uid: u.id,
    id: u.id,
    nome: u.name ?? '',
    email: '', // o resumo não traz email; quem precisa usa GET /usuarios/{id}
    perfil: (u.perfil === 'GESTOR' ? 'gestor' : 'condutor') as UserPerfil,
    departamento: u.departamento ?? '',
    photoURL: u.photoUrl,
    ativo: u.ativo,
  };
}

function normalizar(texto: string): string {
  return texto.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

async function listarPorPerfil(perfil: 'GESTOR' | 'CONDUTOR'): Promise<AppUser[]> {
  const lista = await api.get<UsuarioResumoResponse[]>(`/usuarios?perfil=${perfil}`);
  return lista.map(paraAppUser).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function getGestoresAtivos(): Promise<AppUser[]> {
  return listarPorPerfil('GESTOR');
}

/**
 * O Firestore precisava de dois índices e duas consultas com `startAt/endAt`
 * para buscar por nome ou departamento — e só encontrava prefixos. Aqui a lista
 * de condutores cabe numa requisição, então filtramos no app: além de mais
 * simples, passa a achar o termo no meio da palavra.
 *
 * Se a equipe crescer a ponto de a lista pesar, o certo é o backend ganhar
 * `?busca=` e paginação.
 */
export async function getCondutoresAtivos({
  busca = '',
  limite = 30,
}: { busca?: string; limite?: number } = {}): Promise<AppUser[]> {
  const todos = await listarPorPerfil('CONDUTOR');
  const termo = normalizar(busca);

  const filtrados = termo
    ? todos.filter(
        (u) =>
          normalizar(u.nome).includes(termo) ||
          normalizar(u.departamento ?? '').includes(termo),
      )
    : todos;

  return filtrados.slice(0, limite);
}

// ── Cadastro (feito pelo gestor) ──────────────────────────────────────────────

/**
 * Cria a conta direto no backend.
 *
 * Some aqui a gambiarra que o Firebase exigia: para cadastrar alguém sem
 * derrubar a sessão do gestor, o app precisava subir uma **segunda instância do
 * Firebase App**, criar o usuário nela e destruí-la em seguida. Com a API, é
 * um POST autenticado como qualquer outro.
 */
export async function createUserAccount(data: {
  nome: string;
  email: string;
  senha: string;
  perfil: UserPerfil;
  departamento: string;
}): Promise<void> {
  const { resolverIdPorNome } = await import('./departamentos.backend');

  await api.post('/usuarios', {
    nome: data.nome,
    email: data.email,
    senha: data.senha,
    perfil: data.perfil.toUpperCase(),
    departamentoId: await resolverIdPorNome(data.departamento),
  });
}
