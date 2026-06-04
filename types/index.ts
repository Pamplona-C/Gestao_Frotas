export type UserPerfil = 'condutor' | 'gestor';

/** Mock data shape — mantido para compatibilidade com os mocks locais. */
export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: UserPerfil;
  departamento: string;
}

/**
 * Usuário autenticado na sessão.
 * Combina Firebase Auth (uid, email, photoURL) + perfil do Firestore.
 *
 * @field id  Alias de uid — mantido para compatibilidade com condutorId
 *            dos mocks enquanto o Firestore não está migrado.
 *            TODO: remover `id` após migração para Firestore.
 */
export interface AppUser {
  uid:          string;
  /** @deprecated use uid */
  id?:          string;
  nome:         string;
  email:        string;
  perfil:       UserPerfil;
  departamento?: string;
  photoURL?:    string | null;
  ativo?:       boolean;
  nomeBusca?:   string;
  departamentoBusca?: string;
}

/** Documento Firestore /usuarios/{uid} */
export interface UserProfile {
  nome:           string;
  email:          string;
  perfil:         UserPerfil;
  departamento:   string;
  photoURL?:      string | null;
  fcmToken?:      string | null;
  ativo?:         boolean;
  nomeBusca?:     string;
  departamentoBusca?: string;
}

export type VeiculoTipo = 'carro' | 'moto';

export interface Veiculo {
  id:           string;
  tipo:         VeiculoTipo;
  marca:        string;
  modelo:       string;
  frota:        string;
  placa?:       string;
  ano:          number;
  kmAtual?:     number;
  departamento: string;
  ativo:        boolean;
}

export interface Fornecedor {
  id: string;
  nome: string;
  cidade: string;
  endereco: string;
  horario: string;
  responsavel: string;
  telefone: string;
  googleMapsUrl?: string;
}

export type OSStatus =
  | 'nova'
  | 'em_andamento'
  | 'em_diagnostico'
  | 'orcamento_aprovado'
  | 'concluida';

export type TipoServico = 'preventiva' | 'corretiva';

export interface CatalogoServico {
  id: string;
  nome: string;
  tipo: TipoServico;
  ativo: boolean;
}

export interface ServicoRealizado {
  catalogoId: string;
  nome: string;
  tipo: TipoServico;
  valor: number;
}

export interface StatusEntry {
  status: OSStatus;
  changedAt: string; // ISO string
  changedBy: string; // condutor na criação, gestor nas demais
}

export interface Notificacao {
  id: string;
  userId: string;
  type: 'os_criada' | 'status_atualizado' | 'lembrete_os';
  title: string;
  body: string;
  osId: string;
  createdAt: string; // ISO string
  expiresAt: string; // ISO string — createdAt + 90 dias (TTL policy)
  read: boolean;
}

export type VinculoStatus = 'ativo' | 'inativo';
export type ChecklistPendencia = 'entrada' | 'saida' | null;

export interface Vinculo {
  id:                  string;
  condutorId:          string;
  condutorNome:        string;
  condutorId2?:        string;
  condutorNome2?:      string;
  condutorIds:         string[];  // [condutorId] ou [condutorId, condutorId2]
  veiculoId:           string;
  veiculoFrota:        string;
  veiculoModelo:       string;
  veiculoMarca:        string;
  veiculoPlaca?:       string;
  veiculoTipo:         VeiculoTipo;
  checklistEntradaId?: string;
  checklistSaidaId?:   string;
  pendenciaChecklist?: ChecklistPendencia;
  status:              VinculoStatus;
  criadoEm:            string;
  gestorId:            string;
  encerradoEm?:        string;
}

export interface Checklist {
  id:           string;
  tipo:         'entrada' | 'saida';
  vinculoId:    string;
  condutorId:   string;
  veiculoId:    string;
  veiculoTipo:  VeiculoTipo;
  fotos:        Record<string, string>;
  observacoes?: string;
  completadoEm: string;
}

export interface OrdemServico {
  id: string;
  veiculoId?: string;
  origemChecklistId?: string;
  origemVinculoId?: string;
  veiculoMarca?: string;
  veiculoModelo?: string;
  veiculoTipo?: VeiculoTipo;
  placa?: string;
  frota: string;
  condutorId: string;
  condutorNome: string;
  hodometro?: number;
  servicos?: string[];
  descricao?: string;
  fotos?: string[];
  cidade?: string;
  dataDesejada?: string;
  horario?: string;
  fornecedorId?: string;
  fornecedorNome?: string;
  tipo?: TipoServico;
  status: OSStatus;
  criadoEm: string;
  notaInterna?: string;
  observacoes?: string;
  condutorPhotoURL?:    string | null;
  condutorDepartamento?: string;
  gestorId?:            string;
  gestorNome?:          string;
  gestorPhotoURL?:      string | null;
  gestorDepartamento?:  string;
  statusHistory?:       StatusEntry[];
  entregueOficinaEm?:   string;
  retornouOficinaEm?:   string;
  servicosRealizados?:  ServicoRealizado[];
  valorTotal?:          number;
  gastoPreventiva?:     number;
  gastoCorretiva?:      number;
}
