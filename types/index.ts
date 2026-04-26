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
  /** @deprecated use uid — remover após migração Firestore */
  id:           string;
  nome:         string;
  email:        string;
  perfil:       UserPerfil;
  departamento: string;
  photoURL?:    string | null;
}

/** Documento Firestore /usuarios/{uid} */
export interface UserProfile {
  nome:           string;
  email:          string;
  perfil:         UserPerfil;
  departamento:   string;
  photoURL?:      string | null;
  fcmToken?: string | null;
}

export interface Veiculo {
  id: string;
  placa: string;
  frota: string;
  modelo: string;
  ano: number;
  departamento: string;
  ativo: boolean;
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

export type OSTipo = 'preventiva' | 'corretiva';

export interface OrdemServico {
  id: string;
  placa: string;
  frota: string;
  condutorId: string;
  condutorNome: string;
  hodometro: number;
  tipo: OSTipo;
  servicos?: string[];
  descricao?: string;
  fotos?: string[];
  cidade?: string;
  dataDesejada?: string;
  horario?: string;
  fornecedorId?: string;
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
}
