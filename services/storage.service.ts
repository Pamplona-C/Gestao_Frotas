import {
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import * as ImageManipulator from 'expo-image-manipulator';
import { storage } from '../lib/firebase';

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
  await Promise.allSettled(
    fotoUrls.map((url) => deleteObject(ref(storage, url))),
  );
}

/**
 * Faz upload da foto de perfil de um usuário para Firebase Storage.
 *
 * Path: perfil-fotos/{uid}  (sobrescreve ao trocar de foto — sem acúmulo)
 * Retorna a URL pública permanente (HTTPS) para salvar no Auth + Firestore.
 */
export async function uploadFotoPerfil(
  localUri: string,
  uid: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const response = await fetch(localUri);
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
