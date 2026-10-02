import { useState, useRef, useEffect, useCallback } from 'react';
import { floatTo16BitPCM, downsampleBuffer, arrayBufferToBase64, base64ToAudioBuffer } from '../utils/audioStreamer';
import { Transaction } from '../types';

export interface VoiceTranscript {
  id: string;
  role: 'agent' | 'officer' | 'system';
  text: string;
  timestamp: string;
}

export type OfficerVoice = 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir';

export interface UseLiveVoiceOptions {
  token: string;
  profileId: string;
  defaultVoice?: OfficerVoice;
  onTransactionLogged?: (tx: Transaction) => void;
}

export function useLiveVoice({
  token,
  profileId,
  defaultVoice = 'Zephyr',
  onTransactionLogged,
}: UseLiveVoiceOptions) {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [voice, setVoice] = useState<OfficerVoice>(defaultVoice);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [transcripts, setTranscripts] = useState<VoiceTranscript[]>([
    {
      id: 'init-1',
      role: 'system',
      text: 'M.I.A. Tactical Comms Link standby. Connect to initiate encrypted voice channel.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    },
  ]);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false); // Officer is speaking
  const [isListening, setIsListening] = useState<boolean>(false); // Operative mic active
  const [agentVolume, setAgentVolume] = useState<number>(0);
  const [officerVolume, setOfficerVolume] = useState<number>(0);
  const [activeAction, setActiveAction] = useState<{
    action: string;
    transaction?: Transaction;
    vaultCapital?: number;
    message?: string;
  } | null>(null);

  // References
  const wsRef = useRef<WebSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isMutedRef = useRef<boolean>(isMuted);
  const onTransactionLoggedRef = useRef(onTransactionLogged);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    onTransactionLoggedRef.current = onTransactionLogged;
  }, [onTransactionLogged]);

  // Stop all active audio playback
  const stopAllPlayback = useCallback(() => {
    for (const source of activeSourcesRef.current) {
      try {
        source.stop();
        source.disconnect();
      } catch (_) {}
    }
    activeSourcesRef.current = [];
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
    setIsSpeaking(false);
    setOfficerVolume(0);
  }, []);

  // Teardown all resources
  const disconnect = useCallback(() => {
    console.log('[LiveVoice] Disconnecting...');
    stopAllPlayback();

    // Close WS
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (_) {}
      wsRef.current = null;
    }

    // Stop mic
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    // Disconnect script processor
    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect();
      } catch (_) {}
      scriptProcessorRef.current = null;
    }

    // Close Audio Contexts
    if (inputAudioCtxRef.current && inputAudioCtxRef.current.state !== 'closed') {
      try {
        inputAudioCtxRef.current.close();
      } catch (_) {}
      inputAudioCtxRef.current = null;
    }

    if (outputAudioCtxRef.current && outputAudioCtxRef.current.state !== 'closed') {
      try {
        outputAudioCtxRef.current.close();
      } catch (_) {}
      outputAudioCtxRef.current = null;
    }

    setStatus('disconnected');
    setIsListening(false);
    setIsSpeaking(false);
    setAgentVolume(0);
    setOfficerVolume(0);
  }, [stopAllPlayback]);

  // Connect to Live API over WebSocket
  const connect = useCallback(async () => {
    disconnect();
    setErrorMessage(null);
    setStatus('connecting');

    try {
      // 1. Request microphone access
      console.log('[LiveVoice] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      // 2. Initialize Input Web Audio Context
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputAudioCtx = new AudioCtxClass();
      inputAudioCtxRef.current = inputAudioCtx;

      // Resume context if suspended
      if (inputAudioCtx.state === 'suspended') {
        await inputAudioCtx.resume();
      }

      // Initialize Output Web Audio Context (24kHz preferred for Gemini output)
      const outputAudioCtx = new AudioCtxClass({ sampleRate: 24000 });
      outputAudioCtxRef.current = outputAudioCtx;
      if (outputAudioCtx.state === 'suspended') {
        await outputAudioCtx.resume();
      }

      const outputAnalyser = outputAudioCtx.createAnalyser();
      outputAnalyser.fftSize = 64;
      outputAnalyser.connect(outputAudioCtx.destination);
      outputAnalyserRef.current = outputAnalyser;
      nextStartTimeRef.current = outputAudioCtx.currentTime;

      // 3. Connect WebSocket to server
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live?token=${encodeURIComponent(
        token
      )}&profileId=${encodeURIComponent(profileId)}&voice=${encodeURIComponent(voice)}`;

      console.log('[LiveVoice] Connecting to WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[LiveVoice] WebSocket connection established.');
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'status') {
            if (data.status === 'ready') {
              setStatus('connected');
              setIsListening(true);
              setTranscripts((prev) => [
                ...prev,
                {
                  id: 'status-' + Date.now(),
                  role: 'system',
                  text: `Secure link established with gemini-3.1-flash-live-preview. Tactical Officer ${voice} online.`,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                },
              ]);
            }
          } else if (data.type === 'interrupted') {
            console.log('[LiveVoice] Interruption received from model');
            stopAllPlayback();
          } else if (data.type === 'audio' && data.audio) {
            // Play received PCM audio
            if (!outputAudioCtxRef.current || outputAudioCtxRef.current.state === 'closed') return;
            const ctx = outputAudioCtxRef.current;
            if (ctx.state === 'suspended') {
              await ctx.resume();
            }

            const audioBuffer = base64ToAudioBuffer(data.audio, ctx, 24000);
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;

            if (outputAnalyserRef.current) {
              source.connect(outputAnalyserRef.current);
            } else {
              source.connect(ctx.destination);
            }

            const now = ctx.currentTime;
            if (nextStartTimeRef.current < now) {
              nextStartTimeRef.current = now;
            }
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += audioBuffer.duration;

            setIsSpeaking(true);
            activeSourcesRef.current.push(source);

            source.onended = () => {
              const idx = activeSourcesRef.current.indexOf(source);
              if (idx !== -1) {
                activeSourcesRef.current.splice(idx, 1);
              }
              if (activeSourcesRef.current.length === 0) {
                setIsSpeaking(false);
                setOfficerVolume(0);
              }
            };
          } else if (data.type === 'transcript') {
            const role = data.role === 'agent' ? 'agent' : 'officer';
            setTranscripts((prev) => {
              const last = prev[prev.length - 1];
              // If last item has same role and is within 2 seconds, merge or append nicely
              if (last && last.role === role && last.text.endsWith('...') && !data.text.startsWith(last.text)) {
                return [...prev, {
                  id: 'msg-' + Date.now(),
                  role,
                  text: data.text,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                }];
              }
              return [...prev, {
                id: 'msg-' + Date.now(),
                role,
                text: data.text,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              }];
            });
          } else if (data.type === 'action_completed') {
            setActiveAction({
              action: data.action,
              transaction: data.transaction,
              vaultCapital: data.vaultCapital,
              message: data.transaction?.itemName
                ? `Secured: ${data.transaction.itemName} (Levy: Ksh ${data.transaction.savingsLevy})`
                : 'Direct asset deposit confirmed.',
            });

            if (data.transaction && onTransactionLoggedRef.current) {
              onTransactionLoggedRef.current(data.transaction);
            }
          } else if (data.type === 'error') {
            console.error('[LiveVoice] Server error:', data.error);
            setErrorMessage(data.error);
          }
        } catch (err) {
          console.error('[LiveVoice] Error parsing message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('[LiveVoice] WebSocket error:', err);
        setErrorMessage('Voice comms connection error. Verify Gemini API key.');
        setStatus('error');
      };

      ws.onclose = () => {
        console.log('[LiveVoice] WebSocket disconnected.');
        setStatus('disconnected');
        setIsListening(false);
        setIsSpeaking(false);
      };

      // 4. Set up microphone audio capture pipeline
      const micSource = inputAudioCtx.createMediaStreamSource(stream);
      const scriptProcessor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = scriptProcessor;

      scriptProcessor.onaudioprocess = (audioEvent) => {
        if (isMutedRef.current) {
          setAgentVolume(0);
          return;
        }

        const inputBuffer = audioEvent.inputBuffer.getChannelData(0);

        // Compute volume / RMS for visualizer
        let sum = 0;
        for (let i = 0; i < inputBuffer.length; i++) {
          sum += inputBuffer[i] * inputBuffer[i];
        }
        const rms = Math.sqrt(sum / inputBuffer.length);
        setAgentVolume(Math.min(100, Math.round(rms * 400)));

        // Downsample from browser context rate to 16000Hz
        const downsampled = downsampleBuffer(inputBuffer, inputAudioCtx.sampleRate, 16000);
        const pcm16 = floatTo16BitPCM(downsampled);
        const base64Audio = arrayBufferToBase64(pcm16);

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'audio',
            audio: base64Audio,
          }));
        }
      };

      micSource.connect(scriptProcessor);
      scriptProcessor.connect(inputAudioCtx.destination);
    } catch (err: any) {
      console.error('[LiveVoice] Mic/Init error:', err);
      setErrorMessage(err?.message || 'Could not access microphone.');
      setStatus('error');
    }
  }, [disconnect, token, profileId, voice, stopAllPlayback]);

  // Toggle Mute
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (micStreamRef.current) {
        micStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = !next;
        });
      }
      return next;
    });
  }, []);

  // Send text message directly to Voice Officer
  const sendTextMessage = useCallback((text: string) => {
    if (!text.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setTranscripts((prev) => [
      ...prev,
      {
        id: 'user-' + Date.now(),
        role: 'agent',
        text: text.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      },
    ]);

    wsRef.current.send(JSON.stringify({
      type: 'text',
      text: text.trim(),
    }));
  }, []);

  // Clear transcripts
  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
  }, []);

  // Keep officer volume meter alive during speaking
  useEffect(() => {
    let animId: number;
    const updateMeter = () => {
      if (outputAnalyserRef.current && isSpeaking) {
        const dataArray = new Uint8Array(outputAnalyserRef.current.frequencyBinCount);
        outputAnalyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setOfficerVolume(Math.min(100, Math.round((avg / 255) * 100)));
      }
      animId = requestAnimationFrame(updateMeter);
    };
    animId = requestAnimationFrame(updateMeter);
    return () => cancelAnimationFrame(animId);
  }, [isSpeaking]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
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
    setActiveAction,
    connect,
    disconnect,
    sendTextMessage,
    clearTranscripts,
  };
}
