import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
  deleteDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from './firebase';
import { User, Profile, Archetype, Transaction } from '../types';

/**
 * Seed initial tactical setup in Firestore for a newly authenticated Google operative
 */
export async function seedInitialFirestoreDataForUser(user: User): Promise<{
  defaultProfile: Profile;
  defaultArchetypes: Archetype[];
}> {
  // 1. Write user doc to /users/{uid}
  const userRef = doc(db, 'users', user.id);
  await setDoc(userRef, user, { merge: true });

  // 2. Create default Profile
  const profileId = 'prof_' + Math.random().toString(36).substring(2, 9);
  const defaultProfile: Profile = {
    id: profileId,
    name: 'Primary Tactical Vault',
    emoji: '🕵️‍♂️',
    ownerId: user.id,
    ownerEmail: user.email,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'profiles', profileId), defaultProfile);

  // 3. Create starter archetypes
  const starterArchetypesData = [
    { name: 'Agent Cocoa', emoji: '☕', matchRate: 1.0 },
    { name: 'Tactical Takeout', emoji: '🍔', matchRate: 1.0 },
    { name: 'Night Ops Bar', emoji: '🍸', matchRate: 1.5 },
    { name: 'Impulse Tech', emoji: '📱', matchRate: 2.0 },
    { name: 'Sweet Sabotage', emoji: '🍩', matchRate: 0.5 },
  ];

  const defaultArchetypes: Archetype[] = [];
  for (const arch of starterArchetypesData) {
    const archId = 'arch_' + Math.random().toString(36).substring(2, 9);
    const archDoc: Archetype = {
      id: archId,
      name: arch.name,
      emoji: arch.emoji,
      matchRate: arch.matchRate,
      ownerId: user.id,
      profileId: profileId,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'archetypes', archId), archDoc);
    defaultArchetypes.push(archDoc);
  }

  // 4. Create initial kickoff deposit
  const depositId = 'tx_' + Math.random().toString(36).substring(2, 9);
  const depositDoc: Transaction = {
    id: depositId,
    itemName: 'Mission Kickoff Reserve Seed',
    baseCost: 0,
    savingsLevy: 1000,
    totalOutflow: 0,
    archetypeId: null,
    archetypeName: null,
    archetypeEmoji: '💰',
    matchRateSnapshot: null,
    isDirectDeposit: true,
    isWithdrawal: false,
    note: 'Initial Firestore cloud reserve',
    agentId: user.id,
    profileId: profileId,
    purchaseDate: new Date().toISOString().split('T')[0],
    loggedAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'transactions', depositId), depositDoc);

  return { defaultProfile, defaultArchetypes };
}

/**
 * Fetch all profiles owned by user from Firestore
 */
export async function fetchUserProfilesFromFirestore(userId: string): Promise<Profile[]> {
  const path = 'profiles';
  try {
    const q = query(collection(db, path), where('ownerId', '==', userId));
    const snap = await getDocs(q);
    const profiles: Profile[] = [];
    snap.forEach((d) => profiles.push(d.data() as Profile));
    return profiles;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

/**
 * Fetch all archetypes for a profile from Firestore
 */
export async function fetchArchetypesFromFirestore(profileId: string): Promise<Archetype[]> {
  const path = 'archetypes';
  try {
    const q = query(collection(db, path), where('profileId', '==', profileId));
    const snap = await getDocs(q);
    const archetypes: Archetype[] = [];
    snap.forEach((d) => archetypes.push(d.data() as Archetype));
    return archetypes;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

/**
 * Fetch all transactions for a profile from Firestore
 */
export async function fetchTransactionsFromFirestore(profileId: string): Promise<Transaction[]> {
  const path = 'transactions';
  try {
    const q = query(collection(db, path), where('profileId', '==', profileId));
    const snap = await getDocs(q);
    const transactions: Transaction[] = [];
    snap.forEach((d) => transactions.push(d.data() as Transaction));
    return transactions.sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

/**
 * Subscribe to real-time transactions changes for a profile
 */
export function subscribeToTransactions(
  profileId: string,
  onUpdate: (transactions: Transaction[]) => void
): Unsubscribe {
  const path = 'transactions';
  const q = query(collection(db, path), where('profileId', '==', profileId));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Transaction[] = [];
      snapshot.forEach((doc) => {
        items.push(doc.data() as Transaction);
      });
      items.sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}
