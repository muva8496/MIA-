import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Sparkles, Plus, Calendar, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Archetype, Profile } from '../types';
import { api } from '../services/api';
import { persistTransactionToFirestore } from '../services/firebase';
import { formatKsh } from '../utils/ranks';

interface LogOperationModalProps {
  isOpen: boolean;
  activeProfile: Profile;
  archetypes: Archetype[];
  onClose: () => void;
  onSuccess: () => void;
  onOpenArchetypeModal?: () => void;
}

export const LogOperationModal: React.FC<LogOperationModalProps> = ({
  isOpen,
  activeProfile,
  archetypes,
  onClose,
  onSuccess,
  onOpenArchetypeModal,
}) => {
  const [tab, setTab] = useState<'vice' | 'deposit'>('vice');
  
  // Vice form fields
  const [selectedArchetypeId, setSelectedArchetypeId] = useState<string>('');
  const [itemName, setItemName] = useState<string>('');
  const [baseCost, setBaseCost] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState<string>('');

  // Deposit form fields
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [depositDate, setDepositDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [depositNote, setDepositNote] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set default archetype when opened
  useEffect(() => {
    if (archetypes.length > 0 && !selectedArchetypeId) {
      setSelectedArchetypeId(archetypes[0].id);
    }
  }, [archetypes, selectedArchetypeId]);

  if (!isOpen) return null;

  const currentArchetype = archetypes.find((a) => a.id === selectedArchetypeId) || archetypes[0];
  const numBaseCost = Math.max(0, parseFloat(baseCost) || 0);
  const matchRate = currentArchetype ? currentArchetype.matchRate : 1.0;
  const estimatedSavingsLevy = Math.round(numBaseCost * matchRate);
  const estimatedTotalOutflow = numBaseCost + estimatedSavingsLevy;

  const handleSubmitVice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentArchetype) {
      setError('Please create or select an archetype first');
      return;
    }
    if (numBaseCost <= 0) {
      setError('Please enter a valid base cost (Ksh)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.logTransaction({
        profileId: activeProfile.id,
        isDirectDeposit: false,
        archetypeId: currentArchetype.id,
        itemName: itemName.trim() || currentArchetype.name,
        baseCost: numBaseCost,
        purchaseDate,
        note: note.trim() || undefined,
      });

      if (res.transaction) {
        persistTransactionToFirestore(res.transaction).catch((e) =>
          console.warn('[Firestore] Transaction sync notice:', e)
        );
      }

      // Confetti burst
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#10b981', '#34d399', '#f59e0b'],
      });

      onSuccess();
      onClose();
      // Reset form
      setItemName('');
      setBaseCost('');
      setNote('');
    } catch (err: any) {
      setError(err.message || 'Operation intercept logging failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Math.max(0, parseFloat(depositAmount) || 0);
    if (amount <= 0) {
      setError('Please enter a valid deposit amount (Ksh)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.logTransaction({
        profileId: activeProfile.id,
        isDirectDeposit: true,
        itemName: depositNote.trim() || 'Direct Vault Deposit',
        amount,
        purchaseDate: depositDate,
        note: depositNote.trim() || undefined,
      });

      if (res.transaction) {
        persistTransactionToFirestore(res.transaction).catch((e) =>
          console.warn('[Firestore] Deposit sync notice:', e)
        );
      }

      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.7 },
        colors: ['#10b981', '#34d399', '#6ee7b7'],
      });

      onSuccess();
      onClose();
      setDepositAmount('');
      setDepositNote('');
    } catch (err: any) {
      setError(err.message || 'Vault deposit failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-mono-code bg-emerald-950 text-emerald-400 border border-emerald-500/30 rounded">
                CLASSIFIED OPERATION
              </span>
              <span className="text-xs text-slate-400 font-mono-code">
                PROFILE: {activeProfile.emoji} {activeProfile.name}
              </span>
            </div>
            <h2 className="text-lg font-bold font-tactical text-slate-100 uppercase tracking-wide mt-0.5">
              Operation Ledger Entry
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="p-6 pb-0">
          <div className="grid grid-cols-2 p-1 bg-slate-950 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setTab('vice');
                setError(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-mono-code uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                tab === 'vice'
                  ? 'bg-amber-950/70 border border-amber-500/50 text-amber-300 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🚨</span>
              <span>Vice Intercept</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('deposit');
                setError(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-mono-code uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                tab === 'deposit'
                  ? 'bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>💰</span>
              <span>Vault Quick Save</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-rose-950/60 border border-rose-500/40 rounded-lg text-xs font-mono-code text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {tab === 'vice' ? (
            <form onSubmit={handleSubmitVice} className="space-y-4">
              {archetypes.length === 0 ? (
                <div className="p-4 bg-slate-950 border border-dashed border-slate-700 rounded-xl text-center">
                  <p className="text-xs text-slate-400 mb-2">No active archetypes configured for this profile.</p>
                  {onOpenArchetypeModal && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenArchetypeModal();
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold font-mono-code rounded-lg cursor-pointer"
                    >
                      + Create First Archetype (e.g. Agent Cocoa ☕)
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Archetype Selector */}
                  <div>
                    <label className="block text-xs font-mono-code text-slate-300 mb-1.5 uppercase">
                      Select Vice Archetype
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {archetypes.map((arch) => {
                        const isSelected = (currentArchetype?.id === arch.id);
                        return (
                          <button
                            key={arch.id}
                            type="button"
                            onClick={() => setSelectedArchetypeId(arch.id)}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                              isSelected
                                ? 'bg-amber-950/40 border-amber-500 text-amber-200 ring-1 ring-amber-500'
                                : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xl">{arch.emoji}</span>
                              <span className="text-[10px] font-mono-code px-1.5 py-0.5 bg-slate-900 rounded text-emerald-400 border border-emerald-500/20">
                                {Math.round(arch.matchRate * 100)}%
                              </span>
                            </div>
                            <span className="text-xs font-semibold truncate block">
                              {arch.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Item Description */}
                  <div>
                    <label className="block text-xs font-mono-code text-slate-300 mb-1.5 uppercase">
                      Discretionary Item / Vice Name
                    </label>
                    <input
                      type="text"
                      placeholder={`e.g., Mocha Latte, Burger Meal, Night Uber`}
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Base Cost & Date Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-mono-code text-slate-300 mb-1.5 uppercase">
                        Base Cost (Ksh) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-xs font-mono-code text-slate-500">
                          Ksh
                        </span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          required
                          placeholder="450"
                          value={baseCost}
                          onChange={(e) => setBaseCost(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-12 pr-3.5 py-2 text-sm font-mono-code text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {/* Backdating purchase date (FR-17, BRD 4.3) */}
                    <div>
                      <label className="block text-xs font-mono-code text-slate-300 mb-1.5 uppercase flex items-center justify-between">
                        <span>Purchase Date</span>
                        <span className="text-[10px] text-slate-500 font-normal">Backdate OK</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={purchaseDate}
                        max={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setPurchaseDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono-code text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Real-time breakdown calculation box (FR-15, BRD 4.1) */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] font-mono-code text-slate-400 border-b border-slate-900 pb-1.5">
                      <span>TACTICAL LEVY BREAKDOWN (REAL-TIME)</span>
                      <span className="text-amber-400">
                        {currentArchetype?.name} ({Math.round(matchRate * 100)}% Match)
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center items-center">
                      <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                        <span className="block text-[10px] font-mono-code text-slate-400 uppercase">
                          Base Cost
                        </span>
                        <span className="text-xs font-bold font-mono-code text-amber-300">
                          {formatKsh(numBaseCost)}
                        </span>
                      </div>

                      <div className="bg-emerald-950/40 p-2 rounded-lg border border-emerald-500/30">
                        <span className="block text-[10px] font-mono-code text-emerald-400 uppercase">
                          + Savings Levy
                        </span>
                        <span className="text-xs font-bold font-mono-code text-emerald-300">
                          {formatKsh(estimatedSavingsLevy)}
                        </span>
                      </div>

                      <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                        <span className="block text-[10px] font-mono-code text-slate-400 uppercase">
                          = Total Outflow
                        </span>
                        <span className="text-xs font-bold font-mono-code text-slate-200">
                          {formatKsh(estimatedTotalOutflow)}
                        </span>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-500 font-mono-code italic text-center">
                      * You spend {formatKsh(numBaseCost)} on your vice and set aside {formatKsh(estimatedSavingsLevy)} into your vault.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || numBaseCost <= 0}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm uppercase tracking-wider font-tactical shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <span>INTERCEPTING & LOGGING...</span>
                    ) : (
                      <>
                        <ShieldAlert className="w-4 h-4" />
                        <span>AUTHORIZE VICE INTERCEPT ({formatKsh(estimatedSavingsLevy)} SAVED)</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </form>
          ) : (
            /* Direct Deposit Form (FR-18, BRD 4.2) */
            <form onSubmit={handleSubmitDeposit} className="space-y-4">
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-mono-code flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Direct deposits add pure capital to your vault with 0 base cost and 0 vice outflow. Perfect for cash windfalls, bonuses, or side hustles.
                </span>
              </div>

              <div>
                <label className="block text-xs font-mono-code text-slate-300 mb-1.5 uppercase">
                  Deposit Capital Amount (Ksh) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-mono-code text-slate-500">
                    Ksh
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    placeholder="1000"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-12 pr-3.5 py-2 text-sm font-mono-code text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono-code text-slate-300 mb-1.5 uppercase">
                  Deposit Reason / Note <span className="text-slate-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Birthday money, Freelance bounty, Dividend"
                  value={depositNote}
                  onChange={(e) => setDepositNote(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono-code text-slate-300 mb-1.5 uppercase flex items-center justify-between">
                  <span>Deposit Date</span>
                  <span className="text-[10px] text-slate-500 font-normal">Backdate OK</span>
                </label>
                <input
                  type="date"
                  required
                  value={depositDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDepositDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono-code text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading || (parseFloat(depositAmount) || 0) <= 0}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm uppercase tracking-wider font-tactical shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span>TRANSFERRING TO VAULT...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>DEPOSIT {formatKsh(parseFloat(depositAmount) || 0)} DIRECTLY</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
