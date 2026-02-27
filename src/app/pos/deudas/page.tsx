'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  getMetasAhorro,
  getRegistrosAhorro,
  putRegistroDia,
  postMetaAhorro,
  putMetaAhorro,
  deleteMetaAhorro,
  type MetaAhorro,
  type RegistroAhorroDia,
} from '@/lib/api';
import { formatearMoneda } from '@/lib/utils';

function hoyStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function diasHasta(fechaLimite: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const lim = new Date(fechaLimite);
  lim.setHours(0, 0, 0, 0);
  const diff = lim.getTime() - hoy.getTime();
  return Math.max(0, Math.ceil(diff / 86400000));
}

function totalAhorradoDeRegistros(registros: RegistroAhorroDia[]): number {
  return registros.filter((r) => r.monto > 0).reduce((s, r) => s + r.monto, 0);
}

/** Días que ya “perdimos” por marcar como “no ahorré” (hasta hoy). */
function diasNoAhorroHastaHoy(registros: RegistroAhorroDia[]): number {
  const hoy = hoyStr();
  return registros.filter((r) => r.fecha <= hoy && r.monto === 0).length;
}

/** Días restantes para ahorrar: total hasta la fecha límite menos los días ya marcados como no ahorro. */
function diasRestantesConRegistros(fechaLimite: string, registros: RegistroAhorroDia[]): number {
  const base = diasHasta(fechaLimite);
  const perdidos = diasNoAhorroHastaHoy(registros);
  return Math.max(1, base - perdidos);
}

function ahorroDiarioConRegistros(
  meta: number,
  fechaLimite: string,
  totalAhorrado: number,
  registros: RegistroAhorroDia[]
): number {
  const dias = diasRestantesConRegistros(fechaLimite, registros);
  if (dias <= 0) return 0;
  const restante = Math.max(0, meta - totalAhorrado);
  return Math.round((restante / dias) * 100) / 100;
}

function ahorroDiarioSimple(meta: number, fechaLimite: string): number {
  const dias = diasHasta(fechaLimite);
  if (dias <= 0) return 0;
  return Math.round((meta / dias) * 100) / 100;
}

const DÍAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function CalendarioGrid({
  año,
  mes,
  registros,
  fechaLimite,
  diaSeleccionado,
  setDiaSeleccionado,
}: {
  año: number;
  mes: number;
  registros: RegistroAhorroDia[];
  fechaLimite: string;
  diaSeleccionado: string | null;
  setDiaSeleccionado: (d: string | null) => void;
}) {
  const hoy = hoyStr();
  const primerDia = new Date(año, mes, 1);
  const inicioSemana = primerDia.getDay();
  const diasEnMes = new Date(año, mes + 1, 0).getDate();
  const regMap = Object.fromEntries(registros.map((r) => [r.fecha.slice(0, 10), r.monto]));

  const celdas: { fecha: string; dia: number; esFuturo: boolean; esPasadoOHoy: boolean }[] = [];
  for (let i = 0; i < inicioSemana; i++) celdas.push({ fecha: '', dia: 0, esFuturo: false, esPasadoOHoy: false });
  for (let d = 1; d <= diasEnMes; d++) {
    const fecha = `${año}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const esFuturo = fecha > hoy;
    const esPasadoOHoy = fecha <= hoy;
    celdas.push({ fecha, dia: d, esFuturo, esPasadoOHoy });
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 font-medium">
        {DÍAS_SEMANA.map((d) => (
          <div key={d} className="w-11 h-6 flex items-center justify-center">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {celdas.map((celda, idx) => {
          if (celda.dia === 0) return <div key={`empty-${idx}`} className="w-11 h-11" />;
          const monto = regMap[celda.fecha];
          const verde = monto != null && monto > 0;
          const rojo = monto != null && monto === 0 && celda.esPasadoOHoy;
          const sinMarcar = monto == null && celda.esPasadoOHoy;
          const futuro = celda.esFuturo;
          const puedeMarcar = celda.esPasadoOHoy && celda.fecha <= fechaLimite;
          const seleccionado = diaSeleccionado === celda.fecha;

          return (
            <button
              key={celda.fecha}
              type="button"
              onClick={() => puedeMarcar && setDiaSeleccionado(celda.fecha)}
              disabled={!puedeMarcar}
              className={`w-11 h-11 rounded-lg text-sm font-medium transition ring-2 ring-transparent ${
                seleccionado ? 'ring-amber-400 ring-offset-2 ring-offset-slate-800' : ''
              } ${
                verde
                  ? 'bg-emerald-500/90 text-white'
                  : rojo
                    ? 'bg-red-500/90 text-white'
                    : sinMarcar
                      ? 'bg-slate-600/80 text-slate-300 hover:bg-slate-600'
                      : futuro
                        ? 'bg-slate-700/50 text-slate-500 cursor-default'
                        : 'bg-slate-700/50 text-slate-500 cursor-default'
              }`}
            >
              {celda.dia}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DeudasPage() {
  const [metas, setMetas] = useState<MetaAhorro[]>([]);
  const [registrosByMetaId, setRegistrosByMetaId] = useState<Record<number, RegistroAhorroDia[]>>({});
  const [loading, setLoading] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ nombre: '', meta: '', fechaLimite: '' });
  const [metaCalendario, setMetaCalendario] = useState<MetaAhorro | null>(null);
  const [mesCalendario, setMesCalendario] = useState(() => {
    const d = new Date();
    return { año: d.getFullYear(), mes: d.getMonth() };
  });
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getMetasAhorro();
      setMetas(list);
      const regs = await Promise.all(list.map((m: MetaAhorro) => getRegistrosAhorro(m.id)));
      setRegistrosByMetaId(
        list.reduce((acc: Record<number, RegistroAhorroDia[]>, m: MetaAhorro, i) => {
          acc[m.id] = regs[i] ?? [];
          return acc;
        }, {} as Record<number, RegistroAhorroDia[]>)
      );
    } catch {
      setMetas([]);
      setRegistrosByMetaId({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const abrirModal = (meta?: MetaAhorro) => {
    if (meta) {
      setEditingId(meta.id);
      setForm({
        nombre: meta.nombre,
        meta: String(meta.meta),
        fechaLimite: meta.fechaLimite.slice(0, 10),
      });
    } else {
      setEditingId(null);
      const hoy = new Date();
      const enUnMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, hoy.getDate());
      setForm({
        nombre: '',
        meta: '',
        fechaLimite: enUnMes.toISOString().slice(0, 10),
      });
    }
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setEditingId(null);
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const metaNum = parseFloat(form.meta);
    if (!form.nombre.trim() || Number.isNaN(metaNum) || metaNum <= 0 || !form.fechaLimite) return;
    try {
      if (editingId) {
        await putMetaAhorro(editingId, {
          nombre: form.nombre.trim(),
          meta: metaNum,
          fechaLimite: form.fechaLimite.slice(0, 10),
        });
      } else {
        await postMetaAhorro({
          nombre: form.nombre.trim(),
          meta: metaNum,
          fechaLimite: form.fechaLimite.slice(0, 10),
        });
      }
      await cargarDatos();
      cerrarModal();
    } catch (err) {
      console.error(err);
      alert((err as Error).message);
    }
  };

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar este objetivo de ahorro?')) return;
    try {
      await deleteMetaAhorro(id);
      await cargarDatos();
    } catch (err) {
      console.error(err);
      alert((err as Error).message);
    }
  };

  const abrirCalendario = (m: MetaAhorro) => {
    setMetaCalendario(m);
    setMesCalendario({ año: new Date().getFullYear(), mes: new Date().getMonth() });
    setDiaSeleccionado(null);
  };

  const cerrarCalendario = () => {
    setMetaCalendario(null);
    setDiaSeleccionado(null);
  };

  const refrescarRegistrosMeta = useCallback(async (metaId: number) => {
    try {
      const regs = await getRegistrosAhorro(metaId);
      setRegistrosByMetaId((prev) => ({ ...prev, [metaId]: regs }));
    } catch {
      //
    }
  }, []);

  const guardarDiaCalendario = async (metaId: number, fecha: string, monto: number) => {
    try {
      await putRegistroDia(metaId, fecha, monto);
      await refrescarRegistrosMeta(metaId);
      setDiaSeleccionado(null);
    } catch (err) {
      console.error(err);
      alert((err as Error).message);
    }
  };

  const fm = (n: number) => `$${formatearMoneda(n)}`;

  const formatearFecha = (f: string) => {
    return new Date(f).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const totalDiario = metas
    .filter((m) => m.estado === 'activa')
    .reduce((s, m) => {
      const regs = registrosByMetaId[m.id] ?? [];
      const total = totalAhorradoDeRegistros(regs);
      return s + ahorroDiarioConRegistros(m.meta, m.fechaLimite, total, regs);
    }, 0);

  if (loading && metas.length === 0) {
    return (
      <div className="flex flex-col h-full text-white">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-slate-400 mt-4 text-sm font-medium">Cargando metas de ahorro…</p>
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Deudas</h1>
            <p className="text-slate-400 text-sm mt-0.5">Metas de ahorro para pagos a largo plazo. Ajusta cantidad o fecha y el ahorro diario se recalcula.</p>
          </div>
        </div>
        <button
          onClick={() => abrirModal()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium shadow-lg transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva meta
        </button>
      </header>

      <div className="px-6 py-4 border-b border-slate-700/80 bg-slate-800/40">
        <p className="text-slate-400 text-sm">
          Total a ahorrar por día (todas las metas activas): <span className="font-semibold text-amber-400 tabular-nums">{fm(totalDiario)}</span>
        </p>
      </div>

      <div className="flex-1 px-6 py-6">
        {metas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-800/40 p-12 text-center">
            <p className="text-slate-400 mb-2">No hay metas de ahorro.</p>
            <p className="text-slate-500 text-sm mb-6">Define cuánto necesitas y para cuándo; se calculará el ahorro diario.</p>
            <button
              onClick={() => abrirModal()}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium"
            >
              Agregar primera meta
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {metas.map((m) => {
              const regs = registrosByMetaId[m.id] ?? [];
              const totalAh = totalAhorradoDeRegistros(regs);
              const dias = diasRestantesConRegistros(m.fechaLimite, regs);
              const diario = ahorroDiarioConRegistros(m.meta, m.fechaLimite, totalAh, regs);
              const vencida = diasHasta(m.fechaLimite) <= 0;
              return (
                <div
                  key={m.id}
                  className={`rounded-2xl border p-5 shadow-elevated transition ${
                    m.estado === 'completada'
                      ? 'border-slate-600 bg-slate-800/60 opacity-80'
                      : vencida
                        ? 'border-amber-500/40 bg-amber-500/10'
                        : 'border-slate-600 bg-slate-800/80 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-semibold text-white truncate">{m.nombre}</h3>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => abrirCalendario(m)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition"
                        title="Calendario"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirModal(m)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition"
                        title="Editar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => eliminar(m.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition"
                        title="Eliminar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4m1 4h.01M17 4h.01" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <p className="text-slate-400">
                      Meta: <span className="font-semibold text-white tabular-nums">{fm(m.meta)}</span>
                      {totalAh > 0 && (
                        <span className="text-emerald-400/90 ml-1">(ahorrado {fm(totalAh)})</span>
                      )}
                    </p>
                    <p className="text-slate-400">
                      Para: <span className="text-white">{formatearFecha(m.fechaLimite)}</span>
                    </p>
                    {m.estado === 'completada' ? (
                      <p className="text-emerald-400 font-medium">Completada</p>
                    ) : vencida ? (
                      <p className="text-amber-400 font-medium">Fecha pasada — ajusta la fecha para recalcular</p>
                    ) : (
                      <>
                        <p className="text-amber-400 font-medium">
                          Ahorro diario: <span className="tabular-nums">{fm(diario)}</span>
                        </p>
                        <p className="text-slate-500">{dias} días restantes</p>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => abrirCalendario(m)}
                      className="mt-2 text-amber-400/90 hover:text-amber-400 text-xs font-medium"
                    >
                      Ver calendario →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Calendario por meta */}
      {metaCalendario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={cerrarCalendario}>
          <div
            className="bg-slate-800 rounded-2xl border border-slate-700 shadow-elevated-lg w-full max-w-lg overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white truncate">Calendario — {metaCalendario.nombre}</h2>
              <button type="button" onClick={cerrarCalendario} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-4 py-3 border-b border-slate-700/80 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setMesCalendario((prev) => (prev.mes === 0 ? { año: prev.año - 1, mes: 11 } : { ...prev, mes: prev.mes - 1 }))}
                className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="text-white font-medium capitalize">
                {new Date(mesCalendario.año, mesCalendario.mes).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
              </span>
              <button
                type="button"
                onClick={() => setMesCalendario((prev) => (prev.mes === 11 ? { año: prev.año + 1, mes: 0 } : { ...prev, mes: prev.mes + 1 }))}
                className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
            <div className="p-5">
              <CalendarioGrid
                año={mesCalendario.año}
                mes={mesCalendario.mes}
                registros={registrosByMetaId[metaCalendario.id] ?? []}
                fechaLimite={metaCalendario.fechaLimite}
                diaSeleccionado={diaSeleccionado}
                setDiaSeleccionado={setDiaSeleccionado}
              />
              {diaSeleccionado && (
                <div className="mt-4 p-4 rounded-xl bg-slate-700/80 border border-slate-600">
                  <p className="text-white font-medium mb-1">
                    {new Date(diaSeleccionado).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </p>
                  <p className="text-slate-400 text-sm mb-3">¿Ahorraste este día?</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => guardarDiaCalendario(
                        metaCalendario.id,
                        diaSeleccionado,
                        ahorroDiarioConRegistros(
                          metaCalendario.meta,
                          metaCalendario.fechaLimite,
                          totalAhorradoDeRegistros(registrosByMetaId[metaCalendario.id] ?? []),
                          registrosByMetaId[metaCalendario.id] ?? []
                        )
                      )}
                      className="flex-1 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600"
                    >
                      Sí ({fm(ahorroDiarioConRegistros(
                        metaCalendario.meta,
                        metaCalendario.fechaLimite,
                        totalAhorradoDeRegistros(registrosByMetaId[metaCalendario.id] ?? []),
                        registrosByMetaId[metaCalendario.id] ?? []
                      ))})
                    </button>
                    <button
                      type="button"
                      onClick={() => guardarDiaCalendario(metaCalendario.id, diaSeleccionado, 0)}
                      className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600"
                    >
                      No
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDiaSeleccionado(null)}
                    className="mt-2 w-full py-1.5 text-slate-400 text-sm hover:text-white"
                  >
                    Cerrar
                  </button>
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-700 flex items-center justify-center gap-4 text-sm text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-emerald-500/80" /> Ahorré</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-red-500/80" /> No ahorré</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-slate-600" /> Sin marcar</span>
            </div>
          </div>
        </div>
      )}

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={cerrarModal}>
          <div
            className="bg-slate-800 rounded-2xl border border-slate-700 shadow-elevated-lg w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">{editingId ? 'Editar meta de ahorro' : 'Nueva meta de ahorro'}</h2>
              <p className="text-slate-400 text-sm mt-0.5">Al cambiar la cantidad o la fecha, el ahorro diario se ajusta automáticamente.</p>
            </div>
            <form onSubmit={guardar} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Nombre del objetivo</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej. Refrigerador, colegiatura..."
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Cantidad a reunir ($)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.meta}
                  onChange={(e) => setForm((f) => ({ ...f, meta: e.target.value }))}
                  placeholder="0.00"
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Fecha en que lo necesitas</label>
                <input
                  type="date"
                  value={form.fechaLimite}
                  onChange={(e) => setForm((f) => ({ ...f, fechaLimite: e.target.value }))}
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  required
                />
              </div>
              {form.meta && form.fechaLimite && parseFloat(form.meta) > 0 && (
                <p className="text-sm text-amber-400/90">
                  Ahorro diario sugerido: <span className="font-semibold tabular-nums">{fm(ahorroDiarioSimple(parseFloat(form.meta), form.fechaLimite))}</span>
                </p>
              )}
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
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-medium hover:bg-amber-600 transition"
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
