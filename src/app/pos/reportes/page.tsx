'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { getVentas, getProductos, getGastosAdmin, getNominas, getMovimientosLienzo, type Producto } from '@/lib/api';
import { formatearMoneda } from '@/lib/utils';

type Venta = {
  id: number;
  fecha: string;
  total: number;
  pagado?: number;
  items: { id: number; nombre: string; precio: number; cantidad: number; costo?: number }[];
};

type FiltroPeriodo = 'hoy' | 'semana' | 'mes' | 'año' | 'personalizado';

function formatearFechaCorta(f: string) {
  return new Date(f).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ReportesPage() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [gastosAdmin, setGastosAdmin] = useState<{ fecha: string; monto: number }[]>([]);
  const [nominas, setNominas] = useState<{ fecha: string; total: number }[]>([]);
  const [movimientosLienzo, setMovimientosLienzo] = useState<{ fecha: string; tipo: string; monto: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo>('año');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [exportando, setExportando] = useState(false);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [v, p, g, n, lienzo] = await Promise.all([
        getVentas(),
        getProductos(),
        getGastosAdmin(),
        getNominas(),
        getMovimientosLienzo().catch(() => []),
      ]);
      setVentas(v);
      setProductos(p);
      setGastosAdmin(g);
      setNominas(n);
      setMovimientosLienzo(lienzo);
    } catch {
      setVentas([]);
      setProductos([]);
      setGastosAdmin([]);
      setNominas([]);
      setMovimientosLienzo([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const obtenerRangoFechas = (): { inicio: Date; fin: Date } => {
    const ahora = new Date();
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    
    switch (filtroPeriodo) {
      case 'hoy':
        return { inicio: hoy, fin: new Date(hoy.getTime() + 24 * 60 * 60 * 1000 - 1) };
      case 'semana':
        const semanaPasada = new Date(hoy);
        semanaPasada.setDate(semanaPasada.getDate() - 7);
        return { inicio: semanaPasada, fin: new Date(hoy.getTime() + 24 * 60 * 60 * 1000 - 1) };
      case 'mes':
        const mesPasado = new Date(hoy);
        mesPasado.setMonth(mesPasado.getMonth() - 1);
        return { inicio: mesPasado, fin: new Date(hoy.getTime() + 24 * 60 * 60 * 1000 - 1) };
      case 'año':
        const añoPasado = new Date(hoy);
        añoPasado.setFullYear(añoPasado.getFullYear() - 1);
        return { inicio: añoPasado, fin: new Date(hoy.getTime() + 24 * 60 * 60 * 1000 - 1) };
      case 'personalizado':
        const inicio = fechaInicio ? new Date(fechaInicio) : new Date(0);
        const fin = fechaFin ? new Date(fechaFin + 'T23:59:59') : new Date();
        return { inicio, fin };
      default:
        return { inicio: new Date(0), fin: new Date() };
    }
  };

  const { inicio: inicioPeriodo, fin: finPeriodo } = obtenerRangoFechas();

  const ventasFiltradas = ventas.filter((v) => {
    const fechaVenta = new Date(v.fecha);
    return fechaVenta >= inicioPeriodo && fechaVenta <= finPeriodo;
  });

  const gastosAdminPeriodo = gastosAdmin.filter((g) => {
    const d = new Date(g.fecha);
    return d >= inicioPeriodo && d <= finPeriodo;
  });
  const totalGastosAdminPeriodo = gastosAdminPeriodo.reduce((s, g) => s + g.monto, 0);

  const nominasPeriodo = nominas.filter((n) => {
    const d = new Date(n.fecha);
    return d >= inicioPeriodo && d <= finPeriodo;
  });
  const totalNominasPeriodo = nominasPeriodo.reduce((s, n) => s + n.total, 0);

  // Calcular métricas principales (misma fórmula que Gastos Admin y Sueldos)
  const calcularMetricas = () => {
    // Total de ventas (todas las transacciones del período)
    const totalVentas = ventasFiltradas.length;

    // Ingresos totales = ventas pagadas + ingresos Lienzo Charro del período
    const ventasConPago = ventasFiltradas.filter((v) => (v.pagado || v.total || 0) > 0);
    const ingresosVentas = ventasConPago.reduce((sum, v) => sum + (v.pagado || v.total || 0), 0);
    const ingresosLienzoPeriodo = movimientosLienzo
      .filter((m) => m.tipo === 'ingreso')
      .filter((m) => {
        const d = new Date(m.fecha);
        return d >= inicioPeriodo && d <= finPeriodo;
      })
      .reduce((s, m) => s + m.monto, 0);
    const ingresosTotales = ingresosVentas + ingresosLienzoPeriodo;
    
    // Costo de productos vendidos: usar costo guardado en ítem (al registrar venta) o costo actual del producto
    const costoProductos = ventasConPago.reduce((sum, venta) => {
      const porcentajePagado = venta.total > 0 ? (venta.pagado || venta.total) / venta.total : 1;
      return sum + venta.items.reduce((itemSum, item) => {
        const costoUnitario = item.costo != null ? item.costo : (productos.find((p) => p.id === item.id)?.costo ?? 0);
        return itemSum + (costoUnitario * item.cantidad * porcentajePagado);
      }, 0);
    }, 0);

    const gananciaBruta = ingresosTotales - costoProductos;
    // Ingresos − Costo ventas − Gastos Admin − Nóminas (igual que en Gastos Admin y Sueldos)
    const gananciaNeta = gananciaBruta - totalGastosAdminPeriodo - totalNominasPeriodo;
    const ventaPromedio = ventasConPago.length > 0 ? ingresosTotales / ventasConPago.length : 0;

    // Calcular productos vendidos (solo de ventas con pago)
    const productosVendidos = ventasConPago.reduce((sum, v) => {
      return sum + v.items.reduce((itemSum, item) => itemSum + item.cantidad, 0);
    }, 0);

    // Calcular margen de ganancia
    const margenGanancia = ingresosTotales > 0 ? (gananciaBruta / ingresosTotales) * 100 : 0;

    // Costo promedio por unidad vendida
    const costoPromedio = productosVendidos > 0 ? costoProductos / productosVendidos : 0;

    // Ganancia por venta
    const gananciaPorVenta = ventasConPago.length > 0 ? gananciaBruta / ventasConPago.length : 0;

    return {
      totalVentas,
      ingresosTotales,
      costoProductos,
      totalGastosAdminPeriodo,
      totalNominasPeriodo,
      gananciaBruta,
      gananciaNeta,
      ventaPromedio,
      productosVendidos,
      margenGanancia,
      costoPromedio,
      gananciaPorVenta,
    };
  };

  const metricas = calcularMetricas();

  const formatearRangoFechas = () => {
    const { inicio, fin } = obtenerRangoFechas();
    const formato = (fecha: Date) => {
      const dia = fecha.getDate().toString().padStart(2, '0');
      const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
      const año = fecha.getFullYear();
      return `${dia}/${mes}/${año}`;
    };
    return `${formato(inicio)} - ${formato(fin)}`;
  };

  const ventasConPago = ventasFiltradas.filter((v) => (v.pagado || v.total || 0) > 0);
  const ventasRecientesPeriodo = [...ventasFiltradas]
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice(0, 10);

  const productosMasVendidosPeriodo = (() => {
    const map = new Map<number, { nombre: string; cantidad: number; total: number }>();
    ventasConPago.forEach((v) => {
      (v.items || []).forEach((item) => {
        const prev = map.get(item.id);
        const cantidad = (prev?.cantidad ?? 0) + item.cantidad;
        const total = (prev?.total ?? 0) + item.precio * item.cantidad;
        map.set(item.id, {
          nombre: item.nombre,
          cantidad,
          total,
        });
      });
    });
    return Array.from(map.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10);
  })();

  const exportarReporte = () => {
    setExportando(true);
    const { inicio, fin } = obtenerRangoFechas();
    const encabezado = [
      'Reporte de ventas - POS Juan Mejía',
      `Período: ${formatearRangoFechas()}`,
      `Generado: ${new Date().toLocaleString('es-MX')}`,
      '',
      'RESUMEN',
      `Total ventas (transacciones),${metricas.totalVentas}`,
      `Ingresos totales,$${formatearMoneda(metricas.ingresosTotales)}`,
      `Costo de productos,$${formatearMoneda(metricas.costoProductos)}`,
      `Gastos administrativos (período),$${formatearMoneda(metricas.totalGastosAdminPeriodo)}`,
      `Nóminas pagadas (período),$${formatearMoneda(metricas.totalNominasPeriodo)}`,
      `Ganancia bruta,$${formatearMoneda(metricas.gananciaBruta)}`,
      `Ganancia neta,$${formatearMoneda(metricas.gananciaNeta)}`,
      `Venta promedio,$${formatearMoneda(metricas.ventaPromedio)}`,
      `Productos vendidos (unidades),${metricas.productosVendidos}`,
      `Margen ganancia (%),${formatearMoneda(metricas.margenGanancia)}`,
      '',
      'VENTAS DEL PERÍODO',
      'ID,Fecha,Total,Pagado',
      ...ventasRecientesPeriodo.map((v) =>
        `${v.id},${v.fecha},${v.total},${v.pagado ?? v.total}`
      ),
    ].join('\r\n');
    const blob = new Blob(['\ufeff' + encabezado], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-ventas-${inicio.toISOString().slice(0, 10)}-${fin.toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportando(false);
  };

  const hoy = new Date().toISOString().split('T')[0];
  const hayDatos = ventasFiltradas.length > 0;

  return (
    <div className="flex flex-col h-full text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-4 px-6 py-4 border-b border-slate-700/80 bg-slate-900/90 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Reportes</h1>
            <p className="text-slate-400 text-sm mt-0.5">Análisis financiero y ventas · Período: {formatearRangoFechas()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => cargarDatos()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-sm font-medium transition disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar
          </button>
          <button
            onClick={exportarReporte}
            disabled={exportando || !hayDatos}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium shadow-lg shadow-emerald-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exportando ? 'Exportando…' : 'Exportar reporte'}
          </button>
          <Link
            href="/pos/ventas"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-sm font-medium transition"
          >
            Ver historial
          </Link>
        </div>
      </header>

      {/* Filtros de período */}
      <div className="px-6 py-4 border-b border-slate-700/80 bg-slate-800/30">
        <div className="flex flex-wrap items-center gap-2">
          {(['hoy', 'semana', 'mes', 'año', 'personalizado'] as FiltroPeriodo[]).map((periodo) => (
            <button
              key={periodo}
              onClick={() => {
                setFiltroPeriodo(periodo);
                if (periodo !== 'personalizado') {
                  setFechaInicio('');
                  setFechaFin('');
                }
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                filtroPeriodo === periodo
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-700/80 text-slate-300 hover:bg-slate-600 hover:text-white border border-slate-600/50'
              }`}
            >
              {periodo === 'hoy' && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
              {periodo === 'semana' && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              )}
              {(periodo === 'mes' || periodo === 'año') && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              )}
              {periodo === 'personalizado' && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              )}
              {periodo === 'hoy' ? 'Hoy' : periodo === 'semana' ? 'Esta Semana' : periodo === 'mes' ? 'Este Mes' : periodo === 'año' ? 'Este Año' : 'Personalizado'}
            </button>
          ))}
        </div>

        {/* Rango personalizado */}
        {filtroPeriodo === 'personalizado' && (
          <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-slate-700/80">
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-sm font-medium">Desde</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                max={fechaFin || hoy}
                className="px-3 py-2 rounded-xl bg-slate-700/80 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-sm font-medium">Hasta</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                min={fechaInicio}
                max={hoy}
                className="px-3 py-2 rounded-xl bg-slate-700/80 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Métricas principales */}
      <div className="px-6 py-6 flex-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            <p className="text-slate-400 mt-4 text-sm font-medium">Cargando reportes…</p>
          </div>
        ) : !hayDatos ? (
          <div className="rounded-2xl bg-slate-800/60 border border-slate-700/80 p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-700/80 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-1">Sin ventas en este período</h2>
            <p className="text-slate-400 text-sm max-w-sm mx-auto mb-6">
              No hay transacciones entre {formatearRangoFechas()}. Cambia el período o realiza ventas para ver el reporte.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={() => setFiltroPeriodo('año')}
                className="px-4 py-2 rounded-xl bg-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-600 transition"
              >
                Ver todo el año
              </button>
              <Link href="/pos" className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition">
                Ir a ventas
              </Link>
            </div>
          </div>
        ) : (
        <>
        {/* Resumen ejecutivo */}
        <div className="rounded-2xl bg-gradient-to-r from-emerald-500/10 to-slate-800/80 border border-emerald-500/20 p-5 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-emerald-400/90 uppercase tracking-wider mb-1">Resumen ejecutivo</h2>
              <p className="text-slate-300 text-sm">
                <span className="text-white font-medium">{metricas.totalVentas}</span> transacciones ·
                Ingresos <span className="text-emerald-400 font-semibold">${formatearMoneda(metricas.ingresosTotales)}</span> ·
                Ganancia neta <span className={metricas.gananciaNeta >= 0 ? 'text-emerald-400' : 'text-red-400'}>{metricas.gananciaNeta >= 0 ? '' : '-'}${formatearMoneda(Math.abs(metricas.gananciaNeta))}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 text-slate-500 text-xs">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Reporte generado el {new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
          {/* Total Ventas */}
          <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700/80 shadow-elevated hover:border-slate-600/80 transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Transacciones</span>
            </div>
            <p className="text-3xl font-bold text-white tabular-nums">{metricas.totalVentas}</p>
            <p className="text-sm text-slate-400 mt-0.5">Total Ventas</p>
          </div>

          {/* Ingresos Totales */}
          <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700/80 shadow-elevated hover:border-slate-600/80 transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Ventas brutas</span>
            </div>
            <p className="text-3xl font-bold text-emerald-400 tabular-nums">${formatearMoneda(metricas.ingresosTotales)}</p>
            <p className="text-sm text-slate-400 mt-0.5">Ingresos Totales</p>
          </div>

          {/* Costo de Productos */}
          <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700/80 shadow-elevated hover:border-slate-600/80 transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Costos directos</span>
            </div>
            <p className="text-3xl font-bold text-red-400 tabular-nums">${formatearMoneda(metricas.costoProductos)}</p>
            <p className="text-sm text-slate-400 mt-0.5">Costo de Productos</p>
          </div>

          {/* Ganancia Bruta */}
          <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700/80 shadow-elevated hover:border-slate-600/80 transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Ingresos − Costos</span>
            </div>
            <p className="text-3xl font-bold text-white tabular-nums">${formatearMoneda(metricas.gananciaBruta)}</p>
            <p className="text-sm text-slate-400 mt-0.5">Ganancia Bruta</p>
          </div>

          {/* Ganancia Neta */}
          <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700/80 shadow-elevated hover:border-slate-600/80 transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Ingresos − Costo ventas − Gastos Admin − Nóminas</span>
            </div>
            <p className={`text-3xl font-bold tabular-nums ${metricas.gananciaNeta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ${formatearMoneda(metricas.gananciaNeta)}
            </p>
            <p className="text-sm text-slate-400 mt-0.5">Ganancia Neta (misma fórmula en todos los apartados)</p>
          </div>

          {/* Venta Promedio */}
          <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700/80 shadow-elevated hover:border-slate-600/80 transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Por transacción</span>
            </div>
            <p className="text-3xl font-bold text-white tabular-nums">${formatearMoneda(metricas.ventaPromedio)}</p>
            <p className="text-sm text-slate-400 mt-0.5">Venta Promedio</p>
          </div>
        </div>

        {/* Ventas del período + Productos más vendidos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="rounded-2xl bg-slate-800/80 border border-slate-700/80 overflow-hidden shadow-elevated">
            <div className="px-5 py-4 border-b border-slate-700/80 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Ventas del período</h2>
              <Link href="/pos/ventas" className="text-emerald-400 hover:text-emerald-300 text-sm font-medium">
                Ver todas →
              </Link>
            </div>
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              {ventasRecientesPeriodo.length === 0 ? (
                <p className="p-5 text-slate-500 text-sm">No hay ventas en este rango.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-700/80">
                      <th className="text-left py-3 px-4 font-medium">#</th>
                      <th className="text-left py-3 px-4 font-medium">Fecha</th>
                      <th className="text-right py-3 px-4 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventasRecientesPeriodo.map((v) => (
                      <tr key={v.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                        <td className="py-2.5 px-4 text-slate-300">{v.id}</td>
                        <td className="py-2.5 px-4 text-slate-400">{formatearFechaCorta(v.fecha)}</td>
                        <td className="py-2.5 px-4 text-right font-medium text-emerald-400 tabular-nums">${formatearMoneda(v.pagado ?? v.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          <div className="rounded-2xl bg-slate-800/80 border border-slate-700/80 overflow-hidden shadow-elevated">
            <div className="px-5 py-4 border-b border-slate-700/80">
              <h2 className="text-base font-semibold text-white">Productos más vendidos</h2>
              <p className="text-slate-400 text-xs mt-0.5">En el período seleccionado</p>
            </div>
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              {productosMasVendidosPeriodo.length === 0 ? (
                <p className="p-5 text-slate-500 text-sm">Sin datos de productos vendidos.</p>
              ) : (
                <ul className="divide-y divide-slate-700/50">
                  {productosMasVendidosPeriodo.map((p, i) => (
                    <li key={p.id} className="flex items-center justify-between py-3 px-4 hover:bg-slate-700/20">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
                          {i + 1}
                        </span>
                        <span className="text-white font-medium truncate max-w-[180px]">{p.nombre}</span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-slate-400 text-xs">{p.cantidad} ud.</p>
                        <p className="text-emerald-400 font-semibold tabular-nums text-sm">${formatearMoneda(p.total)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Resumen Financiero */}
        <div className="border-t border-slate-700/80 pt-6 mt-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h2 className="text-xl font-bold text-white">Resumen Financiero</h2>
            </div>
            <p className="text-sm text-slate-400">Período: {formatearRangoFechas()}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Productos vendidos */}
            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/80 shadow-elevated">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <p className="text-sm text-slate-400">Productos vendidos</p>
              </div>
              <p className="text-2xl font-bold text-white">{metricas.productosVendidos} unidades</p>
            </div>

            {/* Margen de ganancia */}
            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/80 shadow-elevated">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-400">Margen de ganancia</p>
              </div>
              <p className="text-2xl font-bold text-white">{formatearMoneda(metricas.margenGanancia)}%</p>
            </div>

            {/* Costo promedio */}
            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/80 shadow-elevated">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-400">Costo promedio</p>
              </div>
              <p className="text-2xl font-bold text-white">${formatearMoneda(metricas.costoPromedio)}</p>
            </div>

            {/* Ganancia por venta */}
            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/80 shadow-elevated">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-400">Ganancia por venta</p>
              </div>
              <p className="text-2xl font-bold text-white">${formatearMoneda(metricas.gananciaPorVenta)}</p>
            </div>
          </div>
        </div>

        <p className="mt-8 pt-6 border-t border-slate-700/80 text-center text-slate-500 text-xs">
          Reporte generado el {new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })} · POS Juan Mejía
        </p>
        </>
        )}
      </div>
    </div>
  );
}
