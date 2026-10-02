// Filter benign Firestore gRPC idle stream disconnection messages from logging to stderr
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

import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { setupLiveWebSocket } from './server/live';
import {
  getDb,
  saveDb,
  seedInitialDataForUser,
  setDocument,
  patchDocument,
  deleteDocument,
  bulkInsertDocuments,
  syncFromFirestore,
  findUser,
} from './server/db';
import { getFirebaseConfig, initFirestore } from './server/firestore';
import { User, Profile, Archetype, Transaction, DashboardMetrics, MonthlyMetric } from './src/types';
import { getRankForCapital } from './src/utils/ranks';

const app = express();
const PORT = 3000;

app.use(express.json());

// Auth Middleware
interface AuthenticatedRequest extends Request {
  user?: User;
}

async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.headers['x-agent-token'] as string);

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Operational token required' });
    return;
  }

  // Resilient lookup checking both memory cache and Cloud Firestore
  const user = await findUser(token);

  if (!user) {
    res.status(401).json({ error: 'Unauthorized: Invalid operational token' });
    return;
  }

  req.user = user;
  next();
}

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ----------------------------------------------------
// AUTH ENDPOINTS
// ----------------------------------------------------

// FR-01: Send magic link
app.post('/api/auth/send-magic-link', async (req: Request, res: Response) => {
  const { email, codename } = req.body;
  if (!email || !email.includes('@')) {
    res.status(400).json({ error: 'Valid intelligence email address required' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const token = 'sec_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const db = getDb();

  const magicDoc = {
    email: cleanEmail,
    token,
    expiresAt: Date.now() + 1000 * 60 * 60, // 1 hour
    codename: codename || 'Operative',
  };
  
  db.magicLinks[token] = magicDoc;
  saveDb();
  await setDocument('magicLinks', token, magicDoc);

  // In production/simulated environment we return the magic link directly so user can instant-verify or copy
  const appUrl = process.env.APP_URL || '';
  const magicUrl = `${appUrl}/#verify=${token}`;

  res.json({
    success: true,
    message: 'Encrypted magic link dispatched to target inbox.',
    token,
    magicUrl,
  });
});

// FR-01: Verify magic link
app.post('/api/auth/verify-magic-link', async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) {
    res.status(400).json({ error: 'Verification token required' });
    return;
  }

  const db = getDb();
  
  // 1. If token directly matches a user ID or token
  let user = await findUser(token);
  if (user && !db.magicLinks[token]) {
    res.json({
      success: true,
      token: user.id,
      user,
    });
    return;
  }

  const magicRecord = db.magicLinks[token];

  if (!magicRecord) {
    res.status(400).json({ error: 'Invalid or expired magic clearance token' });
    return;
  }

  if (Date.now() > magicRecord.expiresAt) {
    delete db.magicLinks[token];
    saveDb();
    res.status(400).json({ error: 'Magic clearance link has expired' });
    return;
  }

  // Look for existing user by email in both cache and Firestore
  user = await findUser(magicRecord.email);
  let isNew = false;

  if (!user) {
    const userId = 'usr_' + Math.random().toString(36).substring(2, 10);
    user = {
      id: userId,
      email: magicRecord.email,
      codename: magicRecord.codename || 'Agent ' + magicRecord.email.split('@')[0].toUpperCase(),
      createdAt: new Date().toISOString(),
    };
    await setDocument('users', userId, user);
    isNew = true;
    seedInitialDataForUser(user);
  }

  // Cleanup used magic link
  delete db.magicLinks[token];
  saveDb();
  deleteDocument('magicLinks', token).catch(() => {});

  res.json({
    success: true,
    token: user.id,
    user,
    isNew,
  });
});

// Demo login for fast preview
app.post('/api/auth/demo-login', async (req: Request, res: Response) => {
  const db = getDb();
  const email = (req.body.email || 'agent.shadow@mia.gov').trim().toLowerCase();
  const codename = req.body.codename || 'Agent Shadow';

  // Check if user already exists
  let user = await findUser(email);
  if (!user) {
    const userId = 'usr_agent_prime';
    user = {
      id: userId,
      email,
      codename,
      createdAt: new Date().toISOString(),
    };
    await setDocument('users', userId, user);
    seedInitialDataForUser(user);
  }

  res.json({
    success: true,
    token: user.id,
    user,
  });
});

// Firebase Auth Google Login endpoint
app.post('/api/auth/firebase-login', async (req: Request, res: Response) => {
  const { uid, email, displayName, photoURL } = req.body;
  if (!uid || !email) {
    res.status(400).json({ error: 'Operative UID and email are required for Firebase authentication' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  let user = await findUser(uid);
  if (!user) {
    user = await findUser(cleanEmail);
  }

  let isNew = false;
  if (!user) {
    user = {
      id: uid,
      email: cleanEmail,
      codename: displayName || ('Agent ' + cleanEmail.split('@')[0].toUpperCase()),
      photoURL: photoURL || undefined,
      authProvider: 'google',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    await setDocument('users', uid, user);
    isNew = true;
    seedInitialDataForUser(user);
  } else {
    // If user already existed, update login timestamp and profile attributes
    if (user.id !== uid) {
      if (!user.linkedUserIds) user.linkedUserIds = [];
      if (!user.linkedUserIds.includes(uid)) {
        user.linkedUserIds.push(uid);
      }
    }
    user.lastLoginAt = new Date().toISOString();
    if (photoURL && !user.photoURL) user.photoURL = photoURL;
    if (displayName && (!user.codename || user.codename.startsWith('Agent '))) {
      user.codename = displayName;
    }
    user.authProvider = 'google';
    await setDocument('users', user.id, user);
    if (user.id !== uid) {
      await setDocument('users', uid, user);
    }
  }

  res.json({
    success: true,
    token: user.id,
    user,
    isNew,
  });
});

// Get current user info
app.get('/api/auth/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

// ----------------------------------------------------
// PROFILES ENDPOINTS (FR-04, FR-05, FR-06, FR-07, FR-08)
// ----------------------------------------------------

app.get('/api/profiles', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  const user = req.user!;
  
  // Find all profiles owned by this user or linked user accounts or matching email
  let userProfiles = Object.values(db.profiles).filter((p) => {
    if (p.ownerId === user.id) return true;
    if (p.ownerEmail && p.ownerEmail.toLowerCase() === user.email.toLowerCase()) return true;
    if (user.linkedUserIds && user.linkedUserIds.includes(p.ownerId)) return true;
    return false;
  });

  if (userProfiles.length === 0) {
    const { defaultProfile } = seedInitialDataForUser(user);
    userProfiles = [defaultProfile];
  }

  res.json({ profiles: userProfiles });
});

// Helper to check profile authorization across primary and linked accounts
function isAuthorizedForProfile(user: User, profileId: string): boolean {
  const db = getDb();
  const profile = db.profiles[profileId];
  if (!profile) return false;
  if (profile.ownerId === user.id) return true;
  if (profile.ownerEmail && profile.ownerEmail.toLowerCase() === user.email.toLowerCase()) return true;
  if (user.linkedUserIds && user.linkedUserIds.includes(profile.ownerId)) return true;
  return false;
}

app.post('/api/profiles', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { name, emoji } = req.body;
  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Profile name is required' });
    return;
  }

  const user = req.user!;
  const profileId = 'prof_' + Math.random().toString(36).substring(2, 10);

  const newProfile: Profile = {
    id: profileId,
    name: name.trim(),
    emoji: emoji || '👤',
    ownerId: user.id,
    ownerEmail: user.email,
    createdAt: new Date().toISOString(),
  };

  await setDocument('profiles', profileId, newProfile);

  // Add default archetypes for new profile
  const starterArchetypes = [
    { name: 'Agent Cocoa', emoji: '☕', matchRate: 1.0 },
    { name: 'Tactical Takeout', emoji: '🍔', matchRate: 1.0 },
    { name: 'Night Ops Bar', emoji: '🍸', matchRate: 1.5 },
  ];

  for (const arch of starterArchetypes) {
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
    await setDocument('archetypes', archId, archDoc);
  }

  res.status(201).json({ profile: newProfile });
});

app.put('/api/profiles/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, emoji } = req.body;
  if (!isAuthorizedForProfile(req.user!, id)) {
    res.status(404).json({ error: 'Profile not found or unauthorized' });
    return;
  }

  const updates: any = {};
  if (name && name.trim()) updates.name = name.trim();
  if (emoji) updates.emoji = emoji;

  const profile = await patchDocument('profiles', id, updates);
  res.json({ profile });
});

app.delete('/api/profiles/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  const user = req.user!;

  const userProfiles = Object.values(db.profiles).filter((p) => isAuthorizedForProfile(user, p.id));
  if (userProfiles.length <= 1) {
    res.status(400).json({ error: 'Cannot delete profile: At least 1 active profile must remain (FR-08)' });
    return;
  }

  if (!isAuthorizedForProfile(user, id)) {
    res.status(404).json({ error: 'Profile not found or unauthorized' });
    return;
  }

  await deleteDocument('profiles', id);

  // Also clean up archetypes and transactions linked to this profile
  for (const [k, arch] of Object.entries(db.archetypes)) {
    if (arch.profileId === id) {
      await deleteDocument('archetypes', k);
    }
  }
  for (const [k, tx] of Object.entries(db.transactions)) {
    if (tx.profileId === id) {
      await deleteDocument('transactions', k);
    }
  }

  res.json({ success: true, message: 'Profile retired successfully' });
});

// ----------------------------------------------------
// ARCHETYPES ENDPOINTS (FR-09, FR-10, FR-11, FR-12, FR-13)
// ----------------------------------------------------

app.get('/api/archetypes', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const profileId = req.query.profileId as string;
  if (!profileId) {
    res.status(400).json({ error: 'Profile ID required' });
    return;
  }

  if (!isAuthorizedForProfile(req.user!, profileId)) {
    res.status(403).json({ error: 'Unauthorized for profile' });
    return;
  }

  const db = getDb();
  const archetypes = Object.values(db.archetypes).filter((a) => a.profileId === profileId);

  res.json({ archetypes });
});

app.post('/api/archetypes', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { profileId, name, emoji, matchRate } = req.body;
  if (!profileId || !name || !name.trim()) {
    res.status(400).json({ error: 'Profile ID and Archetype name required' });
    return;
  }

  const parsedMatchRate = typeof matchRate === 'number' ? matchRate : parseFloat(matchRate);
  if (isNaN(parsedMatchRate) || parsedMatchRate < 0 || parsedMatchRate > 10.0) {
    res.status(400).json({ error: 'Match rate must be between 0% and 1000% (0.0 to 10.0)' });
    return;
  }

  if (!isAuthorizedForProfile(req.user!, profileId)) {
    res.status(403).json({ error: 'Invalid profile authorization' });
    return;
  }

  const archId = 'arch_' + Math.random().toString(36).substring(2, 10);
  const newArchetype: Archetype = {
    id: archId,
    name: name.trim(),
    emoji: emoji || '🎯',
    matchRate: parsedMatchRate,
    ownerId: req.user!.id,
    profileId,
    createdAt: new Date().toISOString(),
  };

  await setDocument('archetypes', archId, newArchetype);

  res.status(201).json({ archetype: newArchetype });
});

app.put('/api/archetypes/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, emoji, matchRate } = req.body;
  const db = getDb();
  const archetype = db.archetypes[id];

  if (!archetype || !isAuthorizedForProfile(req.user!, archetype.profileId)) {
    res.status(404).json({ error: 'Archetype not found or unauthorized' });
    return;
  }

  const updates: any = {};
  if (name && name.trim()) {
    updates.name = name.trim();
  }
  if (emoji) {
    updates.emoji = emoji;
  }
  if (typeof matchRate === 'number' || matchRate !== undefined) {
    const rate = typeof matchRate === 'number' ? matchRate : parseFloat(matchRate);
    if (!isNaN(rate) && rate >= 0 && rate <= 10.0) {
      updates.matchRate = rate;
    }
  }

  const updated = await patchDocument('archetypes', id, updates);
  res.json({ archetype: updated });
});

// FR-13: Deleting an archetype does not remove its associated transactions
app.delete('/api/archetypes/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  const archetype = db.archetypes[id];

  if (!archetype || !isAuthorizedForProfile(req.user!, archetype.profileId)) {
    res.status(404).json({ error: 'Archetype not found or unauthorized' });
    return;
  }

  await deleteDocument('archetypes', id);
  res.json({ success: true, message: 'Archetype decommissioned. Past transactions preserved.' });
});

// ----------------------------------------------------
// TRANSACTIONS & OPERATION LEDGER (FR-14, FR-15, FR-16, FR-17, FR-18, FR-23-FR-27)
// ----------------------------------------------------

app.post('/api/transactions', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const {
    profileId,
    isDirectDeposit,
    isWithdrawal,
    archetypeId,
    itemName,
    baseCost,
    amount,
    purchaseDate,
    note,
  } = req.body;

  if (!profileId) {
    res.status(400).json({ error: 'Profile ID is required' });
    return;
  }

  if (!isAuthorizedForProfile(req.user!, profileId)) {
    res.status(403).json({ error: 'Invalid profile clearance' });
    return;
  }

  const db = getDb();
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const validatedDate = purchaseDate && dateRegex.test(purchaseDate)
    ? purchaseDate
    : new Date().toISOString().split('T')[0];

  const txId = 'tx_' + Math.random().toString(36).substring(2, 11);
  let newTx: Transaction;

  if (isWithdrawal) {
    // Vault Withdrawal / Liquidation
    const withdrawAmount = Math.max(1, Math.round(Number(amount) || Number(baseCost) || 0));
    if (withdrawAmount <= 0) {
      res.status(400).json({ error: 'Withdrawal amount must be at least Ksh 1' });
      return;
    }

    // Validation check: ensure withdrawal amount does not exceed available balance
    const existingTxs = Object.values(db.transactions).filter((t) => t.profileId === profileId);
    const availableBalance = existingTxs.reduce((sum, t) => sum + (t.savingsLevy || 0), 0);

    if (withdrawAmount > availableBalance) {
      res.status(400).json({
        error: `Withdrawal amount (Ksh ${withdrawAmount.toLocaleString()}) exceeds current available vault balance of Ksh ${availableBalance.toLocaleString()}`,
        availableBalance,
      });
      return;
    }

    newTx = {
      id: txId,
      itemName: (itemName || 'Vault Capital Withdrawal').trim(),
      baseCost: 0,
      savingsLevy: -withdrawAmount, // Negative savings levy deducts from vault balance
      totalOutflow: 0,
      archetypeId: null,
      archetypeName: null,
      archetypeEmoji: '💸',
      matchRateSnapshot: null,
      isDirectDeposit: false,
      isWithdrawal: true,
      note: (note || '').trim() || null,
      agentId: req.user!.id,
      profileId,
      purchaseDate: validatedDate,
      loggedAt: new Date().toISOString(),
    };
  } else if (isDirectDeposit) {
    // Direct deposit / Quick save (FR-18, BRD 4.2)
    const depositAmount = Math.max(1, Math.round(Number(amount) || Number(baseCost) || 0));
    if (depositAmount <= 0) {
      res.status(400).json({ error: 'Deposit amount must be greater than 0' });
      return;
    }

    newTx = {
      id: txId,
      itemName: (itemName || 'Direct Vault Deposit').trim(),
      baseCost: 0, // Direct deposits have zero base cost per BRD 4.2
      savingsLevy: depositAmount, // Pure savings
      totalOutflow: 0, // Zero outflow per BRD 4.2
      archetypeId: null,
      archetypeName: null,
      archetypeEmoji: '💰',
      matchRateSnapshot: null,
      isDirectDeposit: true,
      isWithdrawal: false,
      note: (note || '').trim() || null,
      agentId: req.user!.id,
      profileId,
      purchaseDate: validatedDate,
      loggedAt: new Date().toISOString(),
    };
  } else {
    // Vice Purchase (FR-14, FR-15, FR-16, BRD 4.1)
    if (!archetypeId) {
      res.status(400).json({ error: 'Archetype required for vice purchase' });
      return;
    }

    const archetype = db.archetypes[archetypeId];
    if (!archetype || archetype.profileId !== profileId) {
      res.status(400).json({ error: 'Selected archetype not found in profile' });
      return;
    }

    const parsedBaseCost = Math.max(1, Math.round(Number(baseCost) || 0));
    if (parsedBaseCost <= 0) {
      res.status(400).json({ error: 'Base cost must be at least Ksh 1' });
      return;
    }

    // FR-16: Server-side calculation
    const savingsLevy = Math.round(parsedBaseCost * archetype.matchRate);
    const totalOutflow = parsedBaseCost + savingsLevy;

    newTx = {
      id: txId,
      itemName: (itemName || archetype.name).trim(),
      baseCost: parsedBaseCost,
      savingsLevy,
      totalOutflow,
      archetypeId: archetype.id,
      archetypeName: archetype.name,
      archetypeEmoji: archetype.emoji,
      matchRateSnapshot: archetype.matchRate,
      isDirectDeposit: false,
      isWithdrawal: false,
      note: (note || '').trim() || null,
      agentId: req.user!.id,
      profileId,
      purchaseDate: validatedDate,
      loggedAt: new Date().toISOString(),
    };
  }

  await setDocument('transactions', txId, newTx);

  res.status(201).json({ transaction: newTx });
});

// FR-23, FR-24, FR-25, FR-27: Get paginated & searchable transactions
app.get('/api/transactions', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const profileId = req.query.profileId as string;
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
  const pageSize = Math.max(1, parseInt((req.query.pageSize as string) || '15', 10));
  const search = ((req.query.search as string) || '').trim().toLowerCase();
  const archetypeId = req.query.archetypeId as string;
  const filterType = req.query.type as string; // 'all', 'vice', 'deposit'

  if (!profileId) {
    res.status(400).json({ error: 'Profile ID required' });
    return;
  }

  if (!isAuthorizedForProfile(req.user!, profileId)) {
    res.status(403).json({ error: 'Unauthorized for profile' });
    return;
  }

  const db = getDb();
  let txList = Object.values(db.transactions).filter((t) => t.profileId === profileId);

  // Search filter by item name (FR-27)
  if (search) {
    txList = txList.filter((t) =>
      t.itemName.toLowerCase().includes(search) ||
      (t.archetypeName && t.archetypeName.toLowerCase().includes(search)) ||
      (t.note && t.note.toLowerCase().includes(search))
    );
  }

  // Archetype filter
  if (archetypeId && archetypeId !== 'all') {
    txList = txList.filter((t) => t.archetypeId === archetypeId);
  }

  // Type filter
  if (filterType === 'vice') {
    txList = txList.filter((t) => !t.isDirectDeposit && !t.isWithdrawal);
  } else if (filterType === 'deposit') {
    txList = txList.filter((t) => t.isDirectDeposit && !t.isWithdrawal);
  } else if (filterType === 'withdrawal') {
    txList = txList.filter((t) => !!t.isWithdrawal);
  }

  // Sort by purchaseDate DESC, then loggedAt DESC (FR-25)
  txList.sort((a, b) => {
    if (a.purchaseDate !== b.purchaseDate) {
      return b.purchaseDate.localeCompare(a.purchaseDate);
    }
    return b.loggedAt.localeCompare(a.loggedAt);
  });

  const total = txList.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const startIndex = (page - 1) * pageSize;
  const paginatedList = txList.slice(startIndex, startIndex + pageSize);

  // Compute profile overall totals for fast ledger summary telemetry
  const allProfileTxs = Object.values(db.transactions).filter((t) => t.profileId === profileId);
  const totalWithdrawn = allProfileTxs
    .filter((t) => t.isWithdrawal)
    .reduce((acc, t) => acc + Math.abs(t.savingsLevy || 0), 0);
  const vaultCapital = Math.max(
    0,
    allProfileTxs.reduce((acc, t) => acc + (t.savingsLevy || 0), 0)
  );

  res.json({
    transactions: paginatedList,
    total,
    page,
    pageSize,
    totalPages,
    totalWithdrawn,
    vaultCapital,
  });
});

// FR-26: Delete individual transaction
app.delete('/api/transactions/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  const tx = db.transactions[id];

  if (!tx || !isAuthorizedForProfile(req.user!, tx.profileId)) {
    res.status(404).json({ error: 'Transaction not found or unauthorized' });
    return;
  }

  await deleteDocument('transactions', id);
  res.json({ success: true, message: 'Transaction expunged from ledger.' });
});

// ----------------------------------------------------
// COMMAND CENTER DASHBOARD (FR-19, FR-20, FR-21, FR-22)
// ----------------------------------------------------

app.get('/api/dashboard', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const profileId = req.query.profileId as string;
  if (!profileId) {
    res.status(400).json({ error: 'Profile ID required' });
    return;
  }

  if (!isAuthorizedForProfile(req.user!, profileId)) {
    res.status(403).json({ error: 'Unauthorized for profile' });
    return;
  }

  const db = getDb();
  const txList = Object.values(db.transactions).filter((t) => t.profileId === profileId);

  let totalVicesLogged = 0;
  let vaultCapital = 0;
  let totalOutflow = 0;
  let viceSpending = 0;
  let totalWithdrawn = 0;
  let withdrawalCount = 0;
  let grossVaultCapital = 0;

  for (const tx of txList) {
    if (tx.isWithdrawal) {
      const amount = Math.abs(tx.savingsLevy || 0);
      totalWithdrawn += amount;
      withdrawalCount += 1;
    } else {
      grossVaultCapital += (tx.savingsLevy || 0);
    }

    vaultCapital += tx.savingsLevy || 0;

    if (!tx.isDirectDeposit && !tx.isWithdrawal) {
      totalVicesLogged += 1;
      viceSpending += tx.baseCost || 0;
      totalOutflow += tx.totalOutflow || 0;
    }
  }

  // Ensure vault capital does not drop below 0 mathematically
  vaultCapital = Math.max(0, vaultCapital);

  // Monthly Savings Rate (Savings Levy / Base Cost)
  const monthlySavingsRate = viceSpending > 0 ? Math.max(0, Math.round((vaultCapital / viceSpending) * 100)) : 100;

  // Rank progression calculation based on active vault capital
  const rankInfo = getRankForCapital(vaultCapital);

  // Generate 6-month historical chart comparison (FR-21)
  const monthlyComparison: MonthlyMetric[] = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const monthKey = `${year}-${month}`;
    const monthLabel = targetDate.toLocaleString('default', { month: 'short', year: '2-digit' });

    let mViceSpending = 0;
    let mVaultSavings = 0;
    let mTotalOutflow = 0;

    for (const tx of txList) {
      if (tx.purchaseDate && tx.purchaseDate.startsWith(monthKey)) {
        mVaultSavings += tx.savingsLevy || 0;
        if (!tx.isDirectDeposit && !tx.isWithdrawal) {
          mViceSpending += tx.baseCost || 0;
          mTotalOutflow += tx.totalOutflow || 0;
        }
      }
    }

    monthlyComparison.push({
      monthKey,
      monthLabel,
      viceSpending: mViceSpending,
      vaultSavings: mVaultSavings,
      totalOutflow: mTotalOutflow,
    });
  }

  const dashboard: DashboardMetrics = {
    totalVicesLogged,
    vaultCapital,
    totalOutflow,
    viceSpending,
    monthlySavingsRate,
    totalWithdrawn,
    withdrawalCount,
    grossVaultCapital,
    currentRank: rankInfo.currentRank,
    nextRank: rankInfo.nextRank,
    progressToNextRank: rankInfo.progress,
    capitalNeededForNextRank: rankInfo.capitalNeeded,
    monthlyComparison,
  };

  res.json(dashboard);
});

// ----------------------------------------------------
// SCALABLE DATABASE MANIPULATION & STUDIO APIS
// ----------------------------------------------------

// Get database statistics, configuration, and collection metadata
app.get('/api/db/stats', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  const config = getFirebaseConfig();

  const collections = Object.keys(db).map((colName) => {
    const docs = db[colName] || {};
    const count = Object.keys(docs).length;
    const sample = Object.values(docs)[0] || null;
    const schemaKeys = sample ? Object.keys(sample) : [];
    return {
      name: colName,
      count,
      schemaKeys,
    };
  });

  const totalDocs = collections.reduce((acc, c) => acc + c.count, 0);

  res.json({
    status: 'connected',
    provider: 'Firebase Firestore + Distributed Memory Store',
    projectId: config?.projectId || 'vivid-gate-9nm9t',
    firestoreDatabaseId: config?.firestoreDatabaseId || 'default',
    storageBucket: config?.storageBucket || '',
    collections,
    totalDocuments: totalDocs,
    serverTime: new Date().toISOString(),
    scalableModes: ['Real-time Firestore Cloud', 'High-Throughput Batch Writes', 'Dynamic Schema CRUD'],
  });
});

// List collections
app.get('/api/db/collections', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  res.json({ collections: Object.keys(db) });
});

// Create a new collection or add custom collection
app.post('/api/db/collections', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Valid collection name is required' });
    return;
  }
  const cleanName = name.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const db = getDb();
  if (!db[cleanName]) {
    db[cleanName] = {};
    saveDb();
  }
  res.json({ success: true, collection: cleanName });
});

// Query collection documents with filters, sorting, search, and pagination
app.get('/api/db/collections/:name/documents', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { name } = req.params;
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
  const pageSize = Math.max(1, Math.min(500, parseInt((req.query.pageSize as string) || '25', 10)));
  const search = ((req.query.search as string) || '').trim().toLowerCase();
  const filterKey = (req.query.filterKey as string) || '';
  const filterOp = (req.query.filterOp as string) || '=='; // ==, !=, >, <, contains
  const filterVal = req.query.filterVal as string | undefined;
  const sortKey = (req.query.sortKey as string) || '';
  const sortDir = (req.query.sortDir as string) === 'desc' ? 'desc' : 'asc';

  const db = getDb();
  const rawCollection = db[name] || {};
  let docs = Object.values(rawCollection);

  // Search across all string values
  if (search) {
    docs = docs.filter((d) =>
      JSON.stringify(d).toLowerCase().includes(search)
    );
  }

  // Filter by field
  if (filterKey && filterVal !== undefined && filterVal !== '') {
    docs = docs.filter((d) => {
      const val = d[filterKey];
      if (val === undefined || val === null) return false;

      if (filterOp === '==') {
        return String(val).toLowerCase() === String(filterVal).toLowerCase();
      }
      if (filterOp === '!=') {
        return String(val).toLowerCase() !== String(filterVal).toLowerCase();
      }
      if (filterOp === 'contains') {
        return String(val).toLowerCase().includes(String(filterVal).toLowerCase());
      }
      if (filterOp === '>') {
        return Number(val) > Number(filterVal);
      }
      if (filterOp === '<') {
        return Number(val) < Number(filterVal);
      }
      if (filterOp === '>=') {
        return Number(val) >= Number(filterVal);
      }
      if (filterOp === '<=') {
        return Number(val) <= Number(filterVal);
      }
      return true;
    });
  }

  // Sorting
  if (sortKey) {
    docs.sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;
      
      const comparison = typeof valA === 'number' && typeof valB === 'number'
        ? valA - valB
        : String(valA).localeCompare(String(valB));
      
      return sortDir === 'desc' ? -comparison : comparison;
    });
  }

  const total = docs.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const startIndex = (page - 1) * pageSize;
  const paginatedDocs = docs.slice(startIndex, startIndex + pageSize);

  res.json({
    collection: name,
    documents: paginatedDocs,
    total,
    page,
    pageSize,
    totalPages,
  });
});

// Get single document
app.get('/api/db/collections/:name/documents/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { name, id } = req.params;
  const db = getDb();
  const doc = db[name]?.[id];

  if (!doc) {
    res.status(404).json({ error: `Document ${id} not found in collection ${name}` });
    return;
  }

  res.json({ document: doc });
});

// Create/Upsert document
app.post('/api/db/collections/:name/documents', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { name } = req.params;
  const { data, id } = req.body;

  if (!data || typeof data !== 'object') {
    res.status(400).json({ error: 'Document data must be an object' });
    return;
  }

  const docId = id || data.id || `${name.slice(0, 4)}_${Math.random().toString(36).substring(2, 10)}`;
  const saved = await setDocument(name, docId, data);

  res.status(201).json({ success: true, document: saved });
});

// Replace document (PUT)
app.put('/api/db/collections/:name/documents/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { name, id } = req.params;
  const data = req.body;

  if (!data || typeof data !== 'object') {
    res.status(400).json({ error: 'Document data must be an object' });
    return;
  }

  const saved = await setDocument(name, id, data);
  res.json({ success: true, document: saved });
});

// Patch document fields (PATCH)
app.patch('/api/db/collections/:name/documents/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { name, id } = req.params;
  const updates = req.body;

  try {
    const updated = await patchDocument(name, id, updates);
    res.json({ success: true, document: updated });
  } catch (err: any) {
    res.status(404).json({ error: err.message || 'Update failed' });
  }
});

// Delete document
app.delete('/api/db/collections/:name/documents/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { name, id } = req.params;
  const success = await deleteDocument(name, id);

  if (!success) {
    res.status(404).json({ error: `Document ${id} not found in collection ${name}` });
    return;
  }

  res.json({ success: true, message: `Document ${id} deleted successfully from ${name}` });
});

// Bulk seed generator for testing database scale (e.g. 50, 100, 500 records)
app.post('/api/db/collections/:name/bulk-seed', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { name } = req.params;
  const count = Math.min(1000, Math.max(1, parseInt(req.body.count || '50', 10)));
  const profileId = req.body.profileId;
  const userId = req.user!.id;

  const generatedDocs: any[] = [];
  const now = Date.now();

  const viceItems = [
    { name: 'Cold Nitro Brew', base: 450, emoji: '☕', rate: 1.0 },
    { name: 'Late Night Slice & Soda', base: 650, emoji: '🍕', rate: 1.0 },
    { name: 'Double Caramel Macchiato', base: 520, emoji: '☕', rate: 1.2 },
    { name: 'Artisan Burger & Truffle Fries', base: 1200, emoji: '🍔', rate: 1.5 },
    { name: 'Espresso Tonic Refresh', base: 380, emoji: '☕', rate: 1.0 },
    { name: 'Tactical Energy Bar & Shake', base: 500, emoji: '⚡', rate: 0.8 },
    { name: 'Craft Cocktail Intercept', base: 950, emoji: '🍸', rate: 2.0 },
    { name: 'Gadget Impulse Acquisition', base: 3500, emoji: '📱', rate: 2.5 },
  ];

  for (let i = 0; i < count; i++) {
    const isDirectDeposit = Math.random() < 0.15; // 15% quick saves
    const daysAgo = Math.floor(Math.random() * 120); // within last 4 months
    const item = viceItems[Math.floor(Math.random() * viceItems.length)];
    const pDate = new Date(now - daysAgo * 86400000).toISOString().split('T')[0];

    if (name === 'transactions') {
      const baseCost = isDirectDeposit ? 0 : Math.round(item.base * (0.8 + Math.random() * 0.6));
      const savingsLevy = isDirectDeposit
        ? Math.round(500 + Math.random() * 2500)
        : Math.round(baseCost * item.rate);
      const totalOutflow = isDirectDeposit ? 0 : baseCost + savingsLevy;

      generatedDocs.push({
        id: `tx_${Math.random().toString(36).substring(2, 11)}`,
        itemName: isDirectDeposit ? 'Automated Scaled Vault Save' : item.name,
        baseCost,
        savingsLevy,
        totalOutflow,
        archetypeId: isDirectDeposit ? null : `arch_${Math.random().toString(36).substring(2, 8)}`,
        archetypeName: isDirectDeposit ? null : item.name.split(' ')[0],
        archetypeEmoji: isDirectDeposit ? '💰' : item.emoji,
        matchRateSnapshot: isDirectDeposit ? null : item.rate,
        isDirectDeposit,
        note: `Synthetic Scale Test Record #${i + 1}`,
        agentId: userId,
        profileId: profileId || 'prof_default',
        purchaseDate: pDate,
        loggedAt: new Date(now - daysAgo * 86400000).toISOString(),
      });
    } else {
      // Generic document structure for any other collection
      generatedDocs.push({
        id: `${name.slice(0, 4)}_${Math.random().toString(36).substring(2, 11)}`,
        title: `Synthetic Scaled Entity #${i + 1}`,
        category: 'Scale Testing',
        value: Math.round(Math.random() * 10000),
        status: Math.random() > 0.5 ? 'ACTIVE' : 'COMPLETED',
        createdAt: new Date(now - daysAgo * 86400000).toISOString(),
        ownerId: userId,
        metadata: {
          batchId: `batch_${now}`,
          seq: i + 1,
        },
      });
    }
  }

  const insertedCount = await bulkInsertDocuments(name, generatedDocs);

  res.json({
    success: true,
    message: `Generated and scaled ${insertedCount} documents in collection '${name}'`,
    count: insertedCount,
  });
});

// Bulk delete documents
app.post('/api/db/collections/:name/bulk-delete', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { name } = req.params;
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'Array of document ids required' });
    return;
  }

  let deleted = 0;
  for (const id of ids) {
    const success = await deleteDocument(name, id);
    if (success) deleted++;
  }

  res.json({ success: true, deletedCount: deleted });
});

// Export Database / Collection
app.get('/api/db/export', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const collectionName = req.query.collection as string;
  const db = getDb();

  if (collectionName) {
    const data = db[collectionName] || {};
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${collectionName}_export.json"`);
    res.json(data);
    return;
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="mia_database_backup.json"');
  res.json(db);
});

// Import Database / Collection
app.post('/api/db/import', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { collectionName, data } = req.body;

  if (!data || typeof data !== 'object') {
    res.status(400).json({ error: 'Import payload must be an object or array' });
    return;
  }

  let totalImported = 0;

  if (collectionName) {
    const items = Array.isArray(data) ? data : Object.values(data);
    totalImported = await bulkInsertDocuments(collectionName, items as any);
  } else {
    // Multi-collection import
    for (const [col, colData] of Object.entries(data)) {
      if (typeof colData === 'object' && colData !== null) {
        const items = Array.isArray(colData) ? colData : Object.values(colData);
        const count = await bulkInsertDocuments(col, items as any);
        totalImported += count;
      }
    }
  }

  res.json({ success: true, message: `Successfully imported ${totalImported} documents` });
});

// Force two-way sync with Firebase Firestore
app.post('/api/db/sync-firestore', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await syncFromFirestore();
    res.json({
      success: true,
      message: 'Two-way cloud synchronization with Firebase Firestore completed.',
      result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Sync failed' });
  }
});

// ----------------------------------------------------
// VITE MIDDLEWARE & SERVER STARTUP
// ----------------------------------------------------

async function startServer() {
  console.log('[M.I.A.] Booting server: Synchronizing with Google Cloud Firestore...');
  try {
    await syncFromFirestore();
    console.log('[M.I.A.] Firestore cloud persistence synchronized successfully.');
  } catch (err: any) {
    console.error('[M.I.A.] Warning during initial Firestore sync:', err?.message || err);
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);
  setupLiveWebSocket(server);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[M.I.A. Command Server] Active on port ${PORT}`);
  });
}

startServer();
