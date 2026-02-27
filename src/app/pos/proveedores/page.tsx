'use client';

import { useEffect, useState } from 'react';
import { getProveedores, getProductos, postProveedor, putProveedor, deleteProveedor, type Proveedor } from '@/lib/api';

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productosPorProveedor, setProductosPorProveedor] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Proveedor | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [form, setForm] = useState({ nombre: '', telefono: '', email: '', direccion: '' });

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [prov, prods] = await Promise.all([getProveedores(), getProductos()]);
      setProveedores(prov);
      const cuenta: Record<number, number> = {};
      (prods as { proveedorId?: number }[]).forEach((p) => {
        if (p.proveedorId != null) {
          cuenta[p.proveedorId] = (cuenta[p.proveedorId] || 0) + 1;
        }
      });
      setProductosPorProveedor(cuenta);
    } catch {
      setProveedores([]);
      setProductosPorProveedor({});
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
            {filtrados.map((p) => (
              <div key={p.id} className="bg-slate-800 rounded-xl border border-slate-700 p-5 hover:border-slate-600 transition">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-white text-lg">{p.nombre}</h3>
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
                <div className="space-y-1 text-sm text-slate-400">
                  {p.telefono && <p>Tel: {p.telefono}</p>}
                  {p.email && <p>{p.email}</p>}
                  {p.direccion && <p>{p.direccion}</p>}
                </div>
                <div className="mt-4 pt-3 border-t border-slate-700">
                  <p className="text-xs text-slate-500">Productos que surte</p>
                  <p className="text-lg font-bold text-green-400">{productosPorProveedor[p.id] ?? 0}</p>
                </div>
              </div>
            ))}
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
    </div>
  );
}
