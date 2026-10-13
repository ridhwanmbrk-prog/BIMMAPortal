```tsx
import React from 'react';

interface UnisaLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  inverted?: boolean;
}

const UnisaLogo: React.FC<UnisaLogoProps> = ({
  className = '',
  size = 40,
  showText = false,
  inverted = false,
}) => {
  const wrapperClass = [
    'inline-flex',
    'items-center',
    'gap-2.5',
    className,
  ].filter(Boolean).join(' ');

  const titleClass = [
    'font-black',
    'text-xs',
    'sm:text-sm',
    'tracking-tight',
    inverted ? 'text-white' : 'text-slate-900',
  ].join(' ');

  const subtitleClass = [
    'text-[10px]',
    'font-extrabold',
    'tracking-wider',
    'uppercase',
    inverted ? 'text-emerald-200' : 'text-emerald-700',
  ].join(' ');

  return React.createElement(
    'div',
    { className: wrapperClass },
    React.createElement('img', {
      src: '/images/logo%20BIMMA.png',
      alt: 'Logo BIMMA',
      width: size,
      height: size,
      className: 'shrink-0 object-contain',
    }),
    showText
      ? React.createElement(
          'div',
          { className: 'flex flex-col leading-tight' },
          React.createElement(
            'span',
            { className: titleClass },
            'UNIVERSITAS ‘AISYIYAH'
          ),
          React.createElement(
            'span',
            { className: subtitleClass },
            'BANDUNG • PESMA BIMMA'
          )
        )
      : null
  );
};

export { UnisaLogo };
export default UnisaLogo;
```
