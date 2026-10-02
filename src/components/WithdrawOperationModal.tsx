import React, { useState } from 'react';
import { X, ArrowDownRight, AlertCircle, ShieldAlert, CheckCircle2, DollarSign, Wallet, Calendar, AlertTriangle } from 'lucide-react';
import { Profile } from '../types';
import { api } from '../services/api';
import { persistTransactionToFirestore } from '../services/firebase';
import { formatKsh, getRankForCapital } from '../utils/ranks';

interface WithdrawOperationModalProps {
  isOpen: boolean;
  activeProfile: Profile | null;
  vaultCapital: number;
  totalWithdrawn?: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const WithdrawOperationModal: React.FC<WithdrawOperationModalProps> = ({
  isOpen,
  activeProfile,
  vaultCapital,
  totalWithdrawn = 0,
  onClose,
  onSuccess,
}) => {
  const [withdrawalAmount, setWithdrawalAmount] = useState<string>('');
  const [withdrawalDate, setWithdrawalDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [reason, setReason] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !activeProfile) return null;

  const numericAmount = Math.max(0, parseFloat(withdrawalAmount) || 0);
  const isExceeding = numericAmount > vaultCapital;
  const remainingCapital = Math.max(0, vaultCapital - numericAmount);

  // Ranks before and after withdrawal to provide tactical intelligence
  const currentRankInfo = getRankForCapital(vaultCapital);
  const projectedRankInfo = getRankForCapital(remainingCapital);
  const willDemote = projectedRankInfo.currentRank.code !== currentRankInfo.currentRank.code;

  const quickPresets = [
    { label: '25%', value: Math.floor(vaultCapital * 0.25) },
    { label: '50%', value: Math.floor(vaultCapital * 0.5) },
    { label: '75%', value: Math.floor(vaultCapital * 0.75) },
    { label: 'Max (100%)', value: vaultCapital },
  ].filter((p) => p.value > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (numericAmount <= 0) {
      setError('Please enter a valid withdrawal amount (minimum Ksh 1).');
      return;
    }

    if (numericAmount > vaultCapital) {
      setError(
        `Withdrawal amount (Ksh ${numericAmount.toLocaleString()}) exceeds your available vault capital of Ksh ${vaultCapital.toLocaleString()}.`
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const itemName = reason.trim() || 'Vault Capital Liquidation';
      const fullNote = [
        note.trim(),
        reason.trim() ? `Reason: ${reason.trim()}` : '',
      ]
        .filter(Boolean)
        .join(' | ');

      const res = await api.logTransaction({
        profileId: activeProfile.id,
        isDirectDeposit: false,
        isWithdrawal: true,
        itemName,
        amount: numericAmount,
        baseCost: 0,
        purchaseDate: withdrawalDate,
        note: fullNote || 'Operational withdrawal from vault capital',
      });

      if (res.transaction) {
        persistTransactionToFirestore(res.transaction).catch((e) =>
          console.warn('[Firestore] Withdrawal sync notice:', e)
        );
      }

      // Reset
      setWithdrawalAmount('');
      setReason('');
      setNote('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Withdrawal operation failed to execute.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-mono-code bg-rose-950 text-rose-300 border border-rose-500/40 rounded uppercase font-bold tracking-wider">
                CAPITAL LIQUIDATION
              </span>
              <span className="text-xs text-slate-400 font-mono-code">
                VAULT: {activeProfile.emoji} {activeProfile.name}
              </span>
            </div>
            <h2 className="text-lg font-bold font-tactical text-slate-100 uppercase tracking-wide mt-0.5 flex items-center gap-2">
              <ArrowDownRight className="w-5 h-5 text-rose-400" />
              <span>Record Vault Withdrawal</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {/* Available Vault Balance Banner */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-mono-code text-slate-400 uppercase tracking-wider block">
                  Available Vault Capital
                </span>
                <span className="text-xl font-bold font-mono-code text-emerald-400">
                  {formatKsh(vaultCapital)}
                </span>
              </div>
            </div>

            <div className="flex items-center sm:flex-col sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
              <span className="text-[10px] font-mono-code text-slate-400 uppercase block">
                Total Liquidated to Date
              </span>
              <span className="text-sm font-mono-code font-bold text-rose-400 flex items-center gap-1">
                <ArrowDownRight className="w-3.5 h-3.5" />
                {formatKsh(totalWithdrawn)}
              </span>
            </div>
          </div>

          {/* Validation Error Banner */}
          {error && (
            <div className="p-3.5 bg-rose-950/60 border border-rose-500/50 rounded-xl flex items-start gap-2.5 text-xs text-rose-200 font-mono-code animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Over-draw Live Warning */}
          {isExceeding && (
            <div className="p-3 bg-amber-950/60 border border-amber-500/50 rounded-xl flex items-start gap-2 text-xs text-amber-200 font-mono-code">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block uppercase text-amber-300">
                  Deficit Alert: Amount Exceeds Vault Capital
                </span>
                <span>
                  You cannot withdraw more than the available reserve ({formatKsh(vaultCapital)}). The transaction will be rejected.
                </span>
              </div>
            </div>
          )}

          {/* Rank Demotion Warning if applicable */}
          {!isExceeding && willDemote && numericAmount > 0 && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl flex items-start gap-2 text-xs text-rose-300 font-mono-code">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block uppercase text-rose-300">
                  Rank Impact Warning
                </span>
                <span>
                  This withdrawal reduces vault capital below the threshold for {currentRankInfo.currentRank.rank} ({currentRankInfo.currentRank.code}). Your projected rank will readjust to {projectedRankInfo.currentRank.badge} {projectedRankInfo.currentRank.rank}.
                </span>
              </div>
            </div>
          )}

          {/* Withdrawal Amount Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono-code text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-rose-400" />
                <span>Withdrawal Amount (Ksh) *</span>
              </label>
              <span className="text-[11px] font-mono-code text-slate-400">
                Max: {formatKsh(vaultCapital)}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono-code font-bold text-slate-400">
                Ksh
              </span>
              <input
                type="number"
                min="1"
                max={vaultCapital}
                step="1"
                placeholder="0"
                value={withdrawalAmount}
                onChange={(e) => {
                  setWithdrawalAmount(e.target.value);
                  if (error) setError(null);
                }}
                className={`w-full bg-slate-950 border rounded-xl pl-13 pr-4 py-3 text-lg font-mono-code font-bold text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors ${
                  isExceeding
                    ? 'border-rose-500 text-rose-300 focus:border-rose-400'
                    : 'border-slate-700 focus:border-rose-500'
                }`}
                required
                autoFocus
              />
            </div>

            {/* Quick Percentage Presets */}
            {quickPresets.length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-mono-code text-slate-400 uppercase">
                  Quick Select:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {quickPresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setWithdrawalAmount(String(preset.value));
                        if (error) setError(null);
                      }}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono-code text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                    >
                      {preset.label} ({formatKsh(preset.value)})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Reason / Purpose of Withdrawal */}
          <div>
            <label className="block text-xs font-mono-code text-slate-300 uppercase tracking-wider mb-1.5">
              Liquidation Purpose / Reason
            </label>
            <input
              type="text"
              placeholder="e.g., Emergency Expense, Asset Purchase, School Fees"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Date Picker */}
          <div>
            <label className="text-xs font-mono-code text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Withdrawal Date (Backdate Support)</span>
            </label>
            <input
              type="date"
              value={withdrawalDate}
              onChange={(e) => setWithdrawalDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono-code text-slate-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Operational Notes */}
          <div>
            <label className="block text-xs font-mono-code text-slate-300 uppercase tracking-wider mb-1.5">
              Operational Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Additional mission context or audit notes..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-rose-500 resize-none"
            />
          </div>

          {/* Impact Preview */}
          {numericAmount > 0 && !isExceeding && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs font-mono-code">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                Telemetry Impact Simulation
              </span>
              <div className="flex items-center justify-between text-slate-300">
                <span>Amount to Withdraw:</span>
                <span className="font-bold text-rose-400">
                  -{formatKsh(numericAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Vault Capital After Deduction:</span>
                <span className="font-bold text-emerald-400">
                  {formatKsh(remainingCapital)}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Total Liquidated (Post-Op):</span>
                <span className="font-bold text-rose-300">
                  {formatKsh(totalWithdrawn + numericAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Projected Agency Rank:</span>
                <span className="font-bold text-slate-200">
                  {projectedRankInfo.currentRank.badge} {projectedRankInfo.currentRank.rank}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-mono-code text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || isExceeding || numericAmount <= 0}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-xl text-xs uppercase font-tactical tracking-wider shadow-lg shadow-rose-600/20 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
            >
              {loading ? (
                <span>Executing Liquidation...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Execute Withdrawal</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
