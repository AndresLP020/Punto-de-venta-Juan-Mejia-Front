'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getProductos, getVentas, verifyAdminPassword, type Producto } from '@/lib/api';
import { formatearMoneda, formatearCantidad } from '@/lib/utils';
import { useAdminMode } from '@/contexts/AdminModeContext';

type Venta = {
  id: number;
  fecha: string;
  total: number;
  items: { id: number; nombre: string; precio: number; cantidad: number }[];
};

type ProductoVendido = {
  id: number;
  nombre: string;
  stock: number;
  cantidadVendida: number;
  totalVentas: number;
};

function hoy(): string {
  return new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function esHoy(fechaStr: string): boolean {
  const d = new Date(fechaStr);
  const h = new Date();
  return d.getDate() === h.getDate() && d.getMonth() === h.getMonth() && d.getFullYear() === h.getFullYear();
}

export default function DashboardPage() {
  const router = useRouter();
  const { entrarAdminMode } = useAdminMode();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAdmin, setModalAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');

  const cargarDatos = useCallback(() => {
    setLoading(true);
    Promise.all([getProductos(), getVentas()])
      .then(([p, v]) => {
        setProductos(p);
        setVentas(v);
      })
      .catch(() => {
        setProductos([]);
        setVentas([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const enviarAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    if (!adminPassword.trim()) {
      setAdminError('Ingresa la contraseña');
      return;
    }
    try {
      await verifyAdminPassword(adminPassword.trim());
      entrarAdminMode();
      setModalAdmin(false);
      setAdminPassword('');
      router.push('/pos/configuracion');
    } catch (err) {
      setAdminError((err as Error).message);
    }
  };

  const productosActivos = productos.filter((p) => (p.estado || 'Activo') === 'Activo').length;
  const transaccionesHoy = ventas.filter((v) => esHoy(v.fecha)).length;
  const productosStockBajo = productos.filter((p) => p.stock <= (p.stockMinimo ?? 0)).length;

  const ventasRecientes = [...ventas].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()).slice(0, 5);

  const productosMasVendidosMap = new Map<number, ProductoVendido>();
  ventas.forEach((v) => {
    (v.items || []).forEach((item) => {
      const prev = productosMasVendidosMap.get(item.id);
      const cantidad = (prev?.cantidadVendida ?? 0) + item.cantidad;
      const totalVentas = (prev?.totalVentas ?? 0) + item.precio * item.cantidad;
      const prod = productos.find((p) => p.id === item.id);
      productosMasVendidosMap.set(item.id, {
        id: item.id,
        nombre: item.nombre,
        stock: prod?.stock ?? 0,
        cantidadVendida: cantidad,
        totalVentas,
      });
    });
  });
  let productosMasVendidos = Array.from(productosMasVendidosMap.values()).sort(
    (a, b) => b.cantidadVendida - a.cantidadVendida
  );
  if (productosMasVendidos.length === 0 && productos.length > 0) {
    productosMasVendidos = productos.slice(0, 10).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      stock: p.stock,
      cantidadVendida: 0,
      totalVentas: 0,
    }));
  }

  const formatearFecha = (f: string) => {
    return new Date(f).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col min-h-full text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700/80 bg-slate-900/90 backdrop-blur-sm px-6 py-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5 capitalize">{hoy()}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setModalAdmin(true); setAdminError(''); setAdminPassword(''); }}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-400 hover:bg-slate-700/50 transition opacity-70 hover:opacity-100"
            title="Modo administrador"
            aria-label="Modo administrador"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </button>
          <button
            onClick={cargarDatos}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-700/80 text-sm font-medium transition disabled:opacity-50"
            title="Recargar datos"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar
          </button>
          <Link
            href="/pos/ventas"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium shadow-lg shadow-emerald-500/20 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Historial
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            <p className="text-slate-400 mt-4 text-sm font-medium">Cargando dashboard…</p>
          </div>
        ) : (
          <>
            {/* Métricas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
              <div className="rounded-2xl bg-slate-800/80 border border-slate-700/80 p-6 shadow-elevated hover:border-slate-600/80 transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm font-medium">Productos Activos</p>
                    <p className="text-3xl font-bold mt-1 text-white tabular-nums">{productosActivos}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-slate-800/80 border border-slate-700/80 p-6 shadow-elevated hover:border-slate-600/80 transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm font-medium">Transacciones Hoy</p>
                    <p className="text-3xl font-bold mt-1 text-white tabular-nums">{transaccionesHoy}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-slate-800/80 border border-slate-700/80 p-6 shadow-elevated hover:border-slate-600/80 transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm font-medium">Stock Bajo</p>
                    <p className="text-3xl font-bold mt-1 text-white tabular-nums">{productosStockBajo}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Paneles */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl bg-slate-800/80 border border-slate-700/80 overflow-hidden shadow-elevated">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/80">
                  <h2 className="text-base font-semibold text-white">Ventas Recientes</h2>
                  <Link href="/pos/ventas" className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition">
                    Ver todas →
                  </Link>
                </div>
                <div className="p-6 min-h-[220px]">
                  {ventasRecientes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                      <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <p className="text-sm font-medium">No hay ventas registradas</p>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {ventasRecientes.map((v) => (
                        <li key={v.id} className="flex justify-between items-center py-2 border-b border-slate-700/50 last:border-0">
                          <span className="text-slate-400 text-sm">#{v.id} · {formatearFecha(v.fecha)}</span>
                          <span className="text-white font-semibold tabular-nums">${formatearMoneda(v.total ?? 0)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-800/80 border border-slate-700/80 overflow-hidden shadow-elevated">
                <div className="px-6 py-4 border-b border-slate-700/80">
                  <h2 className="text-base font-semibold text-white">Productos Más Vendidos</h2>
                  <p className="text-slate-400 text-sm mt-0.5">Por cantidad vendida</p>
                </div>
                <div className="p-6 min-h-[220px]">
                  {productosMasVendidos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                      <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      <p className="text-sm font-medium">Sin datos de ventas aún</p>
                    </div>
                  ) : (
                    <ul className="space-y-4">
                      {productosMasVendidos.slice(0, 5).map((pv, index) => (
                        <li key={pv.id} className="flex items-center gap-4 py-2 border-b border-slate-700/50 last:border-0">
                          <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                            {index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{pv.nombre}</p>
                            <p className="text-slate-400 text-xs">Stock: {formatearCantidad(pv.stock)} · {formatearCantidad(pv.cantidadVendida)} vendidos</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-white font-semibold tabular-nums">${formatearMoneda(pv.totalVentas)}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal modo administrador */}
      {modalAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setModalAdmin(false)}>
          <div
            className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-700">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white">Modo administrador</h2>
              <p className="text-slate-400 text-sm mt-1">Ingresa la contraseña para acceder a configuración y usuarios.</p>
            </div>
            <form onSubmit={enviarAdminPassword} className="p-6 space-y-5">
              <div>
                <label htmlFor="admin-password" className="block text-sm font-medium text-slate-400 mb-1.5">
                  Contraseña
                </label>
                <input
                  id="admin-password"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => { setAdminPassword(e.target.value); setAdminError(''); }}
                  placeholder="••••••••"
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
                  autoFocus
                />
                {adminError && (
                  <p className="text-red-400 text-sm mt-2 flex items-center gap-1.5">
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {adminError}
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalAdmin(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-700 text-slate-300 font-medium hover:bg-slate-600 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-medium hover:bg-amber-600 transition shadow-lg shadow-amber-500/20"
                >
                  Entrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
