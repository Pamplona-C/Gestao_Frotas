/**
 * Auth Service — toda chamada ao Firebase Auth e ao Firestore de perfil
 * passa por aqui. Componentes e stores nunca importam firebase/auth diretamente.
 */
import {
  signInWithEmailAndPassword,
  signOut            as fbSignOut,
  GoogleAuthProvider,
  signInWithCredential,
  updatePassword     as fbUpdatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updateProfile,
  createUserWithEmailAndPassword,
  getAuth,
} from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import type { FirebaseError } from '@firebase/util';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { app, auth, db } from '../lib/firebase';
import { AppUser, UserPerfil, UserProfile } from '../types';

// ── Erros tipados ──────────────────────────────────────────────────────────────

export interface AuthServiceError {
  code:    string;
  message: string;
}

export function mapFirebaseError(err: unknown): AuthServiceError {
  const fe = err as FirebaseError;
  switch (fe?.code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return { code: fe.code, message: 'E-mail ou senha incorretos.' };
    case 'auth/too-many-requests':
      return { code: fe.code, message: 'Muitas tentativas. Aguarde e tente novamente.' };
    case 'auth/network-request-failed':
      return { code: fe.code, message: 'Sem conexão. Verifique sua internet.' };
    case 'auth/requires-recent-login':
      return { code: fe.code, message: 'Faça login novamente para realizar esta ação.' };
    case 'auth/email-already-in-use':
      return { code: fe.code, message: 'E-mail já cadastrado.' };
    default:
      return { code: fe?.code ?? 'unknown', message: 'Erro inesperado. Tente novamente.' };
  }
}

// ── Perfil no Firestore ────────────────────────────────────────────────────────

// TODO: replace with api.get('/usuarios/:uid')
export async function getUserProfile(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, 'usuarios', uid));
  if (!snap.exists()) return null;
  const d = snap.data() as UserProfile;
  return {
    uid,
    id:          uid,  // backward-compat
    nome:        d.nome        ?? '',
    email:       d.email       ?? '',
    perfil:      d.perfil      as UserPerfil,
    departamento: d.departamento ?? '',
    photoURL:    d.photoURL    ?? null,
  };
}

// TODO: replace with api.post('/usuarios')
export async function createUserProfile(
  uid: string,
  data: Omit<UserProfile, 'photoURL'>
): Promise<void> {
  await setDoc(doc(db, 'usuarios', uid), {
    ...data,
    photoURL:  null,
    criadoEm:  serverTimestamp(),
  });
}

/**
 * Monta o AppUser combinando Firebase Auth + Firestore.
 * Se o perfil ainda não existir no Firestore, cria um stub de 'condutor'.
 * TODO: redirecionar para onboarding quando perfil não existir.
 */
export async function buildAppUser(
  uid: string,
  fallback: { displayName?: string | null; email?: string | null; photoURL?: string | null }
): Promise<AppUser> {
  const profile = await getUserProfile(uid);
  if (profile) {
    // Foto do Firebase Auth sobrepõe Firestore (atualizada pelo updateProfile)
    return { ...profile, photoURL: fallback.photoURL ?? profile.photoURL };
  }

  // Perfil não encontrado — cria documento no Firestore com perfil padrão 'condutor'
  const stub = {
    nome:         fallback.displayName ?? fallback.email ?? 'Usuário',
    email:        fallback.email ?? '',
    perfil:       'condutor' as const,
    departamento: '',
  };
  await createUserProfile(uid, stub);

  return {
    uid,
    id:          uid,
    ...stub,
    photoURL:    fallback.photoURL ?? null,
  };
}

// ── Email / Senha ──────────────────────────────────────────────────────────────

// TODO: replace with api.post('/auth/login')
export async function signInWithEmail(
  email:    string,
  password: string
): Promise<AppUser> {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  return buildAppUser(user.uid, {
    displayName: user.displayName,
    email:       user.email,
    photoURL:    user.photoURL,
  });
}

// ── Google ─────────────────────────────────────────────────────────────────────

// TODO: replace with api.post('/auth/google')
export async function signInWithGoogleIdToken(idToken: string): Promise<AppUser> {
  const credential = GoogleAuthProvider.credential(idToken);
  const { user }   = await signInWithCredential(auth, credential);
  return buildAppUser(user.uid, {
    displayName: user.displayName,
    email:       user.email,
    photoURL:    user.photoURL,
  });
}

// ── Sign-out ───────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  await fbSignOut(auth);
}

// ── Alterar senha ──────────────────────────────────────────────────────────────

// TODO: replace with api.put('/auth/senha')
export async function changePassword(
  currentPassword: string,
  newPassword:     string
): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email) throw { code: 'auth/no-user', message: 'Usuário não autenticado.' };

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await fbUpdatePassword(user, newPassword);
}

// ── Criar conta (gestor cria para condutor) ────────────────────────────────────

/**
 * Cria uma conta Firebase Auth + perfil Firestore sem deslogar o gestor atual.
 * Usa uma instância secundária do Firebase App para o registro.
 */
export async function createUserAccount(data: {
  nome:         string;
  email:        string;
  senha:        string;
  perfil:       UserPerfil;
  departamento: string;
}): Promise<void> {
  // Instância temporária para não afetar a sessão do gestor
  const secondaryApp  = initializeApp(app.options, `create-user-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const { user } = await createUserWithEmailAndPassword(secondaryAuth, data.email, data.senha);
    await updateProfile(user, { displayName: data.nome });
    await createUserProfile(user.uid, {
      nome:         data.nome,
      email:        data.email,
      perfil:       data.perfil,
      departamento: data.departamento,
    });
  } finally {
    await deleteApp(secondaryApp);
  }
}

// ── Foto de perfil ─────────────────────────────────────────────────────────────

export async function getUserById(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'usuarios', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function updatePhotoURL(
  localUriOrNull: string | null,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  let photoURL: string | null = localUriOrNull;

  if (localUriOrNull && localUriOrNull.startsWith('http')) {
    // Já é uma URL remota (ex: Google Sign-In ou placehold.co no web) — usar direto
    photoURL = localUriOrNull;
  } else if (localUriOrNull) {
    // URI local do device — fazer upload para Storage
    const { uploadFotoPerfil } = await import('./storage.service');
    photoURL = await uploadFotoPerfil(localUriOrNull, user.uid, onProgress);
  }

  await updateProfile(user, { photoURL: photoURL ?? '' });
  await updateDoc(doc(db, 'usuarios', user.uid), { photoURL });
}
