'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getVentas, getDevoluciones, getPerdidas, postDevolucion, getProductos, putVenta, cancelarVenta, type Devolucion, type PerdidaItem, type Producto, type VentaItemEdit, type MovimientoVenta } from '@/lib/api';
import { formatearMoneda, formatearCantidad, hoyISO, mensajeError } from '@/lib/utils';
import { imprimirTicket } from '@/lib/ticketPrint';
import { netoCobrado } from '@/lib/finanzas';

type Venta = {
  id: number;
  fecha: string;
  total: number;
  pagado?: number;
  pendiente?: number;
  items: { id?: number; nombre: string; cantidad: number; precio: number; costo?: number }[];
  cliente?: string;
  estado?: string;
  abonos?: MovimientoVenta[];
  reembolsos?: MovimientoVenta[];
  usuario?: string;
  usuarioNombre?: string;
};

/** Quién hizo la venta (las ventas antiguas solo guardaban el usuario de login). */
const vendedorVenta = (v: Venta) => v.usuarioNombre || v.usuario || '';

/** Lo que el cliente ha pagado y no se le ha devuelto. */
const netoVenta = (v: Venta) => netoCobrado({ ...v, items: [] });

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
  const [modalEditarVenta, setModalEditarVenta] = useState<{ venta: Venta; items: VentaItemEdit[] } | null>(null);
  const [enviandoEditar, setEnviandoEditar] = useState(false);
  const [productosParaAgregar, setProductosParaAgregar] = useState<Producto[]>([]);

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
          vendedorVenta(v).toLowerCase().includes(termino) ||
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

  const ventasActivas = ventasFiltradas.filter((v) => v.estado !== 'cancelada');
  const estadisticas = {
    total: ventasActivas.reduce((sum, v) => sum + (v.total || 0), 0),
    cantidad: ventasActivas.length,
    promedio: ventasActivas.length > 0 ? ventasActivas.reduce((sum, v) => sum + (v.total || 0), 0) / ventasActivas.length : 0,
    itemsTotal: ventasActivas.reduce((sum, v) => sum + (v.items?.reduce((s, i) => s + i.cantidad, 0) || 0), 0),
  };

  const hoy = hoyISO();

  /** Ítems del modal de devolución: los del ticket elegido o, sin ticket, todos los productos. */
  const itemsParaDevolucion = (ventaId: number | null, listado: Producto[]): ItemDevolucionEdit[] => {
    const venta = ventaId != null ? ventas.find((v) => v.id === ventaId) : null;
    if (venta) {
      const porProducto = new Map<number, ItemDevolucionEdit>();
      for (const it of venta.items || []) {
        if (it.id == null) continue;
        const prev = porProducto.get(it.id);
        if (prev) prev.cantidadVendida += it.cantidad;
        else porProducto.set(it.id, { productoId: it.id, nombre: it.nombre, cantidadVendida: it.cantidad, cantidadDevolver: 0, precio: it.precio, tipo: 'revendible' });
      }
      return Array.from(porProducto.values());
    }
    return listado.map((p) => ({
      productoId: p.id,
      nombre: p.nombre,
      cantidadVendida: 0,
      cantidadDevolver: 0,
      precio: typeof p.precio === 'number' ? p.precio : 0,
      tipo: 'revendible' as const,
    }));
  };

  const cambiarVentaDevolucion = (ventaId: number | null) => {
    setModalDevolucion({ ventaId, items: itemsParaDevolucion(ventaId, productos as Producto[]) });
  };

  const cancelarVentaHistorial = async (venta: Venta) => {
    const neto = netoVenta(venta);
    const mensaje =
      `¿Cancelar la venta #${venta.id}?\n\nLos productos regresarán al inventario` +
      (neto > 0 ? ` y se registrará la devolución de $${formatearMoneda(neto)} al cliente.` : '.') +
      '\nEsta acción no se puede deshacer.';
    if (!window.confirm(mensaje)) return;
    try {
      await cancelarVenta(venta.id);
      cargarVentas();
    } catch (e) {
      alert(mensajeError(e, 'Error al cancelar la venta'));
    }
  };

  const abrirModalDevolucion = async () => {
    try {
      const listado: Producto[] = await getProductos();
      setProductos(listado);
      setModalDevolucion({ ventaId: null, items: itemsParaDevolucion(null, listado) });
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
      alert(mensajeError(e));
    } finally {
      setEnviandoDevolucion(false);
    }
  };

  const abrirEditarTicket = (venta: Venta) => {
    const items: VentaItemEdit[] = (venta.items || []).map((i) => ({
      id: i.id ?? 0,
      nombre: i.nombre,
      precio: i.precio,
      cantidad: i.cantidad,
      costo: i.costo,
    }));
    setModalEditarVenta({ venta, items });
    getProductos().then(setProductosParaAgregar).catch(() => setProductosParaAgregar([]));
  };

  const actualizarItemEditar = (idx: number, upd: Partial<VentaItemEdit>) => {
    setModalEditarVenta((prev) => {
      if (!prev) return null;
      const next = [...prev.items];
      next[idx] = { ...next[idx], ...upd };
      return { ...prev, items: next };
    });
  };

  const quitarItemEditar = (idx: number) => {
    setModalEditarVenta((prev) => {
      if (!prev) return null;
      const next = prev.items.filter((_, i) => i !== idx);
      if (next.length === 0) return prev;
      return { ...prev, items: next };
    });
  };

  const agregarProductoATicket = (p: Producto) => {
    setModalEditarVenta((prev) => {
      if (!prev) return null;
      const nuevo: VentaItemEdit = {
        id: p.id,
        nombre: p.nombre,
        precio: p.precio,
        cantidad: 1,
        costo: p.costo,
      };
      const existente = prev.items.findIndex((i) => i.id === p.id);
      let items: VentaItemEdit[];
      if (existente >= 0) {
        items = prev.items.map((it, i) => (i === existente ? { ...it, cantidad: it.cantidad + 1 } : it));
      } else {
        items = [...prev.items, nuevo];
      }
      return { ...prev, items };
    });
  };

  const calcularModificaciones = (
    original: { id?: number; nombre: string; cantidad: number; precio: number }[],
    nuevo: VentaItemEdit[]
  ): string[] => {
    const lineas: string[] = [];
    const agrupar = (items: { id?: number; nombre: string; cantidad: number; precio: number }[]) => {
      const m = new Map<number, { nombre: string; cantidad: number; precio: number }>();
      for (const it of items) {
        const id = it.id ?? 0;
        const prev = m.get(id);
        if (!prev) m.set(id, { nombre: it.nombre, cantidad: it.cantidad, precio: it.precio });
        else {
          prev.cantidad += it.cantidad;
          if (it.precio !== prev.precio) prev.precio = it.precio;
        }
      }
      return m;
    };
    const oldM = agrupar(original);
    const newM = agrupar(nuevo);
    const idsViejos = Array.from(oldM.keys());
    const idsNuevos = Array.from(newM.keys());
    const todosIds = Array.from(new Set(idsViejos.concat(idsNuevos)));
    for (let i = 0; i < todosIds.length; i++) {
      const id = todosIds[i];
      const oldItem = oldM.get(id);
      const newItem = newM.get(id);
      const nombre = (newItem ?? oldItem)?.nombre ?? 'Producto';
      if (!oldItem) {
        lineas.push(`• ${nombre} agregado (cant: ${newItem!.cantidad}, precio $${formatearMoneda(newItem!.precio)})`);
      } else if (!newItem) {
        lineas.push(`• ${nombre} eliminado (era cant: ${oldItem.cantidad}, precio $${formatearMoneda(oldItem.precio)})`);
      } else {
        if (oldItem.precio !== newItem.precio) {
          lineas.push(`• ${nombre} precio actualizado: $${formatearMoneda(oldItem.precio)} → $${formatearMoneda(newItem.precio)}`);
        }
        if (oldItem.cantidad !== newItem.cantidad) {
          lineas.push(`• ${nombre} cantidad actualizada: ${oldItem.cantidad} → ${newItem.cantidad}`);
        }
      }
    }
    return lineas;
  };

  const imprimirTicketEditado = (
    venta: Venta,
    items: VentaItemEdit[],
    pagado: number,
    modificaciones: string[]
  ) => {
    const nuevoTotal = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
    imprimirTicket({
      tipo: 'correccion',
      ventaId: venta.id,
      cliente: venta.cliente,
      vendedor: vendedorVenta(venta),
      items: items.map((i) => ({
        nombre: i.nombre,
        cantidad: i.cantidad,
        precio: i.precio,
      })),
      total: nuevoTotal,
      pagado,
      modificaciones,
    });
  };

  const guardarEditarTicket = async () => {
    if (!modalEditarVenta) return;
    if (modalEditarVenta.items.length === 0) {
      alert('El ticket debe tener al menos un producto.');
      return;
    }
    const venta = modalEditarVenta.venta;
    const itemsNuevos = modalEditarVenta.items;
    setEnviandoEditar(true);
    try {
      await putVenta(venta.id, { items: itemsNuevos });
      const pagado = netoVenta(venta);
      const modificaciones = calcularModificaciones(venta.items, itemsNuevos);
      const ventaGuardada = { ...venta, items: itemsNuevos };
      setModalEditarVenta(null);
      cargarVentas();
      const imprimir = window.confirm('¿Imprimir ticket nuevamente con los cambios y el detalle de lo pagado y lo que se debe?');
      if (imprimir) {
        imprimirTicketEditado(ventaGuardada, itemsNuevos, pagado, modificaciones);
      }
    } catch (e) {
      alert(mensajeError(e));
    } finally {
      setEnviandoEditar(false);
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm mb-1">Total de Ventas</p>
            <p className="text-lg sm:text-2xl font-bold break-words text-white">{formatearCantidad(estadisticas.cantidad)}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm mb-1">Monto Total</p>
            <p className="text-lg sm:text-2xl font-bold break-words text-green-400">${formatearMoneda(estadisticas.total)}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm mb-1">Promedio por Venta</p>
            <p className="text-lg sm:text-2xl font-bold break-words text-white">${formatearMoneda(estadisticas.promedio)}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm mb-1">Productos Vendidos</p>
            <p className="text-lg sm:text-2xl font-bold break-words text-white">{formatearCantidad(estadisticas.itemsTotal)}</p>
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
                    <div className="flex items-start justify-between gap-2 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                          <span className={`text-lg font-bold whitespace-nowrap ${venta.estado === 'cancelada' ? 'text-slate-500 line-through' : 'text-white'}`}>Venta #{venta.id}</span>
                          {venta.estado === 'cancelada' && (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-300">Cancelada</span>
                          )}
                          {venta.estado === 'pendiente' && (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-amber-500/20 text-amber-300">
                              Pendiente ${formatearMoneda(venta.pendiente ?? 0)}
                            </span>
                          )}
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
                          {vendedorVenta(venta) && (
                            <span className="flex items-center gap-1.5" title="Vendedor">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              Vendió: {vendedorVenta(venta)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg sm:text-2xl font-bold text-green-400 mb-1 whitespace-nowrap">${formatearMoneda(venta.total ?? 0)}</p>
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
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-slate-300">Productos vendidos:</h4>
                        {venta.estado !== 'cancelada' && (
                        <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); cancelarVentaHistorial(venta); }}
                          className="px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-500 text-white text-sm font-medium transition"
                        >
                          Cancelar venta
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); abrirEditarTicket(venta); }}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Editar ticket
                        </button>
                        </div>
                        )}
                      </div>
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
                        <span className="text-slate-400 text-sm ml-2">{d.ventaId ? `Venta #${d.ventaId}` : 'Sin ticket'}</span>
                        {(d.reembolso ?? 0) > 0 && (
                          <span className="text-blue-300 text-sm ml-2">Reembolso: ${formatearMoneda(d.reembolso ?? 0)}</span>
                        )}
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
                  cambiarVentaDevolucion(val === '' ? null : Number(val));
                }}
                className="w-full rounded-xl bg-slate-700 border border-slate-600 text-white px-4 py-2"
              >
                <option value="">Ninguna</option>
                {ventas.filter((v) => v.estado !== 'cancelada').map((v) => (
                  <option key={v.id} value={v.id}>
                    Venta #{v.id} — {formatearFechaCorta(v.fecha)} — ${formatearMoneda(v.total ?? 0)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <p className="text-slate-400 text-sm mb-3">
                {modalDevolucion.ventaId != null
                  ? 'Productos del ticket seleccionado. El ticket se ajustará y, si ya estaba pagado, se registrará el reembolso al cliente.'
                  : 'Sin ticket de referencia: se muestran todos los productos y se registra el reembolso al precio actual.'}{' '}
                Indica la cantidad a devolver y si se puede revender o es pérdida.
              </p>
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
                          max={modalDevolucion.ventaId != null ? it.cantidadVendida : undefined}
                          step="any"
                          value={it.cantidadDevolver || ''}
                          onChange={(e) => {
                            let cant = Math.max(0, Number(e.target.value) || 0);
                            if (modalDevolucion.ventaId != null) cant = Math.min(cant, it.cantidadVendida);
                            actualizarItemDevolucion(idx, { cantidadDevolver: cant });
                          }}
                          className="w-20 rounded-lg bg-slate-700 border border-slate-600 text-white px-2 py-1 text-sm"
                        />
                        {modalDevolucion.ventaId != null && (
                          <span className="text-slate-500 text-sm">Vendidos en el ticket: {it.cantidadVendida}</span>
                        )}
                        <span className="text-slate-500 text-sm">${formatearMoneda(it.precio)} c/u</span>
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

      {/* Modal Editar ticket */}
      {modalEditarVenta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !enviandoEditar && setModalEditarVenta(null)}>
          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">Editar ticket #{modalEditarVenta.venta.id}</h2>
              <button type="button" onClick={() => !enviandoEditar && setModalEditarVenta(null)} className="p-1 text-slate-400 hover:text-white">×</button>
            </div>
            <div className="p-4 flex-1 overflow-auto space-y-4">
              <p className="text-slate-400 text-sm">Modifica precio, cantidad, agrega o quita productos. El total y las ganancias se actualizarán al guardar.</p>
              {/* Resumen de pago y deuda */}
              <div className="rounded-xl bg-slate-700/50 border border-slate-600 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Pagado anteriormente por el cliente:</span>
                  <span className="text-emerald-400 font-semibold">${formatearMoneda(netoVenta(modalEditarVenta.venta))}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-slate-600">
                  <span className="text-slate-400">Nuevo total del ticket:</span>
                  <span className="text-white font-semibold">${formatearMoneda(modalEditarVenta.items.reduce((s, i) => s + i.precio * i.cantidad, 0))}</span>
                </div>
                {(() => {
                  const nuevoTotal = modalEditarVenta.items.reduce((s, i) => s + i.precio * i.cantidad, 0);
                  const pagado = netoVenta(modalEditarVenta.venta);
                  const seLeDebeAlCliente = Math.max(0, pagado - nuevoTotal);
                  const clienteDebe = Math.max(0, nuevoTotal - pagado);
                  if (seLeDebeAlCliente > 0) {
                    return (
                      <div className="flex justify-between text-sm pt-2 border-t border-slate-600">
                        <span className="text-blue-400">Se le debe al cliente:</span>
                        <span className="text-blue-400 font-bold">${formatearMoneda(seLeDebeAlCliente)}</span>
                      </div>
                    );
                  }
                  if (clienteDebe > 0) {
                    return (
                      <div className="flex justify-between text-sm pt-2 border-t border-slate-600">
                        <span className="text-amber-400">El cliente nos debe:</span>
                        <span className="text-amber-400 font-bold">${formatearMoneda(clienteDebe)}</span>
                      </div>
                    );
                  }
                  return (
                    <div className="text-sm pt-2 border-t border-slate-600 text-emerald-400 font-medium">
                      Cuenta saldada
                    </div>
                  );
                })()}
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-slate-300">Productos en el ticket</h3>
                {modalEditarVenta.items.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-slate-700/50 border border-slate-600">
                    <div className="flex-1 min-w-[140px]">
                      <p className="text-white font-medium text-sm">{item.nombre}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-slate-400 text-xs">Precio</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.precio}
                        onChange={(e) => actualizarItemEditar(idx, { precio: Math.max(0, Number(e.target.value) || 0) })}
                        className="w-20 rounded-lg bg-slate-700 border border-slate-600 text-white px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-slate-400 text-xs">Cant.</label>
                      <input
                        type="number"
                        min={0.001}
                        step="any"
                        value={item.cantidad}
                        onChange={(e) => actualizarItemEditar(idx, { cantidad: Math.max(0.001, Math.round((Number(e.target.value) || 0) * 1000) / 1000) })}
                        className="w-16 rounded-lg bg-slate-700 border border-slate-600 text-white px-2 py-1.5 text-sm"
                      />
                    </div>
                    <span className="text-slate-300 text-sm tabular-nums">= ${formatearMoneda(item.precio * item.cantidad)}</span>
                    <button type="button" onClick={() => quitarItemEditar(idx)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/20" title="Quitar producto">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-slate-700">
                <h3 className="text-sm font-medium text-slate-300 mb-2">Agregar producto al ticket</h3>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {productosParaAgregar.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => agregarProductoATicket(p)}
                      className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm border border-slate-600"
                    >
                      {p.nombre} — ${formatearMoneda(p.precio)} (stock: {p.stock ?? 0})
                    </button>
                  ))}
                </div>
              </div>
              <div className="pt-4 border-t border-slate-700 flex justify-between items-center">
                <span className="text-slate-400">Nuevo total:</span>
                <span className="text-xl font-bold text-green-400">
                  ${formatearMoneda(modalEditarVenta.items.reduce((s, i) => s + i.precio * i.cantidad, 0))}
                </span>
              </div>
            </div>
            <div className="p-4 border-t border-slate-700 flex gap-3 justify-end">
              <button type="button" onClick={() => !enviandoEditar && setModalEditarVenta(null)} className="px-4 py-2 rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600">
                Cancelar
              </button>
              <button type="button" onClick={guardarEditarTicket} disabled={enviandoEditar} className="px-4 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50">
                {enviandoEditar ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
