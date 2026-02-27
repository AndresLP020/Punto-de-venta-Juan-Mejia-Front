'use client';

import { useEffect, useState, useCallback } from 'react';
import { getProductos, getCategorias, getProveedores, postCategoria, deleteCategoria, postProducto, putProducto, deleteProducto, type Producto, type Proveedor } from '@/lib/api';
import { formatearMoneda, formatearCantidad } from '@/lib/utils';
import { useAdminMode } from '@/contexts/AdminModeContext';

const formInitial = {
  nombre: '',
  codigo: '',
  categoria: '',
  precio: '',
  costo: '',
  stock: '',
  stockMinimo: '',
  estado: 'Activo',
  esGranel: false,
  proveedorId: '' as string | number,
};

const redondearPrecio = (n: number) => Math.round(n * 100) / 100;

export default function ProductosPage() {
  const { isAdminMode } = useAdminMode() ?? { isAdminMode: false };
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas las categorías');
  const [proveedorFiltro, setProveedorFiltro] = useState<number | ''>('');
  const [vista, setVista] = useState<'tabla' | 'cards'>('tabla');
  const [ordenarPor, setOrdenarPor] = useState<'nombre' | 'precio' | 'stock' | 'categoria'>('nombre');
  const [ordenAscendente, setOrdenAscendente] = useState(true);
  const [filtroStockBajo, setFiltroStockBajo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState(formInitial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [creandoCategoria, setCreandoCategoria] = useState(false);

  const cargarDatos = useCallback(() => {
    setLoading(true);
    Promise.all([getProductos(), getCategorias(), getProveedores()])
      .then(([p, c, prov]) => {
        setProductos(p);
        setCategorias(c);
        setProveedores(prov);
      })
      .catch(() => {
        setProductos([]);
        setCategorias([]);
        setProveedores([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const abrirModalNuevo = () => {
    setEditandoId(null);
    setForm(formInitial);
    setError('');
    setModalAbierto(true);
  };

  const abrirModalEditar = (p: Producto) => {
    setEditandoId(p.id);
    setForm({
      nombre: p.nombre,
      codigo: p.codigo || '',
      categoria: p.categoria,
      precio: String(redondearPrecio(p.precio)),
      costo: p.costo != null ? String(redondearPrecio(p.costo)) : '',
      stock: String(p.stock),
      stockMinimo: p.stockMinimo != null ? String(p.stockMinimo) : '',
      estado: p.estado || 'Activo',
      esGranel: Boolean(p.esGranel),
      proveedorId: p.proveedorId ?? '',
    });
    setError('');
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setEditandoId(null);
    setError('');
  };

  const guardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const nombre = form.nombre.trim();
    const precio = parseFloat(form.precio);
    const categoria = form.categoria.trim() || (categorias[0] ?? 'General');
    if (!nombre) {
      setError('El nombre es obligatorio');
      return;
    }
    if (Number.isNaN(precio) || precio < 0) {
      setError('Precio venta debe ser un número mayor o igual a 0');
      return;
    }
    const costoNum = form.costo ? parseFloat(form.costo) : undefined;
    const stockNum = form.stock ? (form.esGranel ? parseFloat(form.stock) : parseInt(form.stock, 10)) : 0;
    const stockMinNum = form.stockMinimo ? (form.esGranel ? parseFloat(form.stockMinimo) : parseInt(form.stockMinimo, 10)) : undefined;
    const proveedorIdNum = form.proveedorId === '' || form.proveedorId == null ? undefined : Number(form.proveedorId);
    const payload = {
      nombre,
      codigo: form.codigo.trim() || undefined,
      categoria,
      precio: redondearPrecio(precio),
      costo: costoNum != null ? redondearPrecio(costoNum) : undefined,
      stock: form.esGranel ? redondearPrecio(stockNum) : Math.max(0, Math.floor(stockNum)),
      stockMinimo: stockMinNum != null ? (form.esGranel ? redondearPrecio(stockMinNum) : Math.max(0, Math.floor(stockMinNum))) : undefined,
      estado: form.estado,
      esGranel: Boolean(form.esGranel),
      proveedorId: proveedorIdNum,
    };
    setGuardando(true);
    try {
      if (editandoId) {
        await putProducto(editandoId, { ...payload, proveedorId: proveedorIdNum ?? null });
      } else {
        await postProducto({
          ...payload,
          nombre,
          categoria,
          precio: payload.precio,
          stock: payload.stock ?? 0,
        });
      }
      cargarDatos();
      cerrarModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const eliminarProducto = async (p: Producto) => {
    if (!confirm(`¿Eliminar el producto "${p.nombre}"?`)) return;
    try {
      await deleteProducto(p.id);
      cargarDatos();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const crearCategoria = async () => {
    const name = nuevaCategoria.trim();
    if (!name) return;
    setCreandoCategoria(true);
    try {
      const list = await postCategoria(name);
      setCategorias(list);
      setForm((f) => ({ ...f, categoria: name }));
      setNuevaCategoria('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear categoría');
    } finally {
      setCreandoCategoria(false);
    }
  };

  const eliminarCategoriaActual = async () => {
    const cat = form.categoria.trim();
    if (!cat) return;
    if (!confirm(`¿Eliminar la categoría "${cat}"? Los productos que la usen quedarán con ese nombre hasta que los edites.`)) return;
    try {
      const list = await deleteCategoria(cat);
      setCategorias(list);
      setForm((f) => ({ ...f, categoria: list[0] ?? '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar categoría');
    }
  };

  const productosFiltrados = productos
    .filter((p) => {
      const coincideBusqueda =
        !busqueda.trim() ||
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.codigo?.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.categoria.toLowerCase().includes(busqueda.toLowerCase());
      const coincideCategoria =
        categoriaFiltro === 'Todas las categorías' || p.categoria === categoriaFiltro;
      const coincideProveedor = proveedorFiltro === '' || p.proveedorId === proveedorFiltro;
      const coincideStockBajo = !filtroStockBajo || p.stock <= (p.stockMinimo || 0);
      return coincideBusqueda && coincideCategoria && coincideProveedor && coincideStockBajo;
    })
    .sort((a, b) => {
      let comparacion = 0;
      switch (ordenarPor) {
        case 'nombre':
          comparacion = a.nombre.localeCompare(b.nombre);
          break;
        case 'precio':
          comparacion = a.precio - b.precio;
          break;
        case 'stock':
          comparacion = a.stock - b.stock;
          break;
        case 'categoria':
          comparacion = a.categoria.localeCompare(b.categoria);
          break;
      }
      return ordenAscendente ? comparacion : -comparacion;
    });

  const getEstadoStock = (stock: number, stockMinimo: number = 0) => {
    if (stock <= stockMinimo) return { texto: 'Stock Bajo', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' };
    if (stock <= stockMinimo * 2) return { texto: 'Stock Normal', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' };
    return { texto: 'Stock Normal', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' };
  };

  const estadisticas = {
    total: productos.length,
    activos: productos.filter((p) => (p.estado || 'Activo') === 'Activo').length,
    stockBajo: productos.filter((p) => p.stock <= (p.stockMinimo || 0)).length,
    valorInventario: productos.reduce((sum, p) => sum + (p.costo || 0) * p.stock, 0),
    valorVenta: productos.reduce((sum, p) => sum + p.precio * p.stock, 0),
  };

  return (
    <div className="flex flex-col h-full text-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Gestión de Productos</h1>
            <p className="text-slate-400 text-sm">
              {productosFiltrados.length} {productosFiltrados.length === 1 ? 'producto encontrado' : 'productos encontrados'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVista('tabla')}
              className={`p-2 rounded-lg transition ${
                vista === 'tabla' ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
              title="Vista de tabla"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={() => setVista('cards')}
              className={`p-2 rounded-lg transition ${
                vista === 'cards' ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
              title="Vista de tarjetas"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/30">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <p className="text-xs text-slate-400 mb-1">Total Productos</p>
            <p className="text-xl font-bold text-white">{estadisticas.total}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <p className="text-xs text-slate-400 mb-1">Activos</p>
            <p className="text-xl font-bold text-green-400">{estadisticas.activos}</p>
          </div>
          <button
            type="button"
            onClick={() => setFiltroStockBajo((prev) => !prev)}
            className={`bg-slate-800/50 rounded-lg p-3 border text-left transition hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-red-500/50 ${
              filtroStockBajo ? 'border-red-500 ring-2 ring-red-500/50' : 'border-slate-700'
            }`}
          >
            <p className="text-xs text-slate-400 mb-1">Stock Bajo</p>
            <p className="text-xl font-bold text-red-400">{estadisticas.stockBajo}</p>
            {filtroStockBajo && (
              <p className="text-xs text-red-400 mt-1">Mostrando solo con stock bajo</p>
            )}
          </button>
          {isAdminMode && (
            <>
              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                <p className="text-xs text-slate-400 mb-1">Valor Inventario</p>
                <p className="text-lg font-bold text-blue-400">${formatearMoneda(estadisticas.valorInventario)}</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                <p className="text-xs text-slate-400 mb-1">Valor Venta</p>
                <p className="text-lg font-bold text-purple-400">${formatearMoneda(estadisticas.valorVenta)}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Controles */}
      <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/30 flex flex-wrap items-center gap-4">
        {/* Búsqueda */}
        <div className="flex-1 min-w-[250px]">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar productos..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Filtro de categorías */}
        <div className="relative">
          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="pl-10 pr-8 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 appearance-none cursor-pointer"
          >
            <option>Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </div>

        {/* Filtro por proveedor */}
        <select
          value={proveedorFiltro === '' ? '' : proveedorFiltro}
          onChange={(e) => setProveedorFiltro(e.target.value === '' ? '' : Number(e.target.value))}
          className="px-4 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">Todos los proveedores</option>
          {proveedores.map((pr) => (
            <option key={pr.id} value={pr.id}>
              {pr.nombre}
            </option>
          ))}
        </select>

        {/* Ordenamiento */}
        <div className="flex items-center gap-2">
          <span className="text-slate-300 text-sm">Ordenar:</span>
          <select
            value={ordenarPor}
            onChange={(e) => setOrdenarPor(e.target.value as any)}
            className="px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="nombre">Nombre</option>
            <option value="precio">Precio</option>
            <option value="stock">Stock</option>
            <option value="categoria">Categoría</option>
          </select>
          <button
            onClick={() => setOrdenAscendente(!ordenAscendente)}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
            title={ordenAscendente ? 'Ascendente' : 'Descendente'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {ordenAscendente ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              )}
            </svg>
          </button>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-2">
          <button className="px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 flex items-center gap-2 transition text-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar
          </button>
          <button className="px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 flex items-center gap-2 transition text-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Importar
          </button>
          {isAdminMode && (
            <button
              onClick={abrirModalNuevo}
              className="px-4 py-2.5 rounded-lg bg-green-500 hover:bg-green-600 text-white flex items-center gap-2 transition text-sm font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Agregar producto
            </button>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-center py-12 text-slate-400">Cargando productos...</div>
        ) : productosFiltrados.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-slate-400 text-lg">No hay productos para mostrar</p>
            <p className="text-slate-500 text-sm mt-1">
              {productos.length === 0 ? 'Agrega tu primer producto con el botón superior.' : 'Intenta ajustar los filtros de búsqueda.'}
            </p>
            {productos.length === 0 && isAdminMode && (
              <button onClick={abrirModalNuevo} className="mt-4 px-4 py-2.5 rounded-xl bg-green-500 text-white text-sm font-medium hover:bg-green-600">
                Agregar producto
              </button>
            )}
          </div>
        ) : vista === 'tabla' ? (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/50">
                    <th className="text-left py-4 px-6 text-sm font-semibold text-slate-300">PRODUCTO</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-slate-300">CÓDIGO</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-slate-300">CATEGORÍA</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-slate-300">PROVEEDOR</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-300">PRECIO</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-300">COSTO</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-300">STOCK</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-slate-300">ESTADO</th>
                    {isAdminMode && <th className="text-right py-4 px-6 text-sm font-semibold text-slate-300">ACCIONES</th>}
                  </tr>
                </thead>
                <tbody>
                  {productosFiltrados.map((p) => {
                    const estadoStock = getEstadoStock(p.stock, p.stockMinimo);
                    const margenGanancia = p.costo ? ((p.precio - p.costo) / p.costo * 100) : 0;
                    return (
                      <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition">
                        <td className="py-4 px-6">
                          <div className="font-medium text-white">{p.nombre}</div>
                          {p.codigo && <div className="text-xs text-slate-400 mt-0.5">Código: {p.codigo}</div>}
                          {p.esGranel && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">A granel</span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-slate-300 font-mono text-sm">{p.codigo || '-'}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                            {p.categoria}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-slate-300 text-sm">
                          {proveedores.find((pr) => pr.id === p.proveedorId)?.nombre ?? '-'}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="text-white font-semibold">${formatearMoneda(redondearPrecio(p.precio))}{p.esGranel && <span className="text-slate-400 font-normal text-xs">/kg</span>}</div>
                          {margenGanancia > 0 && (
                            <div className="text-xs text-green-400 mt-0.5">{formatearCantidad(margenGanancia, 1)}% ganancia</div>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right text-slate-400">
                          ${formatearMoneda(redondearPrecio(p.costo || 0))}{p.esGranel && <span className="text-xs">/kg</span>}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className={`inline-flex items-center gap-2 px-2 py-1 rounded ${estadoStock.bg} ${estadoStock.border} border`}>
                            <span className={`font-semibold ${estadoStock.color}`}>{p.esGranel ? formatearCantidad(p.stock, 2) : formatearCantidad(p.stock)}</span>
                            <span className="text-xs text-slate-400">/ {p.esGranel ? formatearCantidad(p.stockMinimo ?? 0, 2) : formatearCantidad(p.stockMinimo ?? 0)}{p.esGranel ? ' kg' : ''}</span>
                          </div>
                          <div className={`text-xs mt-1 ${estadoStock.color}`}>{estadoStock.texto}</div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            (p.estado || 'Activo') === 'Activo' 
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {p.estado || 'Activo'}
                          </span>
                        </td>
                        {isAdminMode && (
                          <td className="py-4 px-6">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => abrirModalEditar(p)}
                                className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition"
                                title="Editar"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => eliminarProducto(p)}
                                className="p-1.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition"
                                title="Eliminar"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {productosFiltrados.map((p) => {
              const estadoStock = getEstadoStock(p.stock, p.stockMinimo);
              const margenGanancia = p.costo ? ((p.precio - p.costo) / p.costo * 100) : 0;
              return (
                <div key={p.id} className="bg-slate-800 rounded-xl border border-slate-700 p-5 hover:border-green-500/50 transition">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-white mb-1">{p.nombre}</h3>
                      <p className="text-xs text-slate-400 font-mono">{p.codigo || 'Sin código'}</p>
                      {p.esGranel && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">A granel</span>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${estadoStock.bg} ${estadoStock.border} border ${estadoStock.color}`}>
                      {p.esGranel ? `${formatearCantidad(typeof p.stock === 'number' ? p.stock : 0, 2)} kg` : formatearCantidad(p.stock)}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Categoría:</span>
                      <span className="text-green-400 font-medium">{p.categoria}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Proveedor:</span>
                      <span className="text-slate-300">{proveedores.find((pr) => pr.id === p.proveedorId)?.nombre ?? '-'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">{p.esGranel ? 'Precio/kg:' : 'Precio:'}</span>
                      <span className="text-white font-bold">${formatearMoneda(redondearPrecio(p.precio))}{p.esGranel ? '/kg' : ''}</span>
                    </div>
                    {p.costo != null && p.costo > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">{p.esGranel ? 'Costo/kg:' : 'Costo:'}</span>
                        <span className="text-slate-300">${formatearMoneda(redondearPrecio(p.costo || 0))}{p.esGranel ? '/kg' : ''}</span>
                      </div>
                    )}
                    {margenGanancia > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Ganancia:</span>
                        <span className="text-green-400 font-medium">{formatearCantidad(margenGanancia, 1)}%</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Stock Mínimo:</span>
                      <span className="text-slate-300">{p.esGranel ? formatearCantidad(p.stockMinimo ?? 0, 2) : formatearCantidad(p.stockMinimo ?? 0)}{p.esGranel ? ' kg' : ''}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                    <span className={`text-xs font-medium ${estadoStock.color}`}>{estadoStock.texto}</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      (p.estado || 'Activo') === 'Activo' 
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {p.estado || 'Activo'}
                    </span>
                  </div>

                  {isAdminMode && (
                    <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-700">
                      <button
                        onClick={() => abrirModalEditar(p)}
                        className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition text-sm"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => eliminarProducto(p)}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition text-sm"
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Agregar / Editar producto */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={cerrarModal}>
          <div
            className="bg-slate-800 rounded-2xl border border-slate-700 shadow-elevated-lg w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">
                {editandoId ? 'Actualizar producto' : 'Agregar producto'}
              </h2>
            </div>
            <form onSubmit={guardarProducto} className="p-6 space-y-4">
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Nombre *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej. Café Americano"
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Código</label>
                <input
                  type="text"
                  value={form.codigo}
                  onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                  placeholder="Código de barras (opcional)"
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Categoría</label>
                <div className="flex gap-2 mb-2">
                  <select
                    value={form.categoria}
                    onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
                    className="flex-1 rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="">Seleccionar...</option>
                    {categorias.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {form.categoria && (
                    <button
                      type="button"
                      onClick={eliminarCategoriaActual}
                      className="p-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition"
                      title="Eliminar categoría"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nuevaCategoria}
                    onChange={(e) => setNuevaCategoria(e.target.value)}
                    placeholder="Nueva categoría..."
                    className="flex-1 rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), crearCategoria())}
                  />
                  <button
                    type="button"
                    onClick={crearCategoria}
                    disabled={!nuevaCategoria.trim() || creandoCategoria}
                    className="px-4 py-2.5 rounded-xl bg-emerald-500/80 hover:bg-emerald-500 text-white text-sm font-medium transition disabled:opacity-50"
                  >
                    {creandoCategoria ? '...' : 'Crear'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Proveedor</label>
                <select
                  value={form.proveedorId === '' || form.proveedorId == null ? '' : form.proveedorId}
                  onChange={(e) => setForm((f) => ({ ...f, proveedorId: e.target.value === '' ? '' : Number(e.target.value) }))}
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">Sin asignar</option>
                  {proveedores.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.nombre}
                    </option>
                  ))}
                </select>
                <p className="text-slate-500 text-xs mt-1">Quien surte este producto. Gestiona proveedores en el menú Proveedores.</p>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.esGranel}
                    onChange={(e) => setForm((f) => ({ ...f, esGranel: e.target.checked }))}
                    className="rounded border-slate-500 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-slate-300 text-sm font-medium">Venta a granel (por peso)</span>
                </label>
                <p className="text-slate-500 text-xs mt-1">Para productos que se venden por kg (pollo, carnes, frutas, etc.)</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-sm font-medium mb-1">
                    {form.esGranel ? 'Precio compra (por kg) *' : 'Precio compra *'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.costo}
                    onChange={(e) => setForm((f) => ({ ...f, costo: e.target.value }))}
                    placeholder="0.00"
                    className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm font-medium mb-1">
                    {form.esGranel ? 'Precio venta (por kg) *' : 'Precio venta *'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.precio}
                    onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))}
                    placeholder="0.00"
                    className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-sm font-medium mb-1">
                    {form.esGranel ? 'Stock (kg)' : 'Stock'}
                  </label>
                  <input
                    type="number"
                    step={form.esGranel ? '0.01' : '1'}
                    min="0"
                    value={form.stock}
                    onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                    placeholder={form.esGranel ? '0.00' : '0'}
                    className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm font-medium mb-1">
                    {form.esGranel ? 'Stock mínimo (kg)' : 'Stock mínimo'}
                  </label>
                  <input
                    type="number"
                    step={form.esGranel ? '0.01' : '1'}
                    min="0"
                    value={form.stockMinimo}
                    onChange={(e) => setForm((f) => ({ ...f, stockMinimo: e.target.value }))}
                    placeholder={form.esGranel ? '0.00' : '0'}
                    className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1">Estado</label>
                <select
                  value={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
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
                  disabled={guardando}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition disabled:opacity-50"
                >
                  {guardando ? 'Guardando…' : editandoId ? 'Actualizar' : 'Agregar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
