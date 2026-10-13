```tsx
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
      <img
        src="/images/logo%20BIMMA.png"
        alt="Logo BIMMA"
        width={size}
        height={size}
        className="shrink-0 object-contain"
      />

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
```
