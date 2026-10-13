import React from 'react';

interface UnisaLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  inverted?: boolean;
}

export const UnisaLogo: React.FC<UnisaLogoProps> = ({
  className = '',
  size = 40,
  showText = false,
  inverted = false,
}) => {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Official Emblem Universitas 'Aisyiyah Bandung Vector */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-xs"
      >
        <defs>
          <linearGradient id="unisaGreenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#065f46" />
            <stop offset="50%" stopColor="#047857" />
            <stop offset="100%" stopColor="#064e3b" />
          </linearGradient>
          <linearGradient id="unisaGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#ca8a04" />
          </linearGradient>
        </defs>

        {/* Outer Circular Ring (Emerald Green Base) */}
        <circle cx="50" cy="50" r="48" fill="url(#unisaGreenGrad)" stroke="#facc15" strokeWidth="2.5" />

        {/* Inner Gold Border Ring */}
        <circle cx="50" cy="50" r="42" fill="none" stroke="#fef08a" strokeWidth="1.2" strokeDasharray="3 1.5" />

        {/* 12-Ray Golden Sun (Sang Surya 'Aisyiyah / Muhammadiyah) */}
        <g transform="translate(50, 50)">
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
            <path
              key={deg}
              d="M0 -36 L4 -23 L-4 -23 Z"
              fill="url(#unisaGoldGrad)"
              transform={`rotate(${deg})`}
            />
          ))}
        </g>

        {/* Inner White Shield / Center Circle */}
        <circle cx="50" cy="50" r="23" fill="#ffffff" stroke="#15803d" strokeWidth="1.8" />

        {/* Center Green Arabic Caligraphy / 'Aisyiyah Insignia */}
        <path
          d="M50 34 C42 34 38 41 38 50 C38 58 44 65 50 65 C56 65 62 58 62 50 C62 41 58 34 50 34 Z"
          fill="#047857"
        />
        
        {/* Gold Crescent & Star Motif */}
        <circle cx="50" cy="49" r="9" fill="#ffffff" />
        <circle cx="52" cy="48" r="7.5" fill="#047857" />
        <polygon
          points="50,44 51.5,48 55,48 52,50 53.5,54 50,51.5 46.5,54 48,50 45,48 48.5,48"
          fill="#eab308"
        />

        {/* Text Ribbon Arc Indicator */}
        <path
          d="M30 78 Q50 86 70 78"
          stroke="#fef08a"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
      </svg>

      {showText && (
        <div className="flex flex-col leading-tight">
          <span
            className={`font-black text-xs sm:text-sm tracking-tight ${
              inverted ? 'text-white' : 'text-slate-900'
            }`}
          >
            UNIVERSITAS ‘AISYIYAH
          </span>
          <span
            className={`text-[10px] font-extrabold tracking-wider uppercase ${
              inverted ? 'text-emerald-200' : 'text-emerald-700'
            }`}
          >
            BANDUNG • PESMA BIMMA
          </span>
        </div>
      )}
    </div>
  );
};
