import { AgencyRank } from '../types';

export const AGENCY_RANKS: AgencyRank[] = [
  {
    rank: 'Recruit',
    code: 'LEVEL-01',
    threshold: 0,
    nextThreshold: 500,
    description: 'Initiate undergoing tactical micro-levy training.',
    badge: '🎖️',
    color: '#94a3b8', // slate-400
  },
  {
    rank: 'Field Agent',
    code: 'LEVEL-02',
    threshold: 500,
    nextThreshold: 2000,
    description: 'Active field operator intercepting daily discretionary outflows.',
    badge: '🛡️',
    color: '#38bdf8', // sky-400
  },
  {
    rank: 'Operative',
    code: 'LEVEL-03',
    threshold: 2000,
    nextThreshold: 5000,
    description: 'Proven covert operative converting impulse expenses into secure assets.',
    badge: '⚡',
    color: '#34d399', // emerald-400
  },
  {
    rank: 'Special Agent',
    code: 'LEVEL-04',
    threshold: 5000,
    nextThreshold: 15000,
    description: 'High-clearance asset strategist with disciplined capital diversion.',
    badge: '🦅',
    color: '#fbbf24', // amber-400
  },
  {
    rank: 'Senior Operative',
    code: 'LEVEL-05',
    threshold: 15000,
    nextThreshold: 50000,
    description: 'Veteran intelligence officer managing robust micro-investment portfolios.',
    badge: '🔮',
    color: '#a78bfa', // purple-400
  },
  {
    rank: 'Deputy Director',
    code: 'LEVEL-06',
    threshold: 50000,
    nextThreshold: 150000,
    description: 'Strategic leadership commanding substantial multi-profile vault reserves.',
    badge: '⭐',
    color: '#f43f5e', // rose-500
  },
  {
    rank: 'Director',
    code: 'LEVEL-07',
    threshold: 150000,
    nextThreshold: null,
    description: 'Supreme intelligence director. Peak financial sovereignty achieved.',
    badge: '👑',
    color: '#10b981', // emerald-500
  },
];

export function getRankForCapital(vaultCapital: number): {
  currentRank: AgencyRank;
  nextRank: AgencyRank | null;
  progress: number;
  capitalNeeded: number;
} {
  let currentRank = AGENCY_RANKS[0];
  let nextRank: AgencyRank | null = AGENCY_RANKS[1];

  for (let i = 0; i < AGENCY_RANKS.length; i++) {
    if (vaultCapital >= AGENCY_RANKS[i].threshold) {
      currentRank = AGENCY_RANKS[i];
      nextRank = i + 1 < AGENCY_RANKS.length ? AGENCY_RANKS[i + 1] : null;
    }
  }

  if (!nextRank) {
    return {
      currentRank,
      nextRank: null,
      progress: 100,
      capitalNeeded: 0,
    };
  }

  const range = nextRank.threshold - currentRank.threshold;
  const earnedInRange = vaultCapital - currentRank.threshold;
  const progress = Math.min(100, Math.max(0, Math.round((earnedInRange / range) * 100)));
  const capitalNeeded = Math.max(0, nextRank.threshold - vaultCapital);

  return {
    currentRank,
    nextRank,
    progress,
    capitalNeeded,
  };
}

export function formatKsh(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace('KES', 'Ksh');
}
