import fs from 'fs';
import path from 'path';
import { User, Profile, Archetype, Transaction } from '../src/types';
import {
  initFirestore,
  getFirestoreDb,
  getFirebaseConfig,
  syncDocToFirestore,
  deleteDocFromFirestore,
  batchWriteToFirestore,
  fetchFirestoreCollection,
  fetchFirestoreDocument,
} from './firestore';

export interface DatabaseSchema {
  users: Record<string, User>;
  magicLinks: Record<string, { email: string; token: string; expiresAt: number; codename?: string }>;
  profiles: Record<string, Profile>;
  archetypes: Record<string, Archetype>;
  transactions: Record<string, Transaction>;
  [customCollection: string]: Record<string, any>;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const INITIAL_DATA: DatabaseSchema = {
  users: {},
  magicLinks: {},
  profiles: {},
  archetypes: {},
  transactions: {},
};

function ensureDb(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DATA, null, 2), 'utf-8');
    return INITIAL_DATA;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      ...INITIAL_DATA,
      ...parsed,
    };
  } catch (err) {
    console.error('Error reading db.json, reinitializing:', err);
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DATA, null, 2), 'utf-8');
    return INITIAL_DATA;
  }
}

let memoryDb: DatabaseSchema = ensureDb();

// Initialize Firestore connection
initFirestore();

export function getDb(): DatabaseSchema {
  return memoryDb;
}

export function saveDb(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(memoryDb, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Error saving db.json:', err);
  }
}

// ----------------------------------------------------
// MANIPULATION APIS & REAL-TIME SYNC
// ----------------------------------------------------

export async function setDocument(collectionName: string, docId: string, data: any): Promise<any> {
  if (!memoryDb[collectionName]) {
    memoryDb[collectionName] = {};
  }
  const cleanData = { ...data, id: docId };
  memoryDb[collectionName][docId] = cleanData;
  saveDb();

  // Asynchronously sync to Firestore to ensure instant API responsiveness
  syncDocToFirestore(collectionName, docId, cleanData).catch((e: any) => {
    console.warn(`[Firestore sync error] ${collectionName}/${docId}:`, e?.message || e);
  });

  return cleanData;
}

export async function patchDocument(collectionName: string, docId: string, updates: any): Promise<any> {
  if (!memoryDb[collectionName] || !memoryDb[collectionName][docId]) {
    throw new Error(`Document ${docId} not found in collection ${collectionName}`);
  }

  const existing = memoryDb[collectionName][docId];
  const merged = { ...existing, ...updates, id: docId };
  memoryDb[collectionName][docId] = merged;
  saveDb();

  syncDocToFirestore(collectionName, docId, merged).catch((e: any) => {
    console.warn(`[Firestore sync error] ${collectionName}/${docId}:`, e?.message || e);
  });

  return merged;
}

export async function deleteDocument(collectionName: string, docId: string): Promise<boolean> {
  if (memoryDb[collectionName] && memoryDb[collectionName][docId]) {
    delete memoryDb[collectionName][docId];
    saveDb();

    deleteDocFromFirestore(collectionName, docId).catch((e: any) => {
      console.warn(`[Firestore delete error] ${collectionName}/${docId}:`, e?.message || e);
    });
    return true;
  }
  return false;
}

export async function bulkInsertDocuments(
  collectionName: string,
  documents: Array<{ id?: string; [key: string]: any }>
): Promise<number> {
  if (!memoryDb[collectionName]) {
    memoryDb[collectionName] = {};
  }

  const firestoreBatchItems: Array<{ id: string; data: any }> = [];

  for (const doc of documents) {
    const id = doc.id || `${collectionName.slice(0, 4)}_${Math.random().toString(36).substring(2, 11)}`;
    const fullDoc = { ...doc, id };
    memoryDb[collectionName][id] = fullDoc;
    firestoreBatchItems.push({ id, data: fullDoc });
  }

  saveDb();

  try {
    await batchWriteToFirestore(collectionName, firestoreBatchItems);
  } catch (e: any) {
    console.warn(`[Firestore batch sync error] ${collectionName}:`, e.message);
  }

  return documents.length;
}

export async function syncFromFirestore(): Promise<{ collectionsSynced: string[]; totalDocs: number }> {
  const collections = ['users', 'profiles', 'archetypes', 'transactions'];
  let totalDocs = 0;

  for (const col of collections) {
    try {
      const remoteDocs = await fetchFirestoreCollection(col);
      const count = Object.keys(remoteDocs).length;
      if (count > 0) {
        if (!memoryDb[col]) memoryDb[col] = {};
        Object.assign(memoryDb[col], remoteDocs);
        totalDocs += count;
      }
    } catch (err) {
      console.error(`[Firestore] Sync error on collection ${col}:`, err);
    }
  }

  saveDb();
  console.log(`[Firestore] Cloud synchronization complete. Ingested ${totalDocs} documents across ${collections.length} collections.`);
  return { collectionsSynced: collections, totalDocs };
}

// Resilient user search across local cache & cloud Firestore
export async function findUser(identifier: string): Promise<User | null> {
  const cleanId = identifier.trim().toLowerCase();
  
  // 1. Check local cache
  const localMatch = Object.values(memoryDb.users).find(
    (u) =>
      u.id === identifier ||
      `agent_${u.id}` === identifier ||
      u.email.toLowerCase() === cleanId ||
      (u.linkedUserIds && u.linkedUserIds.includes(identifier))
  );
  if (localMatch) return localMatch;

  // 2. Query Firestore directly
  try {
    const directUser = await fetchFirestoreDocument('users', identifier);
    if (directUser) {
      memoryDb.users[directUser.id] = directUser;
      saveDb();
      return directUser;
    }

    const allUsers = await fetchFirestoreCollection('users');
    for (const u of Object.values(allUsers) as any[]) {
      if (
        u.id === identifier ||
        `agent_${u.id}` === identifier ||
        (u.email && u.email.toLowerCase() === cleanId) ||
        (u.linkedUserIds && u.linkedUserIds.includes(identifier))
      ) {
        memoryDb.users[u.id] = u;
        saveDb();
        return u;
      }
    }
  } catch (err) {
    console.warn('[Firestore] Error finding user in cloud store:', err);
  }

  return null;
}

export function seedInitialDataForUser(user: User): { defaultProfile: Profile; defaultArchetypes: Archetype[] } {
  // Sync user doc
  setDocument('users', user.id, user);

  // Create default profile "My Account"
  const profileId = 'prof_' + Math.random().toString(36).substring(2, 9);
  const defaultProfile: Profile = {
    id: profileId,
    name: 'My Account',
    emoji: '🕵️‍♂️',
    ownerId: user.id,
    createdAt: new Date().toISOString(),
  };
  setDocument('profiles', profileId, defaultProfile);

  // Seed standard starter archetypes
  const starterArchetypes = [
    { name: 'Agent Cocoa', emoji: '☕', matchRate: 1.0 },
    { name: 'Tactical Takeout', emoji: '🍔', matchRate: 1.0 },
    { name: 'Night Ops Bar', emoji: '🍸', matchRate: 1.5 },
    { name: 'Impulse Tech', emoji: '📱', matchRate: 2.0 },
    { name: 'Sweet Sabotage', emoji: '🍩', matchRate: 0.5 },
  ];

  const defaultArchetypes: Archetype[] = [];
  for (const arch of starterArchetypes) {
    const archId = 'arch_' + Math.random().toString(36).substring(2, 9);
    const newArch: Archetype = {
      id: archId,
      name: arch.name,
      emoji: arch.emoji,
      matchRate: arch.matchRate,
      ownerId: user.id,
      profileId: profileId,
      createdAt: new Date().toISOString(),
    };
    setDocument('archetypes', archId, newArch);
    defaultArchetypes.push(newArch);
  }

  const now = new Date();
  const getPastDate = (daysAgo: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  const seedTxs = [
    { item: 'Espresso Double Shot', base: 350, archIndex: 0, daysAgo: 1 },
    { item: 'Covert Burger Meal', base: 850, archIndex: 1, daysAgo: 3 },
    { item: 'Dark Roast Cold Brew', base: 400, archIndex: 0, daysAgo: 8 },
    { item: 'Late Night Fuel Box', base: 650, archIndex: 1, daysAgo: 14 },
    { item: 'Wireless Earbuds Intercept', base: 2500, archIndex: 3, daysAgo: 25 },
    { item: 'Midnight Gelato', base: 450, archIndex: 4, daysAgo: 38 },
  ];

  for (const item of seedTxs) {
    const arch = defaultArchetypes[item.archIndex];
    const txId = 'tx_' + Math.random().toString(36).substring(2, 9);
    const savingsLevy = Math.round(item.base * arch.matchRate);
    const totalOutflow = item.base + savingsLevy;
    const pDate = getPastDate(item.daysAgo);

    const txDoc: Transaction = {
      id: txId,
      itemName: item.item,
      baseCost: item.base,
      savingsLevy: savingsLevy,
      totalOutflow: totalOutflow,
      archetypeId: arch.id,
      archetypeName: arch.name,
      archetypeEmoji: arch.emoji,
      matchRateSnapshot: arch.matchRate,
      isDirectDeposit: false,
      agentId: user.id,
      profileId: profileId,
      purchaseDate: pDate,
      loggedAt: new Date(Date.now() - item.daysAgo * 86400000).toISOString(),
    };
    setDocument('transactions', txId, txDoc);
  }

  const depositTxId = 'tx_' + Math.random().toString(36).substring(2, 9);
  const depositDoc: Transaction = {
    id: depositTxId,
    itemName: 'Mission Kickoff Quick Save',
    baseCost: 0,
    savingsLevy: 1000,
    totalOutflow: 0,
    archetypeId: null,
    archetypeName: null,
    archetypeEmoji: '💰',
    matchRateSnapshot: null,
    isDirectDeposit: true,
    note: 'Initial vault asset seed',
    agentId: user.id,
    profileId: profileId,
    purchaseDate: getPastDate(20),
    loggedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
  };
  setDocument('transactions', depositTxId, depositDoc);

  return { defaultProfile, defaultArchetypes };
}
