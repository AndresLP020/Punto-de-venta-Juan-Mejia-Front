'use client';

const PASOS = [
  { n: 1, label: 'Carrito' },
  { n: 2, label: 'Datos y pago' },
  { n: 3, label: 'Confirmar' },
];

export function CheckoutPasos({ actual }: { actual: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Progreso de compra" className="mb-6">
      <ol className="flex items-center gap-2 sm:gap-3">
        {PASOS.map((paso, i) => {
          const hecho = actual > paso.n;
          const activo = actual === paso.n;
          return (
            <li key={paso.n} className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <span
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-extrabold flex-shrink-0 ${
                  hecho || activo ? 'bg-[#0b3d91] text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {hecho ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  paso.n
                )}
              </span>
              <span className={`text-xs sm:text-sm font-semibold truncate ${activo ? 'text-[#0b3d91]' : 'text-slate-500'}`}>
                {paso.label}
              </span>
              {i < PASOS.length - 1 && <span className="hidden sm:block flex-1 h-px bg-slate-200" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
      <p className="sr-only">Paso {actual} de 3</p>
    </nav>
  );
}
