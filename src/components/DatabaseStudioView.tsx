import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Server,
  Cloud,
  RefreshCw,
  Search,
  Filter,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Download,
  Upload,
  Layers,
  CheckCircle2,
  AlertCircle,
  Zap,
  Code2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  SlidersHorizontal,
  X,
  Sparkles,
} from 'lucide-react';
import { CollectionMeta, DatabaseStats, Profile, User } from '../types';
import { api } from '../services/api';

interface DatabaseStudioViewProps {
  user: User;
  activeProfile: Profile | null;
  onDataChanged?: () => void;
}

export const DatabaseStudioView: React.FC<DatabaseStudioViewProps> = ({
  user,
  activeProfile,
  onDataChanged,
}) => {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<string>('transactions');
  const [documents, setDocuments] = useState<any[]>([]);
  const [totalDocs, setTotalDocs] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [statsLoading, setStatsLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Search & Filter
  const [search, setSearch] = useState<string>('');
  const [filterKey, setFilterKey] = useState<string>('');
  const [filterOp, setFilterOp] = useState<string>('==');
  const [filterVal, setFilterVal] = useState<string>('');
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Selected Documents for Bulk Actions
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  // Modals
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [editingDoc, setEditingDoc] = useState<any | null>(null);
  const [isNewDoc, setIsNewDoc] = useState<boolean>(false);
  const [rawJsonText, setRawJsonText] = useState<string>('');
  const [editorMode, setEditorMode] = useState<'fields' | 'json'>('fields');
  const [customFields, setCustomFields] = useState<Array<{ key: string; value: string; type: string }>>([]);

  // Batch Scale Modal
  const [scaleModalOpen, setScaleModalOpen] = useState<boolean>(false);
  const [scaleCount, setScaleCount] = useState<number>(50);
  const [scaling, setScaling] = useState<boolean>(false);

  // Import Modal
  const [importModalOpen, setImportModalOpen] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>('');
  const [importLoading, setImportLoading] = useState<boolean>(false);

  // New Collection Modal
  const [newColModalOpen, setNewColModalOpen] = useState<boolean>(false);
  const [newColName, setNewColName] = useState<string>('');

  // Fetch Database Metadata
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await api.getDbStats();
      setStats(res);
    } catch (err: any) {
      console.error('Failed to fetch DB stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch Collection Documents
  const fetchDocuments = useCallback(
    async (targetPage = page) => {
      setLoading(true);
      try {
        const res = await api.queryDocuments(selectedCollection, {
          page: targetPage,
          pageSize,
          search,
          filterKey: filterKey.trim(),
          filterOp,
          filterVal: filterVal.trim(),
          sortKey: sortKey.trim(),
          sortDir,
        });
        setDocuments(res.documents);
        setTotalDocs(res.total);
        setTotalPages(res.totalPages || 1);
        setSelectedDocIds([]);
      } catch (err: any) {
        console.error('Failed to fetch documents:', err);
      } finally {
        setLoading(false);
      }
    },
    [selectedCollection, page, pageSize, search, filterKey, filterOp, filterVal, sortKey, sortDir]
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    setPage(1);
    fetchDocuments(1);
  }, [selectedCollection, search, filterKey, filterOp, filterVal, sortKey, sortDir, pageSize]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchDocuments(newPage);
  };

  const handleSyncFirestore = async () => {
    setSyncing(true);
    setStatusMessage(null);
    try {
      const res = await api.syncFirestore();
      setStatusMessage(`Synced ${res.result?.totalDocs || 0} documents from Firestore cloud.`);
      fetchStats();
      fetchDocuments();
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      setStatusMessage(`Sync error: ${err.message}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  // Open Edit/Create Document
  const handleOpenCreate = () => {
    setIsNewDoc(true);
    const template: Record<string, any> = {
      id: `${selectedCollection.slice(0, 4)}_${Math.random().toString(36).substring(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
    if (selectedCollection === 'transactions') {
      template.itemName = 'New Operation';
      template.baseCost = 500;
      template.savingsLevy = 500;
      template.totalOutflow = 1000;
      template.isDirectDeposit = false;
      template.agentId = user.id;
      template.profileId = activeProfile?.id || 'prof_default';
      template.purchaseDate = new Date().toISOString().split('T')[0];
    }
    setEditingDoc(template);
    setRawJsonText(JSON.stringify(template, null, 2));
    prepareCustomFields(template);
    setEditModalOpen(true);
  };

  const handleOpenEdit = (doc: any) => {
    setIsNewDoc(false);
    setEditingDoc(doc);
    setRawJsonText(JSON.stringify(doc, null, 2));
    prepareCustomFields(doc);
    setEditModalOpen(true);
  };

  const prepareCustomFields = (doc: any) => {
    const fields = Object.entries(doc).map(([k, v]) => ({
      key: k,
      value: typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? ''),
      type: typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : typeof v === 'object' ? 'json' : 'string',
    }));
    setCustomFields(fields);
  };

  const handleSaveDocument = async () => {
    try {
      let finalDocData: any;
      if (editorMode === 'json') {
        finalDocData = JSON.parse(rawJsonText);
      } else {
        finalDocData = {};
        for (const f of customFields) {
          if (!f.key.trim()) continue;
          let val: any = f.value;
          if (f.type === 'number') val = Number(f.value) || 0;
          if (f.type === 'boolean') val = f.value === 'true' || f.value === '1';
          if (f.type === 'json') {
            try {
              val = JSON.parse(f.value);
            } catch {
              val = f.value;
            }
          }
          finalDocData[f.key.trim()] = val;
        }
      }

      const docId = finalDocData.id || editingDoc?.id || `${selectedCollection}_${Date.now()}`;
      if (isNewDoc) {
        await api.createDocument(selectedCollection, finalDocData, docId);
      } else {
        await api.updateDocument(selectedCollection, docId, finalDocData);
      }

      setEditModalOpen(false);
      fetchDocuments();
      fetchStats();
      if (onDataChanged) onDataChanged();
      setStatusMessage(`Document ${docId} saved successfully.`);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!confirm(`Are you sure you want to permanently delete document '${id}'?`)) return;
    try {
      await api.deleteDbDocument(selectedCollection, id);
      fetchDocuments();
      fetchStats();
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDocIds.length === 0) return;
    if (!confirm(`Permanently delete ${selectedDocIds.length} selected documents?`)) return;
    try {
      await api.bulkDeleteDocuments(selectedCollection, selectedDocIds);
      fetchDocuments();
      fetchStats();
      if (onDataChanged) onDataChanged();
      setSelectedDocIds([]);
    } catch (err: any) {
      alert(`Bulk delete error: ${err.message}`);
    }
  };

  const handleExecuteScaleSeed = async () => {
    setScaling(true);
    try {
      const res = await api.bulkSeedCollection(selectedCollection, scaleCount, activeProfile?.id);
      setScaleModalOpen(false);
      setStatusMessage(res.message);
      fetchDocuments();
      fetchStats();
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      alert(`Scale test error: ${err.message}`);
    } finally {
      setScaling(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const handleExportData = async (colOnly = false) => {
    try {
      const data = await api.exportDatabase(colOnly ? selectedCollection : undefined);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = colOnly ? `${selectedCollection}_export.json` : `mia_database_backup_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    }
  };

  const handleImportData = async () => {
    if (!importText.trim()) return;
    setImportLoading(true);
    try {
      const parsed = JSON.parse(importText);
      const res = await api.importDatabase(parsed, selectedCollection);
      setImportModalOpen(false);
      setStatusMessage(res.message);
      fetchDocuments();
      fetchStats();
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      alert(`Import error: ${err.message}`);
    } finally {
      setImportLoading(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    try {
      const res = await api.createCollection(newColName.trim());
      setNewColModalOpen(false);
      setNewColName('');
      await fetchStats();
      setSelectedCollection(res.collection);
    } catch (err: any) {
      alert(err.message || 'Failed to create collection');
    }
  };

  // Toggle selection for all docs
  const handleToggleSelectAll = () => {
    if (selectedDocIds.length === documents.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(documents.map((d) => d.id).filter(Boolean));
    }
  };

  const handleToggleSelectDoc = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const activeColMeta = stats?.collections.find((c) => c.name === selectedCollection);
  const sampleKeys = activeColMeta?.schemaKeys || [];

  return (
    <div className="space-y-6">
      {/* Cloud Database Connection & Metrics Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-400">
                <Database className="w-5 h-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold font-tactical text-slate-100 uppercase tracking-wide">
                    Scalable Cloud Database Console
                  </h2>
                  <span className="flex items-center gap-1 text-[10px] font-mono-code bg-emerald-950 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    FIRESTORE LIVE
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono-code mt-0.5">
                  Real-time document manipulation, scalable batch indexing, and dynamic schema CRUD across all operational records.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Tools */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSyncFirestore}
              disabled={syncing}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-mono-code flex items-center gap-1.5 border border-slate-700 cursor-pointer transition-colors"
              title="Force Two-Way Synchronization with Cloud Firestore"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Sync Firestore'}</span>
            </button>

            <button
              onClick={() => setScaleModalOpen(true)}
              className="px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-xl text-xs font-mono-code font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              title="Scale Test: Batch Generate 50-500 Documents"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Scale & Batch Seed</span>
            </button>

            <button
              onClick={() => handleExportData(false)}
              className="px-3 py-2 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-xs font-mono-code flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Export Full Database as JSON"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Export JSON</span>
            </button>

            <button
              onClick={() => setImportModalOpen(true)}
              className="px-3 py-2 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-xs font-mono-code flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Import JSON Records"
            >
              <Upload className="w-3.5 h-3.5 text-slate-400" />
              <span>Import</span>
            </button>
          </div>
        </div>

        {/* Database Live Stats Row */}
        {stats && (
          <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono-code">
            <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/60">
              <span className="text-[10px] text-slate-500 block uppercase">Project ID</span>
              <span className="text-slate-200 font-bold truncate block">{stats.projectId}</span>
            </div>
            <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/60">
              <span className="text-[10px] text-slate-500 block uppercase">Total Documents</span>
              <span className="text-emerald-400 font-bold block">{stats.totalDocuments.toLocaleString()}</span>
            </div>
            <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/60">
              <span className="text-[10px] text-slate-500 block uppercase">Database ID</span>
              <span className="text-slate-300 truncate block">{stats.firestoreDatabaseId.slice(0, 18)}...</span>
            </div>
            <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/60">
              <span className="text-[10px] text-slate-500 block uppercase">Collections</span>
              <span className="text-amber-400 font-bold block">{stats.collections.length} active</span>
            </div>
          </div>
        )}

        {statusMessage && (
          <div className="mt-3 p-2.5 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-xs font-mono-code text-emerald-300 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Collection Navigation Tabs */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
        <div className="flex items-center gap-2">
          {stats?.collections.map((col) => {
            const isSelected = selectedCollection === col.name;
            return (
              <button
                key={col.name}
                onClick={() => setSelectedCollection(col.name)}
                className={`px-3.5 py-2 rounded-xl text-xs font-mono-code flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="capitalize">{col.name}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] ${
                    isSelected ? 'bg-slate-950 text-emerald-300 font-bold' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {col.count}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setNewColModalOpen(true)}
          className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-emerald-400 rounded-xl text-xs font-mono-code flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Custom Collection</span>
        </button>
      </div>

      {/* Query, Filter & Search Control Panel */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Global Search */}
          <div className="sm:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={`Search in '${selectedCollection}'...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs font-mono-code text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Filter Key Selector */}
          <div className="sm:col-span-3">
            <select
              value={filterKey}
              onChange={(e) => setFilterKey(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono-code text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="">Filter by Field...</option>
              {sampleKeys.map((k) => (
                <option key={k} value={k}>
                  Field: {k}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Operator & Value */}
          {filterKey && (
            <>
              <div className="sm:col-span-2">
                <select
                  value={filterOp}
                  onChange={(e) => setFilterOp(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs font-mono-code text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="==">== (equals)</option>
                  <option value="!=">!= (not equal)</option>
                  <option value="contains">contains</option>
                  <option value=">">&gt; (greater)</option>
                  <option value="<">&lt; (less)</option>
                  <option value=">=">&gt;= (gte)</option>
                  <option value="<=">&lt;= (lte)</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <input
                  type="text"
                  placeholder="Filter value..."
                  value={filterVal}
                  onChange={(e) => setFilterVal(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono-code text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </>
          )}

          {!filterKey && (
            <div className="sm:col-span-5 flex items-center justify-end gap-2">
              <span className="text-xs text-slate-400 font-mono-code">Page Size:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-mono-code text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
                <option value={250}>250 / page</option>
              </select>
            </div>
          )}
        </div>

        {/* Action Controls & Bulk Selection Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono-code text-slate-400">
              Showing <span className="text-emerald-400 font-bold">{documents.length}</span> of{' '}
              <span className="text-slate-200 font-bold">{totalDocs}</span> records in{' '}
              <span className="text-slate-200 font-bold uppercase">{selectedCollection}</span>
            </span>

            {selectedDocIds.length > 0 && (
              <span className="text-xs font-mono-code bg-rose-950 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-lg flex items-center gap-2">
                <span>{selectedDocIds.length} Selected</span>
                <button
                  onClick={handleBulkDelete}
                  className="hover:text-rose-100 font-bold underline cursor-pointer"
                >
                  Delete Selected
                </button>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExportData(true)}
              className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-xs font-mono-code flex items-center gap-1 cursor-pointer"
              title="Export this collection"
            >
              <Download className="w-3 h-3 text-slate-400" />
              <span>Export Collection</span>
            </button>

            <button
              onClick={handleOpenCreate}
              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs font-tactical uppercase flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Insert Document</span>
            </button>
          </div>
        </div>
      </div>

      {/* Documents Table / Grid */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs font-mono-code text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
            <span>QUERYING CLOUD FIRESTORE & DISTRIBUTED DATA STORE...</span>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-xl mx-auto">
              📁
            </div>
            <h3 className="text-sm font-bold text-slate-300 font-tactical uppercase">
              No Documents in Collection '{selectedCollection}'
            </h3>
            <p className="text-xs text-slate-500 font-mono-code max-w-sm mx-auto">
              Insert a new document manually, run a scalable batch seed, or import a JSON dataset to populate this collection.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={handleOpenCreate}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs uppercase font-tactical cursor-pointer"
              >
                + Insert First Document
              </button>
              <button
                onClick={() => setScaleModalOpen(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold rounded-xl text-xs font-mono-code cursor-pointer"
              >
                ⚡ Batch Generate 50
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/90 border-b border-slate-800 text-[11px] font-mono-code text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedDocIds.length > 0 && selectedDocIds.length === documents.length}
                      onChange={handleToggleSelectAll}
                      className="cursor-pointer accent-emerald-500 rounded"
                    />
                  </th>
                  <th className="py-3 px-4">Document ID</th>
                  <th className="py-3 px-4">Primary Content / Schema Preview</th>
                  <th className="py-3 px-4 text-right">Fields</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs font-mono-code">
                {documents.map((doc) => {
                  const docId = doc.id || 'unassigned_id';
                  const isSelected = selectedDocIds.includes(docId);
                  const fieldKeys = Object.keys(doc);

                  return (
                    <tr
                      key={docId}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isSelected ? 'bg-emerald-950/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectDoc(docId)}
                          className="cursor-pointer accent-emerald-500 rounded"
                        />
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-400">{docId}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="max-w-xl truncate text-slate-300">
                          {doc.itemName && (
                            <span className="font-semibold text-slate-100 mr-2">
                              {doc.archetypeEmoji || ''} {doc.itemName}
                            </span>
                          )}
                          {doc.name && (
                            <span className="font-semibold text-slate-100 mr-2">
                              {doc.emoji || ''} {doc.name}
                            </span>
                          )}
                          {doc.email && (
                            <span className="text-slate-300 mr-2 font-bold">{doc.email}</span>
                          )}
                          <span className="text-slate-500 text-[11px]">
                            {JSON.stringify(doc).slice(0, 80)}...
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap text-slate-400 text-[11px]">
                        <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          {fieldKeys.length} keys
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(doc)}
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded cursor-pointer transition-colors"
                            title="Edit Document"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteDocument(docId)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded cursor-pointer transition-colors"
                            title="Delete Document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs font-mono-code">
            <span className="text-slate-400">
              Page <span className="text-slate-200 font-bold">{page}</span> of{' '}
              <span className="text-slate-200 font-bold">{totalPages}</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1 || loading}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages || loading}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit / Create Document Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl p-6 relative max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold font-tactical text-slate-100 uppercase tracking-wide">
                  {isNewDoc ? `Create Document in '${selectedCollection}'` : `Edit Document '${editingDoc?.id}'`}
                </h3>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => setEditorMode('fields')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono-code cursor-pointer ${
                  editorMode === 'fields'
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                Structured Fields
              </button>
              <button
                type="button"
                onClick={() => setEditorMode('json')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono-code cursor-pointer ${
                  editorMode === 'json'
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                Raw JSON Editor
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 flex-1">
              {editorMode === 'json' ? (
                <div className="space-y-2">
                  <label className="block text-xs font-mono-code text-slate-400">
                    RAW JSON PAYLOAD (Validated on Save)
                  </label>
                  <textarea
                    rows={14}
                    value={rawJsonText}
                    onChange={(e) => setRawJsonText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono-code text-emerald-300 focus:outline-none focus:border-emerald-500 resize-none font-mono"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {customFields.map((field, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800"
                    >
                      <div className="col-span-4">
                        <input
                          type="text"
                          placeholder="Field Key"
                          value={field.key}
                          onChange={(e) => {
                            const copy = [...customFields];
                            copy[idx].key = e.target.value;
                            setCustomFields(copy);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono-code text-slate-100 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="col-span-2">
                        <select
                          value={field.type}
                          onChange={(e) => {
                            const copy = [...customFields];
                            copy[idx].type = e.target.value;
                            setCustomFields(copy);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono-code text-slate-200 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="string">string</option>
                          <option value="number">number</option>
                          <option value="boolean">boolean</option>
                          <option value="json">json</option>
                        </select>
                      </div>

                      <div className="col-span-5">
                        <input
                          type="text"
                          placeholder="Value"
                          value={field.value}
                          onChange={(e) => {
                            const copy = [...customFields];
                            copy[idx].value = e.target.value;
                            setCustomFields(copy);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono-code text-slate-100 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="col-span-1 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            setCustomFields((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      setCustomFields((prev) => [...prev, { key: '', value: '', type: 'string' }]);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg text-xs font-mono-code flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Field</span>
                  </button>
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono-code cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDocument}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs font-tactical uppercase cursor-pointer"
              >
                Commit to Database
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Scale & Seed Modal */}
      {scaleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold font-tactical text-slate-100 uppercase tracking-wide">
                  High-Throughput Scale Test
                </h3>
              </div>
              <button
                onClick={() => setScaleModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 font-mono-code mb-4">
              Generate a high volume of synthetic, valid records directly into collection{' '}
              <span className="text-emerald-400 font-bold">'{selectedCollection}'</span> to stress-test high concurrency, indexing, and Firestore throughput.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-mono-code text-slate-400 mb-1">
                  BATCH QUANTITY TO INJECT
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[25, 50, 100, 250].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setScaleCount(num)}
                      className={`py-2 rounded-xl text-xs font-mono-code font-bold cursor-pointer ${
                        scaleCount === num
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {num} Docs
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono-code text-slate-400 mb-1">
                  OR CUSTOM QUANTITY (1 - 500)
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={scaleCount}
                  onChange={(e) => setScaleCount(Math.min(500, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono-code text-slate-100"
                />
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setScaleModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono-code cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteScaleSeed}
                disabled={scaling}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs font-tactical uppercase cursor-pointer"
              >
                {scaling ? 'Injecting Scale Batch...' : `Inject ${scaleCount} Records`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import JSON Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold font-tactical text-slate-100 uppercase tracking-wide">
                  Import JSON Dataset
                </h3>
              </div>
              <button
                onClick={() => setImportModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 font-mono-code mb-3">
              Paste an array of document objects or key-value document dictionary into collection{' '}
              <span className="text-emerald-400 font-bold">'{selectedCollection}'</span>.
            </p>

            <textarea
              rows={10}
              placeholder='[ { "id": "custom_1", "name": "Item 1" } ]'
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono-code text-slate-100 resize-none focus:outline-none focus:border-emerald-500 font-mono"
            />

            <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setImportModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-mono-code"
              >
                Cancel
              </button>
              <button
                onClick={handleImportData}
                disabled={importLoading || !importText.trim()}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs font-tactical uppercase cursor-pointer"
              >
                {importLoading ? 'Importing...' : 'Execute Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Collection Modal */}
      {newColModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleCreateCollection}
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-6 relative space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold font-tactical text-slate-100 uppercase tracking-wide">
                  New Custom Collection
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setNewColModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-mono-code text-slate-400 mb-1">
                COLLECTION NAME (e.g. assets, budgets, audit_logs)
              </label>
              <input
                type="text"
                required
                placeholder="e.g. vault_investments"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono-code text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewColModalOpen(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs font-mono-code"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs font-tactical uppercase cursor-pointer"
              >
                Create Collection
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
