import React from 'react';
import { Radio, Mic, MicOff, Volume2, Sparkles, X } from 'lucide-react';
import { OfficerVoice } from '../hooks/useLiveVoice';

interface VoiceCommsFloatingWidgetProps {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  voice: OfficerVoice;
  isMuted: boolean;
  toggleMute: () => void;
  isSpeaking: boolean;
  agentVolume: number;
  officerVolume: number;
  onOpenFullView: () => void;
  onConnect: () => void;
}

export const VoiceCommsFloatingWidget: React.FC<VoiceCommsFloatingWidgetProps> = ({
  status,
  voice,
  isMuted,
  toggleMute,
  isSpeaking,
  agentVolume,
  officerVolume,
  onOpenFullView,
  onConnect,
}) => {
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';

  return (
    <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2">
      {/* Active Radio Pill */}
      <div
        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full border shadow-2xl backdrop-blur-md transition-all ${
          isConnected
            ? 'bg-slate-950/90 border-emerald-500/60 text-slate-100 shadow-emerald-950/40'
            : isConnecting
            ? 'bg-slate-950/90 border-amber-500/60 text-amber-200'
            : 'bg-slate-900/90 border-slate-700/80 hover:border-emerald-500/50 text-slate-300'
        }`}
      >
        {/* Connection status indicator */}
        <div
          onClick={isConnected ? onOpenFullView : onConnect}
          className="flex items-center gap-2 cursor-pointer group"
          title={isConnected ? 'Open Voice Comms Cockpit' : 'Connect to Live Voice Comms'}
        >
          <div className="relative">
            <Radio
              className={`w-4 h-4 ${
                isConnected
                  ? 'text-emerald-400 animate-pulse'
                  : isConnecting
                  ? 'text-amber-400 animate-spin'
                  : 'text-slate-400 group-hover:text-emerald-400'
              }`}
            />
            {isConnected && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            )}
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold font-tactical tracking-wider">
                VOICE COMMS
              </span>
              <span className="text-[9px] font-mono-code bg-emerald-950 text-emerald-400 px-1 rounded">
                LIVE
              </span>
            </div>
            <span className="text-[10px] font-mono-code text-slate-400">
              {isConnected
                ? isSpeaking
                  ? `${voice} Speaking...`
                  : 'Listening to Mic'
                : isConnecting
                ? 'Synchronizing...'
                : 'Standby / Connect'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        {isConnected ? (
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
            <button
              type="button"
              onClick={toggleMute}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                isMuted
                  ? 'bg-rose-950/80 text-rose-400 hover:bg-rose-900/80'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
            </button>

            <button
              type="button"
              onClick={onOpenFullView}
              className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-full text-[10px] font-mono-code uppercase transition-all cursor-pointer"
            >
              Cockpit
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            disabled={isConnecting}
            className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 font-bold rounded-full text-[10px] font-mono-code uppercase transition-all cursor-pointer flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3 text-slate-950" />
            <span>Connect</span>
          </button>
        )}
      </div>
    </div>
  );
};
