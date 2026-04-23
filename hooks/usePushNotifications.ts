import { useEffect } from 'react';
import { useAuthStore } from '../store/auth.store';
import { registrarTokenFCM } from '../services/notification.service';

/**
 * Registra o FCM token do device ao montar o layout (cobre o caso de
 * sessão restaurada — onAuthStateChanged → setUser sem passar pelo login).
 * Re-executa quando o uid muda (troca de conta).
 * O auth.store.ts cobre o caso de login explícito.
 */
export function usePushNotifications() {
  const { currentUser } = useAuthStore();

  useEffect(() => {
    if (!currentUser) return;
    registrarTokenFCM(currentUser.uid).catch(console.warn);
  }, [currentUser?.uid]);
}
