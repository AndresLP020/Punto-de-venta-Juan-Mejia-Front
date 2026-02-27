'use client';

import { useEffect, useState } from 'react';
import {
  getProveedores,
  getProductos,
  postProveedor,
  putProveedor,
  deleteProveedor,
  getCuentasProveedoresResumen,
  getMovimientosProveedor,
  postMovimientoProveedor,
  type Proveedor,
  type CuentaProveedorResumen,
  type MovimientoCuentaProveedor,
} from '@/lib/api';
import { formatearMoneda } from '@/lib/utils';

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productosPorProveedor, setProductosPorProveedor] = useState<Record<number, number>>({});
  const [resumenCuentas, setResumenCuentas] = useState<Record<number, CuentaProveedorResumen>>({});
  const [loading, setLoading] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Proveedor | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [form, setForm] = useState({ nombre: '', telefono: '', email: '', direccion: '' });

  const [modalCuentaAbierto, setModalCuentaAbierto] = useState(false);
  const [proveedorCuenta, setProveedorCuenta] = useState<Proveedor | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoCuentaProveedor[]>([]);
  const [loadingMovimientos, setLoadingMovimientos] = useState(false);
  const [tipoMovimiento, setTipoMovimiento] = useState<'deuda' | 'pago'>('deuda');
  const [montoMovimiento, setMontoMovimiento] = useState('');
  const [montoMovimientoDisplay, setMontoMovimientoDisplay] = useState('');
  const [descripcionMovimiento, setDescripcionMovimiento] = useState('');
  const [fechaMovimiento, setFechaMovimiento] = useState('');

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [prov, prods, cuentas] = await Promise.all([
        getProveedores(),
        getProductos(),
        getCuentasProveedoresResumen().catch(() => [] as CuentaProveedorResumen[]),
      ]);
      setProveedores(prov);

      const cuentaProductos: Record<number, number> = {};
      (prods as { proveedorId?: number }[]).forEach((p) => {
        if (p.proveedorId != null) {
          cuentaProductos[p.proveedorId] = (cuentaProductos[p.proveedorId] || 0) + 1;
        }
      });
      setProductosPorProveedor(cuentaProductos);

      const mapCuentas: Record<number, CuentaProveedorResumen> = {};
      (cuentas as CuentaProveedorResumen[]).forEach((c) => {
        mapCuentas[c.proveedorId] = c;
      });
      setResumenCuentas(mapCuentas);
    } catch {
      setProveedores([]);
      setProductosPorProveedor({});
      setResumenCuentas({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const abrirModal = (p?: Proveedor) => {
    if (p) {
      setEditando(p);
      setForm({ nombre: p.nombre, telefono: p.telefono || '', email: p.email || '', direccion: p.direccion || '' });
    } else {
      setEditando(null);
      setForm({ nombre: '', telefono: '', email: '', direccion: '' });
    }
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setEditando(null);
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    try {
      if (editando) {
        await putProveedor(editando.id, form);
      } else {
        await postProveedor(form);
      }
      await cargarDatos();
      cerrarModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar este proveedor? Los productos que lo tengan asignado quedarán sin proveedor.')) return;
    try {
      await deleteProveedor(id);
      await cargarDatos();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const abrirCuentaProveedor = async (proveedor: Proveedor) => {
    setProveedorCuenta(proveedor);
    setModalCuentaAbierto(true);
    setLoadingMovimientos(true);
    try {
      const movs = await getMovimientosProveedor(proveedor.id);
      setMovimientos(movs);
    } catch {
      setMovimientos([]);
    } finally {
      setLoadingMovimientos(false);
    }
    setTipoMovimiento('deuda');
    setMontoMovimiento('');
    setMontoMovimientoDisplay('');
    setDescripcionMovimiento('');
    setFechaMovimiento('');
  };

  const cerrarCuentaProveedor = () => {
    setModalCuentaAbierto(false);
    setProveedorCuenta(null);
    setMovimientos([]);
  };

  const registrarMovimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proveedorCuenta) return;
    const monto = parseFloat(montoMovimiento);
    if (isNaN(monto) || monto <= 0) {
      alert('Ingresa un monto válido');
      return;
    }
    try {
      await postMovimientoProveedor({
        proveedorId: proveedorCuenta.id,
        tipo: tipoMovimiento,
        monto,
        descripcion: descripcionMovimiento || undefined,
        fecha: fechaMovimiento || undefined,
      });
      // Recargar resumen y movimientos
      await cargarDatos();
      const movs = await getMovimientosProveedor(proveedorCuenta.id);
      setMovimientos(movs);
      setMontoMovimiento('');
      setMontoMovimientoDisplay('');
      setDescripcionMovimiento('');
      setFechaMovimiento('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al registrar movimiento');
    }
  };

  const filtrados = busqueda.trim()
    ? proveedores.filter(
        (p) =>
          p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          p.telefono?.toLowerCase().includes(busqueda.toLowerCase()) ||
          p.email?.toLowerCase().includes(busqueda.toLowerCase())
      )
    : proveedores;

  return (
    <div className="flex flex-col h-full text-white">
      <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Proveedores</h1>
            <p className="text-slate-400 text-sm">Quienes surten tus productos. Asigna un proveedor al crear o editar cada producto.</p>
          </div>
          <button
            onClick={() => abrirModal()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo proveedor
          </button>
        </div>
      </div>

      <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/30">
        <div className="relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, teléfono o email..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-center py-12 text-slate-400">Cargando proveedores…</div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400 text-lg">No hay proveedores</p>
            <p className="text-slate-500 text-sm mt-1">Agrega uno para asignarlo a tus productos</p>
            <button onClick={() => abrirModal()} className="mt-4 px-4 py-2 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600">
              Nuevo proveedor
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtrados.map((p) => {
              const resumen = resumenCuentas[p.id];
              const saldo = resumen?.saldoPendiente ?? 0;
              return (
                <div key={p.id} className="bg-slate-800 rounded-xl border border-slate-700 p-5 hover:border-slate-600 transition">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-white text-lg">{p.nombre}</h3>
                      {resumen && (
                        <p className="mt-1 text-xs">
                          <span className="text-slate-400">Deuda: </span>
                          <span className="text-amber-400 font-semibold">${formatearMoneda(resumen.totalDeuda)}</span>
                          <span className="text-slate-500 mx-1">·</span>
                          <span className="text-slate-400">Pagos: </span>
                          <span className="text-emerald-400 font-semibold">${formatearMoneda(resumen.totalPagos)}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                          saldo > 0 ? 'bg-amber-500/15 border-amber-400/60 text-amber-300' : 'bg-emerald-500/15 border-emerald-400/60 text-emerald-300'
                        }`}
                      >
                        {saldo > 0 ? `Debe: $${formatearMoneda(saldo)}` : 'Sin deuda'}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => abrirModal(p)} className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300" title="Editar">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => eliminar(p.id)} className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400" title="Eliminar">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-slate-400">
                    {p.telefono && <p>Tel: {p.telefono}</p>}
                    {p.email && <p>{p.email}</p>}
                    {p.direccion && <p>{p.direccion}</p>}
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-700 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">Productos que surte</p>
                      <p className="text-lg font-bold text-green-400">{productosPorProveedor[p.id] ?? 0}</p>
                    </div>
                    <button
                      onClick={() => abrirCuentaProveedor(p)}
                      className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition"
                    >
                      Ver / Registrar deuda
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={cerrarModal}>
          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-4">{editando ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
            <form onSubmit={guardar} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Nombre *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white focus:ring-2 focus:ring-green-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Teléfono</label>
                <input
                  type="text"
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Dirección</label>
                <input
                  type="text"
                  value={form.direccion}
                  onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={cerrarModal} className="flex-1 py-2.5 rounded-xl bg-slate-700 text-slate-300 font-medium hover:bg-slate-600">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-green-500 text-white font-medium hover:bg-green-600">
                  {editando ? 'Actualizar' : 'Agregar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalCuentaAbierto && proveedorCuenta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={cerrarCuentaProveedor}>
          <div
            className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Cuenta con proveedor</h2>
                <p className="text-slate-400 text-sm">{proveedorCuenta.nombre}</p>
              </div>
              <button
                onClick={cerrarCuentaProveedor}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-3 border-b border-slate-700 bg-slate-900/40 flex items-center gap-6">
              {(() => {
                const resumen = resumenCuentas[proveedorCuenta.id];
                const saldo = resumen?.saldoPendiente ?? 0;
                return (
                  <>
                    <div>
                      <p className="text-xs text-slate-400">Saldo pendiente</p>
                      <p className={`text-xl font-bold ${saldo > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {saldo > 0 ? `$${formatearMoneda(saldo)}` : 'Sin deuda'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Total deudas</p>
                      <p className="text-sm font-semibold text-amber-300">
                        ${formatearMoneda(resumen?.totalDeuda ?? 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Total pagos</p>
                      <p className="text-sm font-semibold text-emerald-300">
                        ${formatearMoneda(resumen?.totalPagos ?? 0)}
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
              <div className="bg-slate-900/40 border border-slate-700 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-slate-100 mb-3">Registrar movimiento</h3>
                <form onSubmit={registrarMovimiento} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Tipo</label>
                    <select
                      value={tipoMovimiento}
                      onChange={(e) => setTipoMovimiento(e.target.value as 'deuda' | 'pago')}
                      className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="deuda">Registrar deuda</option>
                      <option value="pago">Registrar pago</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Monto</label>
                    <input
                      type="text"
                      value={montoMovimientoDisplay}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/,/g, '');
                        // Permitir sólo números y punto decimal mientras se escribe
                        if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                          setMontoMovimiento(raw);
                          setMontoMovimientoDisplay(raw);
                        }
                      }}
                      onFocus={() => {
                        // Al enfocar, mostrar el valor sin formato para editarlo fácilmente
                        setMontoMovimientoDisplay(montoMovimiento);
                      }}
                      onBlur={() => {
                        if (!montoMovimiento) {
                          setMontoMovimientoDisplay('');
                          return;
                        }
                        const num = Number(montoMovimiento);
                        if (Number.isNaN(num) || num < 0) {
                          setMontoMovimiento('');
                          setMontoMovimientoDisplay('');
                          return;
                        }
                        setMontoMovimiento(String(num));
                        setMontoMovimientoDisplay(formatearMoneda(num));
                      }}
                      className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Fecha</label>
                    <input
                      type="date"
                      value={fechaMovimiento}
                      onChange={(e) => setFechaMovimiento(e.target.value)}
                      className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs text-slate-400 mb-1">Descripción</label>
                    <input
                      type="text"
                      value={descripcionMovimiento}
                      onChange={(e) => setDescripcionMovimiento(e.target.value)}
                      placeholder="Ej. Factura 123, abono, etc."
                      className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="md:col-span-4 flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition"
                    >
                      Guardar movimiento
                    </button>
                  </div>
                </form>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-100 mb-2">Historial de movimientos</h3>
                {loadingMovimientos ? (
                  <p className="text-slate-400 text-sm">Cargando movimientos…</p>
                ) : movimientos.length === 0 ? (
                  <p className="text-slate-500 text-sm">Aún no hay movimientos registrados con este proveedor.</p>
                ) : (
                  <div className="space-y-2">
                    {movimientos.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium text-slate-100">
                            {m.tipo === 'deuda' ? 'Deuda' : 'Pago'} · ${formatearMoneda(m.monto)}
                          </p>
                          {m.descripcion && <p className="text-xs text-slate-400">{m.descripcion}</p>}
                        </div>
                        <span className="text-xs text-slate-400">
                          {new Date(m.fecha).toLocaleDateString('es-MX', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
