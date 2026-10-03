import React, { useState, useEffect, useCallback } from 'react';
import { User, Profile, Archetype, DashboardMetrics } from './types';
import { api, getStoredToken, clearStoredToken, setStoredToken } from './services/api';
import { AgencyLogo } from './components/AgencyLogo';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { ArchetypesManager } from './components/ArchetypesManager';
import { LedgerHistoryView } from './components/LedgerHistoryView';
import { DatabaseStudioView } from './components/DatabaseStudioView';
import { VoiceCommsView } from './components/VoiceCommsView';
import { VoiceCommsFloatingWidget } from './components/VoiceCommsFloatingWidget';
import { LogOperationModal } from './components/LogOperationModal';
import { WithdrawOperationModal } from './components/WithdrawOperationModal';
import { ProfileManagerModal } from './components/ProfileManagerModal';
import { RankSystemModal } from './components/RankSystemModal';
import { useLiveVoice } from './hooks/useLiveVoice';
import { onFirebaseAuthStateChanged, signOutFirebase } from './services/firebase';
import { Shield, Sparkles } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'archetypes' | 'ledger' | 'ranks' | 'database' | 'voice'>('dashboard');

  // Modals
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [rankModalOpen, setRankModalOpen] = useState(false);

  // Live Voice API Hook
  const liveVoice = useLiveVoice({
    token: getStoredToken() || '',
    profileId: activeProfile?.id || '',
    onTransactionLogged: () => {
      fetchProfileData();
    },
  });

  // Check URL hash for magic link token or existing session & listen to Firebase Auth
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      setAuthLoading(true);
      const hash = window.location.hash;
      if (hash.startsWith('#verify=')) {
        const token = hash.replace('#verify=', '');
        try {
          const res = await api.verifyMagicLink(token);
          if (isMounted) {
            setStoredToken(res.token);
            setUser(res.user);
            window.location.hash = '';
          }
        } catch (err) {
          console.error('Magic link verification failed:', err);
        }
      } else {
        const storedToken = getStoredToken();
        let authenticated = false;
        if (storedToken) {
          try {
            const res = await api.getMe();
            if (isMounted && res.user) {
              setUser(res.user);
              authenticated = true;
            }
          } catch {
            clearStoredToken();
          }
        }

        // Seamless auto-entrance: initialize primary operative account immediately
        if (!authenticated && isMounted) {
          try {
            const demoRes = await api.demoLogin('agent.impulse@mia.gov', 'Agent Shadow (Solo)');
            if (isMounted) {
              setStoredToken(demoRes.token);
              setUser(demoRes.user);
            }
          } catch (e) {
            console.warn('Auto-entrance initialization notice:', e);
            if (isMounted) {
              const defaultUser: User = {
                id: 'usr_agent_prime',
                email: 'agent.impulse@mia.gov',
                codename: 'Agent Shadow',
                createdAt: new Date().toISOString(),
                authProvider: 'demo',
              };
              setStoredToken(defaultUser.id);
              setUser(defaultUser);
            }
          }
        }
      }
      if (isMounted) {
        setAuthLoading(false);
      }
    }

    initAuth();

    // Subscribe to Firebase Auth state for automatic Google session restore
    const unsubscribeFirebase = onFirebaseAuthStateChanged(async (fbUser) => {
      if (fbUser && isMounted) {
        try {
          const res = await api.firebaseLogin({
            uid: fbUser.uid,
            email: fbUser.email || '',
            displayName: fbUser.displayName,
            photoURL: fbUser.photoURL,
          });
          if (isMounted) {
            setStoredToken(res.token);
            setUser(res.user);
          }
        } catch (e) {
          console.warn('[Firebase Auth] Session restore notice:', e);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribeFirebase();
    };
  }, []);

  // Fetch profiles when user logs in
  const fetchProfiles = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getProfiles();
      if (res.profiles && res.profiles.length > 0) {
        setProfiles(res.profiles);
        // Keep activeProfile if it still exists, else pick first
        setActiveProfile((prev) => {
          if (prev && res.profiles.some((p) => p.id === prev.id)) {
            return res.profiles.find((p) => p.id === prev.id) || res.profiles[0];
          }
          return res.profiles[0];
        });
      } else {
        try {
          const newProf = await api.createProfile('My Account', '🕵️‍♂️');
          if (newProf?.profile) {
            setProfiles([newProf.profile]);
            setActiveProfile(newProf.profile);
          }
        } catch (createErr) {
          console.warn('Could not auto-create starter profile:', createErr);
        }
      }
    } catch (err) {
      console.error('Error loading profiles:', err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProfiles();
    }
  }, [user, fetchProfiles]);

  // Fetch archetypes and dashboard metrics for the active profile
  const fetchProfileData = useCallback(async () => {
    if (!user || !activeProfile) return;
    setDataLoading(true);
    try {
      const [archRes, dashRes] = await Promise.all([
        api.getArchetypes(activeProfile.id),
        api.getDashboard(activeProfile.id),
      ]);
      setArchetypes(archRes.archetypes);
      setDashboardMetrics(dashRes);
    } catch (err) {
      console.error('Error fetching profile operational data:', err);
    } finally {
      setDataLoading(false);
    }
  }, [user, activeProfile]);

  useEffect(() => {
    if (activeProfile) {
      fetchProfileData();
    }
  }, [activeProfile, fetchProfileData]);

  const handleSwitchOperative = async (email: string, codename: string) => {
    setDataLoading(true);
    try {
      const res = await api.demoLogin(email, codename);
      setStoredToken(res.token);
      setUser(res.user);
      setActiveProfile(null);
    } catch (err) {
      console.error('Failed to switch operative:', err);
    } finally {
      setDataLoading(false);
    }
  };

  const handleLogout = async () => {
    liveVoice.disconnect();
    await signOutFirebase();
    clearStoredToken();
    handleSwitchOperative('agent.impulse@mia.gov', 'Agent Shadow (Solo)');
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 font-mono-code text-xs gap-3">
        <AgencyLogo size="lg" variant="stacked" />
        <div className="flex items-center gap-2.5 mt-4 text-emerald-400 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl shadow-xl">
          <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>CONNECTING TO M.I.A. VAULT CORE...</span>
        </div>
      </div>
    );
  }

  if (!activeProfile) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 font-mono-code text-xs gap-3">
        <AgencyLogo size="md" variant="icon" />
        <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl">
          <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>LOADING OPERATIONAL PROFILE...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col classified-grid selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Tactical Top Header */}
      <Header
        user={user}
        profiles={profiles}
        activeProfile={activeProfile}
        activeTab={activeTab}
        vaultCapital={dashboardMetrics?.vaultCapital}
        totalWithdrawn={dashboardMetrics?.totalWithdrawn}
        onSelectProfile={(p) => setActiveProfile(p)}
        onOpenNewProfile={() => setProfileModalOpen(true)}
        onOpenManageProfiles={() => setProfileModalOpen(true)}
        onOpenLogModal={() => setLogModalOpen(true)}
        onSelectTab={(tab) => {
          if (tab === 'ranks') {
            setRankModalOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
        onLogout={handleLogout}
        onSwitchOperative={handleSwitchOperative}
        isVoiceConnected={liveVoice.status === 'connected'}
      />

      {/* Main Agency Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            metrics={dashboardMetrics}
            activeProfile={activeProfile}
            loading={dataLoading}
            onOpenLogModal={() => setLogModalOpen(true)}
            onOpenWithdrawModal={() => setWithdrawModalOpen(true)}
            onOpenArchetypesTab={() => setActiveTab('archetypes')}
            onOpenLedgerTab={() => setActiveTab('ledger')}
            onOpenRankModal={() => setRankModalOpen(true)}
          />
        )}

        {activeTab === 'archetypes' && (
          <ArchetypesManager
            activeProfile={activeProfile}
            archetypes={archetypes}
            onRefresh={fetchProfileData}
          />
        )}

        {activeTab === 'ledger' && (
          <LedgerHistoryView
            activeProfile={activeProfile}
            archetypes={archetypes}
            onOpenLogModal={() => setLogModalOpen(true)}
            onOpenWithdrawModal={() => setWithdrawModalOpen(true)}
            onRefreshMetrics={fetchProfileData}
          />
        )}

        {activeTab === 'database' && (
          <DatabaseStudioView
            user={user}
            activeProfile={activeProfile}
            onDataChanged={() => {
              fetchProfiles();
              fetchProfileData();
            }}
          />
        )}

        {activeTab === 'voice' && (
          <VoiceCommsView
            user={user}
            activeProfile={activeProfile}
            metrics={dashboardMetrics}
            status={liveVoice.status}
            errorMessage={liveVoice.errorMessage}
            voice={liveVoice.voice}
            setVoice={liveVoice.setVoice}
            isMuted={liveVoice.isMuted}
            toggleMute={liveVoice.toggleMute}
            isSpeaking={liveVoice.isSpeaking}
            isListening={liveVoice.isListening}
            agentVolume={liveVoice.agentVolume}
            officerVolume={liveVoice.officerVolume}
            transcripts={liveVoice.transcripts}
            activeAction={liveVoice.activeAction}
            connect={liveVoice.connect}
            disconnect={liveVoice.disconnect}
            sendTextMessage={liveVoice.sendTextMessage}
            clearTranscripts={liveVoice.clearTranscripts}
            onRefreshMetrics={fetchProfileData}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500 font-mono-code">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>M.I.A. OPS // ACTIVE NOTIONAL VAULT</span>
          </div>
          <p>Tax your vices to fund your assets. Kenyan Shilling (Ksh) Standard.</p>
        </div>
      </footer>

      {/* Operation Logging Modal */}
      <LogOperationModal
        isOpen={logModalOpen}
        activeProfile={activeProfile}
        archetypes={archetypes}
        onClose={() => setLogModalOpen(false)}
        onSuccess={() => {
          fetchProfileData();
        }}
        onOpenArchetypeModal={() => setActiveTab('archetypes')}
      />

      {/* Vault Capital Withdrawal Modal */}
      <WithdrawOperationModal
        isOpen={withdrawModalOpen}
        activeProfile={activeProfile}
        vaultCapital={dashboardMetrics?.vaultCapital || 0}
        totalWithdrawn={dashboardMetrics?.totalWithdrawn || 0}
        onClose={() => setWithdrawModalOpen(false)}
        onSuccess={() => {
          fetchProfileData();
        }}
      />

      {/* Profile Manager Modal */}
      <ProfileManagerModal
        isOpen={profileModalOpen}
        profiles={profiles}
        activeProfile={activeProfile}
        onClose={() => setProfileModalOpen(false)}
        onSelectProfile={(p) => setActiveProfile(p)}
        onProfilesUpdated={() => {
          fetchProfiles();
          fetchProfileData();
        }}
      />

      {/* Ranks Hierarchy Modal */}
      {dashboardMetrics && (
        <RankSystemModal
          isOpen={rankModalOpen}
          currentRank={dashboardMetrics.currentRank}
          vaultCapital={dashboardMetrics.vaultCapital}
          onClose={() => setRankModalOpen(false)}
        />
      )}

      {/* Persistent Floating Tactical Voice Widget (Accessible across other operational tabs) */}
      {activeTab !== 'voice' && (
        <VoiceCommsFloatingWidget
          status={liveVoice.status}
          voice={liveVoice.voice}
          isMuted={liveVoice.isMuted}
          toggleMute={liveVoice.toggleMute}
          isSpeaking={liveVoice.isSpeaking}
          agentVolume={liveVoice.agentVolume}
          officerVolume={liveVoice.officerVolume}
          onOpenFullView={() => setActiveTab('voice')}
          onConnect={liveVoice.connect}
        />
      )}
    </div>
  );
}
