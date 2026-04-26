import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from '../lib/firebase';

const MAX_DIMENSION = 1280;
const UPLOAD_QUALITY = 0.65;

async function compressImage(localUri: string): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { manipulateAsync, SaveFormat } = require('expo-image-manipulator');
    const result = await manipulateAsync(
      localUri,
      [{ resize: { width: MAX_DIMENSION } }],
      { compress: UPLOAD_QUALITY, format: SaveFormat.JPEG },
    );
    return result.uri;
  } catch {
    return localUri;
  }
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
  const compressed = await compressImage(localUri);
  const response = await fetch(compressed);
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
  const compressed = await compressImage(localUri);
  const response = await fetch(compressed);
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
