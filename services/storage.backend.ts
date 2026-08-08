/**
 * Upload de imagens via moovia-backend (REST).
 *
 * O aparelho não fala mais com o Firebase Storage: manda o arquivo para
 * `POST /uploads` e recebe a URL pronta. Quem grava no bucket é o backend, com a
 * credencial de service account — o app não precisa mais de nenhuma.
 *
 * **O que o backend decide (e o app não):** o caminho do arquivo. O app manda só
 * o tipo e o id do registro dono; o nome final é sorteado no servidor. Isso
 * fecha a porta para gravar por cima do arquivo de outra pessoa.
 *
 * **Perda conhecida — progresso:** o `fetch` não reporta bytes enviados. O
 * `onProgress` passa a contar arquivos concluídos (1 de 3 = 33%) em vez de
 * bytes. Em lote de fotos a barra continua andando; num arquivo só, ela pula de
 * 0 para 100.
 */
import * as ImageManipulator from 'expo-image-manipulator';
import { api } from '../lib/api';

type TipoArquivo = 'OS_FOTO' | 'CHECKLIST' | 'ABASTECIMENTO' | 'PERFIL';

interface UploadResponse {
  url: string;
}

/** Pastas que o app usava no Firebase Storage → tipo entendido pelo backend. */
const TIPO_POR_PASTA: Record<string, TipoArquivo> = {
  'os-fotos': 'OS_FOTO',
  checklists: 'CHECKLIST',
  'abastecimento-fotos': 'ABASTECIMENTO',
  'perfil-fotos': 'PERFIL',
};

/**
 * Traduz um caminho no formato antigo (`checklists/{vinculoId}/entrada`) para os
 * campos que o backend espera. Os services continuam montando o caminho como
 * sempre montaram — a conversão fica aqui, não neles.
 */
function interpretarBasePath(basePath: string): {
  tipo: TipoArquivo;
  referenciaId?: string;
  subpasta?: string;
} {
  const [pasta, referenciaId, subpasta] = basePath.replace(/^\/+|\/+$/g, '').split('/');
  const tipo = TIPO_POR_PASTA[pasta];

  if (!tipo) {
    throw new Error(`Pasta de upload desconhecida: "${pasta}" (de "${basePath}")`);
  }

  return { tipo, referenciaId, subpasta };
}

/**
 * Redimensiona e comprime antes de enviar. Fotos de câmera chegam com 4–8 MB;
 * depois disso ficam em ~150–300 KB — o backend recusa acima de 10 MB.
 */
export async function prepararFotoParaUpload(uri: string, maxWidth = 1280): Promise<string> {
  const resultado = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG },
  );
  return resultado.uri;
}

/** Envia um arquivo e devolve a URL pública. */
async function enviar(
  localUri: string,
  tipo: TipoArquivo,
  referenciaId?: string,
  subpasta?: string,
): Promise<string> {
  const comprimida = await prepararFotoParaUpload(localUri);

  const form = new FormData();
  // No React Native o FormData aceita o descritor {uri,name,type} direto — não é
  // preciso ler o arquivo para memória, o runtime faz o streaming.
  form.append('arquivo', {
    uri: comprimida,
    name: 'foto.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);
  form.append('tipo', tipo);
  if (referenciaId) form.append('referenciaId', referenciaId);
  if (subpasta) form.append('subpasta', subpasta);

  const resposta = await api.upload<UploadResponse>('/uploads', form);
  return resposta.url;
}

/**
 * Envia vários arquivos em paralelo, preservando a ordem das URLs.
 * O progresso conta arquivos concluídos.
 */
async function enviarVarios(
  localUris: string[],
  tipo: TipoArquivo,
  referenciaId: string | undefined,
  subpasta: string | undefined,
  onProgress?: (percent: number) => void,
): Promise<string[]> {
  if (localUris.length === 0) return [];

  let concluidos = 0;

  return Promise.all(
    localUris.map(async (uri) => {
      const url = await enviar(uri, tipo, referenciaId, subpasta);
      concluidos++;
      onProgress?.(Math.round((concluidos / localUris.length) * 100));
      return url;
    }),
  );
}

export async function uploadFotosOS(
  localUris: string[],
  osId: string,
  onProgress?: (percent: number) => void,
): Promise<string[]> {
  return enviarVarios(localUris, 'OS_FOTO', osId, undefined, onProgress);
}

export async function uploadFotosGenerica(
  localUris: string[],
  basePath: string,
  onProgress?: (percent: number) => void,
): Promise<string[]> {
  if (localUris.length === 0) return [];
  const { tipo, referenciaId, subpasta } = interpretarBasePath(basePath);
  return enviarVarios(localUris, tipo, referenciaId, subpasta, onProgress);
}

export async function uploadFotoPerfil(
  localUri: string,
  _uid: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  // O uid vem do token, não do parâmetro: ninguém troca a foto de outra pessoa.
  const url = await enviar(localUri, 'PERFIL');
  onProgress?.(100);
  return url;
}

/**
 * O backend ainda não expõe remoção de arquivo. Nenhuma tela chama isso hoje —
 * a função existe desde o Firebase e ficou sem uso. Se voltar a ser usada,
 * precisa de um `DELETE /uploads` antes.
 */
export async function deleteFotosOS(fotoUrls: string[]): Promise<void> {
  if (fotoUrls.length > 0) {
    console.warn('[storage] remoção de fotos ainda não implementada no backend');
  }
}
