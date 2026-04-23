/**
 * Firebase initialization — single source for all Firebase instances.
 * Import { auth, db, storage } from here; never call initializeApp elsewhere.
 */
import { getApps, getApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  inMemoryPersistence,
  type Auth,
} from 'firebase/auth';
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
  // inMemoryPersistence works in both Expo Go and standalone builds.
  // Users must log in again after an app restart — acceptable for this prototype.
  // TODO: swap for a custom AsyncStorage persistence once native builds are enabled.
  auth = initializeAuth(app, { persistence: inMemoryPersistence });
} else {
  app  = getApp();
  auth = getAuth(app);
}

const db:      Firestore       = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

export { app, auth, db, storage };
