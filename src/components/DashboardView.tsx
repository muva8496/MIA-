import React from 'react';
import {
  ShieldAlert,
  Vault,
  TrendingDown,
  Coins,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  Sparkles,
  Percent,
  Calendar,
  Activity,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { DashboardMetrics, Profile } from '../types';
import { formatKsh } from '../utils/ranks';

interface DashboardViewProps {
  metrics: DashboardMetrics | null;
  activeProfile: Profile;
  loading: boolean;
  onOpenLogModal: () => void;
  onOpenWithdrawModal: () => void;
  onOpenArchetypesTab: () => void;
  onOpenLedgerTab: () => void;
  onOpenRankModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  activeProfile,
  loading,
  onOpenLogModal,
  onOpenWithdrawModal,
  onOpenArchetypesTab,
  onOpenLedgerTab,
  onOpenRankModal,
}) => {
  if (loading || !metrics) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-900/60 border border-slate-800 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-slate-900/60 border border-slate-800 rounded-xl" />
      </div>
    );
  }

  const {
    totalVicesLogged,
    vaultCapital,
    totalOutflow,
    viceSpending,
    monthlySavingsRate,
    totalWithdrawn = 0,
    withdrawalCount = 0,
    grossVaultCapital = vaultCapital,
    currentRank,
    nextRank,
    progressToNextRank,
    capitalNeededForNextRank,
    monthlyComparison,
  } = metrics;

  return (
    <div className="space-y-6">
      {/* Top Banner with Profile & Mission Status */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-full bg-emerald-500/5 blur-2xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{activeProfile.emoji}</span>
              <span className="text-xs font-mono-code text-emerald-400 bg-emerald-950 border border-emerald-500/30 px-2 py-0.5 rounded">
                OPERATIONAL VAULT
              </span>
              <span className="text-xs text-slate-400 font-mono-code">
                AGENT CLEARANCE: {currentRank.code}
              </span>
            </div>
            <h1 className="text-2xl font-bold font-tactical text-slate-100 tracking-wide">
              {activeProfile.name} Command Center
            </h1>
            <p className="text-xs text-slate-400 font-mono-code mt-0.5">
              Taxing discretionary vices into permanent capital reserves (Kenyan Shillings).
            </p>

            {/* Tactical Telemetry Chips with Withdrawn Amount */}
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-2.5 border-t border-slate-800/70">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-xs font-mono-code">
                <Vault className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-400">NET VAULT RESERVE:</span>
                <span className="font-bold text-emerald-300">{formatKsh(vaultCapital)}</span>
              </div>

              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono-code ${
                totalWithdrawn > 0
                  ? 'bg-rose-950/70 border-rose-500/50 text-rose-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}>
                <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-slate-400">TOTAL WITHDRAWN:</span>
                <span className={`font-bold ${totalWithdrawn > 0 ? 'text-rose-300' : 'text-slate-300'}`}>
                  {formatKsh(totalWithdrawn)}
                </span>
                {totalWithdrawn > 0 && (
                  <span className="text-[10px] text-rose-400/80">
                    ({withdrawalCount} event{withdrawalCount !== 1 ? 's' : ''})
                  </span>
                )}
              </div>

              {totalWithdrawn > 0 && (
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-xs font-mono-code">
                  <span className="text-slate-400">GROSS GENERATED:</span>
                  <span className="font-bold text-slate-200">{formatKsh(grossVaultCapital)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 self-start md:self-center">
            <button
              onClick={onOpenWithdrawModal}
              className="bg-slate-900 hover:bg-slate-800 text-rose-300 border border-rose-500/40 hover:border-rose-500 font-bold px-3.5 py-2 rounded-xl flex items-center gap-2 text-xs uppercase tracking-wider font-tactical shadow-md transition-all cursor-pointer hover:scale-[1.02]"
              title="Record withdrawal from vault capital"
            >
              <ArrowDownRight className="w-4 h-4 text-rose-400" />
              <span>Withdraw Capital</span>
            </button>

            <button
              onClick={onOpenLogModal}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl flex items-center gap-2 text-xs uppercase tracking-wider font-tactical shadow-lg shadow-emerald-500/20 transition-all cursor-pointer hover:scale-[1.02]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Log Vice / Quick Save</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5 Core Key Metrics (FR-19 + Capital Withdrawn Telemetry) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Metric 1: Vault Capital Accumulated (Net Active Reserve) */}
        <div className="bg-slate-900/80 border border-emerald-500/30 rounded-xl p-4 shadow-lg relative overflow-hidden group hover:border-emerald-500/60 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono-code text-emerald-400 uppercase tracking-wider">
              Vault Capital
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <Vault className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono-code text-emerald-300">
            {formatKsh(vaultCapital)}
          </div>
          <div className="text-[11px] font-mono-code mt-0.5">
            {totalWithdrawn > 0 ? (
              <span className="text-slate-400">
                Gross: {formatKsh(grossVaultCapital)} • <span className="text-rose-400">-{formatKsh(totalWithdrawn)}</span>
              </span>
            ) : (
              <span className="text-emerald-500/80">100% Reserve Intact</span>
            )}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono-code">
            <span>Active Reserve</span>
            <button
              onClick={onOpenWithdrawModal}
              className="text-rose-400 hover:text-rose-300 font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
              title="Withdraw from vault capital"
            >
              <ArrowDownRight className="w-3 h-3" />
              <span>Withdraw</span>
            </button>
          </div>
        </div>

        {/* Metric 2: Capital Withdrawn (Liquidated Outflow) */}
        <div className="bg-slate-900/80 border border-rose-500/30 rounded-xl p-4 shadow-lg relative overflow-hidden group hover:border-rose-500/60 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono-code text-rose-400 uppercase tracking-wider">
              Capital Withdrawn
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-400 flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono-code text-rose-400">
            {formatKsh(totalWithdrawn)}
          </div>
          <div className="text-[11px] font-mono-code text-slate-400 mt-0.5">
            {totalWithdrawn > 0
              ? `${withdrawalCount} liquidation event${withdrawalCount !== 1 ? 's' : ''}`
              : 'Zero liquidations to date'}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono-code">
            <span>Liquidated Outflow</span>
            <button
              onClick={onOpenWithdrawModal}
              className="text-rose-400 hover:text-rose-300 font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
              title="Record another withdrawal"
            >
              <ArrowDownRight className="w-3 h-3" />
              <span>{totalWithdrawn > 0 ? 'Withdraw More' : 'Withdraw'}</span>
            </button>
          </div>
        </div>

        {/* Metric 3: Total Vices Intercepted */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono-code text-slate-300 uppercase tracking-wider">
              Vices Intercepted
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-amber-400 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono-code text-slate-100">
            {totalVicesLogged} <span className="text-xs font-normal text-slate-400">Events</span>
          </div>
          <div className="text-[11px] font-mono-code text-slate-400 mt-0.5">
            Engagement Count
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono-code">
            <span>Discipline Rate</span>
            <span className="text-amber-400">{monthlySavingsRate}% Match</span>
          </div>
        </div>

        {/* Metric 4: Vice Spending (Base Cost) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono-code text-amber-400 uppercase tracking-wider">
              Vice Spending
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono-code text-amber-300">
            {formatKsh(viceSpending)}
          </div>
          <div className="text-[11px] font-mono-code text-slate-400 mt-0.5">
            Discretionary Base
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono-code">
            <span>Direct Outlay</span>
            <span className="text-slate-400">Expense</span>
          </div>
        </div>

        {/* Metric 5: Total Financial Outflow */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono-code text-slate-300 uppercase tracking-wider">
              Total Outflow
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono-code text-slate-200">
            {formatKsh(totalOutflow)}
          </div>
          <div className="text-[11px] font-mono-code text-slate-400 mt-0.5">
            Base + Saved Levy
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono-code">
            <span>Total Financed</span>
            <span className="text-slate-400">Commitment</span>
          </div>
        </div>
      </div>

      {/* Agency Rank Progression Card (FR-20, BRD 4.4) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center text-2xl shadow-inner">
              {currentRank.badge}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold font-tactical text-slate-100 uppercase tracking-wide">
                  Agency Clearance: {currentRank.rank}
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-mono-code bg-emerald-950 text-emerald-400 border border-emerald-500/30 rounded">
                  {currentRank.code}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono-code">
                {currentRank.description}
              </p>
            </div>
          </div>

          <button
            onClick={onOpenRankModal}
            className="text-xs font-mono-code text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
          >
            <span>View All Agency Ranks</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Progress bar towards next rank */}
        {nextRank ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono-code">
              <span className="text-slate-400">
                Next Tier: <span className="text-slate-200 font-semibold">{nextRank.rank}</span> ({formatKsh(nextRank.threshold)})
              </span>
              <span className="text-emerald-400 font-bold">
                {progressToNextRank}% Complete ({formatKsh(capitalNeededForNextRank)} to next rank)
              </span>
            </div>

            <div className="w-full bg-slate-950 rounded-full h-3.5 p-0.5 border border-slate-800 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${Math.max(4, progressToNextRank)}%` }}
              />
            </div>

            <div className="flex justify-between text-[10px] font-mono-code text-slate-500">
              <span>Current: {formatKsh(vaultCapital)}</span>
              <span>Target: {formatKsh(nextRank.threshold)}</span>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-center">
            <span className="text-xs font-bold font-mono-code text-emerald-300 flex items-center justify-center gap-1.5">
              <span>👑</span> MAXIMUM AGENCY RANK ACHIEVED (DIRECTOR)
            </span>
            <p className="text-[11px] text-slate-400 font-mono-code mt-0.5">
              Vault reserves exceed {formatKsh(currentRank.threshold)}. Supreme financial discipline established.
            </p>
          </div>
        )}
      </div>

      {/* 6-Month Comparative Chart (FR-21) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h3 className="text-base font-bold font-tactical text-slate-100 uppercase tracking-wide">
                Tactical Trend: Spending vs. Vault Savings
              </h3>
            </div>
            <p className="text-xs text-slate-400 font-mono-code">
              6-Month historical comparison of discretionary vice costs vs. matched vault capital.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono-code">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-amber-500 rounded-sm" />
              <span className="text-slate-300">Vice Spending</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
              <span className="text-slate-300">Vault Savings</span>
            </div>
          </div>
        </div>

        {/* Recharts Bar Chart Container */}
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={monthlyComparison}
              margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="monthLabel"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'Fira Code' }}
                tickLine={{ stroke: '#334155' }}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'Fira Code' }}
                tickLine={{ stroke: '#334155' }}
                tickFormatter={(val) => `Ksh ${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#090d16',
                  borderColor: '#334155',
                  borderRadius: '0.75rem',
                  fontFamily: 'Fira Code',
                  fontSize: '12px',
                  color: '#f8fafc',
                }}
                formatter={(value: any) => [formatKsh(Number(value)), '']}
                labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}
              />
              <Bar
                dataKey="viceSpending"
                name="Vice Outlay"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
                maxBarSize={45}
              />
              <Bar
                dataKey="vaultSavings"
                name="Vault Assets"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                maxBarSize={45}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          onClick={onOpenArchetypesTab}
          className="bg-slate-900/70 border border-slate-800 hover:border-emerald-500/50 rounded-xl p-4 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎯</span>
              <h4 className="text-sm font-bold font-tactical text-slate-200 group-hover:text-emerald-400">
                Manage Archetypes & Match Rates
              </h4>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400" />
          </div>
          <p className="text-xs text-slate-400 font-mono-code">
            Configure custom vice categories (e.g. Agent Cocoa ☕, Tactical Takeout 🍔) and adjust match levies (50% to 1000%).
          </p>
        </div>

        <div
          onClick={onOpenLedgerTab}
          className="bg-slate-900/70 border border-slate-800 hover:border-emerald-500/50 rounded-xl p-4 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">📜</span>
              <h4 className="text-sm font-bold font-tactical text-slate-200 group-hover:text-emerald-400">
                Intelligence History & Operation Ledger
              </h4>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400" />
          </div>
          <p className="text-xs text-slate-400 font-mono-code">
            Review paginated logs, search discretionary expenses, check backdated entries, and manage transactions.
          </p>
        </div>
      </div>
    </div>
  );
};
