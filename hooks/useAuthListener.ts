/**
 * Keeps the Zustand auth store in sync with Firebase Auth state.
 * Call once, in RootLayout — never in individual screens.
 */
import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { buildAppUser } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';

export function useAuthListener() {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
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
