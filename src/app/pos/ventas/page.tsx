'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getVentas, getDevoluciones, getPerdidas, postDevolucion, getProductos, type Devolucion, type PerdidaItem, type Producto } from '@/lib/api';
import { formatearMoneda, formatearCantidad } from '@/lib/utils';

type Venta = {
  id: number;
  fecha: string;
  total: number;
  items: { id?: number; nombre: string; cantidad: number; precio: number }[];
  cliente?: string;
};

type FiltroFecha = 'todos' | 'hoy' | 'ayer' | 'semana' | 'mes' | 'personalizado';

type VistaVentas = 'ventas' | 'devoluciones' | 'perdidas';

type ItemDevolucionEdit = { productoId: number; nombre: string; cantidadVendida: number; cantidadDevolver: number; precio: number; tipo: 'revendible' | 'perdida' };

export default function VentasPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Cargando…</div>}>
      <VentasPageContent />
    </Suspense>
  );
}

function VentasPageContent() {
  const searchParams = useSearchParams();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [ventasFiltradas, setVentasFiltradas] = useState<Venta[]>([]);
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>([]);
  const [perdidas, setPerdidas] = useState<PerdidaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroFecha, setFiltroFecha] = useState<FiltroFecha>('todos');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [ventaExpandida, setVentaExpandida] = useState<number | null>(null);
  const [ordenarPor, setOrdenarPor] = useState<'fecha' | 'total'>('fecha');
  const [ordenAscendente, setOrdenAscendente] = useState(false);
  const [vista, setVista] = useState<VistaVentas>('ventas');
  const [productos, setProductos] = useState<{ id: number; nombre: string; precio: number; stock: number; esGranel?: boolean }[]>([]);
  const [modalDevolucion, setModalDevolucion] = useState<{ ventaId: number | null; items: ItemDevolucionEdit[] } | null>(null);
  const [enviandoDevolucion, setEnviandoDevolucion] = useState(false);

  useEffect(() => {
    const v = searchParams.get('vista');
    if (v === 'devoluciones' || v === 'perdidas') setVista(v);
  }, [searchParams]);

  const cargarVentas = useCallback(() => {
    getVentas()
      .then(setVentas)
      .catch(() => setVentas([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    cargarVentas();
  }, [cargarVentas]);

  useEffect(() => {
    if (vista === 'devoluciones') {
      getDevoluciones().then(setDevoluciones).catch(() => setDevoluciones([]));
    } else if (vista === 'perdidas') {
      getPerdidas().then(setPerdidas).catch(() => setPerdidas([]));
    }
  }, [vista]);

  useEffect(() => {
    let filtradas = [...ventas];

    // Filtro por fecha
    const ahora = new Date();
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);
    const semanaPasada = new Date(hoy);
    semanaPasada.setDate(semanaPasada.getDate() - 7);
    const mesPasado = new Date(hoy);
    mesPasado.setMonth(mesPasado.getMonth() - 1);

    switch (filtroFecha) {
      case 'hoy':
        filtradas = filtradas.filter((v) => {
          const fecha = new Date(v.fecha);
          return fecha >= hoy;
        });
        break;
      case 'ayer':
        filtradas = filtradas.filter((v) => {
          const fecha = new Date(v.fecha);
          return fecha >= ayer && fecha < hoy;
        });
        break;
      case 'semana':
        filtradas = filtradas.filter((v) => {
          const fecha = new Date(v.fecha);
          return fecha >= semanaPasada;
        });
        break;
      case 'mes':
        filtradas = filtradas.filter((v) => {
          const fecha = new Date(v.fecha);
          return fecha >= mesPasado;
        });
        break;
      case 'personalizado':
        if (fechaInicio) {
          const inicio = new Date(fechaInicio);
          inicio.setHours(0, 0, 0, 0);
          filtradas = filtradas.filter((v) => {
            const fecha = new Date(v.fecha);
            return fecha >= inicio;
          });
        }
        if (fechaFin) {
          const fin = new Date(fechaFin);
          fin.setHours(23, 59, 59, 999);
          filtradas = filtradas.filter((v) => {
            const fecha = new Date(v.fecha);
            return fecha <= fin;
          });
        }
        break;
    }

    // Búsqueda
    if (busqueda.trim()) {
      const termino = busqueda.toLowerCase();
      filtradas = filtradas.filter(
        (v) =>
          v.id.toString().includes(termino) ||
          v.cliente?.toLowerCase().includes(termino) ||
          v.items.some((i) => i.nombre.toLowerCase().includes(termino))
      );
    }

    // Ordenamiento
    filtradas.sort((a, b) => {
      if (ordenarPor === 'fecha') {
        const fechaA = new Date(a.fecha).getTime();
        const fechaB = new Date(b.fecha).getTime();
        return ordenAscendente ? fechaA - fechaB : fechaB - fechaA;
      } else {
        return ordenAscendente ? a.total - b.total : b.total - a.total;
      }
    });

    setVentasFiltradas(filtradas);
  }, [ventas, filtroFecha, fechaInicio, fechaFin, busqueda, ordenarPor, ordenAscendente]);

  const formatearFecha = (f: string) => {
    const d = new Date(f);
    return d.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatearFechaCorta = (f: string) => {
    const d = new Date(f);
    return d.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const estadisticas = {
    total: ventasFiltradas.reduce((sum, v) => sum + (v.total || 0), 0),
    cantidad: ventasFiltradas.length,
    promedio: ventasFiltradas.length > 0 ? ventasFiltradas.reduce((sum, v) => sum + (v.total || 0), 0) / ventasFiltradas.length : 0,
    itemsTotal: ventasFiltradas.reduce((sum, v) => sum + (v.items?.reduce((s, i) => s + i.cantidad, 0) || 0), 0),
  };

  const hoy = new Date().toISOString().split('T')[0];

  const abrirModalDevolucion = async () => {
    try {
      const listado = await getProductos();
      setProductos(listado);
      const items: ItemDevolucionEdit[] = listado.map((p: Producto) => ({
        productoId: p.id,
        nombre: p.nombre,
        cantidadVendida: typeof p.stock === 'number' ? p.stock : 0,
        cantidadDevolver: 0,
        precio: typeof p.precio === 'number' ? p.precio : 0,
        tipo: 'revendible' as const,
      }));
      const ventaId = ventas.length > 0 ? ventas[0].id : null;
      setModalDevolucion({ ventaId, items });
    } catch {
      alert('Error al cargar productos');
    }
  };

  const actualizarItemDevolucion = (idx: number, upd: Partial<ItemDevolucionEdit>) => {
    setModalDevolucion((prev) => {
      if (!prev) return null;
      const next = [...prev.items];
      next[idx] = { ...next[idx], ...upd };
      return { ...prev, items: next };
    });
  };

  const enviarDevolucion = async () => {
    if (!modalDevolucion) return;
    const itemsEnviar = modalDevolucion.items
      .filter((it) => it.cantidadDevolver > 0)
      .map((it) => ({ id: it.productoId, nombre: it.nombre, cantidad: it.cantidadDevolver, precio: it.precio, tipo: it.tipo }));
    if (itemsEnviar.length === 0) {
      alert('Indica al menos un ítem con cantidad a devolver.');
      return;
    }
    setEnviandoDevolucion(true);
    try {
      await postDevolucion({ ventaId: modalDevolucion.ventaId ?? undefined, items: itemsEnviar });
      setModalDevolucion(null);
      getDevoluciones().then(setDevoluciones).catch(() => {});
      getPerdidas().then(setPerdidas).catch(() => {});
      cargarVentas();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setEnviandoDevolucion(false);
    }
  };

  return (
    <div className="flex flex-col h-full text-white">
      {/* Header con pestañas */}
      <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
          <h1 className="text-2xl font-bold text-white">Ventas</h1>
          <div className="flex rounded-lg bg-slate-700/80 p-1">
            {(['ventas', 'devoluciones', 'perdidas'] as VistaVentas[]).map((v) => (
              <button
                key={v}
                onClick={() => setVista(v)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  vista === v ? 'bg-green-500 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-600'
                }`}
              >
                {v === 'ventas' ? 'Historial' : v === 'devoluciones' ? 'Devoluciones' : 'Pérdidas'}
              </button>
            ))}
          </div>
        </div>
        <p className="text-slate-400 text-sm">
          {vista === 'ventas' && 'Registro de transacciones'}
          {vista === 'devoluciones' && 'Registra devoluciones indicando si el producto se puede revender o es pérdida'}
          {vista === 'perdidas' && 'Productos devueltos registrados como pérdida'}
        </p>
      </div>

      {vista === 'ventas' && (
        <>
      {/* Filtros y controles */}
      <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/30 space-y-4">
        {/* Filtros de fecha */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-300 text-sm font-medium">Filtrar por fecha:</span>
          {(['todos', 'hoy', 'ayer', 'semana', 'mes', 'personalizado'] as FiltroFecha[]).map((filtro) => (
            <button
              key={filtro}
              onClick={() => {
                setFiltroFecha(filtro);
                if (filtro !== 'personalizado') {
                  setFechaInicio('');
                  setFechaFin('');
                }
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${
                filtroFecha === filtro
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {filtro === 'todos' ? 'Todas' : filtro === 'hoy' ? 'Hoy' : filtro === 'ayer' ? 'Ayer' : filtro === 'semana' ? 'Esta semana' : filtro === 'mes' ? 'Este mes' : 'Personalizado'}
            </button>
          ))}
        </div>

        {/* Rango de fechas personalizado */}
        {filtroFecha === 'personalizado' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-700">
            <div className="flex items-center gap-2">
              <label className="text-slate-300 text-sm">Desde:</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                max={fechaFin || hoy}
                className="px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-300 text-sm">Hasta:</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                min={fechaInicio}
                max={hoy}
                className="px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        )}

        {/* Búsqueda y ordenamiento */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-700">
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por número, cliente o producto..."
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-300 text-sm">Ordenar por:</span>
            <select
              value={ordenarPor}
              onChange={(e) => setOrdenarPor(e.target.value as 'fecha' | 'total')}
              className="px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="fecha">Fecha</option>
              <option value="total">Total</option>
            </select>
            <button
              onClick={() => setOrdenAscendente(!ordenAscendente)}
              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
              title={ordenAscendente ? 'Ascendente' : 'Descendente'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {ordenAscendente ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/30">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm mb-1">Total de Ventas</p>
            <p className="text-2xl font-bold text-white">{formatearCantidad(estadisticas.cantidad)}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm mb-1">Monto Total</p>
            <p className="text-2xl font-bold text-green-400">${formatearMoneda(estadisticas.total)}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm mb-1">Promedio por Venta</p>
            <p className="text-2xl font-bold text-white">${formatearMoneda(estadisticas.promedio)}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm mb-1">Productos Vendidos</p>
            <p className="text-2xl font-bold text-white">{formatearCantidad(estadisticas.itemsTotal)}</p>
          </div>
        </div>
      </div>

      {/* Lista de ventas */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-center py-12 text-slate-400">Cargando ventas…</div>
        ) : ventasFiltradas.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-slate-400 text-lg">No se encontraron ventas</p>
            <p className="text-slate-500 text-sm mt-1">Intenta ajustar los filtros de búsqueda</p>
          </div>
        ) : (
          <div className="space-y-3">
            {ventasFiltradas.map((venta) => {
              const itemsCount = venta.items?.reduce((sum, i) => sum + i.cantidad, 0) || 0;
              const estaExpandida = ventaExpandida === venta.id;

              return (
                <div
                  key={venta.id}
                  className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden hover:border-slate-600 transition"
                >
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => setVentaExpandida(estaExpandida ? null : venta.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-lg font-bold text-white">Venta #{venta.id}</span>
                          <span className="px-2 py-1 rounded text-xs font-medium bg-slate-700 text-slate-300">
                            {itemsCount} {itemsCount === 1 ? 'producto' : 'productos'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {formatearFecha(venta.fecha)}
                          </span>
                          {venta.cliente && (
                            <span className="flex items-center gap-1.5">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              {venta.cliente}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-400 mb-1">${formatearMoneda(venta.total ?? 0)}</p>
                        <p className="text-xs text-slate-400">{formatearFechaCorta(venta.fecha)}</p>
                      </div>
                      <button className="p-1 text-slate-400 hover:text-white transition">
                        <svg
                          className={`w-5 h-5 transition-transform ${estaExpandida ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Detalles expandidos */}
                  {estaExpandida && (
                    <div className="border-t border-slate-700 bg-slate-900/50 p-4">
                      <h4 className="text-sm font-semibold text-slate-300 mb-3">Productos vendidos:</h4>
                      <div className="space-y-2">
                        {venta.items?.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/50">
                            <div className="flex-1">
                              <p className="text-white font-medium">{item.nombre}</p>
                              <p className="text-sm text-slate-400">
                                {item.cantidad} × ${formatearMoneda(item.precio)} = ${formatearMoneda(item.cantidad * item.precio)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-white font-semibold">${formatearMoneda(item.cantidad * item.precio)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center">
                        <span className="text-slate-400 text-sm">Total de la venta:</span>
                        <span className="text-xl font-bold text-green-400">${formatearMoneda(venta.total ?? 0)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
        </>
      )}

      {vista === 'devoluciones' && (
        <div className="flex-1 overflow-auto p-6 space-y-6">
          <div className="flex justify-end">
            <button
              onClick={abrirModalDevolucion}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-medium transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Nueva devolución
            </button>
          </div>
          <div className="rounded-2xl bg-slate-800/80 border border-slate-700 overflow-hidden">
            <h2 className="text-slate-200 font-semibold px-4 py-3 border-b border-slate-700">Historial de devoluciones</h2>
            {devoluciones.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No hay devoluciones registradas.</div>
            ) : (
              <ul className="divide-y divide-slate-700">
                {devoluciones.map((d) => (
                  <li key={d.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-medium text-white">Devolución #{d.id}</span>
                        <span className="text-slate-400 text-sm ml-2">Venta #{d.ventaId}</span>
                        <p className="text-slate-500 text-sm mt-1">{formatearFecha(d.fecha)}</p>
                      </div>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm">
                      {d.items.map((it, i) => (
                        <li key={i} className="text-slate-300">
                          {it.nombre} × {it.cantidad} — {it.tipo === 'perdida' ? 'Pérdida' : 'Se puede revender'}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {vista === 'perdidas' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="rounded-2xl bg-slate-800/80 border border-slate-700 overflow-hidden">
            <h2 className="text-slate-200 font-semibold px-4 py-3 border-b border-slate-700">Pérdidas (productos devueltos no revendibles)</h2>
            {perdidas.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No hay pérdidas registradas.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-800 text-left">
                      <th className="text-slate-400 font-semibold text-sm px-4 py-3">Fecha</th>
                      <th className="text-slate-400 font-semibold text-sm px-4 py-3">Venta</th>
                      <th className="text-slate-400 font-semibold text-sm px-4 py-3">Producto</th>
                      <th className="text-slate-400 font-semibold text-sm px-4 py-3">Cantidad</th>
                      <th className="text-slate-400 font-semibold text-sm px-4 py-3 text-right">Valor pérdida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perdidas.map((p, idx) => (
                      <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                        <td className="px-4 py-3 text-slate-300 text-sm">{formatearFecha(p.fecha)}</td>
                        <td className="px-4 py-3 text-slate-300">#{p.ventaId}</td>
                        <td className="px-4 py-3 text-white">{p.nombre}</td>
                        <td className="px-4 py-3 text-slate-300">{p.cantidad}</td>
                        <td className="px-4 py-3 text-right font-medium text-red-400 tabular-nums">${formatearMoneda(p.valorPerdida)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {perdidas.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-700 flex justify-end">
                <span className="text-slate-400 text-sm">
                  Total pérdidas: <span className="font-bold text-red-400">${formatearMoneda(perdidas.reduce((s, p) => s + p.valorPerdida, 0))}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Nueva devolución */}
      {modalDevolucion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !enviandoDevolucion && setModalDevolucion(null)}>
          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">Nueva devolución</h2>
              <button onClick={() => !enviandoDevolucion && setModalDevolucion(null)} className="p-1 text-slate-400 hover:text-white">×</button>
            </div>
            <div className="p-4 border-b border-slate-700">
              <label className="block text-slate-400 text-sm mb-2">Venta de referencia (opcional)</label>
              <select
                value={modalDevolucion.ventaId ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setModalDevolucion((prev) => (prev ? { ...prev, ventaId: val === '' ? null : Number(val) } : null));
                }}
                className="w-full rounded-xl bg-slate-700 border border-slate-600 text-white px-4 py-2"
              >
                <option value="">Ninguna</option>
                {ventas.map((v) => (
                  <option key={v.id} value={v.id}>
                    Venta #{v.id} — {formatearFechaCorta(v.fecha)} — ${formatearMoneda(v.total ?? 0)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <p className="text-slate-400 text-sm mb-3">Todos los productos. Indica cantidad a devolver y si se puede revender o es pérdida.</p>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {modalDevolucion.items.map((it, idx) => (
                  <div key={it.productoId} className="p-3 rounded-xl bg-slate-700/50 border border-slate-600 space-y-2">
                    <p className="font-medium text-white">{it.nombre}</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <label className="text-slate-400 text-sm">Cant. a devolver</label>
                        <input
                          type="number"
                          min={0}
                          value={it.cantidadDevolver || ''}
                          onChange={(e) => actualizarItemDevolucion(idx, { cantidadDevolver: Math.max(0, Number(e.target.value) || 0) })}
                          className="w-20 rounded-lg bg-slate-700 border border-slate-600 text-white px-2 py-1 text-sm"
                        />
                        <span className="text-slate-500 text-sm">Stock actual: {it.cantidadVendida}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-sm">Tipo:</span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`tipo-${idx}`}
                            checked={it.tipo === 'revendible'}
                            onChange={() => actualizarItemDevolucion(idx, { tipo: 'revendible' })}
                            className="rounded-full"
                          />
                          <span className="text-sm text-slate-300">Se puede revender</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`tipo-${idx}`}
                            checked={it.tipo === 'perdida'}
                            onChange={() => actualizarItemDevolucion(idx, { tipo: 'perdida' })}
                            className="rounded-full"
                          />
                          <span className="text-sm text-slate-300">Pérdida</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-slate-700 flex gap-3 justify-end">
              <button type="button" onClick={() => !enviandoDevolucion && setModalDevolucion(null)} className="px-4 py-2 rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600">
                Cancelar
              </button>
              <button type="button" onClick={enviarDevolucion} disabled={enviandoDevolucion} className="px-4 py-2 rounded-xl bg-green-500 text-white hover:bg-green-600 disabled:opacity-50">
                {enviandoDevolucion ? 'Procesando…' : 'Registrar devolución'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
