'use client';

import { useEffect, useState } from 'react';
import { getClientes, getVentas, postCliente, putCliente, deleteCliente, type Cliente } from '@/lib/api';
import { formatearMoneda, formatearCantidad } from '@/lib/utils';
import { useAdminMode } from '@/contexts/AdminModeContext';

type Venta = {
  id: number;
  clienteId?: number;
  cliente?: string;
  total: number;
  fecha: string;
};

type ClienteConEstadisticas = Cliente & {
  totalCompras: number;
  cantidadVentas: number;
  ultimaCompra?: string;
};

export default function ClientesPage() {
  const { isAdminMode } = useAdminMode() ?? { isAdminMode: false };
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [clientesConStats, setClientesConStats] = useState<ClienteConEstadisticas[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [ordenarPor, setOrdenarPor] = useState<'compras' | 'ventas' | 'nombre'>('compras');

  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    email: '',
    direccion: '',
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [c, v] = await Promise.all([getClientes(), getVentas()]);
      setClientes(c);
      setVentas(v);
    } catch {
      setClientes([]);
      setVentas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Calcular estadísticas por cliente
    const stats = new Map<number, { totalCompras: number; cantidadVentas: number; ultimaCompra?: string }>();

    ventas.forEach((venta) => {
      if (venta.clienteId) {
        const actual = stats.get(venta.clienteId) || { totalCompras: 0, cantidadVentas: 0 };
        actual.totalCompras += venta.total || 0;
        actual.cantidadVentas += 1;
        if (!actual.ultimaCompra || venta.fecha > actual.ultimaCompra) {
          actual.ultimaCompra = venta.fecha;
        }
        stats.set(venta.clienteId, actual);
      }
    });

    const clientesConEstadisticas: ClienteConEstadisticas[] = clientes.map((cliente) => {
      const estadisticas = stats.get(cliente.id) || { totalCompras: 0, cantidadVentas: 0 };
      return {
        ...cliente,
        ...estadisticas,
      };
    });

    // Ordenar
    clientesConEstadisticas.sort((a, b) => {
      if (ordenarPor === 'compras') {
        return b.totalCompras - a.totalCompras;
      } else if (ordenarPor === 'ventas') {
        return b.cantidadVentas - a.cantidadVentas;
      } else {
        return a.nombre.localeCompare(b.nombre);
      }
    });

    // Filtrar por búsqueda
    const filtrados = busqueda.trim()
      ? clientesConEstadisticas.filter(
          (c) =>
            c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
            c.telefono?.toLowerCase().includes(busqueda.toLowerCase()) ||
            c.email?.toLowerCase().includes(busqueda.toLowerCase())
        )
      : clientesConEstadisticas;

    setClientesConStats(filtrados);
  }, [clientes, ventas, ordenarPor, busqueda]);

  const abrirFormulario = (cliente?: Cliente) => {
    if (cliente) {
      setClienteEditando(cliente);
      setFormData({
        nombre: cliente.nombre,
        telefono: cliente.telefono || '',
        email: cliente.email || '',
        direccion: cliente.direccion || '',
      });
    } else {
      setClienteEditando(null);
      setFormData({ nombre: '', telefono: '', email: '', direccion: '' });
    }
    setMostrarFormulario(true);
  };

  const cerrarFormulario = () => {
    setMostrarFormulario(false);
    setClienteEditando(null);
    setFormData({ nombre: '', telefono: '', email: '', direccion: '' });
  };

  const guardarCliente = async () => {
    if (!formData.nombre.trim()) {
      alert('El nombre es requerido');
      return;
    }

    try {
      if (clienteEditando) {
        await putCliente(clienteEditando.id, formData);
      } else {
        await postCliente(formData);
      }
      await cargarDatos();
      cerrarFormulario();
    } catch (error) {
      alert('Error al guardar el cliente');
      console.error(error);
    }
  };

  const eliminarCliente = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este cliente?')) return;

    try {
      await deleteCliente(id);
      await cargarDatos();
    } catch (error) {
      alert('Error al eliminar el cliente');
      console.error(error);
    }
  };

  const formatearFecha = (f?: string) => {
    if (!f) return 'Nunca';
    return new Date(f).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="flex flex-col h-full text-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Gestión de Clientes</h1>
            <p className="text-slate-400 text-sm">Administra tu base de clientes y sus compras</p>
          </div>
          <button
            onClick={() => abrirFormulario()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Controles */}
      <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/30 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[250px]">
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
        <div className="flex items-center gap-2">
          <span className="text-slate-300 text-sm">Ordenar por:</span>
          <select
            value={ordenarPor}
            onChange={(e) => setOrdenarPor(e.target.value as 'compras' | 'ventas' | 'nombre')}
            className="px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="compras">Total de Compras</option>
            <option value="ventas">Cantidad de Ventas</option>
            <option value="nombre">Nombre</option>
          </select>
        </div>
      </div>

      {/* Lista de clientes */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-center py-12 text-slate-400">Cargando clientes…</div>
        ) : clientesConStats.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-slate-400 text-lg">No hay clientes registrados</p>
            <p className="text-slate-500 text-sm mt-1">Comienza agregando tu primer cliente</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {clientesConStats.map((cliente) => {
              const esTopCliente = ordenarPor === 'compras' && clientesConStats[0]?.id === cliente.id;
              return (
                <div
                  key={cliente.id}
                  className={`bg-slate-800 rounded-xl border ${
                    esTopCliente ? 'border-green-500/50 bg-green-500/5' : 'border-slate-700'
                  } overflow-hidden hover:border-slate-600 transition`}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-bold text-white">{cliente.nombre}</h3>
                          {esTopCliente && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500 text-white">
                              Mejor Cliente
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 text-sm text-slate-400">
                          {cliente.telefono && (
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              {cliente.telefono}
                            </div>
                          )}
                          {cliente.email && (
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              {cliente.email}
                            </div>
                          )}
                          {cliente.direccion && (
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {cliente.direccion}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => abrirFormulario(cliente)}
                          className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
                          title="Editar"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => eliminarCliente(cliente.id)}
                          className="p-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 transition"
                          title="Eliminar"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Estadísticas */}
                    <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-700">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Total Compras</p>
                        <p className="text-lg font-bold text-green-400">
                          {isAdminMode ? `$${formatearMoneda(cliente.totalCompras)}` : '••••••'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Ventas</p>
                        <p className="text-lg font-bold text-white">{formatearCantidad(cliente.cantidadVentas)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Última Compra</p>
                        <p className="text-sm font-medium text-slate-300">{formatearFecha(cliente.ultimaCompra)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de formulario */}
      {mostrarFormulario && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">
                {clienteEditando ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h2>
              <button
                onClick={cerrarFormulario}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Nombre <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Nombre completo"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Teléfono</label>
                <input
                  type="tel"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="555-1234"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="cliente@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Dirección</label>
                <textarea
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  placeholder="Dirección completa"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={cerrarFormulario}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={guardarCliente}
                className="flex-1 px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium transition"
              >
                {clienteEditando ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
