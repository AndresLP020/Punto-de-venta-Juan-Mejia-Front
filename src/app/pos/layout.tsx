'use client';

import { useEffect } from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AdminModeProvider, useAdminMode } from '@/contexts/AdminModeContext';
import { Sidebar } from '@/components/Sidebar';
import { useRouter, usePathname } from 'next/navigation';

const RUTAS_SOLO_ADMIN = ['/pos/gastos-admin', '/pos/deudas', '/pos/sueldos', '/pos/reportes', '/pos/ventas', '/pos/configuracion'];

function AdminRouteGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdminMode } = useAdminMode();

  useEffect(() => {
    if (pathname && !isAdminMode && RUTAS_SOLO_ADMIN.includes(pathname)) {
      router.replace('/pos/dashboard');
    }
  }, [pathname, isAdminMode, router]);

  return null;
}

function AdminModeBanner() {
  const { isAdminMode, setAdminMode, showMensajeIngreso, cerrarMensajeIngreso } = useAdminMode();
  const router = useRouter();

  if (!isAdminMode) return null;

  const salir = () => {
    setAdminMode(false);
    router.push('/pos/dashboard');
  };

  return (
    <div className="sticky top-0 z-20 flex items-center justify-between gap-4 px-5 py-2.5 bg-gradient-to-r from-amber-500/25 via-amber-600/20 to-slate-800/80 border-b border-amber-500/30 text-amber-100 shadow-lg shadow-black/10">
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-500/30 flex items-center justify-center">
          <svg className="w-4 h-4 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </span>
        <div className="flex flex-col min-w-0 sm:flex-row sm:items-center sm:gap-3">
          {showMensajeIngreso ? (
            <>
              <span className="font-semibold text-amber-50 truncate">Ingresaste al modo administrador</span>
              <button
                type="button"
                onClick={cerrarMensajeIngreso}
                className="text-amber-300/90 hover:text-amber-100 text-sm font-medium transition self-start sm:self-center"
              >
                Ocultar mensaje
              </button>
            </>
          ) : (
            <span className="font-semibold text-amber-50">Modo administrador activo</span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={salir}
        className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700/90 hover:bg-slate-600 border border-slate-600 hover:border-slate-500 text-white text-sm font-medium transition shadow-sm"
      >
        <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Salir del modo administrador
      </button>
    </div>
  );
}

export default function POSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <AdminModeProvider>
        <div className="pos-layout flex h-screen bg-slate-950 overflow-hidden">
          <AdminRouteGuard />
          <Sidebar />
          <main className="flex-1 overflow-auto bg-slate-900/50 min-w-0 flex flex-col">
            <AdminModeBanner />
            <div className="min-h-full bg-gradient-to-b from-slate-900/80 to-slate-900 pos-main-inner flex-1">
              {children}
            </div>
          </main>
        </div>
      </AdminModeProvider>
    </ThemeProvider>
  );
}
