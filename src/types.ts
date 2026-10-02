export interface User {
  id: string;
  email: string;
  codename: string;
  photoURL?: string;
  authProvider?: 'google' | 'magic_link' | 'demo';
  createdAt: string;
  lastLoginAt?: string;
  primaryUserId?: string;
  linkedUserIds?: string[];
}

export interface Profile {
  id: string;
  name: string;
  emoji: string;
  ownerId: string;
  ownerEmail?: string;
  createdAt: string;
}

export interface Archetype {
  id: string;
  name: string;
  emoji: string;
  matchRate: number; // e.g. 1.0 = 100%, 0.5 = 50%, 2.0 = 200%
  ownerId: string;
  profileId: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  itemName: string;
  baseCost: number; // Ksh
  savingsLevy: number; // Ksh
  totalOutflow: number; // Ksh (Base Cost + Savings Levy; 0 for direct deposits)
  archetypeId: string | null;
  archetypeName?: string | null;
  archetypeEmoji?: string | null;
  matchRateSnapshot?: number | null;
  isDirectDeposit: boolean;
  isWithdrawal?: boolean;
  note?: string | null;
  agentId: string;
  profileId: string;
  purchaseDate: string; // YYYY-MM-DD
  loggedAt: string; // ISO
}

export interface AgencyRank {
  rank: string;
  code: string;
  threshold: number;
  nextThreshold: number | null;
  description: string;
  badge: string;
  color: string;
}

export interface MonthlyMetric {
  monthKey: string; // e.g. '2026-08'
  monthLabel: string; // e.g. 'Aug 2026'
  viceSpending: number;
  vaultSavings: number;
  totalOutflow: number;
}

export interface DashboardMetrics {
  totalVicesLogged: number;
  vaultCapital: number;
  totalOutflow: number;
  viceSpending: number;
  monthlySavingsRate: number; // percentage
  totalWithdrawn: number;
  withdrawalCount: number;
  grossVaultCapital: number;
  currentRank: AgencyRank;
  nextRank: AgencyRank | null;
  progressToNextRank: number; // 0 to 100
  capitalNeededForNextRank: number;
  monthlyComparison: MonthlyMetric[];
}

export interface PaginatedTransactions {
  transactions: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  totalWithdrawn?: number;
  vaultCapital?: number;
}

export interface CollectionMeta {
  name: string;
  count: number;
  schemaKeys: string[];
}

export interface DatabaseStats {
  status: string;
  provider: string;
  projectId: string;
  firestoreDatabaseId: string;
  storageBucket: string;
  collections: CollectionMeta[];
  totalDocuments: number;
  serverTime: string;
  scalableModes: string[];
}

export interface PaginatedCollectionDocs {
  collection: string;
  documents: any[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

