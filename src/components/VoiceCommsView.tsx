import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Radio,
  Volume2,
  VolumeX,
  Shield,
  Send,
  Zap,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Terminal,
  Activity,
  Award,
  RefreshCw,
} from 'lucide-react';
import { Profile, User, DashboardMetrics, Transaction } from '../types';
import { OfficerVoice, VoiceTranscript } from '../hooks/useLiveVoice';

interface VoiceCommsViewProps {
  user: User;
  activeProfile: Profile;
  metrics: DashboardMetrics | null;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  errorMessage: string | null;
  voice: OfficerVoice;
  setVoice: (v: OfficerVoice) => void;
  isMuted: boolean;
  toggleMute: () => void;
  isSpeaking: boolean;
  isListening: boolean;
  agentVolume: number;
  officerVolume: number;
  transcripts: VoiceTranscript[];
  activeAction: {
    action: string;
    transaction?: Transaction;
    vaultCapital?: number;
    message?: string;
  } | null;
  connect: () => void;
  disconnect: () => void;
  sendTextMessage: (text: string) => void;
  clearTranscripts: () => void;
  onRefreshMetrics?: () => void;
}

const VOICE_ROSTER: { id: OfficerVoice; name: string; title: string; desc: string }[] = [
  { id: 'Zephyr', name: 'Officer Zephyr', title: 'Tactical Director', desc: 'Balanced, authoritative, crisp operational commands.' },
  { id: 'Puck', name: 'Operative Puck', title: 'Recon Specialist', desc: 'Energetic, fast-paced field handler.' },
  { id: 'Charon', name: 'Quartermaster Charon', title: 'Vault Overseer', desc: 'Deep, deliberate, disciplined capital strategist.' },
  { id: 'Kore', name: 'Analyst Kore', title: 'Intelligence Analyst', desc: 'Calm, methodical, analytical advisor.' },
  { id: 'Fenrir', name: 'Commander Fenrir', title: 'Vanguard Enforcer', desc: 'Commanding, uncompromising vice levy enforcer.' },
];

const QUICK_COMMANDS = [
  { label: 'Log Coffee (Ksh 350)', text: 'I just bought a coffee for 350 shillings, calculate the levy and save it to my vault.' },
  { label: 'Log Takeout (Ksh 800)', text: 'I spent 800 shillings on takeout food, log the vice purchase.' },
  { label: 'Quick Save Ksh 1,000', text: 'I want to deposit a quick save of 1,000 shillings into my vault.' },
  { label: 'Check Vault Status', text: 'Give me a tactical briefing on my vault balance and current agency rank.' },
  { label: 'Next Rank Target', text: 'How much capital do I need to reach the next agency clearance rank?' },
];

export const VoiceCommsView: React.FC<VoiceCommsViewProps> = ({
  user,
  activeProfile,
  metrics,
  status,
  errorMessage,
  voice,
  setVoice,
  isMuted,
  toggleMute,
  isSpeaking,
  isListening,
  agentVolume,
  officerVolume,
  transcripts,
  activeAction,
  connect,
  disconnect,
  sendTextMessage,
  clearTranscripts,
  onRefreshMetrics,
}) => {
  const [inputText, setInputText] = useState('');
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcripts
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendTextMessage(inputText);
    setInputText('');
  };

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Tactical Comms Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all ${
              isConnected
                ? 'bg-emerald-950 border-emerald-500/50 text-emerald-400 shadow-lg shadow-emerald-950/60 animate-pulse'
                : isConnecting
                ? 'bg-amber-950 border-amber-500/50 text-amber-400 animate-spin'
                : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}>
              <Radio className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold font-tactical text-slate-100 tracking-wider">
                  TACTICAL VOICE COMMS
                </h1>
                <span className="text-[11px] font-mono-code bg-slate-950 border border-emerald-500/40 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                  gemini-3.1-flash-live-preview
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono-code mt-0.5">
                Bidirectional encrypted voice channel with M.I.A. Intelligence Officers. Live 16kHz/24kHz PCM audio.
              </p>
            </div>
          </div>

          {/* Connection Controls */}
          <div className="flex items-center gap-3">
            {isConnected ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMute}
                  className={`px-3.5 py-2 rounded-xl font-mono-code text-xs uppercase tracking-wider flex items-center gap-2 border transition-colors cursor-pointer ${
                    isMuted
                      ? 'bg-rose-950/80 border-rose-500 text-rose-300'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                  }`}
                  title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                >
                  {isMuted ? <MicOff className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                  <span>{isMuted ? 'MIC MUTED' : 'MIC ACTIVE'}</span>
                </button>

                <button
                  type="button"
                  onClick={disconnect}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-slate-950 font-bold text-xs uppercase tracking-wider font-tactical shadow-md shadow-rose-950/50 transition-all cursor-pointer"
                >
                  TERMINATE LINK
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={connect}
                disabled={isConnecting}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 font-bold text-xs uppercase tracking-wider font-tactical shadow-lg shadow-emerald-500/20 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                    <span>SYNCHRONIZING SATELLITE LINK...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-slate-950" />
                    <span>INITIALIZE VOICE COMMS</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mt-4 p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl flex items-center gap-3 text-xs text-rose-200 font-mono-code">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Main Cockpit Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Audio Cockpit & Visualizers (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Holographic Radio Frequency Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 text-xs font-mono-code text-slate-400">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="uppercase tracking-wider">AUDIO SPECTRUM // DUAL FREQUENCY</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
                <span className="text-slate-300 uppercase">{status}</span>
              </div>
            </div>

            {/* Central Orbital Waveform */}
            <div className="py-8 flex flex-col items-center justify-center relative">
              {/* Outer pulsing rings */}
              <div className={`w-44 h-44 rounded-full border flex items-center justify-center transition-all duration-300 ${
                isSpeaking
                  ? 'border-emerald-400/60 bg-emerald-950/30 scale-105 shadow-[0_0_50px_rgba(16,185,129,0.3)]'
                  : isListening && !isMuted
                  ? 'border-sky-400/60 bg-sky-950/30 scale-100 shadow-[0_0_30px_rgba(56,189,248,0.2)]'
                  : 'border-slate-800 bg-slate-950/60'
              }`}>
                <div className={`w-32 h-32 rounded-full border flex items-center justify-center transition-all duration-200 ${
                  isSpeaking
                    ? 'border-emerald-400 bg-emerald-900/40'
                    : isListening && !isMuted
                    ? 'border-sky-400 bg-sky-900/40'
                    : 'border-slate-700 bg-slate-900'
                }`}>
                  <div className="text-center">
                    {isSpeaking ? (
                      <Volume2 className="w-10 h-10 text-emerald-400 mx-auto animate-bounce" />
                    ) : isMuted ? (
                      <MicOff className="w-10 h-10 text-rose-400 mx-auto" />
                    ) : (
                      <Mic className={`w-10 h-10 mx-auto ${isConnected ? 'text-sky-400 animate-pulse' : 'text-slate-500'}`} />
                    )}
                    <span className="text-[10px] font-mono-code uppercase font-bold text-slate-300 block mt-1">
                      {isSpeaking ? 'OFFICER SPEAKING' : isMuted ? 'MUTED' : isConnected ? 'LISTENING' : 'OFFLINE'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status readout under orb */}
              <div className="mt-4 text-center">
                <p className="text-xs font-mono-code text-slate-300">
                  {isConnected
                    ? isSpeaking
                      ? `Officer ${voice} is delivering tactical briefing audio...`
                      : 'Radio link listening. Speak your vice expenditure or quick-save command.'
                    : 'Initialize link above to activate full-duplex conversational voice mode.'}
                </p>
              </div>
            </div>

            {/* Dual Audio Bars (Operative Mic vs Officer Speaker) */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800 font-mono-code text-xs">
              {/* Agent Mic Volume Bar */}
              <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-xl">
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-sky-400" />
                    <span>OPERATIVE MIC</span>
                  </span>
                  <span className="text-sky-400 font-bold">{agentVolume}%</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-75"
                    style={{ width: `${agentVolume}%` }}
                  />
                </div>
              </div>

              {/* Officer Audio Volume Bar */}
              <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-xl">
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>OFFICER OUTPUT</span>
                  </span>
                  <span className="text-emerald-400 font-bold">{officerVolume}%</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-300 transition-all duration-75"
                    style={{ width: `${officerVolume}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tactical Officer Selection Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold font-tactical text-slate-200 tracking-wider">
                  INTELLIGENCE OFFICER ROSTER
                </h2>
                <p className="text-xs text-slate-400 font-mono-code">
                  Select operative voice synthesized by Gemini Live audio model.
                </p>
              </div>
              <span className="text-xs font-mono-code text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded">
                Active: {voice}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {VOICE_ROSTER.map((v) => {
                const isSelected = voice === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setVoice(v.id);
                      if (isConnected) {
                        // Reconnect to swap voice in Live API
                        disconnect();
                        setTimeout(connect, 300);
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-950/60 border-emerald-500/80 text-slate-100 shadow-md shadow-emerald-950/30'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs font-tactical text-slate-200">{v.name}</span>
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    </div>
                    <p className="text-[10px] font-mono-code text-emerald-400/90 font-semibold mb-1">{v.title}</p>
                    <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">{v.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Voice Prompt Suggestions */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h3 className="text-xs font-bold font-tactical text-slate-200 tracking-wider uppercase mb-3 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>TACTICAL VOICE DIRECTIVES (CLICK TO TRANSMIT)</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {QUICK_COMMANDS.map((cmd, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => sendTextMessage(cmd.text)}
                  disabled={!isConnected}
                  className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 disabled:opacity-50 border border-slate-800 hover:border-emerald-500/50 rounded-lg text-xs font-mono-code text-slate-300 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Terminal className="w-3 h-3 text-emerald-400" />
                  <span>{cmd.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Live Encrypted Radio Transcripts Terminal (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          {/* Action Execution Alert Banner */}
          {activeAction && (
            <div className="p-4 bg-emerald-950/80 border border-emerald-500/60 rounded-2xl shadow-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs font-mono-code flex-1">
                <p className="font-bold text-emerald-300 uppercase tracking-wider">
                  MISSION ACTION EXECUTED BY VOICE
                </p>
                <p className="text-slate-200 mt-1">{activeAction.message}</p>
                {activeAction.vaultCapital !== undefined && (
                  <p className="text-emerald-400 mt-1 font-semibold">
                    New Vault Balance: Ksh {activeAction.vaultCapital.toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Transcript Terminal */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl flex-1 flex flex-col shadow-xl overflow-hidden min-h-[480px]">
            {/* Terminal Header */}
            <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs font-mono-code">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-slate-200 tracking-wider">CLASSIFIED RADIO LOGS</span>
              </div>
              <button
                type="button"
                onClick={clearTranscripts}
                className="text-[10px] text-slate-500 hover:text-slate-300 uppercase transition-colors cursor-pointer"
              >
                Clear Log
              </button>
            </div>

            {/* Transcript Messages List */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono-code text-xs max-h-[500px]">
              {transcripts.map((t) => {
                const isAgent = t.role === 'agent';
                const isOfficer = t.role === 'officer';
                return (
                  <div
                    key={t.id}
                    className={`p-3 rounded-xl border leading-relaxed ${
                      isAgent
                        ? 'bg-sky-950/40 border-sky-800/60 text-sky-100 ml-4'
                        : isOfficer
                        ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-100 mr-4'
                        : 'bg-slate-950/60 border-slate-800/60 text-slate-400 italic text-[11px]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 border-b border-slate-800/50 pb-1">
                      <span className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                        {isAgent ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                            <span className="text-sky-400 font-tactical">AGENT // {user.codename}</span>
                          </>
                        ) : isOfficer ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span className="text-emerald-400 font-tactical">OFFICER // {voice}</span>
                          </>
                        ) : (
                          <span>M.I.A. SYSTEM</span>
                        )}
                      </span>
                      <span>{t.timestamp}</span>
                    </div>
                    <p className="text-slate-200 whitespace-pre-wrap">{t.text}</p>
                  </div>
                );
              })}
              <div ref={transcriptEndRef} />
            </div>

            {/* Silent Fallback Text Transmitter */}
            <form onSubmit={handleSendText} className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  isConnected
                    ? 'Type operational message or speak into mic...'
                    : 'Initialize Voice Comms above to communicate...'
                }
                disabled={!isConnected}
                className="flex-1 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs font-mono-code text-slate-100 placeholder-slate-500 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!isConnected || !inputText.trim()}
                className="p-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 rounded-xl transition-all cursor-pointer"
                title="Send text message to Voice Officer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
