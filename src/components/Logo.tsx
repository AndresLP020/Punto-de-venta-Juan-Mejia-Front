'use client';

import { useState } from 'react';
import { LOGO_SRC } from '@/lib/tienda';

/**
 * Logo oficial de ARISE Athletic Shop.
 *
 * Se carga desde `public/arise-logo.png` respetando sus proporciones.
 * Si el archivo no existe, se muestra un marcador de posición neutro
 * (no sustituye el logo por otro diseño).
 */
export function Logo({
  size = 96,
  className = '',
  showText = false,
}: {
  size?: number;
  className?: string;
  showText?: boolean;
}) {
  const [hayLogo, setHayLogo] = useState(true);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {hayLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={LOGO_SRC}
          alt="ARISE Athletic Shop"
          width={size}
          height={size}
          onError={() => setHayLogo(false)}
          style={{ height: size, width: 'auto', maxWidth: 'none' }}
          className="object-contain"
        />
      ) : (
        <div
          style={{ height: size, width: size }}
          className="relative flex flex-col items-center justify-center rounded-full border-2 border-dashed border-arise-neon/70 bg-arise-card text-center"
          title="Espacio reservado para el logo oficial (public/arise-logo.png)"
        >
          <span
            className="font-display font-bold uppercase leading-none text-arise-lavender"
            style={{ fontSize: Math.max(8, size * 0.16) }}
          >
            Logo
          </span>
        </div>
      )}
      {showText && (
        <div className="leading-tight">
          <span className="block font-display text-xl font-bold uppercase tracking-wider text-white">ARISE</span>
          <span className="block text-[11px] font-medium uppercase tracking-[0.2em] text-arise-lavender">Athletic Shop</span>
        </div>
      )}
    </div>
  );
}
