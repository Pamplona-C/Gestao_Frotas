/**
 * Mantém o store de auth em sincronia com a sessão. Chame uma vez, no
 * RootLayout — nunca dentro de telas.
 *
 * Há dois caminhos, escolhidos pela flag EXPO_PUBLIC_AUTH_BACKEND:
 *
 *  - **Firebase** (padrão): escuta `onAuthStateChanged`, que dispara sozinho a
 *    cada mudança de sessão.
 *  - **Backend**: não existe "listener" — o JWT está guardado no aparelho.
 *    Lemos a sessão uma vez no boot e perguntamos ao backend quem é o usuário.
 *    A morte da sessão chega pelo callback do cliente HTTP, quando o refresh
 *    é recusado.
 */
import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { AUTH_BACKEND, buildAppUser, restaurarSessao } from '../services/auth.service';
import { aoExpirarSessao } from '../services/auth.backend';
import { useAuthStore } from '../store/auth.store';

export function useAuthListener() {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    if (AUTH_BACKEND) {
      let cancelado = false;

      // Sessão derrubada pelo servidor (refresh expirado/revogado, usuário
      // desativado): o cliente HTTP avisa e a navegação cai para o login.
      aoExpirarSessao(() => {
        if (!cancelado) setUser(null);
      });

      (async () => {
        try {
          const usuario = await restaurarSessao();
          if (!cancelado) setUser(usuario);
        } catch {
          // Sem rede no boot: não desloga: a sessão guardada continua válida.
          if (!cancelado) setUser(null);
        } finally {
          if (!cancelado) setLoading(false);
        }
      })();

      return () => {
        cancelado = true;
      };
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const appUser = await buildAppUser(firebaseUser.uid, {
            displayName: firebaseUser.displayName,
            email:       firebaseUser.email,
            photoURL:    firebaseUser.photoURL,
          });
          setUser(appUser);
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
