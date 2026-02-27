'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import {
  getUsuarios,
  postUsuario,
  putUsuario,
  deleteUsuario,
  type Usuario,
  type PermisosPOS,
} from '@/lib/api';

const permisosDefault: PermisosPOS = {
  hacerVentas: true,
  darDeBajaProductos: false,
  actualizarProductos: true,
  borrarProductos: false,
};

export default function ConfiguracionPage() {
  const { theme, setTheme } = useTheme();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalUsuario, setModalUsuario] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    email: '',
    password: '',
    nombre: '',
    telefono: '',
    permisos: { ...permisosDefault },
  });
  const [error, setError] = useState('');

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const u = await getUsuarios();
      setUsuarios(u);
    } catch {
      setUsuarios([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const abrirModal = (u?: Usuario) => {
    setError('');
    if (u) {
      setEditingId(u.id);
      setForm({
        email: u.email,
        password: '',
        nombre: u.nombre,
        telefono: u.telefono || '',
        permisos: { ...u.permisos },
      });
    } else {
      setEditingId(null);
      setForm({
        email: '',
        password: '',
        nombre: '',
        telefono: '',
        permisos: { ...permisosDefault },
      });
    }
    setModalUsuario(true);
  };

  const cerrarModal = () => {
    setModalUsuario(false);
    setEditingId(null);
    setError('');
  };

  const guardarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.email.trim()) {
      setError('El correo es obligatorio');
      return;
    }
    if (!editingId && !form.password) {
      setError('La contraseña es obligatoria para nuevos usuarios');
      return;
    }
    try {
      if (editingId) {
        await putUsuario(editingId, {
          email: form.email.trim(),
          ...(form.password ? { password: form.password } : undefined),
          nombre: form.nombre.trim(),
          telefono: form.telefono.trim() || undefined,
          permisos: form.permisos,
        });
      } else {
        await postUsuario({
          email: form.email.trim(),
          password: form.password,
          nombre: form.nombre.trim(),
          telefono: form.telefono.trim() || undefined,
          permisos: form.permisos,
        });
      }
      await cargarDatos();
      cerrarModal();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  const eliminarUsuario = async (id: number) => {
    if (!confirm('¿Eliminar este usuario?')) return;
    try {
      await deleteUsuario(id);
      await cargarDatos();
    } catch (err) {
      console.error(err);
    }
  };

  const togglePermiso = (key: keyof PermisosPOS) => {
    setForm((f) => ({
      ...f,
      permisos: { ...f.permisos, [key]: !f.permisos[key] },
    }));
  };

  return (
    <div className="flex flex-col min-h-full text-white">
      <header className="sticky top-0 z-10 px-6 py-4 border-b border-slate-700/80 bg-slate-900/90 backdrop-blur-sm">
        <h1 className="text-xl font-bold tracking-tight text-white">Configuración</h1>
        <p className="text-slate-400 text-sm mt-0.5">Usuarios, permisos y apariencia</p>
      </header>

      <div className="flex-1 p-6 space-y-8">
        {/* Apariencia - Modo oscuro */}
        <section className="rounded-2xl bg-slate-800/80 border border-slate-700/80 p-6 shadow-elevated">
          <h2 className="text-lg font-semibold text-white mb-1">Apariencia</h2>
          <p className="text-slate-400 text-sm mb-4">Activa o desactiva el modo oscuro de la página.</p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              role="switch"
              aria-checked={theme === 'dark'}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-800 ${
                theme === 'dark' ? 'bg-emerald-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition ${
                  theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm font-medium text-white">
              Modo oscuro {theme === 'dark' ? 'activado' : 'desactivado'}
            </span>
          </div>
        </section>

        {/* Usuarios */}
        <section className="rounded-2xl bg-slate-800/80 border border-slate-700/80 overflow-hidden shadow-elevated">
          <div className="px-6 py-4 border-b border-slate-700/80 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Usuarios del sistema</h2>
              <p className="text-slate-400 text-sm mt-0.5">Correo, contraseña, nombre, teléfono y permisos sobre el punto de venta</p>
            </div>
            <button
              onClick={() => abrirModal()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Agregar usuario
            </button>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-400">Cargando usuarios…</div>
          ) : usuarios.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <p className="font-medium">No hay usuarios agregados.</p>
              <p className="text-sm mt-1">Agrega usuarios para gestionar permisos en el punto de venta.</p>
              <button onClick={() => abrirModal()} className="mt-4 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600">
                Agregar usuario
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800">
                    <th className="text-left text-slate-400 font-semibold px-6 py-4">Nombre</th>
                    <th className="text-left text-slate-400 font-semibold px-6 py-4">Correo</th>
                    <th className="text-left text-slate-400 font-semibold px-6 py-4">Teléfono</th>
                    <th className="text-left text-slate-400 font-semibold px-6 py-4">Permisos</th>
                    <th className="text-right text-slate-400 font-semibold px-6 py-4 w-28">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                      <td className="px-6 py-3 text-white font-medium">{u.nombre || '—'}</td>
                      <td className="px-6 py-3 text-slate-300">{u.email}</td>
                      <td className="px-6 py-3 text-slate-400">{u.telefono || '—'}</td>
                      <td className="px-6 py-3">
                        <span className="flex flex-wrap gap-1">
                          {u.permisos.hacerVentas && <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs">Ventas</span>}
                          {u.permisos.darDeBajaProductos && <span className="px-2 py-0.5 rounded bg-slate-500/20 text-slate-400 text-xs">Dar de baja</span>}
                          {u.permisos.actualizarProductos && <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-xs">Actualizar prod.</span>}
                          {u.permisos.borrarProductos && <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs">Borrar prod.</span>}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button onClick={() => abrirModal(u)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-600 hover:text-white mr-1" title="Editar">✎</button>
                        <button onClick={() => eliminarUsuario(u.id)} className="p-2 rounded-lg text-slate-400 hover:bg-red-500/20 hover:text-red-400" title="Eliminar">🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Modal usuario */}
      {modalUsuario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={cerrarModal}>
          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-elevated-lg w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">{editingId ? 'Editar usuario' : 'Agregar usuario'}</h2>
            </div>
            <form onSubmit={guardarUsuario} className="p-6 space-y-4">
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Correo *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">
                  Contraseña {editingId ? '(dejar en blanco para no cambiar)' : '*'}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder={editingId ? '••••••••' : ''}
                  required={!editingId}
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Nombre</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-2">Permisos en el punto de venta</label>
                <div className="flex flex-wrap gap-4">
                  {(
                    [
                      { key: 'hacerVentas' as const, label: 'Hacer ventas' },
                      { key: 'darDeBajaProductos' as const, label: 'Dar de baja productos' },
                      { key: 'actualizarProductos' as const, label: 'Actualizar productos' },
                      { key: 'borrarProductos' as const, label: 'Borrar productos' },
                    ] as const
                  ).map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.permisos[key]}
                        onChange={() => togglePermiso(key)}
                        className="rounded border-slate-500 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-white">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={cerrarModal} className="flex-1 py-2.5 rounded-xl bg-slate-700 text-slate-300 font-medium hover:bg-slate-600">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600">
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
