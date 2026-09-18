/**
 * Notification service — captura o FCM token do device e salva no Firestore.
 * O disparo de notificações é feito pelas Cloud Functions (trigger Firestore).
 *
 * @react-native-firebase/messaging é módulo nativo — não carrega no Expo Go.
 * Usamos require() condicional para que o Metro não avalie o módulo até que
 * o branch seja efetivamente alcançado (nunca acontece no Expo Go).
 *
 * API modular v24: todas as funções recebem a instância de Messaging como
 * primeiro argumento, obtida via getMessaging().
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { USAR_BACKEND } from '../lib/flags';
import { api } from '../lib/api';

/**
 * Guarda o token no destino certo conforme a migração.
 *
 * Diferença que importa: no Firestore o token ficava **no documento do
 * usuário**, um por pessoa — trocar de aparelho derrubava o push do anterior.
 * O backend guarda em `device_tokens`, vários por pessoa, então quem usa
 * celular e tablet recebe nos dois.
 */
/**
 * Último token registrado nesta sessão. O backend remove o aparelho **pelo
 * token**, então precisamos lembrar qual enviamos — sem isso o logout não teria
 * o que apagar e o aparelho continuaria recebendo push.
 */
let ultimoTokenRegistrado: string | null = null;

async function salvarToken(uid: string, token: string): Promise<void> {
  ultimoTokenRegistrado = token;
  if (USAR_BACKEND) {
    await api.post('/usuarios/me/dispositivos', {
      token,
      plataforma: Platform.OS.toUpperCase(),
    });
    return;
  }
  await updateDoc(doc(db, 'usuarios', uid), { fcmToken: token });
}

/** Chamado no logout: para de receber push neste aparelho. */
export async function removerTokenDispositivo(): Promise<void> {
  if (!USAR_BACKEND || !ultimoTokenRegistrado) return;
  try {
    await api.delete('/usuarios/me/dispositivos', { token: ultimoTokenRegistrado });
    ultimoTokenRegistrado = null;
  } catch (err) {
    // Falhar aqui não pode impedir o logout — o token expira sozinho no FCM.
    console.warn('[FCM] removerTokenDispositivo:', err);
  }
}

export const isExpoGo = Constants.appOwnership === 'expo';

export async function registrarTokenFCM(uid: string): Promise<void> {
  if (isExpoGo) return;

  try {
    if (Platform.OS === 'android') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Notifications = require('expo-notifications');
      await Notifications.setNotificationChannelAsync('os-updates', {
        name:             'Atualizações de OS',
        importance:       Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor:       '#1A5C2A',
        sound:            'default',
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {
      getMessaging,
      requestPermission,
      getToken,
      onTokenRefresh,
      AuthorizationStatus,
    } = require('@react-native-firebase/messaging');

    const m = getMessaging();

    const authStatus = await requestPermission(m);
    const concedida =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL;

    if (!concedida) return;

    const token: string = await getToken(m);
    await salvarToken(uid, token);

    onTokenRefresh(m, (novoToken: string) => {
      salvarToken(uid, novoToken).catch(console.warn);
    });
  } catch (err) {
    console.warn('[FCM] registrarTokenFCM:', err);
  }
}
