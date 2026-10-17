'use client';

import { useState } from 'react';

/**
 * Logo de Nutri-Ala.
 *
 * El logo oficial se carga desde `public/nutri-ala-logo.jpeg`.
 * Si el archivo no existe, se muestra un marcador de posición
 * con la temática de pollo y los colores de la marca.
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
          src="/nutri-ala-logo.jpeg"
          alt="Nutri-Ala"
          width={size}
          height={size}
          onError={() => setHayLogo(false)}
          style={{ height: size, width: 'auto' }}
          className="object-contain drop-shadow-md"
        />
      ) : (
        <div
          style={{ height: size, width: size }}
          className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-400 bg-white text-center"
          title="Espacio reservado para el logo oficial (public/nutri-ala-logo.png)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth={1.6} style={{ width: size * 0.5, height: size * 0.5 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          <span className="mt-1 px-1 text-[9px] font-semibold leading-none text-slate-400">
            Logo aquí
          </span>
        </div>
      )}
      {showText && (
        <div className="leading-tight">
          <span className="block text-xl font-extrabold tracking-tight text-slate-900">
            Nutri<span className="text-red-600">-</span>Ala
          </span>
          <span className="block text-xs font-medium text-blue-700">el buen sabor del pollo…</span>
        </div>
      )}
    </div>
  );
}
