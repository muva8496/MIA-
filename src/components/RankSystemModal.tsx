import React from 'react';
import { X, Award, Shield, CheckCircle2, Lock } from 'lucide-react';
import { AGENCY_RANKS, formatKsh } from '../utils/ranks';
import { AgencyRank } from '../types';
import { AgencyLogo } from './AgencyLogo';

interface RankSystemModalProps {
  isOpen: boolean;
  currentRank: AgencyRank;
  vaultCapital: number;
  onClose: () => void;
}

export const RankSystemModal: React.FC<RankSystemModalProps> = ({
  isOpen,
  currentRank,
  vaultCapital,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <AgencyLogo size="sm" variant="icon" />
            <div>
              <h3 className="text-base font-bold font-tactical text-slate-100 uppercase tracking-wide">
                Agency Clearance Hierarchy
              </h3>
              <p className="text-[11px] font-mono-code text-slate-400">
                Current Vault Capital: <span className="text-emerald-400 font-bold">{formatKsh(vaultCapital)}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto space-y-3 pr-1 flex-1">
          {AGENCY_RANKS.map((rank) => {
            const isUnlocked = vaultCapital >= rank.threshold;
            const isCurrent = rank.rank === currentRank.rank;

            return (
              <div
                key={rank.rank}
                className={`p-3.5 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-emerald-950/40 border-emerald-500 shadow-md ring-1 ring-emerald-500/50'
                    : isUnlocked
                    ? 'bg-slate-950/90 border-slate-800'
                    : 'bg-slate-950/40 border-slate-900 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-xl shrink-0">
                      {rank.badge}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-100 font-tactical">
                          {rank.rank}
                        </span>
                        <span className="text-[9px] font-mono-code px-1.5 py-0.2 bg-slate-900 border border-slate-700 text-slate-300 rounded">
                          {rank.code}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] font-mono-code bg-emerald-950 text-emerald-400 border border-emerald-500/40 px-1.5 py-0.2 rounded font-bold">
                            CURRENT
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono-code mt-0.5">
                        {rank.description}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold font-mono-code text-slate-200 block">
                      {formatKsh(rank.threshold)}
                    </span>
                    <span className="text-[10px] font-mono-code flex items-center justify-end gap-1 mt-0.5">
                      {isUnlocked ? (
                        <span className="text-emerald-400 flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" /> Cleared
                        </span>
                      ) : (
                        <span className="text-slate-500 flex items-center gap-0.5">
                          <Lock className="w-3 h-3" /> Locked
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono-code rounded-xl cursor-pointer"
          >
            Dismiss Dossier
          </button>
        </div>
      </div>
    </div>
  );
};
