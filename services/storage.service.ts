import {
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import * as ImageManipulator from 'expo-image-manipulator';
import { storage } from '../lib/firebase';
import { USAR_BACKEND } from '../lib/flags';
import * as backend from './storage.backend';

/**
 * Redimensiona e comprime uma foto local antes do upload.
 * Fotos de câmera chegam em 4–8 MB; após isso ficam em ~150–300 KB.
 */
export async function prepararFotoParaUpload(
  uri: string,
  maxWidth = 1280,
): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}


/**
 * Faz upload de uma única foto de OS para Firebase Storage.
 *
 * Path: os-fotos/{osId}/{timestamp}_{index}
 * Nomes únicos garantem que múltiplas fotos não se sobrescrevam.
 */
async function uploadFotoOSUnica(
  localUri: string,
  osId: string,
  index: number,
  timestamp: number,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const comprimida = await prepararFotoParaUpload(localUri);
  const response = await fetch(comprimida);
  const blob = await response.blob();

  const path = `os-fotos/${osId}/${timestamp}_${index}`;
  const storageRef = ref(storage, path);

  return new Promise<string>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, blob, {
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=604800',
      customMetadata: { osId },
    });

    task.on(
      'state_changed',
      (snapshot) => {
        const pct = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
        );
        onProgress?.(pct);
      },
      reject,
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        } catch (err) {
          reject(err);
        }
      },
    );
  });
}

/**
 * Faz upload de múltiplas fotos de OS em paralelo.
 *
 * @param localUris  Array de URIs locais (file:// ou content://)
 * @param osId       ID da OS no Firestore
 * @param onProgress Callback com % agregado de progresso (0–100)
 * @returns          Array de URLs HTTPS permanentes, na mesma ordem dos localUris
 */
export async function uploadFotosOS(
  localUris: string[],
  osId: string,
  onProgress?: (percent: number) => void,
): Promise<string[]> {
  if (localUris.length === 0) return [];
  if (USAR_BACKEND) return backend.uploadFotosOS(localUris, osId, onProgress);

  const timestamp = Date.now();
  const progressByIndex = new Array(localUris.length).fill(0);

  const notifyAggregated = () => {
    const total = progressByIndex.reduce((a, b) => a + b, 0);
    onProgress?.(Math.round(total / localUris.length));
  };

  return Promise.all(
    localUris.map((uri, i) =>
      uploadFotoOSUnica(uri, osId, i, timestamp, (pct) => {
        progressByIndex[i] = pct;
        notifyAggregated();
      }),
    ),
  );
}

/**
 * Faz upload de múltiplas fotos em paralelo para um path genérico.
 *
 * @param localUris  Array de URIs locais
 * @param basePath   Caminho base no Storage (ex: "checklists/{id}/entrada")
 * @param onProgress Callback com % agregado de progresso (0–100)
 * @returns          Array de URLs HTTPS permanentes, na mesma ordem dos localUris
 */
export async function uploadFotosGenerica(
  localUris: string[],
  basePath: string,
  onProgress?: (percent: number) => void,
): Promise<string[]> {
  if (localUris.length === 0) return [];
  if (USAR_BACKEND) return backend.uploadFotosGenerica(localUris, basePath, onProgress);

  const timestamp = Date.now();
  let concluidos = 0;

  return Promise.all(
    localUris.map(async (uri, i) => {
      const comprimida = await prepararFotoParaUpload(uri);
      const response = await fetch(comprimida);
      const blob = await response.blob();
      const storageRef = ref(storage, `${basePath}/${timestamp}_${i}`);
      const snapshot = await uploadBytes(storageRef, blob, {
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=604800',
      });
      concluidos++;
      onProgress?.(Math.round((concluidos / localUris.length) * 100));
      return getDownloadURL(snapshot.ref);
    }),
  );
}

/**
 * Remove todas as fotos de uma OS do Storage.
 * Requer as URLs (já salvas no Firestore) — Storage não suporta delete de pasta.
 * Falha silenciosa por foto individual.
 */
export async function deleteFotosOS(fotoUrls: string[]): Promise<void> {
  if (USAR_BACKEND) return backend.deleteFotosOS(fotoUrls);

  await Promise.allSettled(
    fotoUrls.map((url) => deleteObject(ref(storage, url))),
  );
}

/**
 * Faz upload da foto de perfil de um usuário para Firebase Storage.
 *
 * Path: perfil-fotos/{uid}  (sobrescreve ao trocar de foto — sem acúmulo)
 * Retorna a URL pública permanente (HTTPS) para salvar no Auth + Firestore.
 *
 * Comprime antes de subir, como as demais rotas. O `quality` do ImagePicker
 * reencoda o JPEG mas não mexe nas dimensões: o recorte de uma foto de 64 MP
 * continua com milhares de pixels de lado e passa dos 5 MB que a regra de
 * `perfil-fotos/` permite — metade do limite das outras pastas.
 */
export async function uploadFotoPerfil(
  localUri: string,
  uid: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  if (USAR_BACKEND) return backend.uploadFotoPerfil(localUri, uid, onProgress);

  const comprimida = await prepararFotoParaUpload(localUri);
  const response = await fetch(comprimida);
  const blob = await response.blob();

  const storageRef = ref(storage, `perfil-fotos/${uid}`);

  return new Promise<string>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, blob, {
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=604800',
      customMetadata: { uid },
    });

    task.on(
      'state_changed',
      (snapshot) => {
        const pct = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
        );
        onProgress?.(pct);
      },
      reject,
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        } catch (err) {
          reject(err);
        }
      },
    );
  });
}

// ── Erros de upload ───────────────────────────────────────────────────────────

/**
 * O que a pessoa pode fazer a respeito. É isto que decide a mensagem: um
 * condutor na rua não tem o que fazer com `storage/retry-limit-exceeded`.
 */
export type AcaoUsuario =
  | 'tentar_novamente'
  | 'trocar_arquivo'
  | 'entrar_novamente'
  | 'avisar_gestor'
  | 'nenhuma';

export interface FalhaUpload {
  /** Texto para a tela — sem jargão e sem código do SDK. Vazio = não mostrar. */
  mensagem: string;
  acao:     AcaoUsuario;
  /** Rabicho curto que o usuário repassa a quem dá suporte. */
  codigo:   string;
}

/**
 * Traduz o erro do Firebase Storage no que o usuário deve fazer.
 *
 * Recebe o estado da conexão porque o código sozinho não basta:
 * `retry-limit-exceeded` é o mesmo quando o sinal está fraco e quando o
 * servidor recusa todas as tentativas. Online + retentativas esgotadas
 * significa que o problema não é do aparelho dele — e que insistir não resolve.
 */
export function mapStorageError(err: unknown, online: boolean): FalhaUpload {
  const code = (err as { code?: string })?.code ?? '';

  if (!online) {
    return {
      mensagem: 'Sem internet. A foto não foi enviada — tente de novo quando tiver sinal.',
      acao:     'tentar_novamente',
      codigo:   'ST-00',
    };
  }

  switch (code) {
    // O usuário abortou: não há falha a comunicar.
    case 'storage/canceled':
      return { mensagem: '', acao: 'nenhuma', codigo: 'ST-01' };

    case 'storage/unauthenticated':
      return {
        mensagem: 'Sua sessão expirou. Entre novamente para continuar.',
        acao:     'entrar_novamente',
        codigo:   'ST-02',
      };

    // A regra do Storage recusou. Pode ser permissão, tamanho acima do limite
    // ou formato — do lado do cliente os três chegam idênticos. A mensagem
    // cobre primeiro o que ele resolve sozinho, antes de mandar escalar.
    case 'storage/unauthorized':
      return {
        mensagem: 'Não foi possível enviar esta foto. Tente outra imagem; se continuar, avise o gestor. (ST-03)',
        acao:     'trocar_arquivo',
        codigo:   'ST-03',
      };

    case 'storage/quota-exceeded':
      return {
        mensagem: 'O armazenamento do sistema está indisponível. Avise o gestor. (ST-04)',
        acao:     'avisar_gestor',
        codigo:   'ST-04',
      };

    // Inclui `retry-limit-exceeded` e `unknown` com o aparelho online: o
    // servidor recusou todas as tentativas.
    default:
      return {
        mensagem: 'Não foi possível salvar a foto agora. O problema é no sistema, não no seu aparelho — avise o gestor. (ST-05)',
        acao:     'avisar_gestor',
        codigo:   'ST-05',
      };
  }
}
