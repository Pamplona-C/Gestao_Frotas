/**
 * Guarda a sessão do backend (accessToken + refreshToken) no aparelho.
 *
 * Preferimos o **SecureStore** (Keychain no iOS, Keystore no Android): o refresh
 * token vale 30 dias e permite emitir access tokens novos, então merece
 * armazenamento cifrado pelo sistema.
 *
 * Mas o SecureStore é um **módulo nativo**: ele só existe se o app nativo tiver
 * sido compilado depois da instalação do pacote. Num development build antigo
 * (ou no Expo Go) ele simplesmente não está lá — e um import direto derruba o
 * app inteiro na inicialização. Por isso carregamos sob demanda e caímos para o
 * AsyncStorage quando ele falta.
 *
 * O mesmo padrão já é usado no projeto para o @react-native-firebase/messaging.
 *
 * Para ter o armazenamento cifrado de verdade, recompile o app nativo:
 *     npx expo run:ios     (ou run:android)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const ACCESS_KEY = 'moovia.accessToken';
const REFRESH_KEY = 'moovia.refreshToken';

type SecureStoreModule = {
  setItemAsync: (k: string, v: string) => Promise<void>;
  getItemAsync: (k: string) => Promise<string | null>;
  deleteItemAsync: (k: string) => Promise<void>;
};

/**
 * Resolve o SecureStore uma única vez. Devolve null quando o módulo nativo não
 * está presente — aí o chamador usa AsyncStorage.
 */
const secureStore: SecureStoreModule | null = (() => {
  // No web o SecureStore não existe; AsyncStorage é o que há.
  if (Platform.OS === 'web') return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-secure-store') as SecureStoreModule;
    // O import resolve mesmo sem o binário nativo; só o uso é que falha.
    // Uma chamada de sondagem revela isso agora, e não no meio de um login.
    void mod.getItemAsync(ACCESS_KEY).catch(() => {});
    return mod;
  } catch {
    return null;
  }
})();

let avisou = false;
function avisarFallback() {
  if (avisou) return;
  avisou = true;
  console.warn(
    '[session] expo-secure-store indisponível — os tokens estão em AsyncStorage ' +
      '(não cifrado). Recompile o app nativo com `npx expo run:ios` para ativar ' +
      'o armazenamento seguro.',
  );
}

async function setItem(key: string, value: string): Promise<void> {
  if (secureStore) {
    try {
      return await secureStore.setItemAsync(key, value);
    } catch {
      avisarFallback();
    }
  } else {
    avisarFallback();
  }
  return AsyncStorage.setItem(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (secureStore) {
    try {
      return await secureStore.getItemAsync(key);
    } catch {
      avisarFallback();
    }
  }
  return AsyncStorage.getItem(key);
}

async function removeItem(key: string): Promise<void> {
  // Apaga dos dois lados: a sessão pode ter sido gravada antes de uma
  // recompilação, e um logout precisa limpar tudo.
  if (secureStore) {
    try {
      await secureStore.deleteItemAsync(key);
    } catch {
      /* segue para o AsyncStorage */
    }
  }
  await AsyncStorage.removeItem(key);
}

export interface Sessao {
  accessToken: string;
  refreshToken: string;
}

/**
 * Cache em memória: o armazenamento é assíncrono e toda requisição precisa do
 * access token. Ler do disco a cada chamada seria lento e desnecessário.
 */
let cache: Sessao | null = null;

export async function salvarSessao(sessao: Sessao): Promise<void> {
  cache = sessao;
  await Promise.all([
    setItem(ACCESS_KEY, sessao.accessToken),
    setItem(REFRESH_KEY, sessao.refreshToken),
  ]);
}

export async function carregarSessao(): Promise<Sessao | null> {
  if (cache) return cache;

  const [accessToken, refreshToken] = await Promise.all([
    getItem(ACCESS_KEY),
    getItem(REFRESH_KEY),
  ]);

  if (!accessToken || !refreshToken) return null;

  cache = { accessToken, refreshToken };
  return cache;
}

export async function limparSessao(): Promise<void> {
  cache = null;
  await Promise.all([removeItem(ACCESS_KEY), removeItem(REFRESH_KEY)]);
}

/** Leitura síncrona do que já está em memória (usada pelo cliente HTTP). */
export function sessaoEmMemoria(): Sessao | null {
  return cache;
}

/** true quando os tokens estão em armazenamento cifrado pelo sistema. */
export function usandoArmazenamentoSeguro(): boolean {
  return secureStore !== null;
}
