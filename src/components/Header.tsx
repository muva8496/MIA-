import React, { useState, useRef, useEffect } from 'react';
import { Shield, ChevronDown, Plus, Users, PlusCircle, LogOut, Radio, LayoutDashboard, Target, History, Award, Database, ArrowDownRight, Vault, Cloud, CheckCircle } from 'lucide-react';
import { Profile, User } from '../types';
import { formatKsh } from '../utils/ranks';

interface HeaderProps {
  user: User;
  profiles: Profile[];
  activeProfile: Profile | null;
  activeTab: 'dashboard' | 'archetypes' | 'ledger' | 'ranks' | 'database' | 'voice';
  vaultCapital?: number;
  totalWithdrawn?: number;
  onSelectProfile: (profile: Profile) => void;
  onOpenNewProfile: () => void;
  onOpenManageProfiles: () => void;
  onOpenLogModal: () => void;
  onSelectTab: (tab: 'dashboard' | 'archetypes' | 'ledger' | 'ranks' | 'database' | 'voice') => void;
  onLogout: () => void;
  isVoiceConnected?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  profiles,
  activeProfile,
  activeTab,
  vaultCapital,
  totalWithdrawn,
  onSelectProfile,
  onOpenNewProfile,
  onOpenManageProfiles,
  onOpenLogModal,
  onSelectTab,
  onLogout,
  isVoiceConnected = false,
}) => {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Brand & Active Mission */}
          <div className="flex items-center gap-4">
            <div 
              onClick={() => onSelectTab('dashboard')}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-lg bg-slate-900 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-md shadow-emerald-950/50 group-hover:border-emerald-400 transition-colors">
                <Shield className="w-5 h-5" />
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold font-tactical text-slate-100 tracking-wider">
                    M.I.A.
                  </span>
                  <span className="text-[10px] font-mono-code bg-emerald-950 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                    OPS
                  </span>
                </div>
                <p className="text-[10px] font-mono-code text-slate-400 tracking-wider">
                  MICRO-INVESTMENT AGENCY
                </p>
              </div>
            </div>

            {/* Profile Switcher Dropdown (FR-06, FR-07) */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700 hover:border-emerald-500/50 text-slate-200 text-xs font-mono-code transition-all cursor-pointer shadow-sm"
              >
                <span className="text-base leading-none">
                  {activeProfile?.emoji || '🕵️‍♂️'}
                </span>
                <span className="font-semibold text-slate-200 truncate max-w-[110px] sm:max-w-[150px]">
                  {activeProfile?.name || 'Active Profile'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {profileDropdownOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 border-b border-slate-800 text-[10px] font-mono-code text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>ACTIVE CLEARANCE PROFILE</span>
                    <span className="text-emerald-400">{profiles.length} Active</span>
                  </div>

                  <div className="max-h-56 overflow-y-auto py-1">
                    {profiles.map((p) => {
                      const isActive = p.id === activeProfile?.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            onSelectProfile(p);
                            setProfileDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-emerald-950/60 text-emerald-300 font-bold border-l-2 border-emerald-500'
                              : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-base">{p.emoji}</span>
                            <span className="truncate">{p.name}</span>
                          </div>
                          {isActive && (
                            <span className="text-[10px] font-mono-code text-emerald-400 bg-emerald-900/50 px-1.5 py-0.5 rounded">
                              CURRENT
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="border-t border-slate-800 pt-1.5 px-2 space-y-1">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        onOpenNewProfile();
                      }}
                      className="w-full px-2.5 py-1.5 text-xs text-emerald-400 hover:bg-emerald-950/40 rounded-lg flex items-center gap-2 cursor-pointer font-mono-code"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create New Profile (e.g. Mum, Junior)</span>
                    </button>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        onOpenManageProfiles();
                      }}
                      className="w-full px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg flex items-center gap-2 cursor-pointer font-mono-code"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Manage / Edit Profiles</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Tactical Telemetry Badges */}
            {vaultCapital !== undefined && (
              <div className="hidden xl:flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-xs font-mono-code text-emerald-300">
                  <Vault className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] text-slate-400">VAULT:</span>
                  <span className="font-bold">{formatKsh(vaultCapital)}</span>
                </div>
                {totalWithdrawn !== undefined && totalWithdrawn > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/60 border border-rose-500/40 text-xs font-mono-code text-rose-300">
                    <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                    <span className="text-[10px] text-rose-400">WITHDRAWN:</span>
                    <span className="font-bold">{formatKsh(totalWithdrawn)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/80 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono-code uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-slate-800 text-emerald-400 font-bold border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Command Center</span>
            </button>

            <button
              onClick={() => onSelectTab('archetypes')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono-code uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'archetypes'
                  ? 'bg-slate-800 text-emerald-400 font-bold border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Archetypes</span>
            </button>

            <button
              onClick={() => onSelectTab('ledger')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono-code uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'ledger'
                  ? 'bg-slate-800 text-emerald-400 font-bold border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Ledger</span>
            </button>

            <button
              onClick={() => onSelectTab('ranks')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono-code uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'ranks'
                  ? 'bg-slate-800 text-emerald-400 font-bold border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Ranks</span>
            </button>

            <button
              onClick={() => onSelectTab('database')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono-code uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'database'
                  ? 'bg-emerald-950/80 text-emerald-400 font-bold border border-emerald-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-emerald-400'
              }`}
              title="Scalable Database Studio & Firestore Console"
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Database Studio</span>
            </button>

            <button
              onClick={() => onSelectTab('voice')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono-code uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'voice'
                  ? 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-500 shadow-md shadow-emerald-950/50'
                  : isVoiceConnected
                  ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-500/40 animate-pulse'
                  : 'text-slate-400 hover:text-emerald-400'
              }`}
              title="Tactical Voice Comms (Live API)"
            >
              <Radio className={`w-3.5 h-3.5 ${isVoiceConnected ? 'text-emerald-400 animate-pulse' : ''}`} />
              <span>Voice Comms</span>
              {isVoiceConnected && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              )}
            </button>
          </nav>

          {/* Action CTAs & User Control */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={onOpenLogModal}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs uppercase tracking-wider font-tactical shadow-md shadow-emerald-500/20 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Log Vice / Quick Save</span>
              <span className="sm:hidden">Log</span>
            </button>

            {/* User Menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="h-9 px-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 flex items-center gap-1.5 cursor-pointer transition-colors"
                title={user.email}
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.codename}
                    className="w-5 h-5 rounded-full border border-emerald-500/50 object-cover"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-500/50 flex items-center justify-center text-[10px] font-bold text-emerald-400">
                    {user.codename ? user.codename.charAt(0).toUpperCase() : 'A'}
                  </div>
                )}
                <span className="hidden lg:inline text-xs font-mono-code text-slate-300 max-w-[100px] truncate">
                  {user.codename}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-2 border-b border-slate-800">
                    <div className="flex items-center gap-2 mb-1">
                      {user.photoURL && (
                        <img
                          src={user.photoURL}
                          alt={user.codename}
                          className="w-6 h-6 rounded-full border border-emerald-500/50 object-cover"
                        />
                      )}
                      <p className="text-xs font-bold text-slate-100 truncate">{user.codename}</p>
                    </div>
                    <p className="text-[10px] font-mono-code text-slate-400 truncate">{user.email}</p>
                    {user.authProvider === 'google' && (
                      <span className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono-code bg-emerald-950/70 border border-emerald-500/40 text-emerald-300">
                        <CheckCircle className="w-2.5 h-2.5 text-emerald-400" />
                        <span>Google Clearance Verified</span>
                      </span>
                    )}
                  </div>

                  {/* Firestore Cloud Sync Telemetry */}
                  <div className="px-3 py-2 border-b border-slate-800/80 bg-slate-950/50">
                    <div className="flex items-center justify-between text-[10px] font-mono-code text-slate-400 mb-0.5">
                      <span className="flex items-center gap-1">
                        <Cloud className="w-3 h-3 text-emerald-400" />
                        <span>Firestore Database</span>
                      </span>
                      <span className="text-emerald-400 font-bold">ONLINE</span>
                    </div>
                    <p className="text-[9px] font-mono-code text-slate-500 truncate" title="ai-studio-miamicroinvestme-2502752c-8b6e-4851-9d1d-77deac7c2e44">
                      ai-studio-miamicroinvestme-2502752c...
                    </p>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-rose-400 hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer font-mono-code"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Terminate Session (Logout)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Navigation Strip */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-800/60 overflow-x-auto">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`px-2.5 py-1 text-[11px] font-mono-code uppercase flex items-center gap-1 cursor-pointer rounded ${
              activeTab === 'dashboard' ? 'text-emerald-400 bg-slate-900 font-bold' : 'text-slate-400'
            }`}
          >
            <LayoutDashboard className="w-3 h-3" />
            <span>Center</span>
          </button>
          <button
            onClick={() => onSelectTab('archetypes')}
            className={`px-2.5 py-1 text-[11px] font-mono-code uppercase flex items-center gap-1 cursor-pointer rounded ${
              activeTab === 'archetypes' ? 'text-emerald-400 bg-slate-900 font-bold' : 'text-slate-400'
            }`}
          >
            <Target className="w-3 h-3" />
            <span>Archetypes</span>
          </button>
          <button
            onClick={() => onSelectTab('ledger')}
            className={`px-2.5 py-1 text-[11px] font-mono-code uppercase flex items-center gap-1 cursor-pointer rounded ${
              activeTab === 'ledger' ? 'text-emerald-400 bg-slate-900 font-bold' : 'text-slate-400'
            }`}
          >
            <History className="w-3 h-3" />
            <span>Ledger</span>
          </button>
          <button
            onClick={() => onSelectTab('ranks')}
            className={`px-2.5 py-1 text-[11px] font-mono-code uppercase flex items-center gap-1 cursor-pointer rounded ${
              activeTab === 'ranks' ? 'text-emerald-400 bg-slate-900 font-bold' : 'text-slate-400'
            }`}
          >
            <Award className="w-3 h-3" />
            <span>Ranks</span>
          </button>
          <button
            onClick={() => onSelectTab('database')}
            className={`px-2.5 py-1 text-[11px] font-mono-code uppercase flex items-center gap-1 cursor-pointer rounded ${
              activeTab === 'database' ? 'text-emerald-400 bg-slate-900 font-bold' : 'text-slate-400'
            }`}
          >
            <Database className="w-3 h-3 text-emerald-400" />
            <span>DB Studio</span>
          </button>
          <button
            onClick={() => onSelectTab('voice')}
            className={`px-2.5 py-1 text-[11px] font-mono-code uppercase flex items-center gap-1 cursor-pointer rounded ${
              activeTab === 'voice'
                ? 'text-emerald-400 bg-slate-900 font-bold'
                : isVoiceConnected
                ? 'text-emerald-400 animate-pulse'
                : 'text-slate-400'
            }`}
          >
            <Radio className="w-3 h-3 text-emerald-400" />
            <span>Voice</span>
          </button>
        </div>
      </div>
    </header>
  );
};
