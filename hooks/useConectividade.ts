import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Retorna `online: boolean` — false quando o device não tem conexão de dados.
 * Inicia como true para evitar flash de "sem internet" no primeiro render.
 */
export function useConectividade(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOnline(state.isConnected === true && state.isInternetReachable !== false);
    });
    return unsub;
  }, []);

  return online;
}
