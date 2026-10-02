import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  setLogLevel,
  Firestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';

// Set Firestore log level to avoid benign idle stream disconnection warnings
try {
  setLogLevel('error');
} catch {}
import {
  getAuth,
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { User, Profile, Archetype, Transaction } from '../types';

// Initialize Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: Initialize Firestore with explicit database ID from config
export const db: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

// Initialize Firebase Auth
export const auth: Auth = getAuth(app);

// Google Auth Provider configured for OAuth popup
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({
  prompt: 'select_account',
});

// ----------------------------------------------------
// ERROR HANDLING (Conforming to SKILL.md)
// ----------------------------------------------------
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('[Firestore Error]', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ----------------------------------------------------
// CONNECTION VALIDATION (Conforming to SKILL.md)
// ----------------------------------------------------
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[Firestore] Validated direct cloud connection to:', firebaseConfig.firestoreDatabaseId);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firestore] The client is offline or network restricted. Please check your Firebase configuration.');
      return false;
    }
    // Expected if test document does not exist or rule restricts, connection itself reached server
    return true;
  }
}

// Automatically test connection on boot
testConnection().catch(() => {});

// ----------------------------------------------------
// AUTHENTICATION HELPERS
// ----------------------------------------------------

/**
 * Sign in using Google OAuth Popup
 */
export async function signInWithGoogle(): Promise<{ firebaseUser: FirebaseUser; user: User }> {
  try {
    const result = await signInWithPopup(auth, googleAuthProvider);
    const fbUser = result.user;

    const user: User = {
      id: fbUser.uid,
      email: fbUser.email || '',
      codename: fbUser.displayName || ('Agent ' + (fbUser.email?.split('@')[0] || 'PRIME').toUpperCase()),
      photoURL: fbUser.photoURL || undefined,
      authProvider: 'google',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    // Persist user record in Firestore immediately
    await persistUserToFirestore(user);

    return { firebaseUser: fbUser, user };
  } catch (err: any) {
    console.error('[Firebase Auth] Google Sign-In failed:', err);
    throw err;
  }
}

/**
 * Sign out of Firebase Auth
 */
export async function signOutFirebase(): Promise<void> {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('[Firebase Auth] Sign out error:', err);
  }
}

/**
 * Subscribe to Firebase Auth state transitions
 */
export function onFirebaseAuthStateChanged(callback: (user: FirebaseUser | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

// ----------------------------------------------------
// FIRESTORE PERSISTENCE & SYNC OPERATIONS
// ----------------------------------------------------

/**
 * Persist or update User document in Firestore
 */
export async function persistUserToFirestore(user: User): Promise<void> {
  const path = `users/${user.id}`;
  try {
    await setDoc(
      doc(db, 'users', user.id),
      {
        ...user,
        lastLoginAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Fetch User document directly from Firestore
 */
export async function fetchUserFromFirestore(userId: string): Promise<User | null> {
  const path = `users/${userId}`;
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (!snap.exists()) return null;
    return snap.data() as User;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Persist Profile to Firestore
 */
export async function persistProfileToFirestore(profile: Profile): Promise<void> {
  const path = `profiles/${profile.id}`;
  try {
    await setDoc(doc(db, 'profiles', profile.id), profile, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Delete Profile from Firestore
 */
export async function deleteProfileFromFirestore(profileId: string): Promise<void> {
  const path = `profiles/${profileId}`;
  try {
    await deleteDoc(doc(db, 'profiles', profileId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Persist Archetype to Firestore
 */
export async function persistArchetypeToFirestore(archetype: Archetype): Promise<void> {
  const path = `archetypes/${archetype.id}`;
  try {
    await setDoc(doc(db, 'archetypes', archetype.id), archetype, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Delete Archetype from Firestore
 */
export async function deleteArchetypeFromFirestore(archetypeId: string): Promise<void> {
  const path = `archetypes/${archetypeId}`;
  try {
    await deleteDoc(doc(db, 'archetypes', archetypeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Persist Transaction to Firestore
 */
export async function persistTransactionToFirestore(transaction: Transaction): Promise<void> {
  const path = `transactions/${transaction.id}`;
  try {
    await setDoc(doc(db, 'transactions', transaction.id), transaction, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Delete Transaction from Firestore
 */
export async function deleteTransactionFromFirestore(transactionId: string): Promise<void> {
  const path = `transactions/${transactionId}`;
  try {
    await deleteDoc(doc(db, 'transactions', transactionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export { firebaseConfig };
