import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  setLogLevel,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  Firestore,
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Silence benign Firestore gRPC idle stream disconnection messages
try {
  setLogLevel('silent');
} catch {}

// Filter benign idle stream disconnection warnings from process.stderr
if (typeof process !== 'undefined' && process.stderr && process.stderr.write) {
  const origStderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = function (chunk: any, ...args: any[]): boolean {
    const str = typeof chunk === 'string' ? chunk : chunk?.toString?.() || '';
    if (
      str.includes('Disconnecting idle stream') ||
      str.includes('Timed out waiting for new targets') ||
      str.includes('GrpcConnection RPC \'Listen\' stream')
    ) {
      return true;
    }
    return (origStderrWrite as any)(chunk, ...args);
  };
}

let firestoreInstance: Firestore | null = null;
let firebaseConfig: any = null;

export function initFirestore(): Firestore | null {
  if (firestoreInstance) return firestoreInstance;

  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const configRaw = fs.readFileSync(configPath, 'utf-8');
      firebaseConfig = JSON.parse(configRaw);
      
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
      console.log('[Firestore] Connected to database:', firebaseConfig.firestoreDatabaseId || 'default');
      return firestoreInstance;
    }
  } catch (err) {
    console.warn('[Firestore] Initialization warning (falling back to durable local store):', err);
  }
  return null;
}

export function getFirestoreDb(): Firestore | null {
  return firestoreInstance || initFirestore();
}

export function getFirebaseConfig() {
  if (!firebaseConfig) {
    try {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      }
    } catch {}
  }
  return firebaseConfig;
}

// Helper to sanitize undefined values for Firestore
function sanitizeDocData(data: any): any {
  if (data === null || data === undefined) return null;
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeDocData);
  
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      clean[k] = sanitizeDocData(v);
    }
  }
  return clean;
}

// Helper to enforce timeout on cloud writes
function withTimeout<T>(promise: Promise<T>, ms: number = 3000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Cloud write timeout')), ms)),
  ]);
}

// Sync document to Firestore asynchronously (fire-and-forget or awaited)
export async function syncDocToFirestore(collectionName: string, docId: string, data: any): Promise<boolean> {
  const db = getFirestoreDb();
  if (!db) return false;

  try {
    const docRef = doc(db, collectionName, docId);
    await withTimeout(setDoc(docRef, sanitizeDocData(data), { merge: true }), 3000);
    return true;
  } catch (err: any) {
    console.warn(`[Firestore] Sync notice ${collectionName}/${docId}:`, err.message || err);
    return false;
  }
}

// Delete document from Firestore
export async function deleteDocFromFirestore(collectionName: string, docId: string): Promise<boolean> {
  const db = getFirestoreDb();
  if (!db) return false;

  try {
    const docRef = doc(db, collectionName, docId);
    await withTimeout(deleteDoc(docRef), 3000);
    return true;
  } catch (err: any) {
    console.warn(`[Firestore] Delete notice ${collectionName}/${docId}:`, err.message || err);
    return false;
  }
}

// Batch write to Firestore for scaling
export async function batchWriteToFirestore(collectionName: string, docs: Array<{ id: string; data: any }>): Promise<number> {
  const db = getFirestoreDb();
  if (!db || docs.length === 0) return 0;

  try {
    // Firestore batches allow max 500 writes
    const CHUNK_SIZE = 450;
    let written = 0;

    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
      const chunk = docs.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      for (const item of chunk) {
        const docRef = doc(db, collectionName, item.id);
        batch.set(docRef, sanitizeDocData(item.data), { merge: true });
      }

      await batch.commit();
      written += chunk.length;
    }
    return written;
  } catch (err) {
    console.error(`[Firestore] Batch write error on ${collectionName}:`, err);
    return 0;
  }
}

// Fetch a single document from Firestore
export async function fetchFirestoreDocument(collectionName: string, docId: string): Promise<any | null> {
  const db = getFirestoreDb();
  if (!db) return null;

  try {
    const docRef = doc(db, collectionName, docId);
    const snap = await withTimeout(getDoc(docRef), 2000);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (err) {
    console.error(`[Firestore] Failed to fetch doc ${collectionName}/${docId}:`, err);
    return null;
  }
}

// Fetch all documents from a Firestore collection
export async function fetchFirestoreCollection(collectionName: string): Promise<Record<string, any>> {
  const db = getFirestoreDb();
  if (!db) return {};

  try {
    const colRef = collection(db, collectionName);
    const snapshot = await withTimeout(getDocs(colRef), 2000);
    const result: Record<string, any> = {};
    snapshot.forEach((d) => {
      result[d.id] = { id: d.id, ...d.data() };
    });
    return result;
  } catch (err) {
    console.error(`[Firestore] Failed to fetch collection ${collectionName}:`, err);
    return {};
  }
}
