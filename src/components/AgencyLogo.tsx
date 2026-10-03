import React from 'react';

interface AgencyLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'icon' | 'horizontal' | 'stacked';
  className?: string;
  withGlow?: boolean;
}

export const AgencyLogo: React.FC<AgencyLogoProps> = ({
  size = 'md',
  variant = 'horizontal',
  className = '',
  withGlow = true,
}) => {
  // Dimensions for the icon based on size
  const iconDimensions = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  }[size];

  const titleSizes = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-4xl',
  }[size];

  const subtitleSizes = {
    xs: 'text-[8px]',
    sm: 'text-[9px]',
    md: 'text-[10px]',
    lg: 'text-xs',
    xl: 'text-sm',
  }[size];

  const IconSvg = (
    <div className={`relative ${iconDimensions} shrink-0 group`}>
      {withGlow && (
        <div className="absolute inset-0 bg-emerald-500/25 rounded-xl blur-md -z-10 group-hover:bg-emerald-400/40 transition-all duration-300" />
      )}
      <svg
        viewBox="0 0 512 512"
        className="w-full h-full drop-shadow-md transition-transform duration-300 group-hover:scale-105"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="shieldBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="50%" stopColor="#022c22" />
            <stop offset="100%" stopColor="#031d17" />
          </linearGradient>

          <linearGradient id="logoNeonEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="50%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>

          <linearGradient id="logoGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>

          <linearGradient id="logoBorder" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="35%" stopColor="#10b981" />
            <stop offset="70%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>

          <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Hexagonal Shield */}
        <polygon
          points="256,26 454,122 454,358 256,486 58,358 58,122"
          fill="url(#shieldBg)"
          stroke="url(#logoBorder)"
          strokeWidth="10"
          strokeLinejoin="round"
        />

        {/* Inner Tactical Dashed Border */}
        <polygon
          points="256,52 430,138 430,342 256,456 82,342 82,138"
          fill="none"
          stroke="#065f46"
          strokeWidth="3.5"
          strokeDasharray="14,8"
        />

        {/* Target Reticle Crosshairs */}
        <line x1="256" y1="12" x2="256" y2="44" stroke="#34d399" strokeWidth="4" strokeLinecap="round" />
        <line x1="256" y1="468" x2="256" y2="500" stroke="#34d399" strokeWidth="4" strokeLinecap="round" />
        <line x1="42" y1="240" x2="74" y2="240" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
        <line x1="438" y1="240" x2="470" y2="240" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />

        {/* Eagle Vanguard Top Chevrons (Emerald) */}
        <path
          d="M 112,162 L 256,88 L 400,162 L 370,194 L 256,136 L 142,194 Z"
          fill="url(#logoNeonEmerald)"
          filter="url(#logoGlow)"
        />

        {/* Middle Chevrons (Gold Vault) */}
        <path
          d="M 132,208 L 256,148 L 380,208 L 356,234 L 256,184 L 156,234 Z"
          fill="url(#logoGold)"
        />

        {/* Lower Vault Base Chevrons */}
        <path
          d="M 152,332 L 256,412 L 360,332 L 340,310 L 256,372 L 172,310 Z"
          fill="url(#logoNeonEmerald)"
        />

        {/* Vault Dial Chamber */}
        <circle
          cx="256"
          cy="256"
          r="88"
          fill="#031712"
          stroke="url(#logoGold)"
          strokeWidth="6"
        />

        {/* Dial Ticks */}
        <g stroke="#34d399" strokeWidth="3" opacity="0.85">
          <line x1="256" y1="172" x2="256" y2="182" />
          <line x1="256" y1="330" x2="256" y2="340" />
          <line x1="172" y1="256" x2="182" y2="256" />
          <line x1="330" y1="256" x2="340" y2="256" />
          <line x1="196" y1="196" x2="204" y2="204" />
          <line x1="316" y1="316" x2="308" y2="308" />
          <line x1="196" y1="316" x2="204" y2="308" />
          <line x1="316" y1="196" x2="308" y2="204" />
        </g>

        {/* Inner Iris Vault Ring */}
        <circle
          cx="256"
          cy="256"
          r="62"
          fill="#062e24"
          stroke="#10b981"
          strokeWidth="4"
        />

        {/* Iris Core Polygon */}
        <polygon
          points="256,206 294,238 278,284 234,284 218,238"
          fill="#0f172a"
          stroke="url(#logoGold)"
          strokeWidth="3"
        />

        {/* Core Glowing Diamond Keyway */}
        <polygon
          points="256,226 272,256 256,286 240,256"
          fill="#34d399"
          filter="url(#logoGlow)"
        />
        <circle cx="256" cy="256" r="7" fill="#ffffff" />

        {/* Corner Tech Dots */}
        <circle cx="94" cy="144" r="5" fill="#34d399" />
        <circle cx="418" cy="144" r="5" fill="#34d399" />
        <circle cx="418" cy="336" r="5" fill="#f59e0b" />
        <circle cx="94" cy="336" r="5" fill="#f59e0b" />
      </svg>
    </div>
  );

  if (variant === 'icon') {
    return <div className={`inline-flex items-center ${className}`}>{IconSvg}</div>;
  }

  if (variant === 'stacked') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        {IconSvg}
        <div className="mt-3">
          <div className="flex items-center justify-center gap-1.5">
            <span className="px-1.5 py-0.2 bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 font-mono-code text-[9px] rounded uppercase tracking-wider">
              EST. 2026 // SECURE
            </span>
          </div>
          <h1 className={`font-tactical font-bold tracking-wider text-slate-100 uppercase ${titleSizes} mt-1`}>
            M.I.A.
          </h1>
          <p className={`font-mono-code text-slate-400 tracking-widest uppercase ${subtitleSizes} mt-0.5`}>
            Micro-Investment Agency
          </p>
        </div>
      </div>
    );
  }

  // Default: Horizontal
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {IconSvg}
      <div className="flex flex-col text-left">
        <div className="flex items-center gap-1.5">
          <span className={`font-tactical font-bold tracking-wider text-slate-100 uppercase leading-none ${titleSizes}`}>
            M.I.A.
          </span>
          <span className="px-1.5 py-0.5 bg-emerald-950/90 border border-emerald-500/30 text-emerald-400 font-mono-code text-[9px] rounded leading-none hidden sm:inline-block">
            TACTICAL
          </span>
        </div>
        <span className={`font-mono-code text-slate-400 tracking-wider uppercase leading-tight ${subtitleSizes} mt-0.5`}>
          Micro-Investment Agency
        </span>
      </div>
    </div>
  );
};
