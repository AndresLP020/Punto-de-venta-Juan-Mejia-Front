'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { useEffect } from 'react';

const items: { href: string; label: string; icon: string; adminOnly?: boolean }[] = [
  { href: '/pos/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/pos/productos', label: 'Productos', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { href: '/pos/proveedores', label: 'Proveedores', icon: 'M8 7h12m0 0l-4-4m4 4l4-4m0 6H4m0 0l4 4m-4-4l4-4' },
  { href: '/pos', label: 'Ventas', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
  { href: '/pos/clientes', label: 'Clientes', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  { href: '/pos/deudores', label: 'Deudores', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { href: '/pos/gastos-admin', label: 'Gastos Admin', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', adminOnly: true },
  { href: '/pos/deudas', label: 'Deudas', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', adminOnly: true },
  { href: '/pos/sueldos', label: 'Sueldos', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', adminOnly: true },
  { href: '/pos/reportes', label: 'Reportes', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', adminOnly: true },
  { href: '/pos/lienzo-charro', label: 'Lienzo Charro', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', adminOnly: true },
  { href: '/pos/ventas', label: 'Historial', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', adminOnly: true },
  { href: '/pos/configuracion', label: 'Configuración', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', adminOnly: true },
];

const LABEL_BY_PATH: Record<string, string> = {
  '/pos/dashboard': 'Dashboard',
  '/pos/productos': 'Productos',
  '/pos/proveedores': 'Proveedores',
  '/pos': 'Ventas',
  '/pos/clientes': 'Clientes',
  '/pos/deudores': 'Deudores',
  '/pos/gastos-admin': 'Gastos Admin',
  '/pos/deudas': 'Deudas',
  '/pos/sueldos': 'Sueldos',
  '/pos/reportes': 'Reportes',
  '/pos/lienzo-charro': 'Lienzo Charro',
  '/pos/ventas': 'Historial',
  '/pos/configuracion': 'Configuración',
};

export function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { isAdminMode } = useAdminMode();

  useEffect(() => {
    if (open && onClose) onClose();
  }, [pathname, open, onClose]);

  useEffect(() => {
    if (open && onClose) onClose();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps -- close on route change

  const asideContent = (
    <>
      <div className="p-4 md:p-5 border-b border-slate-800/80">
        <Link href="/pos/dashboard" className="flex items-center gap-3 group" onClick={onClose}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white shadow-lg ring-2 ring-emerald-500/20 group-hover:ring-emerald-400/30 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <div>
            <span className="font-semibold text-white block leading-tight">POS Juan Mejía</span>
            <span className="text-xs text-slate-500 font-medium">Sistema de ventas</span>
          </div>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        <p className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Menú principal</p>
        {items.filter((item) => !item.adminOnly || isAdminMode).map(({ href, label, icon }) => {
          const isActive =
            pathname === href ||
            (pathname === '/pos' && label === 'Ventas') ||
            (pathname === '/pos/ventas' && label === 'Historial') ||
            (pathname === '/pos/clientes' && label === 'Clientes') ||
            (pathname === '/pos/deudores' && label === 'Deudores') ||
            (pathname === '/pos/gastos-admin' && label === 'Gastos Admin') ||
            (pathname === '/pos/deudas' && label === 'Deudas') ||
            (pathname === '/pos/sueldos' && label === 'Sueldos') ||
            (pathname === '/pos/reportes' && label === 'Reportes') ||
            (pathname === '/pos/lienzo-charro' && label === 'Lienzo Charro') ||
            (pathname === '/pos/configuracion' && label === 'Configuración');
          return (
            <Link
              key={`${href}-${label}`}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-xl text-sm font-medium transition min-h-[44px] md:min-h-0 touch-manipulation ${
                isActive
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  : 'text-slate-400 hover:bg-slate-800/80 hover:text-white active:bg-slate-700'
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0 opacity-90" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
              </svg>
              {label}
            </Link>
          );
        })}
      </nav>
      {isAdminMode && (
        <div className="px-3 py-2 border-t border-amber-500/20">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30">
            <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="text-xs font-semibold text-amber-200 uppercase tracking-wider">Modo administrador</span>
          </div>
        </div>
      )}
      <div className="p-3 border-t border-slate-800/80">
        <Link
          href="/"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-800/80 hover:text-white transition min-h-[44px] md:min-h-0 touch-manipulation"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Cerrar sesión
        </Link>
      </div>
    </>
  );

  return (
    <>
      {/* Móvil: overlay + drawer */}
      {onClose && (
        <div
          className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 md:hidden ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`
          w-60 flex-shrink-0 bg-slate-900 border-r border-slate-800/80 flex flex-col shadow-xl
          ${onClose
            ? `fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-out ${open ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`
            : ''
          }
        `}
      >
        {asideContent}
      </aside>
    </>
  );
}

export function MobileHeaderTitle() {
  const pathname = usePathname();
  const title = LABEL_BY_PATH[pathname ?? ''] ?? 'POS';
  return <span className="font-semibold text-white truncate">{title}</span>;
}
