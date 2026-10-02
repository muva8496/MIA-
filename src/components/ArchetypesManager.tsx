import React, { useState } from 'react';
import { Target, Plus, Edit2, Trash2, Check, X, Sparkles, Shield, AlertTriangle } from 'lucide-react';
import { Archetype, Profile } from '../types';
import { api } from '../services/api';

interface ArchetypesManagerProps {
  activeProfile: Profile;
  archetypes: Archetype[];
  onRefresh: () => void;
}

const COMMON_EMOJIS = ['☕', '🍔', '🍸', '📱', '🍩', '🚬', '🎮', '👗', '🚕', '🍕', '🍿', '🛍️', '🎧', '⚡'];
const MATCH_PRESETS = [
  { label: '50%', value: 0.5, desc: 'Conservative levy' },
  { label: '100%', value: 1.0, desc: '1:1 Standard match' },
  { label: '150%', value: 1.5, desc: 'Aggressive growth' },
  { label: '200%', value: 2.0, desc: '2x Heavy penalty' },
  { label: '300%', value: 3.0, desc: '3x Severe levy' },
];

export const ArchetypesManager: React.FC<ArchetypesManagerProps> = ({
  activeProfile,
  archetypes,
  onRefresh,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingArchetype, setEditingArchetype] = useState<Archetype | null>(null);
  
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('☕');
  const [matchRate, setMatchRate] = useState<number>(1.0);
  const [customRateInput, setCustomRateInput] = useState<string>('100');
  const [isCustomRate, setIsCustomRate] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setEditingArchetype(null);
    setName('');
    setEmoji('☕');
    setMatchRate(1.0);
    setCustomRateInput('100');
    setIsCustomRate(false);
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (arch: Archetype) => {
    setEditingArchetype(arch);
    setName(arch.name);
    setEmoji(arch.emoji);
    setMatchRate(arch.matchRate);
    setCustomRateInput(String(Math.round(arch.matchRate * 100)));
    const isPreset = MATCH_PRESETS.some((p) => Math.abs(p.value - arch.matchRate) < 0.001);
    setIsCustomRate(!isPreset);
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Archetype name is required');
      return;
    }

    let rateToSave = matchRate;
    if (isCustomRate) {
      const parsed = parseFloat(customRateInput);
      if (isNaN(parsed) || parsed < 0 || parsed > 1000) {
        setError('Custom match rate must be between 0% and 1000%');
        return;
      }
      rateToSave = parsed / 100;
    }

    setLoading(true);
    setError(null);

    try {
      if (editingArchetype) {
        await api.updateArchetype(editingArchetype.id, name.trim(), emoji, rateToSave);
      } else {
        await api.createArchetype(activeProfile.id, name.trim(), emoji, rateToSave);
      }
      onRefresh();
      setModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save archetype');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      await api.deleteArchetype(id);
      setDeleteConfirmId(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete archetype');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🎯</span>
            <h2 className="text-xl font-bold font-tactical text-slate-100 uppercase tracking-wide">
              Vice Archetypes Catalog
            </h2>
          </div>
          <p className="text-xs text-slate-400 font-mono-code mt-0.5">
            Configured for Profile: <span className="text-emerald-400">{activeProfile.emoji} {activeProfile.name}</span>. Set custom match rates (0% to 1000%).
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl flex items-center gap-2 text-xs uppercase tracking-wider font-tactical shadow-lg shadow-emerald-500/20 transition-all cursor-pointer hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create New Archetype</span>
        </button>
      </div>

      {/* Archetypes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {archetypes.map((arch) => {
          const matchPercent = Math.round(arch.matchRate * 100);
          return (
            <div
              key={arch.id}
              className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-xl p-4 shadow-lg flex flex-col justify-between transition-all group"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-2xl group-hover:border-emerald-500/40 transition-colors">
                      {arch.emoji}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-100 font-tactical">
                        {arch.name}
                      </h3>
                      <span className="text-[11px] font-mono-code text-slate-400">
                        LEV_CODE: {arch.id.slice(0, 8)}
                      </span>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 text-xs font-bold font-mono-code bg-emerald-950 border border-emerald-500/40 text-emerald-400 rounded-lg">
                    {matchPercent}% LEVY
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 text-xs font-mono-code space-y-1 mb-4">
                  <div className="flex justify-between text-slate-400">
                    <span>Example Base Vice:</span>
                    <span className="text-amber-400">Ksh 1,000</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Vault Matched Savings:</span>
                    <span className="text-emerald-400 font-bold">
                      Ksh {Math.round(1000 * arch.matchRate)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400 border-t border-slate-900 pt-1">
                    <span>Committed Outflow:</span>
                    <span className="text-slate-200 font-bold">
                      Ksh {1000 + Math.round(1000 * arch.matchRate)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
                <button
                  onClick={() => handleOpenEdit(arch)}
                  className="px-2.5 py-1 text-xs font-mono-code text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Configure</span>
                </button>

                {deleteConfirmId === arch.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(arch.id)}
                      disabled={loading}
                      className="px-2 py-1 text-[11px] font-mono-code bg-rose-900/80 hover:bg-rose-800 text-rose-200 rounded cursor-pointer"
                    >
                      Confirm Decom
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="p-1 text-slate-400 hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirmId(arch.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded cursor-pointer transition-colors"
                    title="Decommission Archetype"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {archetypes.length === 0 && (
        <div className="p-8 bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl text-center">
          <p className="text-sm font-mono-code text-slate-400 mb-3">
            No archetypes found for this profile. Create one to begin logging vice transactions.
          </p>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs uppercase font-tactical cursor-pointer"
          >
            + Create First Archetype
          </button>
        </div>
      )}

      {/* Archetype Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold font-tactical text-slate-100 uppercase tracking-wide">
                {editingArchetype ? 'Configure Vice Archetype' : 'New Vice Archetype Protocol'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-2.5 bg-rose-950/60 border border-rose-500/40 rounded-lg text-xs font-mono-code text-rose-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono-code text-slate-300 mb-1 uppercase">
                  Select Visual Icon (Emoji)
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-950 border border-slate-800 rounded-xl">
                  {COMMON_EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEmoji(e)}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all cursor-pointer ${
                        emoji === e
                          ? 'bg-emerald-950 border border-emerald-500 text-emerald-400 scale-110 shadow-sm'
                          : 'hover:bg-slate-800'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono-code text-slate-300 mb-1 uppercase">
                  Archetype Name
                </label>
                <div className="flex gap-2">
                  <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-center text-xl shrink-0">
                    {emoji}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Agent Cocoa, Night Taxi, Snack Run"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono-code text-slate-300 mb-1 uppercase flex items-center justify-between">
                  <span>Match Rate Levy</span>
                  <span className="text-emerald-400 font-bold">
                    {isCustomRate ? `${customRateInput}%` : `${Math.round(matchRate * 100)}%`}
                  </span>
                </label>

                {/* Preset Buttons */}
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {MATCH_PRESETS.map((preset) => {
                    const isSelected = !isCustomRate && Math.abs(matchRate - preset.value) < 0.001;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setIsCustomRate(false);
                          setMatchRate(preset.value);
                          setCustomRateInput(String(Math.round(preset.value * 100)));
                        }}
                        className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <span className="block text-xs font-mono-code">{preset.label}</span>
                        <span className="block text-[9px] text-slate-500">{preset.desc}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setIsCustomRate(true)}
                    className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                      isCustomRate
                        ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="block text-xs font-mono-code">Custom</span>
                    <span className="block text-[9px] text-slate-500">0% - 1000%</span>
                  </button>
                </div>

                {isCustomRate && (
                  <div className="mt-2">
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        step="5"
                        value={customRateInput}
                        onChange={(e) => setCustomRateInput(e.target.value)}
                        className="w-full bg-slate-950 border border-emerald-500/50 rounded-lg px-3 py-2 text-sm font-mono-code text-emerald-300 focus:outline-none"
                        placeholder="e.g. 75 or 250"
                      />
                      <span className="absolute right-3 top-2.5 text-xs font-mono-code text-slate-500">
                        % Match
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono-code cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs uppercase tracking-wider font-tactical cursor-pointer"
                >
                  {loading ? 'Saving...' : editingArchetype ? 'Update Archetype' : 'Establish Archetype'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
