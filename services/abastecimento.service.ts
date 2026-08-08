import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { USAR_BACKEND } from '../lib/flags';
import { uploadFotosGenerica } from './storage.service';
import * as backend from './abastecimento.backend';
import { Abastecimento, TipoCombustivel } from '../types';

const COLLECTION = 'despesas-veiculo';

export interface NovoAbastecimentoInput {
  condutorId:      string;
  condutorNome:    string;
  veiculoId:       string;
  veiculoPlaca:    string;
  veiculoFrota:    string;
  // Opcional: parte das motos da frota não tem odômetro.
  hodometro?:      number;
  tipoCombustivel: TipoCombustivel;
  litros?:         number;
  valor:           number;
}

export async function criarAbastecimento(
  input: NovoAbastecimentoInput,
  fotoUri?: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  if (USAR_BACKEND) return backend.criarAbastecimento(input, fotoUri, onProgress);

  const now = new Date();
  const competencia = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const docData = Object.fromEntries(
    Object.entries({
      ...input,
      tipo: 'abastecimento',
      status: 'pago',
      competencia,
      criadoEm: serverTimestamp(),
    }).filter(([, v]) => v !== undefined),
  );

  const ref = await addDoc(collection(db, COLLECTION), docData);

  if (fotoUri) {
    try {
      const urls = await uploadFotosGenerica(
        [fotoUri],
        `abastecimento-fotos/${ref.id}`,
        onProgress,
      );
      await updateDoc(doc(db, COLLECTION, ref.id), { fotoUrl: urls[0] });
    } catch {
      // doc criado mesmo se foto falhar
    }
  }

  return ref.id;
}

export function subscribeToAbastecimentosByCondutor(
  condutorId: string,
  callback: (items: Abastecimento[]) => void,
): Unsubscribe {
  if (USAR_BACKEND) {
    // Sem tempo real no REST: busca uma vez e devolve um unsubscribe que não faz
    // nada. `cancelado` evita que uma resposta atrasada chame o callback depois
    // que a tela já saiu.
    let cancelado = false;
    backend
      .listarPorCondutor(condutorId)
      .then((items) => {
        if (!cancelado) callback(items);
      })
      .catch((err) => console.warn('[abastecimento] falha ao listar:', err));
    return () => {
      cancelado = true;
    };
  }

  const q = query(
    collection(db, COLLECTION),
    where('condutorId', '==', condutorId),
    where('tipo', '==', 'abastecimento'),
  );

  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Abastecimento, 'id'>) }));
    items.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    callback(items);
  });
}
