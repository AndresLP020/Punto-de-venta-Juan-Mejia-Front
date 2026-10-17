'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, MotionConfig, type Variants } from 'framer-motion';
import { getProductos, getOfertas, type Producto, type Oferta } from '@/lib/api';
import { formatearMoneda } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import { useCart } from '@/contexts/CartContext';

const EASE_SUAVE = [0.16, 1, 0.3, 1] as const;

const contenedorStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const itemArriba: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_SUAVE } },
};

const itemTarjeta: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: EASE_SUAVE } },
};

const revelarAlEntrar = {
  initial: 'hidden' as const,
  whileInView: 'visible' as const,
  viewport: { once: true, amount: 0.15 },
};

function ImagenProducto({ src, alt, className = '' }: { src?: string; alt: string; className?: string }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-amber-100 to-blue-100 ${className}`}>
        <svg className="w-1/3 h-1/3 text-blue-800/40" fill="none" stroke="currentColor" strokeWidth={1.4} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} onError={() => setError(true)} className={`object-cover ${className}`} />;
}

export default function LandingPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriaActiva, setCategoriaActiva] = useState<string>('Todo');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const PRODUCTOS_POR_PAGINA = 12;
  const { agregar, totalUnidades } = useCart();
  const [avisoCarrito, setAvisoCarrito] = useState('');
  const avisoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const agregarAlCarrito = (p: Producto) => {
    agregar(p, 1);
    setAvisoCarrito(`${p.nombre} agregado al carrito`);
    if (avisoTimer.current) clearTimeout(avisoTimer.current);
    avisoTimer.current = setTimeout(() => setAvisoCarrito(''), 2200);
  };

  useEffect(() => {
    Promise.all([getProductos(), getOfertas(true)])
      .then(([p, o]) => {
        setProductos((p as Producto[]).filter((x) => (x.estado || 'Activo') === 'Activo'));
        setOfertas(o);
      })
      .catch(() => {
        setProductos([]);
        setOfertas([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const categorias = useMemo(() => {
    const set = new Set<string>();
    productos.forEach((p) => p.categoria && set.add(p.categoria));
    return ['Todo', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter((p) => {
      const coincideCategoria = categoriaActiva === 'Todo' || p.categoria === categoriaActiva;
      const coincideBusqueda =
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        (p.categoria || '').toLowerCase().includes(q) ||
        (p.descripcion || '').toLowerCase().includes(q) ||
        (p.codigo || '').toLowerCase().includes(q);
      return coincideCategoria && coincideBusqueda;
    });
  }, [productos, categoriaActiva, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(productosFiltrados.length / PRODUCTOS_POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const productosPagina = useMemo(
    () => productosFiltrados.slice((paginaActual - 1) * PRODUCTOS_POR_PAGINA, paginaActual * PRODUCTOS_POR_PAGINA),
    [productosFiltrados, paginaActual]
  );

  // Ventana de páginas visibles: máximo 7 números a la vez
  const paginasVisibles = useMemo(() => {
    const VENTANA = 7;
    if (totalPaginas <= VENTANA) {
      return Array.from({ length: totalPaginas }, (_, i) => i + 1);
    }
    let start = Math.max(1, paginaActual - Math.floor(VENTANA / 2));
    const end = Math.min(totalPaginas, start + VENTANA - 1);
    start = Math.max(1, end - VENTANA + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [paginaActual, totalPaginas]);

  // Reinicia a la primera página al cambiar de categoría o búsqueda
  useEffect(() => {
    setPagina(1);
  }, [categoriaActiva, busqueda]);

  const irAPagina = (n: number) => {
    setPagina(n);
    if (typeof document !== 'undefined') {
      document.getElementById('productos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const destacados = useMemo(() => productos.filter((p) => p.destacado).slice(0, 6), [productos]);

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-white text-slate-900">
      {/* Barra superior */}
      <header className="sticky top-0 z-40 bg-[#0b3d91] text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center overflow-hidden ring-2 ring-yellow-400">
              <Logo size={40} />
            </div>
            <div className="leading-tight">
              <span className="block font-extrabold tracking-tight text-lg text-white">
                Nutri<span className="text-yellow-400">-</span>Ala
              </span>
              <span className="block text-[11px] text-yellow-300 font-medium">el buen sabor del pollo…</span>
            </div>
          </div>
          <nav className="hidden sm:flex items-center gap-6 text-sm font-semibold text-white">
            <a href="#ofertas" className="hover:text-yellow-300 transition">Ofertas</a>
            <a href="#productos" className="hover:text-yellow-300 transition">Productos</a>
            <a href="#contacto" className="hover:text-yellow-300 transition">Contacto</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/carrito"
              aria-label="Ver carrito"
              className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <AnimatePresence>
                {totalUnidades > 0 && (
                  <motion.span
                    key={totalUnidades}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                    className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full bg-red-600 text-white text-[11px] font-extrabold ring-2 ring-[#0b3d91]"
                  >
                    {totalUnidades % 1 === 0 ? totalUnidades : totalUnidades.toFixed(1)}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
            <Link
              href="/acceso"
              className="text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-lg bg-yellow-400 text-[#0b3d91] hover:bg-yellow-300 transition shadow"
            >
              Acceso
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-yellow-50 via-white to-white border-b border-slate-100">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-yellow-300/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-red-500/10 blur-3xl" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 grid md:grid-cols-2 gap-10 items-center">
          <motion.div
            variants={contenedorStagger}
            initial="hidden"
            animate="visible"
          >
            <motion.span variants={itemArriba} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600 text-white text-xs font-bold uppercase tracking-wider shadow">
              Pollo fresco todos los días
            </motion.span>
            <motion.h1 variants={itemArriba} className="mt-4 text-4xl sm:text-5xl font-extrabold leading-tight text-[#0b3d91]">
              El buen sabor del <span className="text-red-600">pollo</span>
            </motion.h1>
            <motion.p variants={itemArriba} className="mt-4 text-slate-600 text-lg max-w-md">
              En <strong className="text-[#0b3d91]">Nutri-Ala</strong> ofrecemos pollo y productos frescos de la mejor
              calidad para tu mesa. Descubre nuestros productos y las ofertas del día.
            </motion.p>
            <motion.div variants={itemArriba} className="mt-8 flex flex-wrap gap-3">
              <motion.a
                href="#productos"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="px-6 py-3 rounded-xl bg-yellow-400 text-[#0b3d91] font-bold hover:bg-yellow-300 transition shadow-lg"
              >
                Ver productos
              </motion.a>
              <motion.a
                href="#ofertas"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="px-6 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 transition shadow-lg"
              >
                Ofertas de hoy
              </motion.a>
            </motion.div>
          </motion.div>

          {/* Espacio del logo (marcador para el logo oficial) */}
          <div className="flex justify-center md:justify-end">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE_SUAVE, delay: 0.15 }}
              className="bg-white rounded-3xl p-6 shadow-2xl ring-4 ring-yellow-400/60 flex flex-col items-center"
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Logo size={180} />
              </motion.div>
              <div className="mt-4 text-center">
                <span className="block text-2xl font-extrabold tracking-tight text-[#0b3d91]">
                  Nutri<span className="text-red-600">-</span>Ala
                </span>
                <span className="block text-sm font-semibold text-slate-500">el buen sabor del pollo…</span>
              </div>
            </motion.div>
          </div>
        </div>
        {/* Franja de colores de marca */}
        <div className="h-2 w-full flex">
          <div className="flex-1 bg-yellow-400" />
          <div className="flex-1 bg-white" />
          <div className="flex-1 bg-[#0b3d91]" />
          <div className="flex-1 bg-red-600" />
          <div className="flex-1 bg-black" />
        </div>
      </section>

      {/* Ofertas */}
      <section id="ofertas" className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <motion.div
          variants={contenedorStagger}
          {...revelarAlEntrar}
          className="flex items-end justify-between mb-8"
        >
          <div>
            <motion.span variants={itemArriba} className="text-red-600 font-bold uppercase tracking-wider text-sm block">Promociones</motion.span>
            <motion.h2 variants={itemArriba} className="text-3xl font-extrabold text-slate-900">Ofertas destacadas</motion.h2>
          </div>
        </motion.div>

        {loading ? (
          <p className="text-slate-500">Cargando ofertas…</p>
        ) : ofertas.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-10 text-center">
            <p className="text-slate-600 font-medium">Por ahora no hay ofertas activas.</p>
            <p className="text-slate-500 text-sm mt-1">¡Vuelve pronto para conocer nuestras promociones!</p>
          </div>
        ) : (
          <motion.div
            variants={contenedorStagger}
            {...revelarAlEntrar}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {ofertas.map((o) => {
              const tieneDescuento = (o.precioNormal ?? 0) > 0 && (o.precioOferta ?? 0) > 0 && o.precioOferta! < o.precioNormal!;
              const pct = tieneDescuento ? Math.round((1 - o.precioOferta! / o.precioNormal!) * 100) : 0;
              return (
                <motion.article
                  key={o.id}
                  variants={itemTarjeta}
                  whileHover={{ y: -6 }}
                  className="group relative rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-md hover:shadow-xl transition"
                >
                  <div className="relative h-48 bg-slate-100">
                    <ImagenProducto src={o.imagen} alt={o.titulo} className="w-full h-full" />
                    {tieneDescuento && (
                      <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-red-600 text-white text-sm font-extrabold shadow">
                        -{pct}%
                      </span>
                    )}
                    <span className="absolute top-3 right-3 px-3 py-1 rounded-full bg-yellow-400 text-[#0b3d91] text-xs font-bold shadow uppercase tracking-wide">
                      Oferta
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-extrabold text-slate-900">{o.titulo}</h3>
                    {o.descripcion && <p className="mt-1 text-sm text-slate-600 line-clamp-3">{o.descripcion}</p>}
                    {o.productos && o.productos.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {o.productos.slice(0, 5).map((p, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-md bg-blue-50 text-[#0b3d91] text-xs font-medium border border-blue-100">
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                    {(o.precioOferta ?? 0) > 0 && (
                      <div className="mt-4 flex items-end gap-2">
                        <span className="text-2xl font-extrabold text-red-600">${formatearMoneda(o.precioOferta!)}</span>
                        {tieneDescuento && (
                          <span className="text-sm text-slate-400 line-through mb-0.5">${formatearMoneda(o.precioNormal!)}</span>
                        )}
                      </div>
                    )}
                    {o.fechaFin && (
                      <p className="mt-2 text-xs text-slate-400">Válida hasta {o.fechaFin.slice(0, 10)}</p>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </motion.div>
        )}
      </section>

      {/* Destacados */}
      {destacados.length > 0 && (
        <section className="bg-blue-50/60 border-y border-blue-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
            <span className="text-[#0b3d91] font-bold uppercase tracking-wider text-sm">Lo más pedido</span>
            <h2 className="text-3xl font-extrabold text-slate-900 mb-6">Productos destacados</h2>
            <motion.div
              variants={contenedorStagger}
              {...revelarAlEntrar}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"
            >
              {destacados.map((p) => (
                <motion.div
                  key={p.id}
                  variants={itemTarjeta}
                  whileHover={{ y: -5 }}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition"
                >
                  <ImagenProducto src={p.imagen} alt={p.nombre} className="w-full h-28" />
                  <div className="p-3">
                    <p className="text-sm font-bold text-slate-900 truncate">{p.nombre}</p>
                    <p className="text-red-600 font-extrabold text-sm mt-0.5">
                      ${formatearMoneda(p.precio)}{p.esGranel && <span className="text-slate-400 font-medium text-xs">/kg</span>}
                    </p>
                    <button
                      type="button"
                      onClick={() => agregarAlCarrito(p)}
                      className="mt-2 w-full py-1.5 rounded-lg bg-[#0b3d91] text-white text-xs font-bold hover:bg-[#0a3378] transition"
                    >
                      Agregar
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* Productos */}
      <section id="productos" className="max-w-6xl mx-auto px-4 sm:px-6 py-14 scroll-mt-20">
        <span className="text-yellow-500 font-bold uppercase tracking-wider text-sm">Nuestro catálogo</span>
        <h2 className="text-3xl font-extrabold text-[#0b3d91] mb-6">Todo lo que vendemos</h2>

        {/* Filtro de categorías */}
        {categorias.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {categorias.map((c) => (
              <button
                key={c}
                onClick={() => setCategoriaActiva(c)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition border ${
                  categoriaActiva === c
                    ? 'bg-[#0b3d91] text-white border-[#0b3d91] shadow'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-yellow-400 hover:text-[#0b3d91]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {/* Barra de búsqueda */}
        <div className="mb-8 max-w-xl">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar un producto por nombre, categoría…"
              className="w-full pl-11 pr-11 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 shadow-sm focus:border-[#0b3d91] focus:ring-2 focus:ring-[#0b3d91]/20 outline-none transition"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                aria-label="Limpiar búsqueda"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {busqueda.trim() && (
            <p className="mt-2 text-sm text-slate-500">
              {productosFiltrados.length} {productosFiltrados.length === 1 ? 'resultado' : 'resultados'} para “{busqueda.trim()}”
            </p>
          )}
        </div>

        {loading ? (
          <p className="text-slate-500">Cargando productos…</p>
        ) : productosFiltrados.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50 p-10 text-center">
            {busqueda.trim() || categoriaActiva !== 'Todo' ? (
              <>
                <p className="text-slate-600 font-medium">No encontramos productos con esos criterios.</p>
                <button
                  type="button"
                  onClick={() => {
                    setBusqueda('');
                    setCategoriaActiva('Todo');
                  }}
                  className="mt-3 px-4 py-2 rounded-lg bg-[#0b3d91] text-white text-sm font-semibold hover:bg-[#0a3378] transition"
                >
                  Limpiar filtros
                </button>
              </>
            ) : (
              <>
                <p className="text-slate-600 font-medium">Aún no hay productos para mostrar.</p>
                <p className="text-slate-500 text-sm mt-1">Agrega productos con imagen y descripción desde el panel de administración.</p>
              </>
            )}
          </div>
        ) : (
          <>
            <motion.div
              key={paginaActual}
              variants={contenedorStagger}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {productosPagina.map((p) => (
                <motion.article
                  key={p.id}
                  variants={itemTarjeta}
                  whileHover={{ y: -6 }}
                  className="group rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm hover:shadow-lg hover:border-yellow-400 transition flex flex-col"
                >
                  <div className="relative h-52 bg-slate-100">
                    <ImagenProducto src={p.imagen} alt={p.nombre} className="w-full h-full group-hover:scale-[1.03] transition-transform duration-300" />
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-[#0b3d91]/90 text-white text-xs font-semibold">
                      {p.categoria}
                    </span>
                    {p.esGranel && (
                      <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-yellow-400 text-[#0b3d91] text-xs font-bold">
                        A granel
                      </span>
                    )}
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="text-lg font-extrabold text-slate-900">{p.nombre}</h3>
                    <p className="mt-1 text-sm text-slate-600 flex-1">
                      {p.descripcion?.trim() || 'Producto disponible en Nutri-Ala.'}
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-2xl font-extrabold text-red-600">
                        ${formatearMoneda(p.precio)}
                        {p.esGranel && <span className="text-slate-400 font-medium text-sm">/kg</span>}
                      </span>
                      <span className="text-xs font-semibold text-[#0b3d91] bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                        Disponible
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => agregarAlCarrito(p)}
                      className="mt-4 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-yellow-400 text-[#0b3d91] font-bold hover:bg-yellow-300 transition shadow-sm"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Agregar al carrito
                    </button>
                  </div>
                </motion.article>
              ))}
            </motion.div>

            {/* Paginación */}
            {totalPaginas > 1 && (
              <div className="mt-10 flex flex-col items-center gap-3">
                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                  <button
                    onClick={() => irAPagina(paginaActual - 1)}
                    disabled={paginaActual === 1}
                    className="px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 bg-white text-slate-700 hover:border-[#0b3d91] hover:text-[#0b3d91] disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    Anterior
                  </button>

                  {/* Primera página + elipsis */}
                  {paginasVisibles[0] > 1 && (
                    <>
                      <button
                        onClick={() => irAPagina(1)}
                        className="w-10 h-10 rounded-lg text-sm font-bold border bg-white text-slate-700 border-slate-200 hover:border-yellow-400 hover:text-[#0b3d91] transition"
                      >
                        1
                      </button>
                      {paginasVisibles[0] > 2 && <span className="px-1 text-slate-400 select-none">…</span>}
                    </>
                  )}

                  {paginasVisibles.map((n) => (
                    <button
                      key={n}
                      onClick={() => irAPagina(n)}
                      className={`w-10 h-10 rounded-lg text-sm font-bold border transition ${
                        n === paginaActual
                          ? 'bg-[#0b3d91] text-white border-[#0b3d91] shadow'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-yellow-400 hover:text-[#0b3d91]'
                      }`}
                    >
                      {n}
                    </button>
                  ))}

                  {/* Elipsis + última página */}
                  {paginasVisibles[paginasVisibles.length - 1] < totalPaginas && (
                    <>
                      {paginasVisibles[paginasVisibles.length - 1] < totalPaginas - 1 && <span className="px-1 text-slate-400 select-none">…</span>}
                      <button
                        onClick={() => irAPagina(totalPaginas)}
                        className="w-10 h-10 rounded-lg text-sm font-bold border bg-white text-slate-700 border-slate-200 hover:border-yellow-400 hover:text-[#0b3d91] transition"
                      >
                        {totalPaginas}
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => irAPagina(paginaActual + 1)}
                    disabled={paginaActual === totalPaginas}
                    className="px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 bg-white text-slate-700 hover:border-[#0b3d91] hover:text-[#0b3d91] disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    Siguiente
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Mostrando {(paginaActual - 1) * PRODUCTOS_POR_PAGINA + 1}
                  {'–'}
                  {Math.min(paginaActual * PRODUCTOS_POR_PAGINA, productosFiltrados.length)} de {productosFiltrados.length} productos
                </p>
              </div>
            )}
          </>
        )}
      </section>

      {/* Contacto / Footer */}
      <footer id="contacto" className="bg-slate-900 text-slate-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center overflow-hidden ring-2 ring-yellow-400">
                <Logo size={44} />
              </div>
              <div className="leading-tight">
                <span className="block font-extrabold text-white text-lg">
                  Nutri<span className="text-yellow-400">-</span>Ala
                </span>
                <span className="block text-xs text-yellow-300">el buen sabor del pollo…</span>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-400 max-w-xs">
              Pollo fresco y productos de calidad para tu familia. Gracias por preferirnos.
            </p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-3">Contacto</h4>
            <ul className="space-y-2 text-sm">
              <li>Dirección: (agregar dirección)</li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <a href="tel:+527121537999" className="hover:text-yellow-300 transition">+52 712 153 7999</a>
              </li>
              <li>
                <p className="font-semibold text-slate-300">Horario de atención:</p>
                <p>Lunes a sábado: 8:00 am - 7:00 pm</p>
                <p>Domingos: 8:00 am - 6:00 pm</p>
              </li>
            </ul>
            <a
              href="https://wa.me/527121537999?text=Hola%20Nutri-Ala,%20quisiera%20hacer%20un%20pedido"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm transition shadow-lg"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
              Enviar WhatsApp
            </a>
          </div>
          <div>
            <h4 className="text-white font-bold mb-3">Enlaces</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#ofertas" className="hover:text-yellow-300 transition">Ofertas</a></li>
              <li><a href="#productos" className="hover:text-yellow-300 transition">Productos</a></li>
              <li><Link href="/acceso" className="hover:text-yellow-300 transition">Acceso administrador</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800 py-5 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Nutri-Ala · El buen sabor del pollo
        </div>
      </footer>

      {/* Botón flotante de WhatsApp */}
      <motion.a
        href="https://wa.me/527121537999?text=Hola%20Nutri-Ala,%20quisiera%20hacer%20un%20pedido"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Enviar WhatsApp a Nutri-Ala"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8, type: 'spring', stiffness: 260, damping: 18 }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="group fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-2xl shadow-green-500/30 transition-all p-4 sm:pr-5"
      >
        <svg className="w-7 h-7 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
        <span className="hidden sm:inline-block max-w-0 overflow-hidden whitespace-nowrap font-bold text-sm transition-all duration-300 group-hover:max-w-[10rem] group-hover:ml-1">
          Escríbenos
        </span>
      </motion.a>

      {/* Aviso al agregar al carrito */}
      <AnimatePresence>
        {avisoCarrito && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-24 left-1/2 z-50 flex items-center gap-2 rounded-xl bg-[#0b3d91] text-white px-4 py-3 shadow-2xl"
          >
            <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-semibold">{avisoCarrito}</span>
            <Link href="/carrito" className="ml-2 text-xs font-bold text-yellow-300 underline">
              Ver carrito
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}
