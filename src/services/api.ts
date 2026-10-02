import {
  Archetype,
  DashboardMetrics,
  PaginatedTransactions,
  Profile,
  Transaction,
  User,
  DatabaseStats,
  PaginatedCollectionDocs,
} from '../types';

const TOKEN_KEY = 'mia_agent_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-agent-token'] = token;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = 'An operational error occurred';
    try {
      const data = await response.json();
      errorMsg = data.error || errorMsg;
    } catch {
      errorMsg = `Server error (${response.status})`;
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Auth
  sendMagicLink: (email: string, codename?: string) =>
    request<{ success: boolean; message: string; token: string; magicUrl: string }>('/api/auth/send-magic-link', {
      method: 'POST',
      body: JSON.stringify({ email, codename }),
    }),

  verifyMagicLink: (token: string) =>
    request<{ success: boolean; token: string; user: User; isNew?: boolean }>('/api/auth/verify-magic-link', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  demoLogin: (email?: string, codename?: string) =>
    request<{ success: boolean; token: string; user: User }>('/api/auth/demo-login', {
      method: 'POST',
      body: JSON.stringify({ email, codename }),
    }),

  firebaseLogin: (data: { uid: string; email: string; displayName?: string | null; photoURL?: string | null }) =>
    request<{ success: boolean; token: string; user: User; isNew?: boolean }>('/api/auth/firebase-login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMe: () => request<{ user: User }>('/api/auth/me'),

  // Profiles
  getProfiles: () => request<{ profiles: Profile[] }>('/api/profiles'),

  createProfile: (name: string, emoji: string) =>
    request<{ profile: Profile }>('/api/profiles', {
      method: 'POST',
      body: JSON.stringify({ name, emoji }),
    }),

  updateProfile: (id: string, name: string, emoji: string) =>
    request<{ profile: Profile }>(`/api/profiles/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, emoji }),
    }),

  deleteProfile: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/profiles/${id}`, {
      method: 'DELETE',
    }),

  // Archetypes
  getArchetypes: (profileId: string) =>
    request<{ archetypes: Archetype[] }>(`/api/archetypes?profileId=${encodeURIComponent(profileId)}`),

  createArchetype: (profileId: string, name: string, emoji: string, matchRate: number) =>
    request<{ archetype: Archetype }>('/api/archetypes', {
      method: 'POST',
      body: JSON.stringify({ profileId, name, emoji, matchRate }),
    }),

  updateArchetype: (id: string, name: string, emoji: string, matchRate: number) =>
    request<{ archetype: Archetype }>(`/api/archetypes/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, emoji, matchRate }),
    }),

  deleteArchetype: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/archetypes/${id}`, {
      method: 'DELETE',
    }),

  // Transactions
  getTransactions: (
    profileId: string,
    params: { page?: number; pageSize?: number; search?: string; archetypeId?: string; type?: string } = {}
  ) => {
    const query = new URLSearchParams({
      profileId,
      page: String(params.page || 1),
      pageSize: String(params.pageSize || 15),
      search: params.search || '',
      archetypeId: params.archetypeId || '',
      type: params.type || 'all',
    });
    return request<PaginatedTransactions>(`/api/transactions?${query.toString()}`);
  },

  logTransaction: (data: {
    profileId: string;
    isDirectDeposit: boolean;
    isWithdrawal?: boolean;
    archetypeId?: string;
    itemName: string;
    baseCost?: number;
    amount?: number;
    purchaseDate: string;
    note?: string;
  }) =>
    request<{ transaction: Transaction }>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteTransaction: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/transactions/${id}`, {
      method: 'DELETE',
    }),

  // Dashboard
  getDashboard: (profileId: string) =>
    request<DashboardMetrics>(`/api/dashboard?profileId=${encodeURIComponent(profileId)}`),

  // Database Manipulation Studio
  getDbStats: () => request<DatabaseStats>('/api/db/stats'),

  getCollections: () => request<{ collections: string[] }>('/api/db/collections'),

  createCollection: (name: string) =>
    request<{ success: boolean; collection: string }>('/api/db/collections', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  queryDocuments: (
    collectionName: string,
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
      filterKey?: string;
      filterOp?: string;
      filterVal?: string;
      sortKey?: string;
      sortDir?: 'asc' | 'desc';
    } = {}
  ) => {
    const query = new URLSearchParams({
      page: String(params.page || 1),
      pageSize: String(params.pageSize || 25),
      search: params.search || '',
      filterKey: params.filterKey || '',
      filterOp: params.filterOp || '==',
      filterVal: params.filterVal || '',
      sortKey: params.sortKey || '',
      sortDir: params.sortDir || 'asc',
    });
    return request<PaginatedCollectionDocs>(`/api/db/collections/${encodeURIComponent(collectionName)}/documents?${query.toString()}`);
  },

  getDocument: (collectionName: string, id: string) =>
    request<{ document: any }>(`/api/db/collections/${encodeURIComponent(collectionName)}/documents/${encodeURIComponent(id)}`),

  createDocument: (collectionName: string, data: any, id?: string) =>
    request<{ success: boolean; document: any }>(`/api/db/collections/${encodeURIComponent(collectionName)}/documents`, {
      method: 'POST',
      body: JSON.stringify({ data, id }),
    }),

  updateDocument: (collectionName: string, id: string, data: any) =>
    request<{ success: boolean; document: any }>(
      `/api/db/collections/${encodeURIComponent(collectionName)}/documents/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    ),

  patchDocument: (collectionName: string, id: string, updates: any) =>
    request<{ success: boolean; document: any }>(
      `/api/db/collections/${encodeURIComponent(collectionName)}/documents/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }
    ),

  deleteDbDocument: (collectionName: string, id: string) =>
    request<{ success: boolean; message: string }>(
      `/api/db/collections/${encodeURIComponent(collectionName)}/documents/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      }
    ),

  bulkSeedCollection: (collectionName: string, count: number, profileId?: string) =>
    request<{ success: boolean; message: string; count: number }>(
      `/api/db/collections/${encodeURIComponent(collectionName)}/bulk-seed`,
      {
        method: 'POST',
        body: JSON.stringify({ count, profileId }),
      }
    ),

  bulkDeleteDocuments: (collectionName: string, ids: string[]) =>
    request<{ success: boolean; deletedCount: number }>(
      `/api/db/collections/${encodeURIComponent(collectionName)}/bulk-delete`,
      {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }
    ),

  exportDatabase: (collectionName?: string) => {
    const url = collectionName ? `/api/db/export?collection=${encodeURIComponent(collectionName)}` : '/api/db/export';
    return request<any>(url);
  },

  importDatabase: (data: any, collectionName?: string) =>
    request<{ success: boolean; message: string }>('/api/db/import', {
      method: 'POST',
      body: JSON.stringify({ data, collectionName }),
    }),

  syncFirestore: () =>
    request<{ success: boolean; message: string; result: any }>('/api/db/sync-firestore', {
      method: 'POST',
    }),
};
