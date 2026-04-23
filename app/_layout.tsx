import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { Colors } from '../constants/colors';
import { useAuthListener } from '../hooks/useAuthListener';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useAuthStore } from '../store/auth.store';
import { registrarTokenFCM } from '../services/notification.service';

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: Colors.primary,
    secondary: Colors.accent,
    surface: Colors.card,
    background: Colors.background,
    outline: Colors.border,
    onSurface: Colors.textPrimary,
  },
};

export default function RootLayout() {
  useAuthListener();
  usePushNotifications();

  const router = useRouter();
  const { currentUser } = useAuthStore();

  // Atualiza o FCM token quando o app volta ao foreground
  // (o token FCM pode ter sido rotacionado enquanto o app estava em background)
  useEffect(() => {
    if (Constants.appOwnership === 'expo') return;

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && currentUser?.uid) {
        registrarTokenFCM(currentUser.uid).catch(console.warn);
      }
    });
    return () => sub.remove();
  }, [currentUser?.uid]);

  // Listeners de deep link: toque em notificação → navega para a OS
  useEffect(() => {
    // @react-native-firebase/messaging é módulo nativo — não funciona no Expo Go.
    // require() condicional: Metro só carrega o módulo quando este branch é alcançado.
    if (Constants.appOwnership === 'expo') return;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const messaging = require('@react-native-firebase/messaging').default;

    // App em background → tocou na notificação
    const unsubBg = messaging().onNotificationOpenedApp((msg: any) => {
      const osId = msg?.data?.osId as string | undefined;
      if (osId) router.push(`/os/${osId}`);
    });

    // App fechado (cold start) → abriu pelo toque na notificação
    messaging().getInitialNotification().then((msg: any) => {
      const osId = msg?.data?.osId as string | undefined;
      if (osId) router.push(`/os/${osId}`);
    });

    // App em foreground → exibe notificação local via expo-notifications
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert:  true,
        shouldShowBanner: true,
        shouldShowList:   true,
        shouldPlaySound:  true,
        shouldSetBadge:   false,
      }),
    });

    // Toque em notificação exibida em foreground
    const unsubFg = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const osId = response?.notification?.request?.content?.data?.osId as string | undefined;
      if (osId) router.push(`/os/${osId}`);
    });

    return () => {
      unsubBg();
      unsubFg.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="nova-os" />
            <Stack.Screen name="os" />
            <Stack.Screen name="novo-usuario" />
          </Stack>
          <StatusBar style="auto" />
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
