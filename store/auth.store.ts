import { create } from 'zustand';
import {
  AUTH_BACKEND,
  signInWithEmail,
  signInWithGoogleIdToken,
  signOut,
  updatePhotoURL,
  mapAuthError,
} from '../services/auth.service';
import { registrarTokenFCM, removerTokenDispositivo } from '../services/notification.service';
import { auth } from '../lib/firebase';
import { AppUser } from '../types';

interface AuthState {
  currentUser:    AppUser | null;
  loading:        boolean;
  error:          string | null;

  // Called by useAuthListener — never call directly from UI
  setUser:        (user: AppUser | null) => void;
  setLoading:     (loading: boolean) => void;

  login:          (email: string, password: string) => Promise<boolean>;
  loginWithGoogle:(idToken: string) => Promise<boolean>;
  logout:         () => Promise<void>;
  updatePhoto:    (uri: string | null, onProgress?: (pct: number) => void) => Promise<void>;
  clearError:     () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  loading:     true,   // true until onAuthStateChanged fires
  error:       null,

  setUser:    (user) => set({ currentUser: user }),
  setLoading: (loading) => set({ loading }),

  login: async (email, password) => {
    set({ error: null });
    try {
      const user = await signInWithEmail(email, password);
      set({ currentUser: user });
      registrarTokenFCM(user.uid).catch(console.warn);
      return true;
    } catch (err) {
      set({ error: mapAuthError(err).message });
      return false;
    }
  },

  // Aposentado: não haverá login por Google. Mantido só enquanto o caminho
  // Firebase existir — a tela de login já não oferece o botão.
  loginWithGoogle: async (idToken) => {
    if (AUTH_BACKEND) {
      set({ error: 'Login com Google não está mais disponível.' });
      return false;
    }
    set({ error: null });
    try {
      const user = await signInWithGoogleIdToken(idToken);
      set({ currentUser: user });
      registrarTokenFCM(user.uid).catch(console.warn);
      return true;
    } catch (err) {
      set({ error: mapAuthError(err).message });
      return false;
    }
  },

  logout: async () => {
    // Antes de descartar a sessão: para de receber push neste aparelho.
    await removerTokenDispositivo().catch(console.warn);
    await signOut();
    set({ currentUser: null, error: null });
  },

  updatePhoto: async (uri, onProgress) => {
    // A URL final vem de quem gravou — o upload gera uma URL nova, diferente da
    // URI local. Guardar a URI local aqui era o motivo de a foto sumir ao
    // reabrir o app: ela só existia no aparelho, nunca no servidor.
    const gravada = await updatePhotoURL(uri, onProgress);
    const finalURL = gravada ?? (!AUTH_BACKEND ? auth.currentUser?.photoURL : null) ?? uri;
    set((s) => ({
      currentUser: s.currentUser ? { ...s.currentUser, photoURL: finalURL } : null,
    }));
  },

  clearError: () => set({ error: null }),
}));
