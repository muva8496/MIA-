import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality, Type, LiveServerMessage } from '@google/genai';
import { getDb, findUser, setDocument } from './db';
import { User, Profile, Archetype, Transaction } from '../src/types';
import { getRankForCapital } from '../src/utils/ranks';

export function setupLiveWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname === '/api/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', async (clientWs: WebSocket, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const token = url.searchParams.get('token');
    const profileIdParam = url.searchParams.get('profileId');
    const voiceParam = url.searchParams.get('voice') || 'Zephyr';

    console.log('[Live API] Client attempting connection...');

    if (!token) {
      clientWs.send(JSON.stringify({ type: 'error', error: 'Missing token parameter' }));
      clientWs.close(4001, 'Unauthorized');
      return;
    }

    const user = await findUser(token);
    if (!user) {
      clientWs.send(JSON.stringify({ type: 'error', error: 'Invalid operational token' }));
      clientWs.close(4001, 'Unauthorized');
      return;
    }

    const db = getDb();
    let profile: Profile | undefined;
    if (profileIdParam && db.profiles[profileIdParam]) {
      profile = db.profiles[profileIdParam];
    } else {
      profile = Object.values(db.profiles).find(
        (p) => p.ownerId === user.id || (p.ownerEmail && p.ownerEmail.toLowerCase() === user.email.toLowerCase())
      );
    }

    if (!profile) {
      clientWs.send(JSON.stringify({ type: 'error', error: 'No active profile found for operative' }));
      clientWs.close(4004, 'Profile Not Found');
      return;
    }

    const activeProfileId = profile.id;
    const profileArchetypes = Object.values(db.archetypes).filter((a) => a.profileId === activeProfileId);
    const profileTransactions = Object.values(db.transactions).filter((t) => t.profileId === activeProfileId);

    const vaultCapital = profileTransactions.reduce((acc, t) => acc + (t.savingsLevy || 0), 0);
    const totalVicesLogged = profileTransactions.reduce((acc, t) => acc + (t.baseCost || 0), 0);
    const rankInfo = getRankForCapital(vaultCapital);
    const currentRank = rankInfo.currentRank;

    const archetypesSummary = profileArchetypes
      .map((a) => `${a.name} (${Math.round(a.matchRate * 100)}% match)`)
      .join(', ');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      clientWs.send(JSON.stringify({ type: 'error', error: 'GEMINI_API_KEY environment secret is not configured.' }));
      clientWs.close(4500, 'API Key Missing');
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const tacticalSystemInstruction = `You are the Tactical Voice Intelligence Officer for the M.I.A. (Micro-Investment Agency).
You communicate via live encrypted voice link with Agent ${user.codename || 'Operative'} (Email: ${user.email}).
Active Mission Vault: "${profile.name}" (ID: ${profile.id}).

Current Intelligence Dossier:
- Vault Capital Accumulated: Ksh ${vaultCapital.toLocaleString()}
- Total Vice Expenditure Intercepted: Ksh ${totalVicesLogged.toLocaleString()}
- Agency Rank: ${currentRank.rank} (${currentRank.code})
- Active Tactical Archetypes: ${archetypesSummary || 'None registered yet'}

Directives:
1. Speak with military/espionage brevity, tactical precision, and confident encouragement.
2. Keep responses brief, punchy, and conversational (optimized for low-latency live audio streaming). Avoid long bulleted essays, markdown tables, or special characters.
3. If the user mentions spending money on a vice (coffee, takeout, drinks, tech, shopping) or wants to make a save or withdrawal, use your tools:
   - Call "log_vice_purchase" to calculate the levy and log the transaction directly into their vault.
   - Call "log_quick_save" if they say they want to directly deposit/save money.
   - Call "log_withdrawal" if they need to withdraw capital from their vault (warn them if balance is insufficient).
   - Call "get_vault_metrics" if they ask for their balance or stats.
4. When logging a vice, automatically match it to the closest archetype (e.g. coffee -> Agent Cocoa, fast food/takeout -> Tactical Takeout, electronics/gadgets -> Impulse Tech, alcohol/bars -> Night Ops Bar, sweets/pastries -> Sweet Sabotage).
5. Confirm the execution with crisp verbal feedback (e.g., "Confirmed, Agent. Logged 400 Shillings for Coffee. Applied 100% levy. 400 Shillings transferred to your vault.").`;

    let session: any = null;
    let isClosed = false;

    try {
      clientWs.send(JSON.stringify({
        type: 'status',
        status: 'connecting',
        message: 'Establishing secure quantum satellite uplink with gemini-3.1-flash-live-preview...',
        model: 'gemini-3.1-flash-live-preview',
        voice: voiceParam,
      }));

      session = await ai.live.connect({
        model: 'gemini-3.1-flash-live-preview',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceParam || 'Zephyr',
              },
            },
          },
          systemInstruction: tacticalSystemInstruction,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'log_vice_purchase',
                  description: 'Logs a vice expenditure to tax the vice, calculate levy, and save capital to the vault.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      itemName: {
                        type: Type.STRING,
                        description: 'Name of the vice item (e.g., "Caramel Macchiato", "Covert Burger", "Night Drinks")',
                      },
                      amount: {
                        type: Type.NUMBER,
                        description: 'Amount spent in Ksh/currency units (e.g. 450)',
                      },
                      archetypeName: {
                        type: Type.STRING,
                        description: 'Closest archetype name from active list, e.g. "Agent Cocoa", "Tactical Takeout", "Impulse Tech"',
                      },
                    },
                    required: ['itemName', 'amount'],
                  },
                },
                {
                  name: 'log_quick_save',
                  description: 'Directly saves money to the mission vault without an associated vice purchase.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      amount: {
                        type: Type.NUMBER,
                        description: 'Amount to directly deposit to the vault',
                      },
                      note: {
                        type: Type.STRING,
                        description: 'Optional tactical mission note or reason',
                      },
                    },
                    required: ['amount'],
                  },
                },
                {
                  name: 'log_withdrawal',
                  description: 'Withdraws accumulated capital from the vault. Cannot exceed current vault balance.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      amount: {
                        type: Type.NUMBER,
                        description: 'Amount in Ksh to withdraw from the vault',
                      },
                      reason: {
                        type: Type.STRING,
                        description: 'Reason for withdrawal (e.g. "Emergency reserve deploy", "Asset acquisition")',
                      },
                    },
                    required: ['amount'],
                  },
                },
                {
                  name: 'get_vault_metrics',
                  description: 'Retrieves real-time vault balance, current rank, and progress to next level.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {},
                  },
                },
              ],
            },
          ],
        },
        callbacks: {
          onopen: () => {
            console.log('[Live API] Uplink connected to gemini-3.1-flash-live-preview for user:', user.codename);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'status',
                status: 'ready',
                message: 'Encrypted tactical voice channel operational.',
                model: 'gemini-3.1-flash-live-preview',
                voice: voiceParam,
              }));
            }
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;

            // Handle interruption signal from Live model
            if (msg.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ type: 'interrupted' }));
            }

            // Handle model turn audio & text parts
            const parts = msg.serverContent?.modelTurn?.parts;
            if (parts && parts.length > 0) {
              for (const part of parts) {
                if (part.inlineData?.data) {
                  clientWs.send(JSON.stringify({
                    type: 'audio',
                    audio: part.inlineData.data,
                  }));
                }
                if (part.text) {
                  clientWs.send(JSON.stringify({
                    type: 'transcript',
                    role: 'officer',
                    text: part.text,
                  }));
                }
              }
            }

            // Handle output speech transcriptions (model speech)
            const outputTrans = (msg as any).outputTranscription?.text;
            if (outputTrans) {
              clientWs.send(JSON.stringify({
                type: 'transcript',
                role: 'officer',
                text: outputTrans,
              }));
            }

            // Handle input speech transcriptions (agent speaking)
            const inputTrans = (msg as any).inputTranscription?.text;
            if (inputTrans) {
              clientWs.send(JSON.stringify({
                type: 'transcript',
                role: 'agent',
                text: inputTrans,
              }));
            }

            // Handle Tool Calls (function execution)
            if (msg.toolCall?.functionCalls && msg.toolCall.functionCalls.length > 0) {
              const functionResponses: any[] = [];

              for (const call of msg.toolCall.functionCalls) {
                const callId = call.id;
                const callName = call.name;
                const callArgs = (call.args || {}) as Record<string, any>;
                console.log(`[Live API] Tool invocation: ${callName}`, callArgs);

                if (callName === 'log_vice_purchase') {
                  const currentDb = getDb();
                  const profileArchs = Object.values(currentDb.archetypes).filter((a) => a.profileId === activeProfileId);
                  
                  // Match archetype
                  let matchedArch: Archetype | undefined;
                  if (callArgs.archetypeName) {
                    const search = callArgs.archetypeName.toLowerCase();
                    matchedArch = profileArchs.find(
                      (a) => a.name.toLowerCase().includes(search) || search.includes(a.name.toLowerCase())
                    );
                  }
                  if (!matchedArch && profileArchs.length > 0) {
                    // Match by item keyword or default to first archetype
                    const itemLower = (callArgs.itemName || '').toLowerCase();
                    matchedArch = profileArchs.find((a) => {
                      const an = a.name.toLowerCase();
                      if (itemLower.includes('coffee') || itemLower.includes('tea') || itemLower.includes('espresso')) return an.includes('cocoa');
                      if (itemLower.includes('food') || itemLower.includes('burger') || itemLower.includes('lunch') || itemLower.includes('takeout')) return an.includes('takeout');
                      if (itemLower.includes('tech') || itemLower.includes('gadget') || itemLower.includes('phone') || itemLower.includes('earbuds')) return an.includes('tech');
                      if (itemLower.includes('drink') || itemLower.includes('beer') || itemLower.includes('bar') || itemLower.includes('club')) return an.includes('bar');
                      if (itemLower.includes('sweet') || itemLower.includes('ice cream') || itemLower.includes('cake') || itemLower.includes('donut')) return an.includes('sweet');
                      return false;
                    }) || profileArchs[0];
                  }

                  const rate = matchedArch ? matchedArch.matchRate : 1.0;
                  const baseCost = Math.round(Number(callArgs.amount) || 0);
                  const savingsLevy = Math.round(baseCost * rate);
                  const totalOutflow = baseCost + savingsLevy;

                  const txId = 'tx_' + Math.random().toString(36).substring(2, 11);
                  const newTx: Transaction = {
                    id: txId,
                    itemName: String(callArgs.itemName || 'Tactical Vice Purchase'),
                    baseCost,
                    savingsLevy,
                    totalOutflow,
                    archetypeId: matchedArch ? matchedArch.id : null,
                    archetypeName: matchedArch ? matchedArch.name : 'Tactical Intercept',
                    archetypeEmoji: matchedArch ? matchedArch.emoji : '🎯',
                    matchRateSnapshot: rate,
                    isDirectDeposit: false,
                    note: 'Logged via M.I.A. Tactical Voice Comms (gemini-3.1-flash-live-preview)',
                    agentId: user.id,
                    profileId: activeProfileId,
                    purchaseDate: new Date().toISOString().split('T')[0],
                    loggedAt: new Date().toISOString(),
                  };

                  await setDocument('transactions', txId, newTx);

                  // Recompute metrics
                  const updatedTxs = Object.values(getDb().transactions).filter((t) => t.profileId === activeProfileId);
                  const newVaultCap = updatedTxs.reduce((acc, t) => acc + (t.savingsLevy || 0), 0);

                  clientWs.send(JSON.stringify({
                    type: 'action_completed',
                    action: 'log_vice_purchase',
                    transaction: newTx,
                    vaultCapital: newVaultCap,
                  }));

                  functionResponses.push({
                    id: callId,
                    response: {
                      status: 'success',
                      message: `Successfully logged vice "${newTx.itemName}" with ${Math.round(rate * 100)}% match rate. Deposited Ksh ${savingsLevy} into Vault. Total vault capital is now Ksh ${newVaultCap}.`,
                      savingsLevy,
                      totalOutflow,
                      newVaultCapital: newVaultCap,
                    },
                  });
                } else if (callName === 'log_quick_save') {
                  const amount = Math.round(Number(callArgs.amount) || 0);
                  const txId = 'tx_' + Math.random().toString(36).substring(2, 11);
                  const newTx: Transaction = {
                    id: txId,
                    itemName: callArgs.note ? `Quick Save: ${callArgs.note}` : 'Voice Quick Save Asset Injection',
                    baseCost: 0,
                    savingsLevy: amount,
                    totalOutflow: 0,
                    archetypeId: null,
                    archetypeName: null,
                    archetypeEmoji: '💰',
                    matchRateSnapshot: null,
                    isDirectDeposit: true,
                    note: callArgs.note || 'Logged via M.I.A. Voice Comms',
                    agentId: user.id,
                    profileId: activeProfileId,
                    purchaseDate: new Date().toISOString().split('T')[0],
                    loggedAt: new Date().toISOString(),
                  };

                  await setDocument('transactions', txId, newTx);

                  const updatedTxs = Object.values(getDb().transactions).filter((t) => t.profileId === activeProfileId);
                  const newVaultCap = updatedTxs.reduce((acc, t) => acc + (t.savingsLevy || 0), 0);

                  clientWs.send(JSON.stringify({
                    type: 'action_completed',
                    action: 'log_quick_save',
                    transaction: newTx,
                    vaultCapital: newVaultCap,
                  }));

                  functionResponses.push({
                    id: callId,
                    response: {
                      status: 'success',
                      message: `Successfully deposited Ksh ${amount} into Vault. Total vault capital is now Ksh ${newVaultCap}.`,
                      amountSaved: amount,
                      newVaultCapital: newVaultCap,
                    },
                  });
                } else if (callName === 'log_withdrawal') {
                  const amount = Math.round(Number(callArgs.amount) || 0);
                  const currentTxs = Object.values(getDb().transactions).filter((t) => t.profileId === activeProfileId);
                  const currentCap = currentTxs.reduce((acc, t) => acc + (t.savingsLevy || 0), 0);

                  if (amount <= 0) {
                    functionResponses.push({
                      id: callId,
                      response: {
                        status: 'error',
                        message: 'Withdrawal amount must be greater than zero.',
                      },
                    });
                  } else if (amount > currentCap) {
                    functionResponses.push({
                      id: callId,
                      response: {
                        status: 'error',
                        message: `Insufficient vault reserves. Requested withdrawal of Ksh ${amount} exceeds available balance of Ksh ${currentCap}.`,
                        availableBalance: currentCap,
                      },
                    });
                  } else {
                    const txId = 'tx_' + Math.random().toString(36).substring(2, 11);
                    const reason = callArgs.reason ? String(callArgs.reason) : 'Capital Extraction';
                    const newTx: Transaction = {
                      id: txId,
                      itemName: `Vault Withdrawal: ${reason}`,
                      baseCost: 0,
                      savingsLevy: -amount,
                      totalOutflow: 0,
                      archetypeId: null,
                      archetypeName: null,
                      archetypeEmoji: '💸',
                      matchRateSnapshot: null,
                      isDirectDeposit: false,
                      isWithdrawal: true,
                      note: `Voice extraction: ${reason}`,
                      agentId: user.id,
                      profileId: activeProfileId,
                      purchaseDate: new Date().toISOString().split('T')[0],
                      loggedAt: new Date().toISOString(),
                    };

                    await setDocument('transactions', txId, newTx);

                    const updatedTxs = Object.values(getDb().transactions).filter((t) => t.profileId === activeProfileId);
                    const newVaultCap = Math.max(0, updatedTxs.reduce((acc, t) => acc + (t.savingsLevy || 0), 0));
                    const newRank = getRankForCapital(newVaultCap);

                    clientWs.send(JSON.stringify({
                      type: 'action_completed',
                      action: 'log_withdrawal',
                      transaction: newTx,
                      vaultCapital: newVaultCap,
                    }));

                    functionResponses.push({
                      id: callId,
                      response: {
                        status: 'success',
                        message: `Withdrawal of Ksh ${amount} confirmed. Remaining vault capital: Ksh ${newVaultCap}. Current rank: ${newRank.currentRank.rank} (${newRank.currentRank.code}).`,
                        amountWithdrawn: amount,
                        newVaultCapital: newVaultCap,
                        newRank: newRank.currentRank.rank,
                      },
                    });
                  }
                } else if (callName === 'get_vault_metrics') {
                  const currentTxs = Object.values(getDb().transactions).filter((t) => t.profileId === activeProfileId);
                  const currentCap = currentTxs.reduce((acc, t) => acc + (t.savingsLevy || 0), 0);
                  const currentVices = currentTxs.reduce((acc, t) => acc + (t.baseCost || 0), 0);
                  const rank = getRankForCapital(currentCap);

                  functionResponses.push({
                    id: callId,
                    response: {
                      vaultName: profile.name,
                      vaultCapitalKsh: currentCap,
                      totalViceExpenditureKsh: currentVices,
                      rank: rank.currentRank.rank,
                      rankCode: rank.currentRank.code,
                      nextRank: rank.nextRank ? rank.nextRank.rank : 'Supreme Sovereignty',
                      capitalNeededForNextRank: rank.capitalNeeded,
                    },
                  });
                }
              }

              if (functionResponses.length > 0 && session) {
                session.sendToolResponse({ functionResponses });
              }
            }
          },
          onerror: (err: any) => {
            console.error('[Live API] Session Error:', err?.message || err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'error',
                error: err?.message || 'Live audio stream error',
              }));
            }
          },
          onclose: (e: any) => {
            console.log('[Live API] Session closed by host:', e?.reason || e);
            if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'status', status: 'closed', message: 'Voice connection closed' }));
            }
          },
        },
      });

      // Handle messages from browser client
      clientWs.on('message', (rawData) => {
        if (!session) return;
        try {
          const parsed = JSON.parse(rawData.toString());

          // Realtime 16kHz PCM audio chunk from microphone
          if (parsed.audio) {
            session.sendRealtimeInput({
              audio: {
                data: parsed.audio,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          } else if (parsed.type === 'text' && parsed.text) {
            // Text turn input
            session.sendClientContent({
              turns: [{ role: 'user', parts: [{ text: parsed.text }] }],
              turnComplete: true,
            });
          } else if (parsed.type === 'ping') {
            clientWs.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (err: any) {
          console.error('[Live API] Error handling client message:', err?.message);
        }
      });

      clientWs.on('close', () => {
        isClosed = true;
        console.log('[Live API] Client disconnected.');
        if (session) {
          try {
            session.close();
          } catch (_) {}
        }
      });
    } catch (err: any) {
      console.error('[Live API] Failed to initialize live session:', err?.message || err);
      clientWs.send(JSON.stringify({
        type: 'error',
        error: `Could not establish Live connection: ${err?.message || 'Check Gemini API Key.'}`,
      }));
      clientWs.close(4500, 'Init Error');
    }
  });

  console.log('[M.I.A. Tactical Live API] WebSocket subsystem initialized on path /api/live');
}
