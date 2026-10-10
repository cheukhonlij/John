import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  Firestore,
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

// Cloud mode switches on when a Firebase project is configured through
// VITE_FIREBASE_* variables (see .env.example). Without them the app keeps
// everything in this browser's localStorage, as before.

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const cloudEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

const useEmulator = import.meta.env.VITE_FIREBASE_EMULATOR === 'true';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (cloudEnabled) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = initializeFirestore(app, {
    // Firestore rejects undefined fields; our records use undefined for "not set".
    ignoreUndefinedProperties: true,
    // Keep working offline on the shop floor and sync when back online.
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  if (useEmulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
}

export const getFirebase = () => {
  if (!app || !auth || !db) throw new Error('Firebase is not configured');
  return { app, auth, db, useEmulator };
};
