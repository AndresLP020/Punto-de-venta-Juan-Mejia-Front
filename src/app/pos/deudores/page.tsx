'use client';

import { useEffect, useState } from 'react';
import { getVentas, getClientes, abonarVenta, type Cliente } from '@/lib/api';
import { formatearMoneda } from '@/lib/utils';

type Venta = {
  id: number;
  fecha: string;
  total: number;
  pagado?: number;
  pendiente?: number;
  estado?: string;
  cliente?: string;
  clienteId?: number;
  items: { nombre: string; cantidad: number; precio: number }[];
};

type Deudor = {
  cliente: Cliente;
  totalAdeudado: number;
  ventasPendientes: Venta[];
};

export default function DeudoresPage() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [deudores, setDeudores] = useState<Deudor[]>([]);
  const [deudorSeleccionado, setDeudorSeleccionado] = useState<Deudor | null>(null);
  const [loading, setLoading] = useState(true);
  const [ventaAbonando, setVentaAbonando] = useState<number | null>(null);
  const [montoAbono, setMontoAbono] = useState('');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [v, c] = await Promise.all([getVentas(), getClientes()]);
      setVentas(v);
      setClientes(c);
    } catch {
      setVentas([]);
      setClientes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Calcular deudores agrupados por cliente
    const deudoresMap = new Map<number, { cliente: Cliente; ventasPendientes: Venta[] }>();

    ventas
      .filter((v) => v.estado === 'pendiente' && v.pendiente && v.pendiente > 0 && v.clienteId)
      .forEach((venta) => {
        const clienteId = venta.clienteId!;
        const cliente = clientes.find((c) => c.id === clienteId);
        if (!cliente) return;

        if (!deudoresMap.has(clienteId)) {
          deudoresMap.set(clienteId, { cliente, ventasPendientes: [] });
        }
        deudoresMap.get(clienteId)!.ventasPendientes.push(venta);
      });

    const deudoresArray: Deudor[] = Array.from(deudoresMap.values()).map((d) => ({
      ...d,
      totalAdeudado: d.ventasPendientes.reduce((sum, v) => sum + (v.pendiente || 0), 0),
    }));

    // Ordenar por total adeudado (mayor a menor)
    deudoresArray.sort((a, b) => b.totalAdeudado - a.totalAdeudado);

    // Filtrar por búsqueda
    const filtrados = busqueda.trim()
      ? deudoresArray.filter(
          (d) =>
            d.cliente.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
            d.cliente.telefono?.toLowerCase().includes(busqueda.toLowerCase()) ||
            d.cliente.email?.toLowerCase().includes(busqueda.toLowerCase())
        )
      : deudoresArray;

    setDeudores(filtrados);
  }, [ventas, clientes, busqueda]);

  const abrirAbono = (ventaId: number) => {
    const venta = ventas.find((v) => v.id === ventaId);
    if (venta) {
      setVentaAbonando(ventaId);
      setMontoAbono('');
    }
  };

  const cerrarAbono = () => {
    setVentaAbonando(null);
    setMontoAbono('');
  };

  const procesarAbono = async () => {
    if (!ventaAbonando || !montoAbono) return;
    const monto = parseFloat(montoAbono);
    if (isNaN(monto) || monto <= 0) {
      alert('Ingrese un monto válido');
      return;
    }

    const venta = ventas.find((v) => v.id === ventaAbonando);
    if (!venta || monto > (venta.pendiente || 0)) {
      alert('El monto del abono no puede ser mayor al pendiente');
      return;
    }

    try {
      await abonarVenta(ventaAbonando, monto);
      // Recargar datos para obtener ventas actualizadas
      const [ventasActualizadas, clientesActualizados] = await Promise.all([getVentas(), getClientes()]);
      setVentas(ventasActualizadas);
      setClientes(clientesActualizados);
      
      // Actualizar el deudor seleccionado si existe
      if (deudorSeleccionado) {
        const deudoresActualizados = calcularDeudores(ventasActualizadas, clientesActualizados);
        const deudorActualizado = deudoresActualizados.find((d) => d.cliente.id === deudorSeleccionado.cliente.id);
        if (deudorActualizado && deudorActualizado.ventasPendientes.length === 0) {
          setDeudorSeleccionado(null);
        } else if (deudorActualizado) {
          setDeudorSeleccionado(deudorActualizado);
        }
      }
      cerrarAbono();
    } catch (error) {
      alert('Error al registrar el abono');
      console.error(error);
    }
  };

  const calcularDeudores = (ventasData: Venta[], clientesData: Cliente[]) => {
    const deudoresMap = new Map<number, { cliente: Cliente; ventasPendientes: Venta[] }>();

    ventasData
      .filter((v) => v.estado === 'pendiente' && v.pendiente && v.pendiente > 0 && v.clienteId)
      .forEach((venta) => {
        const clienteId = venta.clienteId!;
        const cliente = clientesData.find((c) => c.id === clienteId);
        if (!cliente) return;

        if (!deudoresMap.has(clienteId)) {
          deudoresMap.set(clienteId, { cliente, ventasPendientes: [] });
        }
        deudoresMap.get(clienteId)!.ventasPendientes.push(venta);
      });

    return Array.from(deudoresMap.values()).map((d) => ({
      ...d,
      totalAdeudado: d.ventasPendientes.reduce((sum, v) => sum + (v.pendiente || 0), 0),
    }));
  };

  const formatearFecha = (f: string) => {
    return new Date(f).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalGeneral = deudores.reduce((sum, d) => sum + d.totalAdeudado, 0);

  // Vista de lista de deudores
  if (!deudorSeleccionado) {
    return (
      <div className="flex flex-col h-full text-white">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Gestión de Deudores</h1>
              <p className="text-slate-400 text-sm">Selecciona un deudor para ver su historial de deudas</p>
            </div>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/30">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <p className="text-slate-400 text-sm mb-1">Total de Deudores</p>
              <p className="text-2xl font-bold text-white">{deudores.length}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <p className="text-slate-400 text-sm mb-1">Deuda Total</p>
              <p className="text-2xl font-bold text-amber-400">${formatearMoneda(totalGeneral)}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <p className="text-slate-400 text-sm mb-1">Ventas Pendientes</p>
              <p className="text-2xl font-bold text-white">
                {deudores.reduce((sum, d) => sum + d.ventasPendientes.length, 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Búsqueda */}
        <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/30">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

        {/* Lista de deudores */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-slate-400">Cargando deudores…</div>
          ) : deudores.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-slate-400 text-lg">No hay deudores registrados</p>
              <p className="text-slate-500 text-sm mt-1">Todas las ventas están pagadas</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {deudores.map((deudor) => (
                <button
                  key={deudor.cliente.id}
                  onClick={() => setDeudorSeleccionado(deudor)}
                  className="text-left p-5 bg-slate-800 rounded-xl border border-slate-700 hover:border-green-500/50 hover:bg-slate-700/50 transition"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white mb-1">{deudor.cliente.nombre}</h3>
                      {deudor.cliente.telefono && (
                        <p className="text-sm text-slate-400">{deudor.cliente.telefono}</p>
                      )}
                    </div>
                    <span className="px-3 py-1 rounded-full text-sm font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                      ${formatearMoneda(deudor.totalAdeudado)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    {deudor.ventasPendientes.length} {deudor.ventasPendientes.length === 1 ? 'venta pendiente' : 'ventas pendientes'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vista detallada del deudor seleccionado
  return (
    <div className="flex flex-col h-full text-white">
      {/* Header con botón volver */}
      <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setDeudorSeleccionado(null)}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white mb-1">{deudorSeleccionado.cliente.nombre}</h1>
            <p className="text-slate-400 text-sm">Historial de deudas pendientes</p>
          </div>
          <span className="px-4 py-2 rounded-full text-lg font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            Debe: ${formatearMoneda(deudorSeleccionado.totalAdeudado)}
          </span>
        </div>
      </div>

      {/* Información de contacto */}
      <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/30">
        <div className="flex flex-wrap gap-4 text-sm">
          {deudorSeleccionado.cliente.telefono && (
            <div className="flex items-center gap-2 text-slate-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {deudorSeleccionado.cliente.telefono}
            </div>
          )}
          {deudorSeleccionado.cliente.email && (
            <div className="flex items-center gap-2 text-slate-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {deudorSeleccionado.cliente.email}
            </div>
          )}
          {deudorSeleccionado.cliente.direccion && (
            <div className="flex items-center gap-2 text-slate-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {deudorSeleccionado.cliente.direccion}
            </div>
          )}
        </div>
      </div>

      {/* Lista de ventas pendientes */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-4">
          {deudorSeleccionado.ventasPendientes.map((venta) => (
            <div key={venta.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              {/* Header de la venta */}
              <div className="p-5 bg-slate-900/50 border-b border-slate-700">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg font-bold text-white">Venta #{venta.id}</span>
                      <span className="text-sm text-slate-400">{formatearFecha(venta.fecha)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-slate-400 mb-1">
                      Total: <span className="text-white font-semibold">${formatearMoneda(venta.total)}</span>
                    </div>
                    <div className="text-sm text-green-400 mb-1">
                      Pagado: <span className="font-semibold">${formatearMoneda(venta.pagado || 0)}</span>
                    </div>
                    <div className="text-lg font-bold text-amber-400">
                      Pendiente: ${formatearMoneda(venta.pendiente || 0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Productos de la venta */}
              <div className="p-5">
                <h4 className="text-sm font-semibold text-slate-300 mb-3">Productos:</h4>
                <div className="space-y-2 mb-4">
                  {venta.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-700/50 border border-slate-600">
                      <div className="flex-1">
                        <p className="text-white font-medium">{item.nombre}</p>
                        <p className="text-sm text-slate-400">
                          Cantidad: {item.cantidad} × ${formatearMoneda(item.precio)} = ${formatearMoneda(item.cantidad * item.precio)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-semibold">${formatearMoneda(item.cantidad * item.precio)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Resumen financiero */}
                <div className="pt-4 border-t border-slate-700 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Total de la venta:</span>
                    <span className="text-white font-semibold">${formatearMoneda(venta.total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Dinero que dejó:</span>
                    <span className="text-green-400 font-semibold">${formatearMoneda(venta.pagado || 0)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-700">
                    <span className="text-slate-300">Lo que no pagó:</span>
                    <span className="text-amber-400">${formatearMoneda(venta.pendiente || 0)}</span>
                  </div>
                </div>

                {/* Botón abonar */}
                <button
                  onClick={() => abrirAbono(venta.id)}
                  className="w-full mt-4 py-3 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold transition"
                >
                  Abonar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de abono */}
      {ventaAbonando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Registrar Abono</h2>
              <button
                onClick={cerrarAbono}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {(() => {
              const venta = ventas.find((v) => v.id === ventaAbonando);
              if (!venta) return null;
              return (
                <>
                  <div className="mb-4 p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                    <div className="text-sm text-slate-400 mb-2">Venta #{venta.id}</div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-300">Total:</span>
                      <span className="text-white font-medium">${formatearMoneda(venta.total)}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-300">Pagado:</span>
                      <span className="text-green-400 font-medium">${formatearMoneda(venta.pagado || 0)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-600">
                      <span className="text-slate-300">Pendiente:</span>
                      <span className="text-amber-400">${formatearMoneda(venta.pendiente || 0)}</span>
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Monto del abono <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      value={montoAbono}
                      onChange={(e) => setMontoAbono(e.target.value)}
                      min="0.01"
                      max={venta.pendiente || 0}
                      step="0.01"
                      className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="0.00"
                      autoFocus
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Máximo: ${formatearMoneda(venta.pendiente || 0)}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={cerrarAbono}
                      className="flex-1 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={procesarAbono}
                      disabled={!montoAbono || parseFloat(montoAbono) <= 0}
                      className="flex-1 px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition"
                    >
                      Registrar Abono
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
