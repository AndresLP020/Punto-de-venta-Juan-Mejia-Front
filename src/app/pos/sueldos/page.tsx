'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  getEmpleados,
  getVentas,
  getProductos,
  getNominas,
  getGastosAdmin,
  getAdelantos,
  postEmpleado,
  putEmpleado,
  deleteEmpleado,
  postNomina,
  postAdelanto,
  type Empleado,
  type Producto,
  type Adelanto,
} from '@/lib/api';
import { formatearMoneda } from '@/lib/utils';

type Venta = {
  id: number;
  fecha: string;
  total: number;
  pagado?: number;
  items: { id: number; nombre: string; precio: number; cantidad: number; costo?: number }[];
};

function getInicioSemana(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Lunes de la semana (YYYY-MM-DD) para identificar la semana de pago */
function getLunesSemana(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const lunes = new Date(d);
  lunes.setDate(diff);
  lunes.setHours(0, 0, 0, 0);
  return lunes.toISOString().slice(0, 10);
}

export default function SueldosPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [nominas, setNominas] = useState<{ id: number; fecha: string; total: number; items: { empleadoId: number; monto: number; semana?: string; adelantoDescontado?: number }[] }[]>([]);
  const [gastosAdmin, setGastosAdmin] = useState<{ fecha: string; monto: number }[]>([]);
  const [adelantos, setAdelantos] = useState<Adelanto[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalTrabajador, setModalTrabajador] = useState(false);
  const [modalNomina, setModalNomina] = useState(false);
  const [modalAdelanto, setModalAdelanto] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ nombre: '', sueldo: '', puesto: '' });
  const [formAdelanto, setFormAdelanto] = useState({ empleadoId: '', montoTotal: '', semanas: '2' });
  const [seleccionados, setSeleccionados] = useState<number[]>([]);
  /** Días trabajados por empleado en el modal nómina (default 7) */
  const [diasPorEmpleado, setDiasPorEmpleado] = useState<Record<number, number>>({});
  /** Calendario: mes mostrado (0 = enero) */
  const [calendarioMes, setCalendarioMes] = useState(() => ({ año: new Date().getFullYear(), mes: new Date().getMonth() }));
  /** Fecha seleccionada en calendario para ver detalle (YYYY-MM-DD) */
  const [fechaDetalle, setFechaDetalle] = useState<string | null>(null);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [e, v, p, n, g, a] = await Promise.all([
        getEmpleados(),
        getVentas(),
        getProductos(),
        getNominas(),
        getGastosAdmin(),
        getAdelantos(),
      ]);
      setEmpleados(e);
      setVentas(v);
      setProductos(p);
      setNominas(n);
      setGastosAdmin(g);
      setAdelantos(a);
    } catch {
      setEmpleados([]);
      setVentas([]);
      setProductos([]);
      setNominas([]);
      setGastosAdmin([]);
      setAdelantos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const inicioSemana = getInicioSemana();
  const ahora = new Date();

  const ventasSemanales = ventas.filter((v) => {
    const d = new Date(v.fecha);
    return d >= inicioSemana && d <= ahora;
  });
  const ingresosSemanales = ventasSemanales.reduce(
    (s, v) => s + (v.pagado ?? v.total ?? 0),
    0
  );

  const costosSemanales = ventasSemanales.reduce((sum, venta) => {
    const porcentaje = venta.total > 0 ? (venta.pagado ?? venta.total) / venta.total : 1;
    return (
      sum +
      (venta.items || []).reduce((itemSum, item) => {
        const costoUnit = item.costo != null ? item.costo : (productos.find((p) => p.id === item.id)?.costo ?? 0);
        return itemSum + (costoUnit * item.cantidad * porcentaje);
      }, 0)
    );
  }, 0);

  const nominasSemanales = nominas.filter((n) => {
    const d = new Date(n.fecha);
    return d >= inicioSemana && d <= ahora;
  });
  const totalNominasPagadasSemana = nominasSemanales.reduce((s, n) => s + n.total, 0);

  const gastosAdminSemanales = gastosAdmin.filter((g) => {
    const d = new Date(g.fecha);
    return d >= inicioSemana && d <= ahora;
  });
  const totalGastosAdminSemana = gastosAdminSemanales.reduce((s, g) => s + g.monto, 0);

  const totalSueldos = empleados.reduce((s, e) => s + e.sueldo, 0);
  const semanaActual = getLunesSemana();
  const empleadosPagadosEstaSemana = new Set(
    nominas.flatMap((n) => (n.items || []).filter((i) => i.semana === semanaActual).map((i) => i.empleadoId))
  );
  const empleadosPendientesDePago = empleados.filter((e) => !empleadosPagadosEstaSemana.has(e.id));
  const adelantosActivos = adelantos.filter((a) => a.estado === 'activo');
  const adelantoPendientePorEmpleado = adelantosActivos.reduce<Record<number, number>>((acc, a) => {
    acc[a.empleadoId] = (acc[a.empleadoId] ?? 0) + a.saldoPendiente;
    return acc;
  }, {});
  const descuentoPorSemanaPorEmpleado = adelantosActivos.reduce<Record<number, number>>((acc, a) => {
    const semanaAdelanto = a.fecha ? getLunesSemana(new Date(a.fecha)) : null;
    if (semanaAdelanto == null || semanaActual <= semanaAdelanto) return acc;
    acc[a.empleadoId] = (acc[a.empleadoId] ?? 0) + a.montoPorSemana;
    return acc;
  }, {});

  /** Eventos por fecha (YYYY-MM-DD) para el calendario */
  const eventosPorFecha = (() => {
    const map: Record<string, { nominas: typeof nominas; adelantos: Adelanto[] }> = {};
    nominas.forEach((n) => {
      const key = n.fecha ? n.fecha.slice(0, 10) : '';
      if (!key) return;
      if (!map[key]) map[key] = { nominas: [], adelantos: [] };
      map[key].nominas.push(n);
    });
    adelantos.forEach((a) => {
      const key = a.fecha ? a.fecha.slice(0, 10) : '';
      if (!key) return;
      if (!map[key]) map[key] = { nominas: [], adelantos: [] };
      map[key].adelantos.push(a);
    });
    return map;
  })();

  // Misma fórmula que Gastos Admin y Reportes: Ingresos − Costo ventas − Gastos Admin − Nóminas
  const gananciaNetaSemanal = ingresosSemanales - costosSemanales - totalGastosAdminSemana - totalNominasPagadasSemana;
  const efectivoDisponible = gananciaNetaSemanal;
  const efectivoBajo = efectivoDisponible < 0 || (ingresosSemanales === 0 && (empleados.length > 0 || gastosAdmin.length > 0));

  const abrirModalTrabajador = (emp?: Empleado) => {
    if (emp) {
      setEditingId(emp.id);
      setForm({ nombre: emp.nombre, sueldo: String(emp.sueldo), puesto: emp.puesto || '' });
    } else {
      setEditingId(null);
      setForm({ nombre: '', sueldo: '', puesto: '' });
    }
    setModalTrabajador(true);
  };

  const cerrarModalTrabajador = () => {
    setModalTrabajador(false);
    setEditingId(null);
  };

  const guardarTrabajador = async (e: React.FormEvent) => {
    e.preventDefault();
    const sueldo = parseFloat(form.sueldo);
    if (Number.isNaN(sueldo) || form.nombre.trim() === '') return;
    try {
      if (editingId) {
        await putEmpleado(editingId, {
          nombre: form.nombre.trim(),
          sueldo,
          puesto: form.puesto.trim() || undefined,
        });
      } else {
        await postEmpleado({
          nombre: form.nombre.trim(),
          sueldo,
          puesto: form.puesto.trim() || undefined,
        });
      }
      await cargarDatos();
      cerrarModalTrabajador();
    } catch (err) {
      console.error(err);
    }
  };

  const eliminarTrabajador = async (id: number) => {
    if (!confirm('¿Eliminar este trabajador?')) return;
    try {
      await deleteEmpleado(id);
      await cargarDatos();
      setSeleccionados((prev) => prev.filter((x) => x !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const abrirModalNomina = () => {
    setSeleccionados(empleados.map((e) => e.id));
    setDiasPorEmpleado(empleados.reduce<Record<number, number>>((acc, e) => ({ ...acc, [e.id]: 7 }), {}));
    setSeleccionados((prev) => prev.filter((id) => !empleadosPagadosEstaSemana.has(id)));
    setModalNomina(true);
  };

  const toggleSeleccion = (id: number) => {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const empleadosSeleccionados = empleados.filter((e) => seleccionados.includes(e.id));
  const empleadosSeleccionadosPendientes = empleadosSeleccionados.filter((e) => !empleadosPagadosEstaSemana.has(e.id));
  const totalNominaBruto = empleadosSeleccionadosPendientes.reduce((s, e) => {
    const dias = diasPorEmpleado[e.id] ?? 7;
    return s + Math.round((e.sueldo * dias) / 7 * 100) / 100;
  }, 0);
  const totalDescuentoAdelanto = empleadosSeleccionadosPendientes.reduce((s, e) => s + (descuentoPorSemanaPorEmpleado[e.id] ?? 0), 0);
  const totalNominaSeleccionada = totalNominaBruto - totalDescuentoAdelanto;

  const setDiasTrabajados = (empleadoId: number, dias: number) => {
    const n = Math.min(7, Math.max(1, Math.round(dias) || 1));
    setDiasPorEmpleado((prev) => ({ ...prev, [empleadoId]: n }));
  };

  const guardarAdelanto = async (e: React.FormEvent) => {
    e.preventDefault();
    const empleadoId = Number(formAdelanto.empleadoId);
    const montoTotal = parseFloat(formAdelanto.montoTotal);
    const semanas = Math.max(1, Math.min(52, parseInt(formAdelanto.semanas, 10) || 2));
    if (!empleadoId || Number.isNaN(montoTotal) || montoTotal <= 0) return;
    try {
      await postAdelanto({ empleadoId, montoTotal, semanas });
      await cargarDatos();
      setModalAdelanto(false);
      setFormAdelanto({ empleadoId: '', montoTotal: '', semanas: '2' });
    } catch (err) {
      console.error(err);
      alert('Error al registrar adelanto');
    }
  };

  const procesarNomina = async () => {
    if (empleadosSeleccionadosPendientes.length === 0) return;
    try {
      const items = empleadosSeleccionadosPendientes.map((e) => {
        const dias = diasPorEmpleado[e.id] ?? 7;
        const monto = Math.round((e.sueldo * dias) / 7 * 100) / 100;
        return {
          empleadoId: e.id,
          nombre: e.nombre,
          monto,
          diasTrabajados: dias,
          semana: semanaActual,
        };
      });
      await postNomina({
        items,
        total: totalNominaBruto,
      });
      await cargarDatos();
      setModalNomina(false);
      setSeleccionados([]);
    } catch (err) {
      console.error(err);
    }
  };

  const fm = (n: number) => `$${formatearMoneda(n)}`;

  if (loading && empleados.length === 0 && nominas.length === 0) {
    return (
      <div className="flex flex-col h-full text-white">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-slate-400 mt-4 text-sm font-medium">Cargando…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full text-white">
      {/* Debug bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 bg-slate-800/60 border-b border-slate-700/80">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-slate-400 text-sm font-medium">
            Empleados: {empleados.length} | Ingresos: {fm(ingresosSemanales)} · Costo ventas: {fm(costosSemanales)} · Gastos Admin: {fm(totalGastosAdminSemana)} · Nóminas: {fm(totalNominasPagadasSemana)} · Ganancia neta: {fm(gananciaNetaSemanal)}
          </span>
          {empleados.length === 0 && (
            <span className="flex items-center gap-1.5 text-amber-400 text-sm">
              <span className="text-amber-500">▲</span> No hay empleados registrados
            </span>
          )}
          {ventas.length === 0 && (
            <span className="flex items-center gap-1.5 text-amber-400 text-sm">
              <span className="text-amber-500">▲</span> No hay ingresos cargados
            </span>
          )}
        </div>
        <span className="text-slate-400 text-sm font-medium">Efectivo: {fm(efectivoDisponible)}</span>
      </div>

      {/* Header */}
      <header className="px-6 py-4 border-b border-slate-700/80">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-600/80 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Sueldos y Trabajadores</h1>
            <p className="text-slate-400 text-sm mt-0.5">Nómina semanal y control de empleados</p>
          </div>
        </div>
      </header>

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
          <div className="rounded-2xl bg-slate-800/80 border border-emerald-500/30 p-5 shadow-elevated">
            <p className="text-slate-400 text-sm font-medium">Ingresos Semanales</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">{fm(ingresosSemanales)}</p>
          </div>
          <div className="rounded-2xl bg-slate-800/80 border border-slate-600/80 p-5 shadow-elevated">
            <p className="text-slate-400 text-sm font-medium">Total Sueldos</p>
            <p className="text-2xl font-bold text-white mt-1 tabular-nums">{formatearMoneda(totalSueldos)}</p>
          </div>
          <div className="rounded-2xl bg-slate-800/80 border border-emerald-500/30 p-5 shadow-elevated">
            <p className="text-slate-400 text-sm font-medium">Ganancia Neta Semanal</p>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${gananciaNetaSemanal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fm(gananciaNetaSemanal)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Ingresos − Costo ventas − Gastos Admin − Nóminas</p>
          </div>
          <div className="rounded-2xl bg-slate-800/80 border border-violet-500/30 p-5 shadow-elevated">
            <p className="text-slate-400 text-sm font-medium">Efectivo Disponible</p>
            <p className="text-2xl font-bold text-violet-400 mt-1 tabular-nums">{fm(efectivoDisponible)}</p>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            onClick={() => abrirModalTrabajador()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium shadow-lg transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Agregar Trabajador
          </button>
          <button
            onClick={abrirModalNomina}
            disabled={empleados.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-600 hover:bg-slate-500 text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Procesar Nómina ({formatearMoneda(totalSueldos)})
          </button>
          <button
            onClick={() => { setFormAdelanto({ empleadoId: empleados[0]?.id ? String(empleados[0].id) : '', montoTotal: '', semanas: '2' }); setModalAdelanto(true); }}
            disabled={empleados.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Adelanto de sueldo
          </button>
        </div>

        {/* Adelantos activos */}
        {adelantosActivos.length > 0 && (
          <div className="rounded-2xl bg-slate-800/80 border border-amber-500/30 p-5 mb-6">
            <h3 className="text-slate-300 font-semibold mb-3">Adelantos pendientes de descontar</h3>
            <div className="flex flex-wrap gap-3">
              {adelantosActivos.map((ad) => (
                <div key={ad.id} className="px-4 py-2 rounded-xl bg-slate-700/80 border border-slate-600 text-sm">
                  <span className="text-white font-medium">{ad.nombre}</span>
                  <span className="text-slate-400 mx-2">·</span>
                  <span className="text-amber-400">Debe {fm(ad.saldoPendiente)}</span>
                  <span className="text-slate-500 ml-1">({fm(ad.montoPorSemana)}/semana en {ad.semanas} semanas)</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Calendario de pagos */}
        <div className="rounded-2xl bg-slate-800/80 border border-slate-700/80 p-5 mb-6">
          <h3 className="text-slate-300 font-semibold mb-4">Calendario de pagos</h3>
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setCalendarioMes((m) => (m.mes === 0 ? { año: m.año - 1, mes: 11 } : { ...m, mes: m.mes - 1 }))}
              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300"
            >
              ‹
            </button>
            <span className="text-white font-medium">
              {new Date(calendarioMes.año, calendarioMes.mes).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
            </span>
            <button
              type="button"
              onClick={() => setCalendarioMes((m) => (m.mes === 11 ? { año: m.año + 1, mes: 0 } : { ...m, mes: m.mes + 1 }))}
              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d) => (
              <div key={d} className="text-slate-500 font-medium py-1">{d}</div>
            ))}
            {(() => {
              const first = new Date(calendarioMes.año, calendarioMes.mes, 1);
              const last = new Date(calendarioMes.año, calendarioMes.mes + 1, 0);
              const startPad = first.getDay();
              const daysInMonth = last.getDate();
              const cells: { date: Date; key: string; isCurrentMonth: boolean }[] = [];
              for (let i = 0; i < startPad; i++) {
                const d = new Date(calendarioMes.año, calendarioMes.mes, -startPad + i + 1);
                cells.push({ date: d, key: d.toISOString().slice(0, 10), isCurrentMonth: false });
              }
              for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(calendarioMes.año, calendarioMes.mes, d);
                cells.push({ date, key: date.toISOString().slice(0, 10), isCurrentMonth: true });
              }
              const rest = 42 - cells.length;
              for (let i = 0; i < rest; i++) {
                const date = new Date(calendarioMes.año, calendarioMes.mes + 1, i + 1);
                cells.push({ date, key: date.toISOString().slice(0, 10), isCurrentMonth: false });
              }
              return cells.map(({ date, key, isCurrentMonth }) => {
                const eventos = eventosPorFecha[key];
                const hasEventos = eventos && (eventos.nominas.length > 0 || eventos.adelantos.length > 0);
                const isHoy = key === new Date().toISOString().slice(0, 10);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFechaDetalle(key)}
                    className={`min-h-[44px] rounded-lg flex flex-col items-center justify-center gap-0.5 py-1 ${
                      !isCurrentMonth ? 'text-slate-600' : 'text-slate-200 hover:bg-slate-700'
                    } ${isHoy ? 'ring-2 ring-emerald-500' : ''}`}
                  >
                    <span>{date.getDate()}</span>
                    {hasEventos && (
                      <span className="flex gap-0.5">
                        {eventos.nominas.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Nómina" />}
                        {eventos.adelantos.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Adelanto" />}
                      </span>
                    )}
                  </button>
                );
              });
            })()}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Nómina</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Adelanto</span>
          </div>
        </div>

        {/* Modal detalle del día */}
        {fechaDetalle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setFechaDetalle(null)}>
            <div
              className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  Pagos del {new Date(fechaDetalle + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </h2>
                <button type="button" onClick={() => setFechaDetalle(null)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400">✕</button>
              </div>
              <div className="p-6 overflow-y-auto space-y-4">
                {(!eventosPorFecha[fechaDetalle] || (eventosPorFecha[fechaDetalle].nominas.length === 0 && eventosPorFecha[fechaDetalle].adelantos.length === 0)) ? (
                  <p className="text-slate-500 text-sm">No hay registros de pago este día.</p>
                ) : (
                  <>
                    {eventosPorFecha[fechaDetalle]?.nominas?.length > 0 && (
                      <div>
                        <h4 className="text-emerald-400 font-medium text-sm mb-2">Nóminas</h4>
                        <ul className="space-y-2">
                          {eventosPorFecha[fechaDetalle].nominas.map((n) => (
                            <li key={n.id} className="rounded-xl bg-slate-700/80 p-3 text-sm">
                              <p className="text-slate-400 text-xs">Total pagado: {fm(n.total)}</p>
                              <ul className="mt-2 space-y-1">
                                {(n.items || []).map((it: { nombre?: string; monto: number; adelantoDescontado?: number; empleadoId?: number }, idx: number) => (
                                  <li key={`${n.id}-${it.empleadoId ?? idx}`} className="flex justify-between text-slate-300">
                                    <span>{it.nombre}</span>
                                    <span>{fm((it.monto || 0) - (it.adelantoDescontado || 0))} neto{it.adelantoDescontado ? ` (descuento ${fm(it.adelantoDescontado)})` : ''}</span>
                                  </li>
                                ))}
                              </ul>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {eventosPorFecha[fechaDetalle]?.adelantos?.length > 0 && (
                      <div>
                        <h4 className="text-amber-400 font-medium text-sm mb-2">Adelantos entregados</h4>
                        <ul className="space-y-2">
                          {eventosPorFecha[fechaDetalle].adelantos.map((a) => (
                            <li key={a.id} className="rounded-xl bg-slate-700/80 p-3 text-sm flex justify-between items-center">
                              <span className="text-white">{a.nombre}</span>
                              <span className="text-amber-400 font-medium">{fm(a.montoTotal)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Lista de trabajadores */}
        <div className="rounded-2xl bg-slate-800/80 border border-slate-700/80 overflow-hidden shadow-elevated">
          {empleados.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-slate-400 font-medium">No hay trabajadores registrados.</p>
              <p className="text-slate-500 text-sm mt-1">Agrega trabajadores con el botón superior para calcular nómina.</p>
              <button
                onClick={() => abrirModalTrabajador()}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium"
              >
                + Agregar Trabajador
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800">
                    <th className="text-left text-slate-400 font-semibold text-sm px-6 py-4">Nombre</th>
                    <th className="text-left text-slate-400 font-semibold text-sm px-6 py-4">Puesto</th>
                    <th className="text-right text-slate-400 font-semibold text-sm px-6 py-4">Sueldo semanal</th>
                    <th className="text-right text-slate-400 font-semibold text-sm px-6 py-4">Adelanto pendiente</th>
                    <th className="text-center text-slate-400 font-semibold text-sm px-6 py-4">Pagado esta semana</th>
                    <th className="text-right text-slate-400 font-semibold text-sm px-6 py-4 w-28">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {empleados.map((emp) => (
                    <tr key={emp.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                      <td className="px-6 py-3 text-white font-medium">{emp.nombre}</td>
                      <td className="px-6 py-3 text-slate-400 text-sm">{emp.puesto || '—'}</td>
                      <td className="px-6 py-3 text-right font-medium text-emerald-400 tabular-nums">{fm(emp.sueldo)}</td>
                      <td className="px-6 py-3 text-right text-sm">
                        {adelantoPendientePorEmpleado[emp.id] != null && adelantoPendientePorEmpleado[emp.id] > 0 ? (
                          <span className="text-amber-400 tabular-nums">{fm(adelantoPendientePorEmpleado[emp.id])}</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-center">
                        {empleadosPagadosEstaSemana.has(emp.id) ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                            Sí
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/40">
                            No
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => abrirModalTrabajador(emp)}
                            className="p-2 rounded-lg text-slate-400 hover:bg-slate-600 hover:text-white transition"
                            title="Editar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => eliminarTrabajador(emp.id)}
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Agregar/Editar Trabajador */}
      {modalTrabajador && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={cerrarModalTrabajador}>
          <div
            className="bg-slate-800 rounded-2xl border border-slate-700 shadow-elevated-lg w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">
                {editingId ? 'Editar trabajador' : 'Agregar trabajador'}
              </h2>
            </div>
            <form onSubmit={guardarTrabajador} className="p-6 space-y-4">
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Nombre</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Nombre completo"
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Sueldo semanal</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.sueldo}
                  onChange={(e) => setForm((f) => ({ ...f, sueldo: e.target.value }))}
                  placeholder="0.00"
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Puesto (opcional)</label>
                <input
                  type="text"
                  value={form.puesto}
                  onChange={(e) => setForm((f) => ({ ...f, puesto: e.target.value }))}
                  placeholder="Ej. Cajero, Repartidor"
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={cerrarModalTrabajador}
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

      {/* Modal Procesar Nómina */}
      {modalNomina && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setModalNomina(false)}>
          <div
            className="bg-slate-800 rounded-2xl border border-slate-700 shadow-elevated-lg w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Procesar Nómina</h2>
              <p className="text-slate-400 text-sm mt-0.5">Selecciona trabajadores e indica días trabajados (1-7). El pago es proporcional: sueldo × días ÷ 7. Se registra como pago de la semana en curso.</p>
            </div>
            <div className="p-6 max-h-96 overflow-y-auto space-y-2">
              {empleadosPendientesDePago.length === 0 ? (
                <p className="text-slate-400 text-center py-6">Todos los empleados ya fueron pagados esta semana.</p>
              ) : (
                empleadosPendientesDePago.map((emp) => {
                const dias = diasPorEmpleado[emp.id] ?? 7;
                const montoBruto = Math.round((emp.sueldo * dias) / 7 * 100) / 100;
                const descuento = descuentoPorSemanaPorEmpleado[emp.id] ?? 0;
                const montoNeto = Math.max(0, montoBruto - descuento);
                return (
                  <div
                    key={emp.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-700/50 border border-slate-600/50 hover:bg-slate-700/80"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={seleccionados.includes(emp.id)}
                        onChange={() => toggleSeleccion(emp.id)}
                        className="rounded border-slate-500 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className="text-white font-medium">{emp.nombre}</span>
                      {emp.puesto && <span className="text-slate-500 text-sm">({emp.puesto})</span>}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="flex items-center gap-2 text-slate-400 text-sm">
                        Días:
                        <input
                          type="number"
                          min={1}
                          max={7}
                          value={dias}
                          onChange={(e) => setDiasTrabajados(emp.id, Number(e.target.value))}
                          className="w-14 rounded-lg bg-slate-700 border border-slate-600 px-2 py-1.5 text-white text-center text-sm focus:ring-2 focus:ring-emerald-500"
                        />
                      </label>
                      {descuento > 0 && (
                        <span className="text-amber-400 text-sm tabular-nums">-{fm(descuento)} adelanto</span>
                      )}
                      <span className="text-emerald-400 font-semibold tabular-nums w-24 text-right">{fm(montoNeto)} neto</span>
                    </div>
                  </div>
                );
              })
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-700 space-y-1">
              {totalDescuentoAdelanto > 0 && (
                <div className="flex items-center justify-between text-sm text-amber-400">
                  <span>Descuento por adelantos:</span>
                  <span className="tabular-nums">-{fm(totalDescuentoAdelanto)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Total a pagar (neto):</span>
                <span className="text-xl font-bold text-white tabular-nums">{fm(totalNominaSeleccionada)}</span>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                type="button"
                onClick={() => setModalNomina(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-700 text-slate-300 font-medium hover:bg-slate-600 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={procesarNomina}
                disabled={empleadosSeleccionadosPendientes.length === 0}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition disabled:opacity-50"
              >
                Procesar nómina
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adelanto de sueldo */}
      {modalAdelanto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setModalAdelanto(false)}>
          <div
            className="bg-slate-800 rounded-2xl border border-slate-700 shadow-elevated-lg w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Adelanto de sueldo</h2>
              <p className="text-slate-400 text-sm mt-0.5">Le das sueldo + adelanto hoy. Los adelantos se descontarán de sus siguientes pagos en las semanas que elijas.</p>
            </div>
            <form onSubmit={guardarAdelanto} className="p-6 space-y-4">
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Trabajador</label>
                <select
                  value={formAdelanto.empleadoId}
                  onChange={(e) => setFormAdelanto((f) => ({ ...f, empleadoId: e.target.value }))}
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white focus:ring-2 focus:ring-amber-500 outline-none"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {empleados.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.nombre}{emp.puesto ? ` (${emp.puesto})` : ''} — Sueldo {fm(emp.sueldo)}/sem</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Monto del adelanto a dar hoy</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formAdelanto.montoTotal}
                  onChange={(e) => setFormAdelanto((f) => ({ ...f, montoTotal: e.target.value }))}
                  placeholder="Ej. 1500"
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 outline-none"
                  required
                />
                <p className="text-slate-500 text-xs mt-1">Este monto se descontará de sus próximas nóminas (no del sueldo de hoy).</p>
              </div>
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">¿En cuántas semanas descontar el adelanto?</label>
                <input
                  type="number"
                  min={1}
                  value={formAdelanto.semanas}
                  onChange={(e) => setFormAdelanto((f) => ({ ...f, semanas: e.target.value }))}
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white focus:ring-2 focus:ring-amber-500 outline-none"
                />
                <p className="text-slate-500 text-xs mt-1">Más semanas = menor descuento por semana (menos pesado para el trabajador).</p>
              </div>
              {formAdelanto.empleadoId && formAdelanto.montoTotal && Number(formAdelanto.montoTotal) > 0 && formAdelanto.semanas && Number(formAdelanto.semanas) >= 1 && (() => {
                const emp = empleados.find((e) => e.id === Number(formAdelanto.empleadoId));
                const sueldo = emp?.sueldo ?? 0;
                const adelanto = Number(formAdelanto.montoTotal);
                const semanas = Math.max(1, Math.round(Number(formAdelanto.semanas)));
                const totalEntregar = sueldo + adelanto;
                const porSemana = Math.round((adelanto / semanas) * 100) / 100;
                return (
                  <div className="rounded-xl bg-slate-700/80 border border-amber-500/30 p-4 space-y-2">
                    <p className="text-slate-300 text-sm font-medium">Resumen (queda guardado en el sistema):</p>
                    <p className="text-white"><span className="text-slate-400">Sueldo semanal:</span> {fm(sueldo)}</p>
                    <p className="text-white"><span className="text-slate-400">Adelanto que le das hoy:</span> {fm(adelanto)}</p>
                    <p className="text-emerald-400 font-bold text-lg">Total a entregar hoy: {fm(totalEntregar)}</p>
                    <p className="text-amber-400 text-sm">Se descontará {fm(porSemana)} por semana durante {semanas} semana{semanas !== 1 ? 's' : ''} de sus siguientes pagos.</p>
                  </div>
                );
              })()}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalAdelanto(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-700 text-slate-300 font-medium hover:bg-slate-600 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-medium hover:bg-amber-600 transition"
                >
                  Registrar adelanto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
