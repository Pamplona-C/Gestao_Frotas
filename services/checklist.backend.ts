/**
 * Checklists via moovia-backend (REST).
 *
 * ⚠️ GLOSSÁRIO INVERTIDO — o mesmo alerta do `vinculo.backend`:
 *
 *   momento real                        app          backend
 *   ------------                        ---          -------
 *   condutor RECEBE o veículo        →  'entrada'    checklist-SAÍDA
 *   condutor DEVOLVE o veículo       →  'saida'      checklist-RETORNO
 *
 * **Mudança estrutural:** no Firestore o checklist era um documento próprio, na
 * coleção `checklists`, com id próprio. No backend ele não existe como entidade
 * — é um par de blocos dentro do vínculo (`checklistSaida` / `checklistRetorno`),
 * do mesmo jeito que data, condutor e fotos.
 *
 * Como as telas navegam por id (`/checklists/{id}`), o id vira sintético:
 * `{vinculoId}:saida` e `{vinculoId}:retorno` — a mesma convenção que o
 * `vinculo.backend` já usa em `checklistEntradaId` / `checklistSaidaId`. O
 * sufixo usa a palavra do BACKEND.
 *
 * **Consequência:** cada vínculo tem no máximo um checklist de cada lado. No
 * Firestore nada impedia gravar dois; aqui, refazer um checklist é rejeitado
 * pela regra de status do vínculo.
 */
import { Asset } from 'expo-asset';
import { api } from '../lib/api';
import { getAngulosByTipo } from '../constants/checklistAngulos';
import { Checklist, VeiculoTipo } from '../types';
import { uploadFotosGenerica } from './storage.service';

type LadoBackend = 'saida' | 'retorno';

interface CondutorResumo {
  id: string;
  nome?: string | null;
  name?: string | null;
}

interface ChecklistResponse {
  data: string;
  condutor: CondutorResumo | null;
  fotos: Record<string, string> | null;
  observacoes: string | null;
}

interface VinculoResponse {
  id: string;
  veiculo: {
    id: string;
    categoria: 'CARRO' | 'MOTO' | 'CAMINHONETE' | 'CAMINHAO' | null;
  } | null;
  condutores: CondutorResumo[];
  checklistSaida: ChecklistResponse | null;
  checklistRetorno: ChecklistResponse | null;
}

/** app 'entrada' → backend 'saida'; app 'saida' → backend 'retorno'. */
function ladoDoBackend(tipo: Checklist['tipo']): LadoBackend {
  return tipo === 'entrada' ? 'saida' : 'retorno';
}

function tipoDoApp(lado: LadoBackend): Checklist['tipo'] {
  return lado === 'saida' ? 'entrada' : 'saida';
}

export function montarId(vinculoId: string, lado: LadoBackend): string {
  return `${vinculoId}:${lado}`;
}

function separarId(id: string): { vinculoId: string; lado: LadoBackend } | null {
  const separador = id.lastIndexOf(':');
  if (separador < 0) return null;

  const lado = id.slice(separador + 1);
  if (lado !== 'saida' && lado !== 'retorno') return null;

  return { vinculoId: id.slice(0, separador), lado };
}

/**
 * Monta o Checklist do app a partir de um lado do vínculo. Devolve null quando
 * aquele checklist ainda não foi feito.
 */
function paraChecklist(v: VinculoResponse, lado: LadoBackend): Checklist | null {
  const bloco = lado === 'saida' ? v.checklistSaida : v.checklistRetorno;
  if (!bloco) return null;

  return {
    id: montarId(v.id, lado),
    tipo: tipoDoApp(lado),
    vinculoId: v.id,
    // Quem fez o checklist; se o backend não devolveu, cai no 1º condutor.
    condutorId: bloco.condutor?.id ?? v.condutores?.[0]?.id ?? '',
    veiculoId: v.veiculo?.id ?? '',
    // Caminhonete e caminhão contam como carro — é o que decide o nº de fotos.
    veiculoTipo: (v.veiculo?.categoria === 'MOTO' ? 'moto' : 'carro') as VeiculoTipo,
    fotos: bloco.fotos ?? {},
    observacoes: bloco.observacoes ?? undefined,
    completadoEm: bloco.data,
  };
}

// ── Escrita ───────────────────────────────────────────────────────────────────

export async function createChecklist(
  data: Omit<Checklist, 'id'>,
  fotosUris: Record<string, string>,
  onProgress?: (pct: number) => void,
): Promise<Checklist> {
  const angulos = Object.keys(fotosUris);
  const uris = Object.values(fotosUris);

  // A subpasta usa a palavra do APP ('entrada'/'saida'), como no Firebase — é só
  // organização de arquivo, e manter igual deixa os dois períodos comparáveis.
  const urls = await uploadFotosGenerica(
    uris,
    `checklists/${data.vinculoId}/${data.tipo}`,
    onProgress,
  );

  const fotos: Record<string, string> = {};
  angulos.forEach((angulo, i) => {
    fotos[angulo] = urls[i];
  });

  const lado = ladoDoBackend(data.tipo);
  // O backend faz numa transação o que o app fazia em duas escritas: gravar o
  // checklist e mover o status do vínculo (PENDENTE_SAIDA→ATIVO, ATIVO→ENCERRADO).
  const vinculo = await api.post<VinculoResponse>(
    `/vinculos/${data.vinculoId}/checklist-${lado}`,
    { fotos, observacoes: data.observacoes ?? null },
  );

  const criado = paraChecklist(vinculo, lado);
  if (criado) return criado;

  // Defesa: o backend acabou de gravar, então o bloco deveria existir. Se não
  // existir, devolvemos o que enviamos em vez de quebrar a tela.
  return { ...data, id: montarId(data.vinculoId, lado), fotos };
}

/**
 * Atalho de desenvolvimento: preenche todos os ângulos com uma imagem
 * placeholder, para não ter que fotografar 20 ângulos a cada teste.
 *
 * **Por que não grava um checklist vazio** (que era o que fazia no Firestore):
 * a exigência de ao menos uma foto é a única coisa que garante que todo vínculo
 * tenha registro do estado do veículo, e ela existe por causa de disputa ("o
 * carro já estava riscado"). Afrouxá-la no servidor abriria essa porta para o
 * cliente de verdade também. Aqui o checklist fica completo **de verdade** — só
 * com uma imagem que ninguém confunde com foto real.
 *
 * Sobe o placeholder uma vez e repete a mesma URL em todos os ângulos: o que
 * demora é o upload, não a requisição.
 */
export async function skipChecklistDev(
  vinculoId: string,
  tipo: Checklist['tipo'],
  _condutorId: string,
  _veiculoId: string,
  veiculoTipo: VeiculoTipo,
): Promise<void> {
  if (!__DEV__) return;

  const asset = Asset.fromModule(require('../assets/images/icon.png'));
  await asset.downloadAsync();

  const [url] = await uploadFotosGenerica(
    [asset.localUri ?? asset.uri],
    `checklists/${vinculoId}/${tipo}`,
  );

  const fotos: Record<string, string> = {};
  for (const angulo of getAngulosByTipo(veiculoTipo)) fotos[angulo] = url;

  await api.post(`/vinculos/${vinculoId}/checklist-${ladoDoBackend(tipo)}`, {
    fotos,
    observacoes: '[DEV] checklist preenchido automaticamente',
  });
}

// ── Leitura ───────────────────────────────────────────────────────────────────

export async function getChecklistById(id: string): Promise<Checklist | null> {
  const partes = separarId(id);
  if (!partes) return null;

  try {
    const vinculo = await api.get<VinculoResponse>(`/vinculos/${partes.vinculoId}`);
    return paraChecklist(vinculo, partes.lado);
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

export async function getChecklistsByVinculo(vinculoId: string): Promise<Checklist[]> {
  try {
    const vinculo = await api.get<VinculoResponse>(`/vinculos/${vinculoId}`);
    return [paraChecklist(vinculo, 'saida'), paraChecklist(vinculo, 'retorno')]
      .filter((c): c is Checklist => c !== null);
  } catch (err) {
    if ((err as { status?: number }).status === 404) return [];
    throw err;
  }
}

/**
 * Checklists recentes, do mais novo para o mais antigo.
 *
 * Não há endpoint de checklists: eles moram dentro dos vínculos, então lemos a
 * listagem de vínculos e achatamos os dois lados de cada um. `GET /vinculos` é
 * de GESTOR — a tela que usa isso (relatórios) também é.
 *
 * Isso traz **todos** os vínculos para depois cortar em memória. Funciona na
 * escala atual; quando incomodar, o caminho é um endpoint de checklists no
 * backend, com filtro por data e paginação.
 */
export async function getRecentChecklists(
  startIso?: string,
  pageSize = 200,
): Promise<Checklist[]> {
  const vinculos = await api.get<VinculoResponse[]>('/vinculos');

  const checklists = vinculos.flatMap((v) =>
    [paraChecklist(v, 'saida'), paraChecklist(v, 'retorno')]
      .filter((c): c is Checklist => c !== null),
  );

  return checklists
    .filter((c) => !startIso || c.completadoEm >= startIso)
    .sort((a, b) => b.completadoEm.localeCompare(a.completadoEm))
    .slice(0, pageSize);
}
