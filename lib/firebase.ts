/**
 * Firebase initialization — single source for all Firebase instances.
 * Import { auth, db, storage } from here; never call initializeApp elsewhere.
 */
import { getApps, getApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  type Auth,
  type Persistence,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// getReactNativePersistence está no export condicional 'react-native' do @firebase/auth.
// TypeScript resolve os tipos pelo export padrão (browser) que não o inclui,
// mas o Metro em runtime usa o bundle RN correto.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getReactNativePersistence } = require('firebase/auth') as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
};
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Avoid re-initialization on Fast Refresh
let app: FirebaseApp;
let auth: Auth;

if (!getApps().length) {
  app  = initializeApp(firebaseConfig);
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
} else {
  app  = getApp();
  auth = getAuth(app);
}

const db:      Firestore       = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

export { app, auth, db, storage };
