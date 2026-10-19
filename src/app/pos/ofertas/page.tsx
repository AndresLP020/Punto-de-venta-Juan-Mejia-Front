'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getOfertas,
  postOferta,
  putOferta,
  deleteOferta,
  getProductos,
  type Oferta,
  type Producto,
} from '@/lib/api';
import { formatearMoneda } from '@/lib/utils';
import { useAdminMode } from '@/contexts/AdminModeContext';

const formInitial = {
  titulo: '',
  descripcion: '',
  imagen: '',
  precioNormal: '',
  precioOferta: '',
  productos: [] as string[],
  activa: true,
  fechaInicio: '',
  fechaFin: '',
};

const MAX_IMG_BYTES = 1_500_000; // ~1.5 MB

function archivoADataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function OfertasAdminPage() {
  const { isAdminMode } = useAdminMode() ?? { isAdminMode: false };
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState(formInitial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [busquedaProd, setBusquedaProd] = useState('');

  const cargar = useCallback(() => {
    setLoading(true);
    Promise.all([getOfertas(false), getProductos()])
      .then(([o, p]) => {
        setOfertas(o);
        setProductos(p);
      })
      .catch(() => {
        setOfertas([]);
        setProductos([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirNuevo = () => {
    setEditandoId(null);
    setForm(formInitial);
    setError('');
    setModalAbierto(true);
  };

  const abrirEditar = (o: Oferta) => {
    setEditandoId(o.id);
    setForm({
      titulo: o.titulo || '',
      descripcion: o.descripcion || '',
      imagen: o.imagen || '',
      precioNormal: o.precioNormal ? String(o.precioNormal) : '',
      precioOferta: o.precioOferta ? String(o.precioOferta) : '',
      productos: o.productos || [],
      activa: o.activa ?? true,
      fechaInicio: o.fechaInicio ? o.fechaInicio.slice(0, 10) : '',
      fechaFin: o.fechaFin ? o.fechaFin.slice(0, 10) : '',
    });
    setError('');
    setModalAbierto(true);
  };

  const cerrar = () => {
    setModalAbierto(false);
    setEditandoId(null);
    setError('');
    setBusquedaProd('');
  };

  const onImagen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMG_BYTES) {
      setError('La imagen es muy grande (máx. 1.5 MB). Usa una imagen más liviana.');
      return;
    }
    try {
      const dataUrl = await archivoADataURL(file);
      setForm((f) => ({ ...f, imagen: dataUrl }));
      setError('');
    } catch {
      setError('No se pudo leer la imagen');
    }
  };

  const toggleProducto = (nombre: string) => {
    setForm((f) => ({
      ...f,
      productos: f.productos.includes(nombre)
        ? f.productos.filter((n) => n !== nombre)
        : [...f.productos, nombre],
    }));
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const titulo = form.titulo.trim();
    if (!titulo) {
      setError('El título es obligatorio');
      return;
    }
    const payload = {
      titulo,
      descripcion: form.descripcion.trim(),
      imagen: form.imagen,
      precioNormal: form.precioNormal ? parseFloat(form.precioNormal) : 0,
      precioOferta: form.precioOferta ? parseFloat(form.precioOferta) : 0,
      productos: form.productos,
      activa: form.activa,
      fechaInicio: form.fechaInicio || '',
      fechaFin: form.fechaFin || '',
    };
    setGuardando(true);
    try {
      if (editandoId) await putOferta(editandoId, payload);
      else await postOferta(payload);
      cargar();
      cerrar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar la oferta');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (o: Oferta) => {
    if (!confirm(`¿Eliminar la oferta "${o.titulo}"?`)) return;
    try {
      await deleteOferta(o.id);
      cargar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const cambiarActiva = async (o: Oferta) => {
    try {
      await putOferta(o.id, { activa: !o.activa });
      cargar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al actualizar');
    }
  };

  return (
    <div className="flex flex-col h-full text-white">
      {/* Header */}
      <div className="px-2 sm:px-0 pb-4 border-b border-slate-700 mb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Ofertas y promociones</h1>
            <p className="text-slate-400 text-sm">
              {ofertas.length} {ofertas.length === 1 ? 'oferta' : 'ofertas'} · se muestran en la página promocional
            </p>
          </div>
          {isAdminMode && (
            <button
              onClick={abrirNuevo}
              className="px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold flex items-center gap-2 transition text-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nueva oferta
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="text-center py-12 text-slate-400">Cargando ofertas…</div>
        ) : ofertas.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-5 5a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <p className="text-slate-400 text-lg">No hay ofertas todavía</p>
            {isAdminMode && (
              <button onClick={abrirNuevo} className="mt-4 px-4 py-2.5 rounded-xl bg-amber-500 text-slate-900 text-sm font-semibold hover:bg-amber-600">
                Crear primera oferta
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ofertas.map((o) => {
              const tieneDescuento = (o.precioNormal ?? 0) > 0 && (o.precioOferta ?? 0) > 0 && o.precioOferta! < o.precioNormal!;
              const pct = tieneDescuento ? Math.round((1 - o.precioOferta! / o.precioNormal!) * 100) : 0;
              return (
                <div key={o.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col">
                  <div className="relative h-40 bg-slate-900/60">
                    {o.imagen ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.imagen} alt={o.titulo} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 6h16v12H4z" />
                        </svg>
                      </div>
                    )}
                    {tieneDescuento && (
                      <span className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-red-600 text-white text-sm font-extrabold">-{pct}%</span>
                    )}
                    <span className={`absolute top-2 right-2 px-2.5 py-1 rounded-full text-xs font-bold ${o.activa ? 'bg-green-500/90 text-white' : 'bg-slate-600 text-slate-200'}`}>
                      {o.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-bold text-white">{o.titulo}</h3>
                    {o.descripcion && <p className="text-sm text-slate-400 mt-1 line-clamp-2">{o.descripcion}</p>}
                    {o.productos && o.productos.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {o.productos.slice(0, 4).map((p, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-violet-500/15 text-violet-200 text-xs border border-violet-500/20">{p}</span>
                        ))}
                        {o.productos.length > 4 && <span className="text-xs text-slate-500">+{o.productos.length - 4}</span>}
                      </div>
                    )}
                    {(o.precioOferta ?? 0) > 0 && (
                      <div className="mt-3 flex items-end gap-2">
                        <span className="text-xl font-extrabold text-amber-400">${formatearMoneda(o.precioOferta!)}</span>
                        {tieneDescuento && <span className="text-sm text-slate-500 line-through mb-0.5">${formatearMoneda(o.precioNormal!)}</span>}
                      </div>
                    )}
                    <div className="mt-auto pt-3 flex items-center gap-2 border-t border-slate-700/60 mt-3">
                      <button onClick={() => cambiarActiva(o)} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition">
                        {o.activa ? 'Desactivar' : 'Activar'}
                      </button>
                      <button onClick={() => abrirEditar(o)} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-violet-600/80 hover:bg-violet-600 text-white transition">
                        Editar
                      </button>
                      <button onClick={() => eliminar(o)} className="ml-auto text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 transition">
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={cerrar}>
          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800 z-10">
              <h2 className="text-lg font-semibold text-white">{editandoId ? 'Editar oferta' : 'Nueva oferta'}</h2>
              <button onClick={cerrar} className="text-slate-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={guardar} className="p-6 space-y-4">
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Título *</label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ej. 2x1 en playeras de entrenamiento"
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Descripción</label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Describe la promoción…"
                  rows={3}
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Imagen</label>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-20 rounded-xl bg-slate-900/60 border border-slate-600 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {form.imagen ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={form.imagen} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 6h16v12H4z" /></svg>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input type="file" accept="image/*" onChange={onImagen} className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-amber-500 file:text-slate-900 file:font-semibold file:cursor-pointer hover:file:bg-amber-600" />
                    <input
                      type="text"
                      value={form.imagen.startsWith('data:') ? '' : form.imagen}
                      onChange={(e) => setForm((f) => ({ ...f, imagen: e.target.value }))}
                      placeholder="…o pega una URL de imagen"
                      className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                    {form.imagen && (
                      <button type="button" onClick={() => setForm((f) => ({ ...f, imagen: '' }))} className="text-xs text-red-300 hover:text-red-200">Quitar imagen</button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-sm font-medium mb-1">Precio normal</label>
                  <input type="number" step="0.01" min="0" value={form.precioNormal} onChange={(e) => setForm((f) => ({ ...f, precioNormal: e.target.value }))} placeholder="0.00" className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm font-medium mb-1">Precio oferta</label>
                  <input type="number" step="0.01" min="0" value={form.precioOferta} onChange={(e) => setForm((f) => ({ ...f, precioOferta: e.target.value }))} placeholder="0.00" className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">
                  Productos incluidos
                  {form.productos.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-amber-400">({form.productos.length} seleccionado{form.productos.length === 1 ? '' : 's'})</span>
                  )}
                </label>
                {productos.length > 0 && (
                  <div className="relative mb-2">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={busquedaProd}
                      onChange={(e) => setBusquedaProd(e.target.value)}
                      placeholder="Buscar producto…"
                      className="w-full pl-9 pr-9 py-2 rounded-lg bg-slate-700 border border-slate-600 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                    {busquedaProd && (
                      <button type="button" onClick={() => setBusquedaProd('')} className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-600 hover:text-white transition" aria-label="Limpiar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                )}
                <div className="max-h-40 overflow-y-auto rounded-xl bg-slate-900/50 border border-slate-600 p-2 space-y-1 scrollbar-thin">
                  {productos.length === 0 ? (
                    <p className="text-slate-500 text-sm px-2 py-1">No hay productos. Agrégalos en la sección Productos.</p>
                  ) : (() => {
                    const q = busquedaProd.trim().toLowerCase();
                    const lista = q
                      ? productos.filter((p) => p.nombre.toLowerCase().includes(q) || (p.categoria || '').toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q))
                      : productos;
                    if (lista.length === 0) {
                      return <p className="text-slate-500 text-sm px-2 py-3 text-center">Sin resultados para “{busquedaProd.trim()}”</p>;
                    }
                    return lista.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-700/50 cursor-pointer">
                        <input type="checkbox" checked={form.productos.includes(p.nombre)} onChange={() => toggleProducto(p.nombre)} className="rounded border-slate-500 text-amber-500 focus:ring-amber-500" />
                        <span className="text-sm text-slate-200">{p.nombre}</span>
                        <span className="ml-auto text-xs text-slate-500">${formatearMoneda(p.precio)}</span>
                      </label>
                    ));
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-sm font-medium mb-1">Válida desde</label>
                  <input type="date" value={form.fechaInicio} onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))} className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm font-medium mb-1">Válida hasta</label>
                  <input type="date" value={form.fechaFin} onChange={(e) => setForm((f) => ({ ...f, fechaFin: e.target.value }))} className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.activa} onChange={(e) => setForm((f) => ({ ...f, activa: e.target.checked }))} className="rounded border-slate-500 text-green-500 focus:ring-green-500" />
                <span className="text-slate-300 text-sm font-medium">Oferta activa (visible en la página promocional)</span>
              </label>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={cerrar} className="flex-1 py-2.5 rounded-xl bg-slate-700 text-slate-300 font-medium hover:bg-slate-600 transition">Cancelar</button>
                <button type="submit" disabled={guardando} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-600 transition disabled:opacity-50">
                  {guardando ? 'Guardando…' : editandoId ? 'Actualizar' : 'Crear oferta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
