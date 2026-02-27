'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { getProductos, getProductoPorCodigo, getCategorias, postVenta, getClientes, type Producto, type Cliente } from '@/lib/api';

type CarritoItem = {
  producto: Producto;
  cantidad: number;
  precioVenta: number;
};

function formatearMoneda(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Formatea una cadena numérica para mostrar en el input: añade comas cada 3 dígitos (ej. "20000000" → "20,000,000") */
function formatInputConComas(s: string): string {
  if (s === '') return '';
  const hasDot = s.includes('.');
  const [intPart, decPart] = s.split('.');
  const digitsOnly = (intPart || '').replace(/\D/g, '');
  const withCommas = digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (hasDot) {
    const dec = (decPart || '').replace(/\D/g, '').slice(0, 2);
    return withCommas + (dec ? '.' + dec : '.');
  }
  return withCommas;
}

export default function POSPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [carrito, setCarrito] = useState<CarritoItem[]>([]);
  const [codigoBarras, setCodigoBarras] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [productoEncontrado, setProductoEncontrado] = useState<Producto | null>(null);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [montoPagado, setMontoPagado] = useState<string>('');
  const [productoGranelModal, setProductoGranelModal] = useState<Producto | null>(null);
  const [granelKg, setGranelKg] = useState<string>('1');
  const codigoInputRef = useRef<HTMLInputElement>(null);
  const busquedaTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    Promise.all([getProductos(), getCategorias(), getClientes()])
      .then(([p, c, cl]) => {
        setProductos(p);
        setCategorias(c);
        setClientes(cl);
      })
      .catch(() => {
        setProductos([]);
        setCategorias([]);
        setClientes([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const codigoBarrasTimeoutRef = useRef<NodeJS.Timeout>();
  
  useEffect(() => {
    if (codigoBarrasTimeoutRef.current) clearTimeout(codigoBarrasTimeoutRef.current);
    
    if (codigoBarras.length >= 8) {
      codigoBarrasTimeoutRef.current = setTimeout(() => {
        buscarPorCodigo(codigoBarras);
        setCodigoBarras('');
      }, 200);
    }
    
    return () => {
      if (codigoBarrasTimeoutRef.current) clearTimeout(codigoBarrasTimeoutRef.current);
    };
  }, [codigoBarras]);

  const buscarPorCodigo = async (codigo: string) => {
    if (!codigo.trim()) return;
    try {
      const producto = await getProductoPorCodigo(codigo);
      if (producto.esGranel) {
        setGranelKg('1');
        setProductoGranelModal(producto);
      } else {
        agregarAlCarrito(producto);
      }
      setCodigoBarras('');
    } catch {
      // Producto no encontrado
    }
  };

  useEffect(() => {
    if (busquedaTimeoutRef.current) clearTimeout(busquedaTimeoutRef.current);
    
    if (busqueda.trim().length > 0) {
      busquedaTimeoutRef.current = setTimeout(() => {
        const encontrado = productos.find(
          (p) =>
            p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
            p.codigo?.toLowerCase().includes(busqueda.toLowerCase())
        );
        setProductoEncontrado(encontrado || null);
      }, 300);
    } else {
      setProductoEncontrado(null);
    }

    return () => {
      if (busquedaTimeoutRef.current) clearTimeout(busquedaTimeoutRef.current);
    };
  }, [busqueda, productos]);

  const agregarAlCarrito = (p: Producto, precioModificado?: number, cantidadKg?: number) => {
    const stockDisponible = typeof p.stock === 'number' ? p.stock : 0;
    if (stockDisponible <= 0) return;
    if (p.esGranel) {
      if (cantidadKg == null || cantidadKg <= 0) {
        setGranelKg('1');
        setProductoGranelModal(p);
        return;
      }
      const kg = Math.min(cantidadKg, stockDisponible);
      setCarrito((prev) => {
        const i = prev.findIndex((x) => x.producto.id === p.id);
        const precioVenta = precioModificado ?? p.precio;
        if (i >= 0) {
          const copy = [...prev];
          const nuevoTotal = copy[i].cantidad + kg;
          copy[i].cantidad = Math.min(nuevoTotal, stockDisponible);
          copy[i].precioVenta = precioVenta;
          return copy;
        }
        return [...prev, { producto: p, cantidad: kg, precioVenta }];
      });
    } else {
      setCarrito((prev) => {
        const i = prev.findIndex((x) => x.producto.id === p.id);
        const precioVenta = precioModificado ?? p.precio;
        if (i >= 0) {
          const copy = [...prev];
          if (copy[i].cantidad >= stockDisponible) return prev;
          copy[i].cantidad++;
          copy[i].precioVenta = precioVenta;
          return copy;
        }
        return [...prev, { producto: p, cantidad: 1, precioVenta }];
      });
    }
    setProductoEncontrado(null);
    setBusqueda('');
    setProductoGranelModal(null);
    setGranelKg('1');
  };

  const quitarDelCarrito = (id: number) => {
    setCarrito((prev) => {
      const i = prev.findIndex((x) => x.producto.id === id);
      if (i < 0) return prev;
      const copy = [...prev];
      const item = copy[i];
      const paso = item.producto.esGranel ? 0.1 : 1;
      if (item.cantidad <= paso) return copy.filter((_, j) => j !== i);
      copy[i] = { ...item, cantidad: Math.max(0, item.cantidad - paso) };
      return copy[i].cantidad <= 0 ? copy.filter((_, j) => j !== i) : copy;
    });
  };

  const eliminarDelCarrito = (id: number) => {
    setCarrito((prev) => prev.filter((x) => x.producto.id !== id));
  };

  const modificarPrecio = (id: number, nuevoPrecio: number) => {
    setCarrito((prev) => {
      const i = prev.findIndex((x) => x.producto.id === id);
      if (i < 0) return prev;
      const copy = [...prev];
      copy[i].precioVenta = Math.max(0, nuevoPrecio);
      return copy;
    });
  };

  const cambiarCantidad = (id: number, nuevaCantidad: number) => {
    setCarrito((prev) => {
      const i = prev.findIndex((x) => x.producto.id === id);
      if (i < 0) return prev;
      const copy = [...prev];
      const maxStock = typeof copy[i].producto.stock === 'number' ? copy[i].producto.stock : 0;
      const qty = Math.max(0, Math.min(nuevaCantidad, maxStock));
      if (qty <= 0) return copy.filter((_, j) => j !== i);
      copy[i] = { ...copy[i], cantidad: qty };
      return copy;
    });
  };

  const totalCarrito = carrito.reduce((s, i) => s + i.precioVenta * i.cantidad, 0);
  const parseMontoPagado = (): number => {
    const raw = String(montoPagado).replace(/,/g, '');
    if (raw === '') return 0;
    const n = parseFloat(raw);
    return isNaN(n) ? 0 : n;
  };
  const montoPagadoNum = parseMontoPagado();
  const pagado = montoPagado.trim() === '' ? totalCarrito : montoPagadoNum;
  const pendiente = Math.max(0, totalCarrito - pagado);
  const cambio = pagado > totalCarrito ? pagado - totalCarrito : 0;

  const productosDisponibles = categoriaFiltro
    ? productos.filter((p) => p.categoria === categoriaFiltro)
    : productos;

  const estadisticasVenta = {
    totalItems: carrito.reduce((sum, i) => sum + i.cantidad, 0),
    productosUnicos: carrito.length,
    promedioItem: carrito.length > 0 ? totalCarrito / carrito.reduce((sum, i) => sum + i.cantidad, 0) : 0,
  };

  const cobrar = async () => {
    if (carrito.length === 0) return;
    const montoPago = montoPagado.trim() === '' ? totalCarrito : montoPagadoNum;
    if (montoPago < 0 || montoPago > totalCarrito * 2) {
      alert('El monto pagado debe ser válido');
      return;
    }
    setEnviando(true);
    try {
      await postVenta({
        items: carrito.map((i) => ({
          id: i.producto.id,
          nombre: i.producto.nombre,
          precio: i.precioVenta,
          cantidad: i.cantidad,
          costo: i.producto.costo != null ? i.producto.costo : 0,
        })),
        total: totalCarrito,
        pagado: montoPago,
        cliente: clienteSeleccionado?.nombre || '',
        clienteId: clienteSeleccionado?.id,
      });
      imprimirTicket();
      setCarrito([]);
      setClienteSeleccionado(null);
      setMontoPagado('');
    } catch (err) {
      console.error(err);
      alert('Error al registrar la venta');
    } finally {
      setEnviando(false);
    }
  };

  const imprimirTicket = () => {
    const ventana = window.open('', '_blank');
    if (!ventana) return;
    const montoPago = montoPagado.trim() === '' ? totalCarrito : montoPagadoNum;
    const pendienteTicket = Math.max(0, totalCarrito - montoPago);
    const cambioTicket = montoPago > totalCarrito ? montoPago - totalCarrito : 0;

    const contenido = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ticket de Venta</title>
          <style>
            body { font-family: monospace; padding: 20px; max-width: 300px; margin: 0 auto; font-size: 12px; }
            .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 15px; }
            .header h2 { margin: 0 0 5px 0; font-size: 18px; }
            .header p { margin: 3px 0; font-size: 11px; }
            .cliente { margin: 10px 0; padding: 5px; background: #f0f0f0; border-radius: 3px; }
            .item { margin: 8px 0; padding-bottom: 8px; border-bottom: 1px dotted #ccc; }
            .item-name { font-weight: bold; margin-bottom: 3px; }
            .item-detail { font-size: 11px; color: #555; }
            .totals { border-top: 2px dashed #000; padding-top: 10px; margin-top: 15px; }
            .total-row { display: flex; justify-content: space-between; margin: 5px 0; }
            .total-label { font-weight: bold; }
            .total-amount { font-weight: bold; }
            .pago { color: #059669; }
            .pendiente { color: #d97706; font-weight: bold; font-size: 14px; }
            .cambio { color: #059669; }
            .footer { text-align: center; margin-top: 20px; padding-top: 10px; border-top: 1px dashed #000; font-size: 11px; }
            .advertencia { background: #fef3c7; padding: 8px; margin-top: 10px; border-radius: 3px; font-size: 11px; color: #92400e; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Punto de Venta</h2>
            <p><strong>Juan Mejía</strong></p>
            <p>${new Date().toLocaleString('es-MX')}</p>
            ${clienteSeleccionado ? `<div class="cliente"><strong>Cliente:</strong> ${clienteSeleccionado.nombre}</div>` : ''}
          </div>
          
          <div style="margin-bottom: 15px;">
            <strong>PRODUCTOS:</strong>
          </div>
          
          ${carrito.map((i) => `
            <div class="item">
              <div class="item-name">${i.producto.nombre}</div>
              <div class="item-detail">
                ${i.producto.esGranel ? i.cantidad.toFixed(2) + ' kg' : 'Cantidad: ' + i.cantidad} × $${formatearMoneda(i.precioVenta)} = $${formatearMoneda(i.precioVenta * i.cantidad)}
              </div>
            </div>
          `).join('')}
          
          <div class="totals">
            <div class="total-row">
              <span class="total-label">TOTAL:</span>
              <span class="total-amount">$${formatearMoneda(totalCarrito)}</span>
            </div>
            <div class="total-row">
              <span>Pagado:</span>
              <span class="pago">$${formatearMoneda(montoPago)}</span>
            </div>
            ${cambioTicket > 0 ? `
              <div class="total-row">
                <span>Cambio:</span>
                <span class="cambio">$${formatearMoneda(cambioTicket)}</span>
              </div>
            ` : ''}
            ${pendienteTicket > 0 ? `
              <div class="total-row" style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #000;">
                <span class="pendiente">PENDIENTE:</span>
                <span class="pendiente">$${formatearMoneda(pendienteTicket)}</span>
              </div>
            ` : ''}
          </div>
          
          ${pendienteTicket > 0 ? `
            <div class="advertencia">
              <strong>⚠ VENTA CON CRÉDITO</strong><br>
              Monto pendiente de pago: $${formatearMoneda(pendienteTicket)}
            </div>
          ` : ''}
          
          <div class="footer">
            <p><strong>${pendienteTicket > 0 ? 'Venta con crédito pendiente' : 'Gracias por su compra'}</strong></p>
            <p style="margin-top: 5px;">Conserve este ticket</p>
          </div>
        </body>
      </html>
    `;

    ventana.document.write(contenido);
    ventana.document.close();
    ventana.print();
  };

  return (
    <div className="flex flex-col h-full text-white">
      {/* Modal peso producto a granel */}
      {productoGranelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => { setProductoGranelModal(null); setGranelKg('1'); }}>
          <div className="bg-slate-800 rounded-xl border border-slate-600 shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-1">Venta por peso</h3>
            <p className="text-sm text-slate-400 mb-4">{productoGranelModal.nombre}</p>
            <p className="text-sm text-slate-300 mb-2">Precio: ${formatearMoneda(typeof productoGranelModal.precio === 'number' ? productoGranelModal.precio : Number(productoGranelModal.precio) || 0)}/kg · Stock: {productoGranelModal.stock} kg</p>
            <label className="block text-sm font-medium text-slate-300 mb-2">Peso (kg)</label>
            <input
              type="number"
              min="0.01"
              max={productoGranelModal.stock}
              step="0.01"
              value={granelKg}
              onChange={(e) => setGranelKg(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const kg = parseFloat(granelKg) || 0;
                  if (kg > 0 && kg <= productoGranelModal.stock) {
                    agregarAlCarrito(productoGranelModal, productoGranelModal.precio, kg);
                  }
                }
              }}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setProductoGranelModal(null); setGranelKg('1'); }}
                className="flex-1 py-2.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const kg = parseFloat(granelKg) || 0;
                  if (kg > 0 && kg <= productoGranelModal.stock) {
                    agregarAlCarrito(productoGranelModal, productoGranelModal.precio, kg);
                  } else {
                    alert(kg <= 0 ? 'Ingresa un peso válido.' : `Stock disponible: ${productoGranelModal.stock} kg`);
                  }
                }}
                className="flex-1 py-2.5 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header con estadísticas */}
      <div className="px-6 py-3 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Nueva Venta</h1>
            <p className="text-sm text-slate-400">Sistema de punto de venta</p>
          </div>
          {carrito.length > 0 && (
            <div className="flex items-center gap-4 text-sm">
              <div className="text-right">
                <p className="text-slate-400">Items en carrito</p>
                <p className="text-lg font-bold text-white">{estadisticasVenta.totalItems.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-400">Total</p>
                <p className="text-lg font-bold text-green-400">${formatearMoneda(totalCarrito)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Columna central */}
        <div className="flex-1 flex flex-col p-6 space-y-6 overflow-auto">
          {/* Escáner de código de barras */}
          <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <h2 className="text-xl font-semibold text-white">Escáner de Código de Barras</h2>
            </div>
            <div className="flex gap-3">
              <input
                ref={codigoInputRef}
                type="text"
                value={codigoBarras}
                onChange={(e) => setCodigoBarras(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && codigoBarras.trim()) {
                    e.preventDefault();
                    buscarPorCodigo(codigoBarras);
                    setCodigoBarras('');
                    codigoInputRef.current?.focus();
                  }
                }}
                placeholder="Escanea o ingresa el código"
                className="flex-1 px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 text-lg"
                autoFocus
              />
              <button
                onClick={() => buscarPorCodigo(codigoBarras)}
                className="px-6 py-3 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium transition"
              >
                Buscar
              </button>
            </div>
          </div>

          {/* Buscar productos */}
          <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h2 className="text-xl font-semibold text-white">Buscar Productos</h2>
            </div>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, código o descripción..."
              className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />

            {/* Resultado de búsqueda */}
            {productoEncontrado && (
              <div className="mt-4 p-4 rounded-lg bg-slate-700 border-2 border-green-500/50 shadow-lg">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="font-semibold text-white text-lg mb-1">{productoEncontrado.nombre}</div>
                    <div className="text-sm text-slate-400 mb-2">Código: {productoEncontrado.codigo || 'N/A'}</div>
                    <div className="text-xs text-green-400">Categoría: {productoEncontrado.categoria}</div>
                  </div>
                    <div className="text-right">
                    <div className="text-2xl font-bold text-white mb-1">${productoEncontrado.precio.toLocaleString('es-MX', { minimumFractionDigits: 2 })}{productoEncontrado.esGranel ? '/kg' : ''}</div>
                    <div className={`text-sm font-medium ${productoEncontrado.stock > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      Stock: {productoEncontrado.esGranel ? `${productoEncontrado.stock} kg` : productoEncontrado.stock}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => agregarAlCarrito(productoEncontrado)}
                  disabled={productoEncontrado.stock <= 0 || (typeof productoEncontrado.stock === 'number' && productoEncontrado.stock < (productoEncontrado.esGranel ? 0.01 : 1))}
                  className="w-full py-2.5 rounded-lg bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition"
                >
                  {productoEncontrado.esGranel ? 'Vender por peso (kg)' : 'Agregar al carrito'}
                </button>
              </div>
            )}
          </div>

          {/* Categorías */}
          {categorias.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Categorías</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCategoriaFiltro('')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    !categoriaFiltro
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Todas
                </button>
                {categorias.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategoriaFiltro(c)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      categoriaFiltro === c
                        ? 'bg-green-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Productos disponibles */}
          {!busqueda && (
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">
                Productos Disponibles ({productosDisponibles.length})
              </h3>
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="h-24 bg-slate-700 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {productosDisponibles.slice(0, 12).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => agregarAlCarrito(p)}
                      disabled={p.stock <= 0 || (p.esGranel && p.stock < 0.01)}
                      className="text-left p-3 bg-slate-800 rounded-lg border border-slate-700 hover:border-green-500/50 hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      <div className="text-xs font-medium text-green-400 mb-1 truncate">{p.categoria}</div>
                      <div className="font-medium text-white text-sm mb-1 truncate">{p.nombre}</div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm font-semibold text-white">${formatearMoneda(typeof p.precio === 'number' ? p.precio : Number(p.precio) || 0)}{p.esGranel ? '/kg' : ''}</span>
                        <span className="text-xs text-slate-400">Stock: {p.esGranel ? `${p.stock} kg` : p.stock}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panel lateral derecho */}
        <div className="w-96 min-h-0 border-l border-slate-700 bg-slate-800 flex flex-col">
          {/* Botón Devoluciones */}
          <div className="p-4 border-b border-slate-700">
            <Link
              href="/pos/ventas?vista=devoluciones"
              className="block w-full py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium transition text-center"
            >
              Devoluciones
            </Link>
          </div>

          {/* Selector de Cliente */}
          <div className="p-4 border-b border-slate-700">
            <label className="block text-sm font-medium text-slate-300 mb-2">Cliente</label>
            <select
              value={clienteSeleccionado?.id || ''}
              onChange={(e) => {
                const id = Number(e.target.value);
                const cliente = clientes.find((c) => c.id === id) || null;
                setClienteSeleccionado(cliente);
              }}
              className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Cliente general</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            {clienteSeleccionado && (
              <div className="mt-2 p-2 rounded bg-slate-700/50 border border-slate-600">
                <p className="text-xs text-slate-400">Cliente seleccionado:</p>
                <p className="text-sm font-medium text-white">{clienteSeleccionado.nombre}</p>
                {clienteSeleccionado.telefono && (
                  <p className="text-xs text-slate-400">{clienteSeleccionado.telefono}</p>
                )}
              </div>
            )}
          </div>

          {/* Venta Actual */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Venta Actual</h2>
                {carrito.length > 0 && (
                  <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                    {carrito.length} {carrito.length === 1 ? 'producto' : 'productos'}
                  </span>
                )}
              </div>
            </div>

            {carrito.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-400">
                <svg className="w-20 h-20 mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-center">No hay productos en la venta</p>
                <p className="text-xs text-slate-500 mt-1 text-center">Escanea códigos o busca productos</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0 min-w-0">
                <div className="flex-1 min-h-[200px] overflow-y-auto overflow-x-hidden p-4 space-y-3">
                  {carrito.map((item, idx) => (
                    <div key={`${item.producto.id}-${idx}`} className="p-3 rounded-lg bg-slate-700 border border-slate-600">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white truncate">{item.producto.nombre}</div>
                          <div className="text-xs text-slate-400 mt-0.5">Código: {item.producto.codigo || 'N/A'}</div>
                        </div>
                        <button
                          onClick={() => eliminarDelCarrito(item.producto.id)}
                          className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition ml-2"
                          title="Eliminar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <label className="text-xs text-slate-400">{item.producto.esGranel ? 'Precio/kg:' : 'Precio:'}</label>
                        <input
                          type="number"
                          value={item.precioVenta}
                          onChange={(e) => modificarPrecio(item.producto.id, parseFloat(e.target.value) || 0)}
                          className="flex-1 px-2 py-1 rounded bg-slate-600 border border-slate-500 text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                          step="0.01"
                          min="0"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => quitarDelCarrito(item.producto.id)}
                            className="w-8 h-8 rounded-lg bg-slate-600 hover:bg-slate-500 flex items-center justify-center text-white text-sm"
                          >
                            −
                          </button>
                          {item.producto.esGranel ? (
                            <input
                              type="number"
                              value={item.cantidad}
                              onChange={(e) => cambiarCantidad(item.producto.id, parseFloat(e.target.value) || 0)}
                              min="0.01"
                              max={item.producto.stock}
                              step="0.01"
                              className="w-16 px-2 py-1 rounded bg-slate-600 border border-slate-500 text-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-green-500"
                            />
                          ) : (
                            <span className="w-8 text-center font-semibold text-white">{item.cantidad}</span>
                          )}
                          <button
                            onClick={() => item.producto.esGranel ? cambiarCantidad(item.producto.id, item.cantidad + 0.1) : agregarAlCarrito(item.producto, item.precioVenta)}
                            disabled={item.producto.esGranel ? item.cantidad >= item.producto.stock : item.cantidad >= item.producto.stock}
                            className="w-8 h-8 rounded-lg bg-slate-600 hover:bg-slate-500 disabled:opacity-50 flex items-center justify-center text-white text-sm"
                          >
                            +
                          </button>
                          {item.producto.esGranel && <span className="text-xs text-slate-400">kg</span>}
                        </div>
                        <span className="ml-auto font-bold text-white text-lg">
                          ${formatearMoneda(item.precioVenta * item.cantidad)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex-shrink-0 p-4 border-t border-slate-700 space-y-3 bg-slate-900/30">
                  {/* Resumen */}
                  <div className="space-y-2 pb-3 border-b border-slate-700">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Items:</span>
                      <span className="text-white font-medium">{estadisticasVenta.totalItems.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold">
                      <span className="text-slate-300">Total:</span>
                      <span className="text-white">${formatearMoneda(totalCarrito)}</span>
                    </div>
                  </div>

                  {/* Monto pagado */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-slate-300">
                        Monto pagado
                      </label>
                      <button
                        type="button"
                        onClick={() => setMontoPagado(formatearMoneda(totalCarrito))}
                        className="text-xs font-medium text-emerald-400 hover:text-emerald-300 border border-emerald-500/50 hover:border-emerald-400 rounded-lg px-2.5 py-1 transition"
                      >
                        Pagado completo
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formatInputConComas(montoPagado)}
                        onChange={(e) => {
                          const v = e.target.value.replace(/,/g, '');
                          if (v === '') {
                            setMontoPagado('');
                            return;
                          }
                          const parts = v.split('.');
                          if (parts.length > 2) return;
                          if (parts[1] !== undefined && parts[1].length > 2) return;
                          if (/^\d*\.?\d*$/.test(v)) setMontoPagado(v);
                        }}
                        onBlur={() => {
                          const n = parseMontoPagado();
                          if (n >= 0) setMontoPagado(n > 0 ? formatearMoneda(n) : '');
                        }}
                        className="w-full pl-6 pr-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-green-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        placeholder="0.00"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && carrito.length > 0) {
                            cobrar();
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Cambio o Pendiente */}
                  {cambio > 0 && (
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-300">Cambio:</span>
                        <span className="text-lg font-bold text-green-400">${formatearMoneda(cambio)}</span>
                      </div>
                    </div>
                  )}
                  {pendiente > 0 && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-300">Pendiente:</span>
                        <span className="text-lg font-bold text-amber-400">${formatearMoneda(pendiente)}</span>
                      </div>
                    </div>
                  )}

                  {/* Botón cobrar */}
                  <button
                    onClick={cobrar}
                    disabled={carrito.length === 0 || enviando}
                    className="w-full py-3.5 rounded-lg bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg transition shadow-lg"
                  >
                    {enviando ? 'Procesando...' : pendiente > 0 ? 'Registrar Venta con Crédito' : 'Cobrar e Imprimir'}
                  </button>
                  {pendiente > 0 && (
                    <p className="text-xs text-amber-400 text-center">
                      Se registrará una deuda de ${formatearMoneda(pendiente)}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
