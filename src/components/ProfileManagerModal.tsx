import React, { useState } from 'react';
import { X, Users, Plus, Edit2, Trash2, Check, AlertCircle, Shield } from 'lucide-react';
import { Profile } from '../types';
import { api } from '../services/api';

interface ProfileManagerModalProps {
  isOpen: boolean;
  profiles: Profile[];
  activeProfile: Profile | null;
  onClose: () => void;
  onSelectProfile: (profile: Profile) => void;
  onProfilesUpdated: () => void;
}

const PROFILE_EMOJIS = ['🕵️‍♂️', '👩‍💼', '👨‍💼', '👨', '👩', '👦', '👧', '🎯', '🦅', '⚡', '👑', '💼', '🚀', '⭐'];

export const ProfileManagerModal: React.FC<ProfileManagerModalProps> = ({
  isOpen,
  profiles,
  activeProfile,
  onClose,
  onSelectProfile,
  onProfilesUpdated,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🕵️‍♂️');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setEditingProfileId(null);
    setName('');
    setEmoji('🕵️‍♂️');
    setError(null);
    setIsCreating(true);
  };

  const handleStartEdit = (p: Profile) => {
    setIsCreating(false);
    setEditingProfileId(p.id);
    setName(p.name);
    setEmoji(p.emoji);
    setError(null);
  };

  const handleCancelForm = () => {
    setIsCreating(false);
    setEditingProfileId(null);
    setName('');
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Profile display name required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (editingProfileId) {
        await api.updateProfile(editingProfileId, name.trim(), emoji);
      } else {
        const res = await api.createProfile(name.trim(), emoji);
        onSelectProfile(res.profile);
      }
      onProfilesUpdated();
      handleCancelForm();
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (profiles.length <= 1) {
      setError('Cannot delete profile: At least 1 active profile must remain (FR-08)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.deleteProfile(id);
      onProfilesUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to retire profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold font-tactical text-slate-100 uppercase tracking-wide">
              Intelligence Profiles Manager
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-2.5 bg-rose-950/60 border border-rose-500/40 rounded-lg text-xs font-mono-code text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Create or Edit Form */}
        {(isCreating || editingProfileId) && (
          <form onSubmit={handleSave} className="mb-5 p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs font-mono-code text-emerald-400">
              <span>{editingProfileId ? 'RENAME PROFILE & BADGE' : 'CREATE NEW CLEARANCE PROFILE'}</span>
              <button
                type="button"
                onClick={handleCancelForm}
                className="text-slate-500 hover:text-slate-300 text-[11px]"
              >
                Cancel
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-mono-code text-slate-400 mb-1">
                SELECT PROFILE ICON
              </label>
              <div className="flex flex-wrap gap-1">
                {PROFILE_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-base cursor-pointer ${
                      emoji === e
                        ? 'bg-emerald-950 border border-emerald-500 text-emerald-400 shadow-sm'
                        : 'hover:bg-slate-800'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono-code text-slate-400 mb-1">
                PROFILE NAME (e.g. Mum, Dad, Junior, Personal)
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Junior"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono-code"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-3 py-1 bg-slate-800 text-slate-300 rounded text-xs font-mono-code"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded text-xs font-tactical uppercase cursor-pointer"
              >
                {loading ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        )}

        {/* Existing Profiles List */}
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          <div className="flex items-center justify-between text-[11px] font-mono-code text-slate-400 px-1">
            <span>REGISTERED PROFILES ({profiles.length})</span>
            {!isCreating && !editingProfileId && (
              <button
                type="button"
                onClick={handleStartCreate}
                className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Profile</span>
              </button>
            )}
          </div>

          {profiles.map((p) => {
            const isActive = p.id === activeProfile?.id;
            return (
              <div
                key={p.id}
                className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                  isActive
                    ? 'bg-slate-950 border-emerald-500/50 shadow-sm'
                    : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                <div
                  onClick={() => {
                    onSelectProfile(p);
                    onClose();
                  }}
                  className="flex items-center gap-3 cursor-pointer flex-1"
                >
                  <span className="text-2xl">{p.emoji}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-100">{p.name}</span>
                      {isActive && (
                        <span className="text-[9px] font-mono-code bg-emerald-950 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono-code text-slate-500">
                      ID: {p.id.slice(0, 8)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleStartEdit(p)}
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded cursor-pointer"
                    title="Rename Profile"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {profiles.length > 1 && (
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={loading}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded cursor-pointer"
                      title="Retire Profile (Min 1 must remain)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 pt-3 border-t border-slate-800 text-center">
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono-code rounded-xl cursor-pointer"
          >
            Close Manager
          </button>
        </div>
      </div>
    </div>
  );
};
