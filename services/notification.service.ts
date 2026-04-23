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
    await updateDoc(doc(db, 'usuarios', uid), { fcmToken: token });

    onTokenRefresh(m, (novoToken: string) => {
      updateDoc(doc(db, 'usuarios', uid), { fcmToken: novoToken }).catch(console.warn);
    });
  } catch (err) {
    console.warn('[FCM] registrarTokenFCM:', err);
  }
}
