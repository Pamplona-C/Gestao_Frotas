import { create } from 'zustand';
import {
  signInWithEmail,
  signInWithGoogleIdToken,
  signOut,
  updatePhotoURL,
  mapFirebaseError,
} from '../services/auth.service';
import { registrarTokenFCM } from '../services/notification.service';
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
      set({ error: mapFirebaseError(err).message });
      return false;
    }
  },

  loginWithGoogle: async (idToken) => {
    set({ error: null });
    try {
      const user = await signInWithGoogleIdToken(idToken);
      set({ currentUser: user });
      registrarTokenFCM(user.uid).catch(console.warn);
      return true;
    } catch (err) {
      set({ error: mapFirebaseError(err).message });
      return false;
    }
  },

  logout: async () => {
    await signOut();
    set({ currentUser: null, error: null });
  },

  updatePhoto: async (uri, onProgress) => {
    await updatePhotoURL(uri, onProgress);
    // updatePhotoURL pode ter feito upload e gerado uma URL nova — reler do Auth
    const finalURL = auth.currentUser?.photoURL ?? uri;
    set((s) => ({
      currentUser: s.currentUser ? { ...s.currentUser, photoURL: finalURL } : null,
    }));
  },

  clearError: () => set({ error: null }),
}));
