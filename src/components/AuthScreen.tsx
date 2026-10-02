import React, { useState } from 'react';
import { Shield, Lock, Send, CheckCircle2, Terminal, ArrowRight, KeyRound, Sparkles, Database, Cloud } from 'lucide-react';
import { api, setStoredToken } from '../services/api';
import { signInWithGoogle, persistUserToFirestore } from '../services/firebase';
import { seedInitialFirestoreDataForUser } from '../services/firestoreSync';
import { User } from '../types';

interface AuthScreenProps {
  onAuthenticated: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [email, setEmail] = useState('');
  const [codename, setCodename] = useState('');
  const [magicSent, setMagicSent] = useState(false);
  const [magicToken, setMagicToken] = useState('');
  const [magicUrl, setMagicUrl] = useState('');
  const [verifyingToken, setVerifyingToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Google Sign-In with Firebase Auth & Firestore persistence
  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);

    try {
      // 1. Authenticate with Google via Firebase Popup
      const { user: firebaseUser } = await signInWithGoogle();

      // 2. Persist to server backend & Firestore sync
      const res = await api.firebaseLogin({
        uid: firebaseUser.id,
        email: firebaseUser.email,
        displayName: firebaseUser.codename,
        photoURL: firebaseUser.photoURL,
      });

      // 3. If new user, seed Firestore cloud documents immediately
      if (res.isNew) {
        try {
          await seedInitialFirestoreDataForUser(res.user);
        } catch (seedErr) {
          console.warn('[Firestore] Initial cloud seed completed with notices:', seedErr);
        }
      }

      setStoredToken(res.token);
      onAuthenticated(res.user);
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      // Helpful friendly message if popup closed by user
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Authentication popup was closed. Please try again.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        setError('Google sign-in was interrupted. Please retry.');
      } else {
        setError(err.message || 'Google clearance authentication failed');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid intelligence email address');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await api.sendMagicLink(email.trim(), codename.trim() || undefined);
      setMagicSent(true);
      setMagicToken(res.token);
      setMagicUrl(res.magicUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch magic link');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyToken = async (tokenToUse: string) => {
    if (!tokenToUse.trim()) return;
    setError(null);
    setLoading(true);

    try {
      const res = await api.verifyMagicLink(tokenToUse.trim());
      setStoredToken(res.token);
      onAuthenticated(res.user);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired magic link code');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAccess = async (persona: 'solo' | 'family' | 'coach') => {
    setError(null);
    setLoading(true);

    const emailMap = {
      solo: 'agent.impulse@mia.gov',
      family: 'agent.family_manager@mia.gov',
      coach: 'agent.coach_ops@mia.gov',
    };
    const codenameMap = {
      solo: 'Agent Shadow (Impulse Spender)',
      family: 'Director Vanguard (Family Mgr)',
      coach: 'Chief Falcon (Financial Coach)',
    };

    try {
      const res = await api.demoLogin(emailMap[persona], codenameMap[persona]);
      setStoredToken(res.token);
      onAuthenticated(res.user);
    } catch (err: any) {
      setError(err.message || 'Demo clearance access failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 classified-grid relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-900 border border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/10 mb-4">
            <Shield className="w-8 h-8" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[11px] font-mono-code bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 rounded">
              CONFIDENTIAL // CLEARANCE REQ
            </span>
          </div>
          <h1 className="text-3xl font-bold font-tactical tracking-wider text-slate-100 uppercase">
            M.I.A.
          </h1>
          <p className="text-xs font-mono-code text-slate-400 tracking-widest mt-0.5">
            MICRO-INVESTMENT AGENCY
          </p>
          <p className="text-sm text-slate-400 mt-2 max-w-xs mx-auto">
            Tax your vices to fund your assets. Covert micro-savings intelligence system.
          </p>

          {/* Firestore Cloud Status Pill */}
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900/90 border border-emerald-500/30 rounded-full text-[10px] font-mono-code text-emerald-300">
            <Cloud className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>FIRESTORE CLOUD PERSISTENCE ACTIVE</span>
          </div>
        </div>

        {/* Auth Box */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-6 shadow-2xl relative">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-5">
            <div className="flex items-center gap-2 text-xs font-mono-code text-slate-300">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>TERMINAL: AUTH_FIREBASE_V2.0</span>
            </div>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-950/60 border border-rose-500/40 rounded-lg text-xs font-mono-code text-rose-300 flex items-start gap-2">
              <span className="text-rose-400 font-bold">ERR:</span>
              <span>{error}</span>
            </div>
          )}

          {/* PRIMARY AUTH METHOD: Google Sign-In with Firebase Auth */}
          <div className="space-y-4 mb-6">
            <button
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
              type="button"
              className="w-full bg-white hover:bg-slate-100 text-slate-900 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-3 text-sm tracking-wide shadow-lg hover:shadow-xl transition-all cursor-pointer disabled:opacity-50 border border-slate-200"
            >
              {googleLoading ? (
                <div className="flex items-center gap-2 text-slate-800 font-mono-code text-xs">
                  <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  <span>AUTHORIZING CLEARANCE...</span>
                </div>
              ) : (
                <>
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span className="font-tactical tracking-wider text-xs uppercase font-bold text-slate-900">
                    Sign in with Google
                  </span>
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-slate-400 font-mono-code">
              Uses Firebase Authentication & links your identity to Firestore
            </p>
          </div>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-mono-code">
              <span className="bg-slate-900 px-3 text-slate-500">Or Manual Operative Access</span>
            </div>
          </div>

          {!magicSent ? (
            <form onSubmit={handleSendMagicLink} className="space-y-4">
              <div>
                <label className="block text-xs font-mono-code text-slate-300 mb-1.5 uppercase">
                  Target Operative Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="agent@agency.ops or your-email@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono-code"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono-code text-slate-300 mb-1.5 uppercase">
                  Operative Codename <span className="text-slate-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Agent Maverick"
                  value={codename}
                  onChange={(e) => setCodename(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-sm uppercase tracking-wider font-tactical transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span>DISPATCHING CLEARANCE...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>TRANSMIT MAGIC LINK</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 bg-emerald-950 border border-emerald-500/50 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-100 font-tactical">
                MAGIC LINK GENERATED
              </h3>
              <p className="text-xs text-slate-400 font-mono-code">
                Encrypted magic link dispatched for <span className="text-emerald-400">{email}</span>. Click below to verify instantly.
              </p>

              {/* Instant Verification Button */}
              <button
                onClick={() => handleVerifyToken(magicToken)}
                disabled={loading}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-sm uppercase tracking-wider font-tactical transition-colors cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>CONFIRM CLEARANCE & ENTER VAULT</span>
              </button>

              <div className="pt-2 border-t border-slate-800 text-left">
                <p className="text-[11px] font-mono-code text-slate-400 mb-1">
                  MANUAL VERIFICATION CODE:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={verifyingToken || magicToken}
                    onChange={(e) => setVerifyingToken(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-300 font-mono-code"
                  />
                  <button
                    onClick={() => handleVerifyToken(verifyingToken || magicToken)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-mono-code text-slate-200 rounded border border-slate-700 cursor-pointer"
                  >
                    Verify
                  </button>
                </div>
              </div>

              <button
                onClick={() => setMagicSent(false)}
                className="text-xs text-slate-500 hover:text-slate-400 underline font-mono-code cursor-pointer"
              >
                Use different email address
              </button>
            </div>
          )}

          {/* Quick Demo Personas */}
          <div className="mt-6 pt-5 border-t border-slate-800">
            <p className="text-[11px] font-mono-code text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Instant Test Agent Access</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleDemoAccess('solo')}
                disabled={loading || googleLoading}
                className="p-2 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 rounded-lg text-left transition-all cursor-pointer group"
              >
                <span className="text-base block mb-0.5">☕</span>
                <span className="block text-[11px] font-bold text-slate-200 group-hover:text-emerald-400">
                  Impulse Spender
                </span>
                <span className="block text-[9px] text-slate-500 font-mono-code">18-35 Solo</span>
              </button>

              <button
                onClick={() => handleDemoAccess('family')}
                disabled={loading || googleLoading}
                className="p-2 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 rounded-lg text-left transition-all cursor-pointer group"
              >
                <span className="text-base block mb-0.5">👨‍👩‍👦</span>
                <span className="block text-[11px] font-bold text-slate-200 group-hover:text-emerald-400">
                  Family Manager
                </span>
                <span className="block text-[9px] text-slate-500 font-mono-code">Multi-Profile</span>
              </button>

              <button
                onClick={() => handleDemoAccess('coach')}
                disabled={loading || googleLoading}
                className="p-2 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 rounded-lg text-left transition-all cursor-pointer group"
              >
                <span className="text-base block mb-0.5">📊</span>
                <span className="block text-[11px] font-bold text-slate-200 group-hover:text-emerald-400">
                  Advisor / Coach
                </span>
                <span className="block text-[9px] text-slate-500 font-mono-code">Client Vaults</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info with Firestore Database badge */}
        <div className="text-center mt-5 space-y-1 text-xs text-slate-500 font-mono-code">
          <p>M.I.A. Protocol 2026 // Ksh Currency Core // Notional Asset Vault</p>
          <p className="text-[10px] text-slate-600 flex items-center justify-center gap-1">
            <Database className="w-3 h-3 text-emerald-500/70" />
            <span>Firestore: ai-studio-miamicroinvestme-2502752c-8b6e-4851-9d1d-77deac7c2e44</span>
          </p>
        </div>
      </div>
    </div>
  );
};
