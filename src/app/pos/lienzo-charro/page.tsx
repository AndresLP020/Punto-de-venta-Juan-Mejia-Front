'use client';

import { useEffect, useState } from 'react';
import {
  getMovimientosLienzo,
  postMovimientoLienzo,
  deleteMovimientoLienzo,
  type MovimientoLienzo,
} from '@/lib/api';
import { formatearMoneda } from '@/lib/utils';

type Periodo = 'dia' | 'semana' | 'mes' | 'año';

function obtenerRangoPeriodo(periodo: Periodo): { inicio: Date; fin: Date } {
  const ahora = new Date();
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

  switch (periodo) {
    case 'dia':
      return { inicio: hoy, fin: new Date(hoy.getTime() + 24 * 60 * 60 * 1000 - 1) };
    case 'semana': {
      const haceSiete = new Date(hoy);
      haceSiete.setDate(haceSiete.getDate() - 7);
      return { inicio: haceSiete, fin: new Date(hoy.getTime() + 24 * 60 * 60 * 1000 - 1) };
    }
    case 'mes': {
      const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);
      return { inicio: inicioMes, fin: finMes };
    }
    case 'año': {
      const inicioAño = new Date(hoy.getFullYear(), 0, 1);
      const finAño = new Date(hoy.getFullYear(), 11, 31, 23, 59, 59);
      return { inicio: inicioAño, fin: finAño };
    }
    default:
      return { inicio: new Date(0), fin: new Date() };
  }
}

function formatearRango(inicio: Date, fin: Date): string {
  const f = (d: Date) =>
    d.getDate().toString().padStart(2, '0') +
    '/' +
    (d.getMonth() + 1).toString().padStart(2, '0') +
    '/' +
    d.getFullYear();
  return `${f(inicio)} - ${f(fin)}`;
}

/** Convierte Date a YYYY-MM-DD para comparar sin zona horaria */
function toYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function LienzoCharroPage() {
  const [movimientos, setMovimientos] = useState<MovimientoLienzo[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [tipoForm, setTipoForm] = useState<'ingreso' | 'gasto'>('ingreso');
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'ingreso' | 'gasto'>('todos');

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const data = await getMovimientosLienzo();
      setMovimientos(data);
    } catch {
      setMovimientos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    if (!fecha) {
      const hoy = new Date().toISOString().split('T')[0];
      setFecha(hoy);
    }
  }, [fecha]);

  const { inicio: inicioPeriodo, fin: finPeriodo } = obtenerRangoPeriodo(periodo);
  const inicioStr = toYYYYMMDD(inicioPeriodo);
  const finStr = toYYYYMMDD(finPeriodo);
  const movimientosEnPeriodo = movimientos.filter((m) => {
    const movFecha = (m.fecha || '').slice(0, 10);
    return movFecha >= inicioStr && movFecha <= finStr;
  });

  const totalIngresos = movimientosEnPeriodo.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
  const totalGastos = movimientosEnPeriodo.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + m.monto, 0);
  const balance = totalIngresos - totalGastos;

  const movimientosFiltrados =
    filtroTipo === 'todos'
      ? movimientosEnPeriodo
      : movimientosEnPeriodo.filter((m) => m.tipo === filtroTipo);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const montoNum = parseFloat((monto || '').replace(/,/g, ''));
    if (Number.isNaN(montoNum) || montoNum <= 0) {
      alert('Ingresa un monto válido');
      return;
    }
    try {
      await postMovimientoLienzo({
        tipo: tipoForm,
        descripcion: descripcion.trim() || undefined,
        monto: montoNum,
        fecha: fecha || undefined,
      });
      await cargarDatos();
      setDescripcion('');
      setMonto('');
      setFecha(new Date().toISOString().split('T')[0]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar este registro?')) return;
    try {
      await deleteMovimientoLienzo(id);
      await cargarDatos();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const formatearFecha = (f: string) => {
    const soloFecha = (f || '').slice(0, 10);
    if (soloFecha.length < 10) return f || '—';
    const [a, mes, dia] = soloFecha.split('-');
    return `${dia}/${mes}/${a}`;
  };
  const fm = (n: number) => `$${formatearMoneda(n)}`;

  if (loading && movimientos.length === 0) {
    return (
      <div className="flex flex-col h-full text-white">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <p className="text-slate-400 mt-4 text-sm font-medium">Cargando Lienzo Charro…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full text-white">
      <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-700/80 bg-slate-900/90 backdrop-blur-sm px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Lienzo Charro</h1>
            <p className="text-slate-400 text-sm mt-0.5">Renta de caballos y gastos de mantención</p>
          </div>
        </div>
      </header>

      <div className="px-6 py-5 space-y-6">
        {/* Selector de período */}
        <div className="rounded-2xl bg-slate-800/80 border border-slate-700/80 p-4">
          <p className="text-slate-400 text-sm font-medium mb-2">Visualizar por período</p>
          <div className="flex flex-wrap gap-2">
            {(['dia', 'semana', 'mes', 'año'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                  periodo === p
                    ? 'bg-amber-500 text-white shadow-lg'
                    : 'bg-slate-700/80 text-slate-300 hover:bg-slate-600 border border-slate-600/50'
                }`}
              >
                {p === 'dia' ? 'Día' : p === 'semana' ? 'Semana' : p === 'mes' ? 'Mes' : 'Año'}
              </button>
            ))}
          </div>
          <p className="text-slate-500 text-xs mt-2">{formatearRango(inicioPeriodo, finPeriodo)}</p>
        </div>

        {/* Resumen: cuánto invierto, cuánto gano */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="rounded-2xl bg-slate-800/80 border border-red-500/30 p-5 shadow-elevated">
            <p className="text-slate-400 text-sm font-medium">Total invertido (gastos)</p>
            <p className="text-2xl font-bold text-red-400 mt-1 tabular-nums">{fm(totalGastos)}</p>
            <p className="text-xs text-slate-500 mt-1">Mantención · {periodo === 'dia' ? 'hoy' : periodo === 'semana' ? 'esta semana' : periodo === 'mes' ? 'este mes' : 'este año'}</p>
          </div>
          <div className="rounded-2xl bg-slate-800/80 border border-emerald-500/30 p-5 shadow-elevated">
            <p className="text-slate-400 text-sm font-medium">Total ganado (ingresos)</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">{fm(totalIngresos)}</p>
            <p className="text-xs text-slate-500 mt-1">Renta · {periodo === 'dia' ? 'hoy' : periodo === 'semana' ? 'esta semana' : periodo === 'mes' ? 'este mes' : 'este año'}</p>
          </div>
          <div className="rounded-2xl bg-slate-800/80 border border-violet-500/30 p-5 shadow-elevated">
            <p className="text-slate-400 text-sm font-medium">Balance</p>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fm(balance)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Ganancia − Inversión</p>
          </div>
        </div>

        {/* Registrar ingreso o gasto */}
        <div className="rounded-2xl bg-slate-800/80 border border-slate-700/80 p-5">
          <h2 className="text-slate-200 font-semibold mb-4">Registrar movimiento</h2>
          <form onSubmit={guardar} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-slate-400 text-sm font-medium mb-1">Tipo</label>
              <select
                value={tipoForm}
                onChange={(e) => setTipoForm(e.target.value as 'ingreso' | 'gasto')}
                className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white focus:ring-2 focus:ring-amber-500 outline-none"
              >
                <option value="ingreso">Ingreso (renta caballos)</option>
                <option value="gasto">Gasto (mantención)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 text-sm font-medium mb-1">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm font-medium mb-1">Descripción</label>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder={tipoForm === 'ingreso' ? 'Ej. Renta evento X' : 'Ej. Alimento, herradura'}
                className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm font-medium mb-1">Monto</label>
              <input
                type="text"
                value={monto}
                onChange={(e) => {
                  const raw = e.target.value.replace(/,/g, '');
                  if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                    setMonto(raw);
                  }
                }}
                onBlur={() => {
                  if (!monto) return;
                  const num = parseFloat(monto);
                  if (!Number.isNaN(num) && num >= 0) setMonto(formatearMoneda(num));
                }}
                onFocus={() => {
                  if (monto) setMonto(monto.replace(/,/g, ''));
                }}
                placeholder="0.00"
                className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 outline-none"
                required
              />
            </div>
            <div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium transition"
              >
                Guardar
              </button>
            </div>
          </form>
        </div>

        {/* Filtro y lista de movimientos */}
        <div className="rounded-2xl bg-slate-800/80 border border-slate-700/80 overflow-hidden shadow-elevated">
          <div className="px-6 py-4 border-b border-slate-700 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-slate-200 font-semibold">Historial de movimientos</h2>
              <p className="text-slate-500 text-xs mt-0.5">Período: {formatearRango(inicioPeriodo, finPeriodo)}</p>
            </div>
            <div className="flex gap-2">
              {(['todos', 'ingreso', 'gasto'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltroTipo(f)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                    filtroTipo === f
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-700/80 text-slate-300 hover:bg-slate-600 border border-slate-600/50'
                  }`}
                >
                  {f === 'todos' ? 'Todos' : f === 'ingreso' ? 'Ingresos' : 'Gastos'}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800">
                  <th className="text-left text-slate-400 font-semibold text-sm px-6 py-4">Fecha</th>
                  <th className="text-left text-slate-400 font-semibold text-sm px-6 py-4">Tipo</th>
                  <th className="text-left text-slate-400 font-semibold text-sm px-6 py-4">Descripción</th>
                  <th className="text-right text-slate-400 font-semibold text-sm px-6 py-4">Monto</th>
                  <th className="text-right text-slate-400 font-semibold text-sm px-6 py-4 w-24">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {movimientosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      No hay movimientos en este período. Cambia el filtro o agrega ingresos/gastos.
                    </td>
                  </tr>
                ) : (
                  movimientosFiltrados.map((m) => (
                    <tr key={m.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition">
                      <td className="px-6 py-3 text-slate-300 text-sm">{formatearFecha(m.fecha)}</td>
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${
                            m.tipo === 'ingreso'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-white">{m.descripcion || '—'}</td>
                      <td className="px-6 py-3 text-right font-medium tabular-nums">
                        <span className={m.tipo === 'ingreso' ? 'text-emerald-400' : 'text-red-400'}>
                          {m.tipo === 'ingreso' ? '+' : '-'}{fm(m.monto)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() => eliminar(m.id)}
                          className="p-2 rounded-lg text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition"
                          title="Eliminar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
