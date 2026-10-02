import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Trash2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Coins,
  Vault,
  Sparkles,
  ArrowUpDown,
  ArrowDownRight,
} from 'lucide-react';
import { Archetype, PaginatedTransactions, Profile, Transaction } from '../types';
import { api } from '../services/api';
import { formatKsh } from '../utils/ranks';

interface LedgerHistoryViewProps {
  activeProfile: Profile;
  archetypes: Archetype[];
  onOpenLogModal: () => void;
  onOpenWithdrawModal?: () => void;
  onRefreshMetrics: () => void;
}

export const LedgerHistoryView: React.FC<LedgerHistoryViewProps> = ({
  activeProfile,
  archetypes,
  onOpenLogModal,
  onOpenWithdrawModal,
  onRefreshMetrics,
}) => {
  const [data, setData] = useState<PaginatedTransactions | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedArchetype, setSelectedArchetype] = useState('all');
  const [selectedType, setSelectedType] = useState<'all' | 'vice' | 'deposit' | 'withdrawal'>('all');
  const [loading, setLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchTransactions = async (pageToFetch = page) => {
    setLoading(true);
    try {
      const res = await api.getTransactions(activeProfile.id, {
        page: pageToFetch,
        pageSize: 15,
        search,
        archetypeId: selectedArchetype,
        type: selectedType,
      });
      setData(res);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions(1);
    setPage(1);
  }, [activeProfile.id, search, selectedArchetype, selectedType]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchTransactions(newPage);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteTransaction(id);
      setDeleteConfirmId(null);
      fetchTransactions(page);
      onRefreshMetrics();
    } catch (err: any) {
      alert(err.message || 'Failed to delete transaction');
    }
  };

  const transactions = data?.transactions || [];
  const totalPages = data?.totalPages || 1;
  const totalRecords = data?.total || 0;

  return (
    <div className="space-y-6">
      {/* Search and Filters Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📜</span>
              <h2 className="text-xl font-bold font-tactical text-slate-100 uppercase tracking-wide">
                Operation Intelligence Ledger
              </h2>
            </div>
            <p className="text-xs text-slate-400 font-mono-code mt-0.5">
              Chronological log of intercepted vice expenditures and direct vault deposits. (15 entries/page)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono-code text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              TOTAL ENTRIES: <span className="text-emerald-400 font-bold">{totalRecords}</span>
            </span>
            <span className="text-xs font-mono-code text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              VAULT RESERVE: <span className="text-emerald-400 font-bold">{formatKsh(data?.vaultCapital || 0)}</span>
            </span>
            <span className={`text-xs font-mono-code px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${
              (data?.totalWithdrawn || 0) > 0
                ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}>
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
              <span>WITHDRAWN:</span>
              <span className={`font-bold ${(data?.totalWithdrawn || 0) > 0 ? 'text-rose-300' : 'text-slate-400'}`}>
                {formatKsh(data?.totalWithdrawn || 0)}
              </span>
            </span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
          {/* Search Input (FR-27) */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by item name or note..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs font-mono-code text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Archetype Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedArchetype}
              onChange={(e) => setSelectedArchetype(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono-code text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Archetypes</option>
              {archetypes.map((arch) => (
                <option key={arch.id} value={arch.id}>
                  {arch.emoji} {arch.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono-code text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Operations</option>
              <option value="vice">🚨 Vice Intercepts Only</option>
              <option value="deposit">💰 Quick Saves Only</option>
              <option value="withdrawal">💸 Vault Withdrawals Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ledger Table / List (FR-23, FR-24, FR-25) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {loading && (
          <div className="p-8 text-center text-xs font-mono-code text-slate-400">
            DECRYPTING LEDGER RECORDS...
          </div>
        )}

        {!loading && transactions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-xl mx-auto">
              📂
            </div>
            <h3 className="text-sm font-bold text-slate-300 font-tactical uppercase">
              No Operations Logged in this Category
            </h3>
            <p className="text-xs text-slate-500 font-mono-code max-w-sm mx-auto">
              Execute a vice intercept or direct vault quick-save to populate your operational intelligence ledger.
            </p>
            <button
              onClick={onOpenLogModal}
              className="mt-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs uppercase font-tactical cursor-pointer"
            >
              + Log First Operation
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono-code text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Date (Backdated)</th>
                  <th className="py-3 px-4">Operation / Item</th>
                  <th className="py-3 px-4">Archetype</th>
                  <th className="py-3 px-4 text-right">Base Cost</th>
                  <th className="py-3 px-4 text-right">Savings Levy</th>
                  <th className="py-3 px-4 text-right">Total Outflow</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {transactions.map((tx) => {
                  const isDeposit = tx.isDirectDeposit;
                  const isWithdrawal = tx.isWithdrawal;
                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Purchase Date (FR-25) */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono-code text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>{tx.purchaseDate}</span>
                        </div>
                      </td>

                      {/* Item Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-base">
                            {tx.archetypeEmoji || (isWithdrawal ? '💸' : isDeposit ? '💰' : '🎯')}
                          </span>
                          <div>
                            <span className="font-semibold text-slate-100 block">
                              {tx.itemName}
                            </span>
                            {tx.note && (
                              <span className="text-[10px] font-mono-code text-slate-400 block italic">
                                Note: {tx.note}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Archetype / Tag */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isWithdrawal ? (
                          <span className="px-2 py-0.5 text-[10px] font-mono-code bg-rose-950 text-rose-300 border border-rose-500/40 rounded">
                            VAULT WITHDRAWAL
                          </span>
                        ) : isDeposit ? (
                          <span className="px-2 py-0.5 text-[10px] font-mono-code bg-emerald-950 text-emerald-300 border border-emerald-500/30 rounded">
                            QUICK SAVE (0% BASE)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-mono-code bg-amber-950 text-amber-300 border border-amber-500/30 rounded">
                            {tx.archetypeName || 'Vice'} (
                            {tx.matchRateSnapshot ? Math.round(tx.matchRateSnapshot * 100) : 100}%)
                          </span>
                        )}
                      </td>

                      {/* Base Cost */}
                      <td className="py-3 px-4 text-right font-mono-code whitespace-nowrap text-amber-300">
                        {isDeposit || isWithdrawal ? '—' : formatKsh(tx.baseCost)}
                      </td>

                      {/* Savings Levy (Core Savings / Deduction) */}
                      <td className={`py-3 px-4 text-right font-mono-code font-bold whitespace-nowrap ${
                        isWithdrawal ? 'text-rose-400' : 'text-emerald-400'
                      }`}>
                        {isWithdrawal
                          ? `-${formatKsh(Math.abs(tx.savingsLevy))}`
                          : `+${formatKsh(tx.savingsLevy)}`}
                      </td>

                      {/* Total Outflow */}
                      <td className="py-3 px-4 text-right font-mono-code whitespace-nowrap text-slate-200">
                        {isDeposit || isWithdrawal ? '—' : formatKsh(tx.totalOutflow)}
                      </td>

                      {/* Actions (FR-26) */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {deleteConfirmId === tx.id ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleDelete(tx.id)}
                              className="px-2 py-0.5 bg-rose-900 hover:bg-rose-800 text-[10px] font-mono-code text-rose-200 rounded cursor-pointer"
                            >
                              Expunge
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="text-xs text-slate-400 hover:text-slate-200 px-1 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(tx.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                            title="Expunge Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls (FR-23) */}
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
    </div>
  );
};
