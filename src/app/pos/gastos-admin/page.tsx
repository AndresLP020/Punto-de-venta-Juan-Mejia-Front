'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  getGastosAdmin,
  getVentas,
  getProductos,
  getNominas,
  getMovimientosLienzo,
  postGastoAdmin,
  putGastoAdmin,
  deleteGastoAdmin,
  CATEGORIAS_GASTOS,
  type GastoAdmin,
} from '@/lib/api';
import type { Producto } from '@/lib/api';
import { formatearMoneda } from '@/lib/utils';

type VentaConItems = {
  fecha: string;
  total: number;
  pagado?: number;
  items?: { id: number; nombre: string; precio: number; cantidad: number; costo?: number }[];
};
type PeriodoResumen = 'diario' | 'semanal' | 'mensual' | 'anual' | 'personalizado';

export default function GastosAdminPage() {
  const [gastos, setGastos] = useState<GastoAdmin[]>([]);
  const [ventas, setVentas] = useState<VentaConItems[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [nominas, setNominas] = useState<{ fecha: string; total: number }[]>([]);
  const [movimientosLienzo, setMovimientosLienzo] = useState<{ fecha: string; tipo: string; monto: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('Todos');
  const [periodoResumen, setPeriodoResumen] = useState<PeriodoResumen>('mensual');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ fecha: '', descripcion: '', categoria: 'Diversos', monto: '' });

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [g, v, p, n, lienzo] = await Promise.all([
        getGastosAdmin(),
        getVentas(),
        getProductos(),
        getNominas(),
        getMovimientosLienzo().catch(() => []),
      ]);
      setGastos(g);
      setVentas(v);
      setProductos(p);
      setNominas(n);
      setMovimientosLienzo(lienzo);
    } catch {
      setGastos([]);
      setVentas([]);
      setProductos([]);
      setNominas([]);
      setMovimientosLienzo([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Fechas por defecto para filtro (mes actual)
  useEffect(() => {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    if (!fechaDesde) setFechaDesde(primerDia.toISOString().split('T')[0]);
    if (!fechaHasta) setFechaHasta(hoy.toISOString().split('T')[0]);
  }, []);

  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59);

  const gastosEsteMes = gastos.filter((g) => {
    const d = new Date(g.fecha);
    return d >= inicioMes && d <= finMes;
  });
  const totalGastosMes = gastosEsteMes.reduce((s, g) => s + g.monto, 0);

  const nominasEsteMes = nominas.filter((n) => {
    const d = new Date(n.fecha);
    return d >= inicioMes && d <= finMes;
  });
  const totalNominasMes = nominasEsteMes.reduce((s, n) => s + n.total, 0);

  const ventasEsteMes = ventas.filter((v) => {
    const d = new Date(v.fecha);
    return d >= inicioMes && d <= finMes;
  });
  const ingresosMes = ventasEsteMes.reduce((s, v) => s + (v.pagado ?? v.total ?? 0), 0);
  const ingresosLienzoMes = movimientosLienzo
    .filter((m) => m.tipo === 'ingreso')
    .filter((m) => {
      const d = new Date(m.fecha);
      return d >= inicioMes && d <= finMes;
    })
    .reduce((s, m) => s + m.monto, 0);
  const ingresosTotalesMes = ingresosMes + ingresosLienzoMes;
  // Costo de lo vendido (costo de productos). Usar costo guardado en ítem o, si no, costo actual del producto.
  const costoVentasMes = ventasEsteMes.reduce((sum, venta) => {
    const porcentajePagado = venta.total > 0 ? (venta.pagado ?? venta.total) / venta.total : 1;
    return sum + (venta.items || []).reduce((itemSum, item) => {
      const costoUnit = item.costo != null ? item.costo : (productos.find((p) => p.id === item.id)?.costo ?? 0);
      return itemSum + costoUnit * item.cantidad * porcentajePagado;
    }, 0);
  }, 0);
  const gananciaBrutaMes = ingresosTotalesMes - costoVentasMes;
  // Fórmula unificada: Ganancia neta = Ingresos (ventas + Lienzo Charro) − Costo ventas − Gastos Admin − Nóminas
  const gananciaNetaMes = gananciaBrutaMes - totalGastosMes - totalNominasMes;
  const efectivoDisponible = gananciaNetaMes;
  const efectivoBajo = efectivoDisponible < 0 || (ingresosTotalesMes === 0 && (gastos.length > 0 || nominas.length > 0));

  const totalGeneral = gastos.reduce((s, g) => s + g.monto, 0);

  // Filtro por categoría
  const categoriasPrimeraFila = [
    'Todos',
    'Salud',
    'Automotriz',
    'Escuelas',
    'Diversos',
    'Sueldos',
    'Viáticos',
    'Entretenimiento',
    'Servicios básicos de casa',
    'Compras familiares',
    'seguros, Hacienda (SAT)',
    'Lienzo Charro',
  ];
  const gastosPorCategoria =
    categoriaFiltro === 'Todos'
      ? gastos
      : gastos.filter((g) => g.categoria === categoriaFiltro);

  // Filtro por rango de fechas
  const gastosFiltrados = gastosPorCategoria.filter((g) => {
    if (!fechaDesde && !fechaHasta) return true;
    const d = new Date(g.fecha);
    const desde = fechaDesde ? new Date(fechaDesde) : null;
    const hasta = fechaHasta ? new Date(fechaHasta + 'T23:59:59') : null;
    if (desde && d < desde) return false;
    if (hasta && d > hasta) return false;
    return true;
  });

  const totalGastadoFiltrado = gastosFiltrados.reduce((s, g) => s + g.monto, 0);

  // Resumen por categoría (mismo filtro de fechas): para ver en qué apartado se gasta más
  const resumenPorCategoria = (() => {
    const map = new Map<string, number>();
    for (const g of gastosFiltrados) {
      map.set(g.categoria, (map.get(g.categoria) ?? 0) + g.monto);
    }
    return Array.from(map.entries())
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total);
  })();
  const maxCategoria = Math.max(...resumenPorCategoria.map((r) => r.total), 1);

  const abrirModal = (gasto?: GastoAdmin) => {
    if (gasto) {
      setEditingId(gasto.id);
      setForm({
        fecha: gasto.fecha.split('T')[0],
        descripcion: gasto.descripcion,
        categoria: gasto.categoria,
        monto: String(gasto.monto),
      });
    } else {
      setEditingId(null);
      const hoy = new Date().toISOString().split('T')[0];
      setForm({ fecha: hoy, descripcion: '', categoria: 'Diversos', monto: '' });
    }
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setEditingId(null);
  };

  const guardarGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    const monto = parseFloat(form.monto);
    if (Number.isNaN(monto) || form.descripcion.trim() === '') return;
    try {
      if (editingId) {
        await putGastoAdmin(editingId, {
          fecha: form.fecha,
          descripcion: form.descripcion.trim(),
          categoria: form.categoria,
          monto,
        });
      } else {
        await postGastoAdmin({
          fecha: form.fecha || undefined,
          descripcion: form.descripcion.trim(),
          categoria: form.categoria,
          monto,
        });
      }
      await cargarDatos();
      cerrarModal();
    } catch (err) {
      console.error(err);
    }
  };

  const eliminarGasto = async (id: number) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    try {
      await deleteGastoAdmin(id);
      await cargarDatos();
    } catch (err) {
      console.error(err);
    }
  };

  const formatearFecha = (f: string) => {
    return new Date(f).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const fm = (n: number) => `$${formatearMoneda(n)}`;

  if (loading && gastos.length === 0) {
    return (
      <div className="flex flex-col h-full text-white">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-slate-400 mt-4 text-sm font-medium">Cargando gastos…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-700/80 bg-slate-900/90 backdrop-blur-sm px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold text-blue-400">$</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Gastos del Administrador</h1>
            <p className="text-slate-400 text-sm mt-0.5">Control y registro de gastos personales</p>
          </div>
        </div>
        <button
          onClick={() => abrirModal()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium shadow-lg transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Agregar Gasto
        </button>
      </header>

      {/* Barra resumen / debug */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 bg-slate-800/60 border-b border-slate-700/80">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-slate-400 text-sm font-medium">
            Gastos Admin: {gastos.length} | Total: {fm(totalGeneral)}
          </span>
          {gastos.length === 0 && (
            <span className="flex items-center gap-1.5 text-amber-400 text-sm">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92z" clipRule="evenodd" />
              </svg>
              No hay gastos administrativos registrados
            </span>
          )}
          <span className="text-slate-500 text-sm">
            Ingresos: {fm(ingresosTotalesMes)} · Costo ventas: {fm(costoVentasMes)} · Gastos: {fm(totalGastosMes)} · Ganancia neta: {fm(gananciaNetaMes)} · Efectivo: {fm(efectivoDisponible)}
          </span>
        </div>
      </div>

      {/* Alerta efectivo bajo */}
      {efectivoBajo && (
        <div className="mx-6 mt-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="font-medium">Efectivo disponible bajo</span>
        </div>
      )}

      {/* KPIs */}
      <div className="px-6 py-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-6">
          <div className="rounded-2xl bg-slate-800/80 border border-emerald-500/30 p-5 shadow-elevated">
            <p className="text-slate-400 text-sm font-medium">Ingresos Mensuales</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">{fm(ingresosTotalesMes)}</p>
            <p className="text-xs text-slate-500 mt-1">Ventas + Lienzo Charro del mes</p>
          </div>
          <div className="rounded-2xl bg-slate-800/80 border border-amber-500/30 p-5 shadow-elevated">
            <p className="text-slate-400 text-sm font-medium">Costo de Ventas</p>
            <p className="text-2xl font-bold text-amber-400 mt-1 tabular-nums">{fm(costoVentasMes)}</p>
            <p className="text-xs text-slate-500 mt-1">Costo de productos vendidos</p>
          </div>
          <div className="rounded-2xl bg-slate-800/80 border border-red-500/30 p-5 shadow-elevated">
            <p className="text-slate-400 text-sm font-medium">Gastos Administrativos</p>
            <p className="text-2xl font-bold text-red-400 mt-1 tabular-nums">{fm(totalGastosMes)}</p>
            <p className="text-xs text-slate-500 mt-1">Gastos del mes (este apartado)</p>
          </div>
          <div className="rounded-2xl bg-slate-800/80 border border-emerald-500/30 p-5 shadow-elevated">
            <p className="text-slate-400 text-sm font-medium">Ganancia Neta Mensual</p>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${gananciaNetaMes >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fm(gananciaNetaMes)}</p>
            <p className="text-xs text-slate-500 mt-1">Ingresos − Costo ventas − Gastos Admin − Nóminas</p>
          </div>
          <div className="rounded-2xl bg-slate-800/80 border border-violet-500/30 p-5 shadow-elevated">
            <p className="text-slate-400 text-sm font-medium">Efectivo Disponible</p>
            <p className="text-2xl font-bold text-violet-400 mt-1 tabular-nums">{fm(efectivoDisponible)}</p>
            <p className="text-xs text-slate-500 mt-1">Ganancia neta (resumen)</p>
          </div>
        </div>

        {/* Filtros por categoría */}
        <div className="mb-4">
          <p className="text-slate-400 text-sm font-medium mb-2">Filtrar por categoría</p>
          <div className="flex flex-wrap gap-2">
            {categoriasPrimeraFila.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoriaFiltro(cat)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                  categoriaFiltro === cat
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'bg-slate-700/80 text-slate-300 hover:bg-slate-600 border border-slate-600/50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="mt-2">
            <button
              onClick={() => setCategoriaFiltro('Gastos de la empresa')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                categoriaFiltro === 'Gastos de la empresa'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700/80 text-slate-300 hover:bg-slate-600 border border-slate-600/50'
              }`}
            >
              Gastos de la empresa
            </button>
          </div>
        </div>

        {/* Resumen por periodo y categoría */}
        <div className="rounded-2xl bg-slate-800/80 border border-slate-700/80 p-4 mb-6 inline-flex flex-col gap-2">
          <h2 className="text-slate-200 font-semibold">Resumen por periodo y categoría</h2>
          <div className="flex items-center gap-2">
            <label className="text-slate-400 text-sm">Selecciona periodo:</label>
            <select
              value={periodoResumen}
              onChange={(e) => setPeriodoResumen(e.target.value as PeriodoResumen)}
              className="rounded-xl bg-slate-700 border border-slate-600 text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="diario">Diario</option>
              <option value="semanal">Semanal</option>
              <option value="mensual">Mensual</option>
              <option value="anual">Anual</option>
              <option value="personalizado">Personalizado</option>
            </select>
          </div>
        </div>

        {/* Filtro por fechas + Total gastado */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-slate-400 text-sm">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="rounded-xl bg-slate-700/80 border border-slate-600 px-3 py-2 text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-slate-400 text-sm">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="rounded-xl bg-slate-700/80 border border-slate-600 px-3 py-2 text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div className="rounded-2xl bg-slate-800/80 border border-slate-700/80 px-5 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <span className="text-blue-400 font-bold">$</span>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Total Gastado (Filtrado)</p>
              <p className="text-xl font-bold text-violet-400 tabular-nums">{fm(totalGastadoFiltrado)}</p>
            </div>
          </div>
        </div>

        {/* Resumen: en qué categoría se gasta más */}
        {resumenPorCategoria.length > 0 && (
          <div className="rounded-2xl bg-slate-800/80 border border-slate-700/80 p-5 mb-6">
            <h2 className="text-slate-200 font-semibold mb-1">Dónde se gasta más (periodo filtrado)</h2>
            <p className="text-slate-500 text-sm mb-4">Total por categoría, ordenado de mayor a menor gasto</p>
            <div className="space-y-3">
              {resumenPorCategoria.map(({ categoria, total }) => {
                const pct = totalGastadoFiltrado > 0 ? (total / totalGastadoFiltrado) * 100 : 0;
                const anchoBarra = maxCategoria > 0 ? (total / maxCategoria) * 100 : 0;
                return (
                  <div key={categoria} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-300">{categoria}</span>
                      <span className="text-red-400 font-semibold tabular-nums">{fm(total)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-red-500/70 min-w-[2px] transition-all"
                        style={{ width: `${anchoBarra}%` }}
                      />
                    </div>
                    <div className="flex justify-end">
                      <span className="text-xs text-slate-500">{pct.toFixed(1)}% del total filtrado</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabla de gastos */}
        <div className="rounded-2xl bg-slate-800/80 border border-slate-700/80 overflow-hidden shadow-elevated">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800">
                  <th className="text-left text-slate-400 font-semibold text-sm px-6 py-4">Fecha</th>
                  <th className="text-left text-slate-400 font-semibold text-sm px-6 py-4">Descripción</th>
                  <th className="text-left text-slate-400 font-semibold text-sm px-6 py-4">Categoría</th>
                  <th className="text-right text-slate-400 font-semibold text-sm px-6 py-4">Monto</th>
                  <th className="text-right text-slate-400 font-semibold text-sm px-6 py-4 w-24">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {gastosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-500">
                        <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <p className="text-lg font-medium text-slate-400">No hay gastos administrativos registrados</p>
                        <p className="text-sm mt-1 max-w-sm">Comienza agregando tu primer gasto administrativo usando el botón &quot;Agregar Gasto&quot;</p>
                        <button
                          onClick={() => abrirModal()}
                          className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium transition"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Agregar Primer Gasto
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  gastosFiltrados.map((g) => (
                    <tr key={g.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition">
                      <td className="px-6 py-3 text-slate-300 text-sm">{formatearFecha(g.fecha)}</td>
                      <td className="px-6 py-3 text-white">{g.descripcion}</td>
                      <td className="px-6 py-3 text-slate-400 text-sm">{g.categoria}</td>
                      <td className="px-6 py-3 text-right font-medium text-red-400 tabular-nums">{fm(g.monto)}</td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => abrirModal(g)}
                            className="p-2 rounded-lg text-slate-400 hover:bg-slate-600 hover:text-white transition"
                            title="Editar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => eliminarGasto(g.id)}
                            className="p-2 rounded-lg text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition"
                            title="Eliminar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Agregar/Editar Gasto */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={cerrarModal}>
          <div
            className="bg-slate-800 rounded-2xl border border-slate-700 shadow-elevated-lg w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">
                {editingId ? 'Editar gasto' : 'Agregar gasto'}
              </h2>
            </div>
            <form onSubmit={guardarGasto} className="p-6 space-y-4">
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Fecha</label>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Descripción</label>
                <input
                  type="text"
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Ej. Pago de luz"
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Categoría</label>
                <select
                  value={form.categoria}
                  onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {CATEGORIAS_GASTOS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Monto</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.monto}
                  onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))}
                  placeholder="0.00"
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="flex-1 py-2.5 rounded-xl bg-slate-700 text-slate-300 font-medium hover:bg-slate-600 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition"
                >
                  {editingId ? 'Guardar' : 'Agregar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
