/**
 * Notification service — captura o FCM token do device e salva no Firestore.
 * O disparo de notificações é feito pelas Cloud Functions (trigger Firestore).
 *
 * @react-native-firebase/messaging é módulo nativo — não carrega no Expo Go.
 * Usamos require() condicional para que o Metro não avalie o módulo até que
 * o branch seja efetivamente alcançado (nunca acontece no Expo Go).
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const isExpoGo = Constants.appOwnership === 'expo';

/**
 * Solicita permissão, obtém o FCM token e persiste em Firestore.
 * - Permissão negada: retorna silenciosamente (sem throw).
 * - Expo Go: retorna silenciosamente (módulo nativo indisponível).
 * - Configura canal Android 'os-updates' (HIGH) via expo-notifications.
 * - Registra onTokenRefresh para manter o Firestore atualizado.
 */
export async function registrarTokenFCM(uid: string): Promise<void> {
  if (isExpoGo) return;

  try {
    // Canal Android — deve ser criado antes de qualquer exibição de notificação
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
    const messaging = require('@react-native-firebase/messaging').default;

    const authStatus = await messaging().requestPermission();
    const concedida =
      authStatus === 1 || // AUTHORIZED
      authStatus === 2 || // PROVISIONAL
      authStatus === messaging.AuthorizationStatus?.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus?.PROVISIONAL;

    if (!concedida) return;

    const token: string = await messaging().getToken();
    await updateDoc(doc(db, 'usuarios', uid), { fcmToken: token });

    // Mantém o token atualizado quando o FCM o rotacionar
    messaging().onTokenRefresh((novoToken: string) => {
      updateDoc(doc(db, 'usuarios', uid), { fcmToken: novoToken }).catch(console.warn);
    });
  } catch (err) {
    // Falha silenciosa — notificação não é crítica para o funcionamento do app
    console.warn('[FCM] registrarTokenFCM:', err);
  }
}
