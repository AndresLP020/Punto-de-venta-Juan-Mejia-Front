'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, MotionConfig, type Variants } from 'framer-motion';
import { getProductos, getOfertas, type Producto, type Oferta } from '@/lib/api';
import { formatearMoneda } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import { useCart } from '@/contexts/CartContext';
import { TIENDA } from '@/lib/tienda';

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

const ENLACES_NAV = [
  { href: '#inicio', label: 'Inicio' },
  { href: '#productos', label: 'Catálogo' },
  { href: '#ofertas', label: 'Ofertas' },
  { href: '#contacto', label: 'Contacto' },
];

const ICONO_WHATSAPP =
  'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z';

const LINK_WHATSAPP = TIENDA.whatsapp
  ? `https://wa.me/${TIENDA.whatsapp}?text=${encodeURIComponent('Hola ARISE Athletic Shop, quisiera hacer un pedido')}`
  : '';

const REDES = [
  { key: 'instagram', label: 'Instagram', url: TIENDA.redes.instagram },
  { key: 'facebook', label: 'Facebook', url: TIENDA.redes.facebook },
  { key: 'tiktok', label: 'TikTok', url: TIENDA.redes.tiktok },
].filter((r) => r.url);

function ImagenProducto({ src, alt, className = '' }: { src?: string; alt: string; className?: string }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-arise-deep/40 via-arise-card to-arise-bg ${className}`}>
        <svg className="w-1/3 h-1/3 text-arise-lavender/40" fill="none" stroke="currentColor" strokeWidth={1.4} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} onError={() => setError(true)} className={`object-cover ${className}`} />;
}

/**
 * Visual del hero. Si existe `public/hero-arise.jpg` (fotografía de campaña)
 * se muestra; si no, se usa el logo oficial con iluminación neón.
 */
function HeroVisual() {
  const [hayFoto, setHayFoto] = useState(true);
  return (
    <div className="relative mx-auto w-full max-w-md aspect-[4/5]">
      <div className="absolute inset-6 rounded-[2rem] bg-arise-primary blur-3xl opacity-60 animate-glow-pulse" aria-hidden="true" />
      <div className="relative h-full w-full overflow-hidden rounded-[2rem] border border-arise-neon/40 bg-arise-card shadow-glow-strong">
        {hayFoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/hero-arise.jpg"
            alt="Campaña ARISE Athletic Shop"
            onError={() => setHayFoto(false)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="relative flex h-full w-full items-center justify-center bg-grid-neon">
            <div className="absolute h-3/4 w-3/4 rounded-full border border-arise-neon/30" aria-hidden="true" />
            <div className="absolute h-[55%] w-[55%] rounded-full border border-arise-fuchsia/30" aria-hidden="true" />
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              className="relative drop-shadow-[0_0_35px_rgba(161,0,255,0.7)]"
            >
              <Logo size={220} />
            </motion.div>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-arise-bg via-arise-bg/40 to-transparent" />
        <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between">
          <span className="font-display text-xs font-bold uppercase tracking-[0.3em] text-arise-lavender">Athletic Shop</span>
          <span className="h-px flex-1 mx-3 bg-arise-electric" aria-hidden="true" />
          <span className="font-display text-xs font-bold uppercase tracking-[0.3em] text-white">Arise</span>
        </div>
      </div>
    </div>
  );
}

function EncabezadoSeccion({ eyebrow, titulo, subtitulo }: { eyebrow: string; titulo: React.ReactNode; subtitulo?: string }) {
  return (
    <motion.div variants={contenedorStagger} {...revelarAlEntrar} className="mb-8 max-w-2xl">
      <motion.span variants={itemArriba} className="eyebrow-neon block">
        {eyebrow}
      </motion.span>
      <motion.h2 variants={itemArriba} className="heading-display mt-2 text-4xl sm:text-5xl">
        {titulo}
      </motion.h2>
      {subtitulo && (
        <motion.p variants={itemArriba} className="mt-3 text-arise-text2">
          {subtitulo}
        </motion.p>
      )}
    </motion.div>
  );
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
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const busquedaRef = useRef<HTMLInputElement>(null);

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

  // Transición de fondo del navbar al hacer scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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

  // Botón "Buscar" del navbar: lleva al catálogo y enfoca el buscador existente
  const irABuscar = () => {
    setMenuAbierto(false);
    document.getElementById('productos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => busquedaRef.current?.focus({ preventScroll: true }), 450);
  };

  const destacados = useMemo(() => productos.filter((p) => p.destacado).slice(0, 6), [productos]);

  const hayContacto = Boolean(
    LINK_WHATSAPP || TIENDA.telefono || TIENDA.email || TIENDA.direccion || TIENDA.horarios.length || REDES.length
  );

  const botonPaginaBase =
    'w-10 h-10 rounded-lg text-sm font-bold border transition font-display';
  const botonPaginaInactivo =
    'bg-arise-card text-arise-text2 border-arise-border hover:border-arise-neon hover:text-white hover:shadow-glow';

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen overflow-x-clip bg-arise-bg text-white">
      {/* Barra superior */}
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-xl transition-colors duration-300 ${
          scrolled ? 'bg-arise-bg/85 border-arise-neon/30 shadow-[0_8px_30px_-12px_rgba(161,0,255,0.45)]' : 'bg-arise-bg/60 border-arise-border/60'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-[72px] flex items-center justify-between gap-4">
          <a href="#inicio" className="flex items-center gap-3 flex-shrink-0" aria-label="ARISE Athletic Shop — inicio">
            <div className="rounded-full ring-1 ring-arise-neon/50 shadow-glow overflow-hidden">
              <Logo size={44} />
            </div>
            <div className="leading-none hidden min-[380px]:block">
              <span className="block font-display font-bold uppercase tracking-[0.18em] text-lg text-white">Arise</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.3em] text-arise-lavender">Athletic Shop</span>
            </div>
          </a>
          <nav className="hidden md:flex items-center gap-1 font-display text-[15px] font-semibold uppercase tracking-wider">
            {ENLACES_NAV.map((e) => (
              <a
                key={e.href}
                href={e.href}
                className="relative px-4 py-2 text-arise-text2 hover:text-white transition after:absolute after:left-4 after:right-4 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-arise-primary after:scale-x-0 after:transition-transform hover:after:scale-x-100 hover:[text-shadow:0_0_12px_rgba(161,0,255,0.8)]"
              >
                {e.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={irABuscar}
              aria-label="Buscar productos"
              className="flex items-center justify-center w-10 h-10 rounded-lg text-arise-text2 hover:text-white hover:bg-arise-neon/15 hover:shadow-glow transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <Link
              href="/carrito"
              aria-label="Ver carrito"
              className="relative flex items-center justify-center w-10 h-10 rounded-lg text-arise-text2 hover:text-white hover:bg-arise-neon/15 hover:shadow-glow transition"
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
                    className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full bg-arise-fuchsia text-white text-[11px] font-extrabold ring-2 ring-arise-bg shadow-glow-fuchsia"
                  >
                    {totalUnidades % 1 === 0 ? totalUnidades : totalUnidades.toFixed(1)}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
            <Link
              href="/acceso"
              className="hidden sm:inline-flex font-display text-sm font-bold uppercase tracking-wider px-4 py-2 rounded-lg border border-arise-neon/60 text-white hover:bg-arise-neon/20 hover:shadow-glow transition"
            >
              Acceso
            </Link>
            <button
              type="button"
              onClick={() => setMenuAbierto((v) => !v)}
              aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={menuAbierto}
              aria-controls="menu-movil"
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-white hover:bg-arise-neon/15 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                {menuAbierto ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Menú móvil */}
        <AnimatePresence>
          {menuAbierto && (
            <motion.nav
              id="menu-movil"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE_SUAVE }}
              className="md:hidden overflow-hidden border-t border-arise-border bg-arise-bg/95"
            >
              <div className="px-4 py-3 flex flex-col font-display text-lg font-semibold uppercase tracking-wider">
                {ENLACES_NAV.map((e) => (
                  <a
                    key={e.href}
                    href={e.href}
                    onClick={() => setMenuAbierto(false)}
                    className="py-3 border-b border-arise-border/60 text-arise-text2 hover:text-white transition"
                  >
                    {e.label}
                  </a>
                ))}
                <Link
                  href="/acceso"
                  onClick={() => setMenuAbierto(false)}
                  className="py-3 text-arise-lavender hover:text-white transition"
                >
                  Acceso
                </Link>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      {/* Hero */}
      <section id="inicio" className="relative overflow-hidden border-b border-arise-border scroll-mt-20">
        <div className="absolute inset-0 bg-grid-neon [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" aria-hidden="true" />
        <div className="absolute -top-40 -left-32 w-[32rem] h-[32rem] rounded-full bg-arise-violet/30 blur-[120px]" aria-hidden="true" />
        <div className="absolute -bottom-40 right-0 w-[28rem] h-[28rem] rounded-full bg-arise-fuchsia/20 blur-[120px]" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid md:grid-cols-2 gap-12 items-center">
          <motion.div variants={contenedorStagger} initial="hidden" animate="visible">
            <motion.span
              variants={itemArriba}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-arise-fuchsia/50 bg-arise-fuchsia/10 text-arise-lavender font-display text-xs font-bold uppercase tracking-[0.25em]"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-arise-fuchsia shadow-glow-fuchsia" aria-hidden="true" />
              Ropa deportiva &amp; fitness
            </motion.span>
            <motion.h1 variants={itemArriba} className="heading-display mt-5 text-5xl sm:text-6xl lg:text-7xl">
              <span className="text-gradient-neon">Arise</span>
              <br />
              Athletic Shop
            </motion.h1>
            <motion.p variants={itemArriba} className="mt-5 font-display text-xl sm:text-2xl font-bold uppercase tracking-wide text-white">
              Eleva tu potencial. <span className="text-gradient-neon">Domina tu estilo.</span>
            </motion.p>
            <motion.p variants={itemArriba} className="mt-4 text-arise-text2 text-base sm:text-lg max-w-md">
              Descubre ropa deportiva diseñada para acompañarte en cada entrenamiento. Combina rendimiento, comodidad y
              actitud en cada movimiento.
            </motion.p>
            <motion.div variants={itemArriba} className="mt-8 flex flex-col min-[420px]:flex-row flex-wrap gap-3">
              <a href="#productos" className="btn-neon">
                Explorar colección
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
              <a href="#ofertas" className="btn-outline-neon">
                Ver ofertas
              </a>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE_SUAVE, delay: 0.15 }}
          >
            <HeroVisual />
          </motion.div>
        </div>
        {/* Franja de energía */}
        <div className="h-[3px] w-full bg-arise-primary shadow-glow-fuchsia" aria-hidden="true" />
      </section>

      {/* Ofertas */}
      <section id="ofertas" className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 scroll-mt-20">
        <EncabezadoSeccion
          eyebrow="Promociones"
          titulo={
            <>
              Ofertas que <span className="text-gradient-neon">impulsan</span> tu entrenamiento
            </>
          }
          subtitulo="Equípate con estilo y aprovecha nuestras promociones disponibles."
        />

        {loading ? (
          <p className="text-arise-muted">Cargando ofertas…</p>
        ) : ofertas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-arise-fuchsia/40 bg-arise-fuchsia/5 p-10 text-center">
            <p className="text-white font-semibold">Por ahora no hay ofertas activas.</p>
            <p className="text-arise-muted text-sm mt-1">¡Vuelve pronto para conocer nuestras promociones!</p>
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
                  className="group relative card-neon overflow-hidden hover:border-arise-fuchsia/70 hover:shadow-[0_0_0_1px_rgba(255,0,229,0.3),0_18px_40px_-18px_rgba(255,0,229,0.6)]"
                >
                  <div className="relative aspect-[4/3] bg-arise-bg2 overflow-hidden">
                    <ImagenProducto src={o.imagen} alt={o.titulo} className="w-full h-full group-hover:scale-[1.04] transition-transform duration-500" />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-arise-card via-transparent to-transparent" />
                    {tieneDescuento && (
                      <span className="tag-fuchsia absolute top-3 left-3">-{pct}%</span>
                    )}
                    <span className="absolute top-3 right-3 px-3 py-1 rounded-full bg-arise-bg/80 border border-arise-neon/50 text-arise-lavender font-display text-xs font-bold uppercase tracking-widest backdrop-blur">
                      Oferta
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-display text-xl font-bold uppercase tracking-wide text-white">{o.titulo}</h3>
                    {o.descripcion && <p className="mt-1 text-sm text-arise-text2 line-clamp-3">{o.descripcion}</p>}
                    {o.productos && o.productos.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {o.productos.slice(0, 5).map((p, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-md bg-arise-neon/10 text-arise-lavender text-xs font-medium border border-arise-neon/25">
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                    {(o.precioOferta ?? 0) > 0 && (
                      <div className="mt-4 flex items-end gap-2">
                        <span className="font-display text-3xl font-bold text-arise-fuchsia [text-shadow:0_0_18px_rgba(255,0,229,0.45)]">
                          ${formatearMoneda(o.precioOferta!)}
                        </span>
                        {tieneDescuento && (
                          <span className="text-sm text-arise-muted line-through mb-1">${formatearMoneda(o.precioNormal!)}</span>
                        )}
                      </div>
                    )}
                    {o.fechaFin && (
                      <p className="mt-2 text-xs text-arise-muted">Válida hasta {o.fechaFin.slice(0, 10)}</p>
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
        <section className="relative border-y border-arise-border bg-arise-bg2">
          <div className="absolute inset-0 bg-gradient-to-r from-arise-violet/10 via-transparent to-arise-fuchsia/10" aria-hidden="true" />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-14">
            <EncabezadoSeccion eyebrow="Lo más buscado" titulo="Productos destacados" />
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
                  className="group card-neon card-neon-hover overflow-hidden"
                >
                  <div className="aspect-square overflow-hidden bg-arise-bg2">
                    <ImagenProducto src={p.imagen} alt={p.nombre} className="w-full h-full group-hover:scale-[1.05] transition-transform duration-500" />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-white truncate">{p.nombre}</p>
                    <p className="font-display text-lg font-bold text-arise-lavender mt-0.5">
                      ${formatearMoneda(p.precio)}{p.esGranel && <span className="text-arise-muted font-medium text-xs">/kg</span>}
                    </p>
                    <button
                      type="button"
                      onClick={() => agregarAlCarrito(p)}
                      className="mt-2 w-full py-1.5 rounded-lg bg-arise-primary text-white font-display text-sm font-bold uppercase tracking-wider shadow-glow hover:shadow-glow-strong transition"
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
      <section id="productos" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 scroll-mt-20">
        <EncabezadoSeccion
          eyebrow="Nuestro catálogo"
          titulo={
            <>
              Equípate para <span className="text-gradient-neon">rendir</span>
            </>
          }
        />

        {/* Filtro de categorías */}
        {categorias.length > 1 && (
          <div className="flex gap-2 mb-5 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible scrollbar-thin">
            {categorias.map((c) => (
              <button
                key={c}
                onClick={() => setCategoriaActiva(c)}
                className={`flex-shrink-0 px-4 py-2 rounded-full font-display text-sm font-bold uppercase tracking-wider transition border ${
                  categoriaActiva === c
                    ? 'bg-arise-primary text-white border-transparent shadow-glow'
                    : 'bg-arise-card text-arise-text2 border-arise-border hover:border-arise-neon hover:text-white'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {/* Barra de búsqueda */}
        <div className="mb-10 max-w-xl">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-arise-lavender pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={busquedaRef}
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar un producto por nombre, categoría…"
              className="input-neon pl-11 pr-11 py-3"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full text-arise-muted hover:bg-arise-neon/20 hover:text-white transition"
                aria-label="Limpiar búsqueda"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {busqueda.trim() && (
            <p className="mt-2 text-sm text-arise-muted">
              {productosFiltrados.length} {productosFiltrados.length === 1 ? 'resultado' : 'resultados'} para “{busqueda.trim()}”
            </p>
          )}
        </div>

        {loading ? (
          <p className="text-arise-muted">Cargando productos…</p>
        ) : productosFiltrados.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-arise-neon/40 bg-arise-neon/5 p-10 text-center">
            {busqueda.trim() || categoriaActiva !== 'Todo' ? (
              <>
                <p className="text-white font-semibold">No encontramos productos con esos criterios.</p>
                <button
                  type="button"
                  onClick={() => {
                    setBusqueda('');
                    setCategoriaActiva('Todo');
                  }}
                  className="btn-neon mt-4 px-5 py-2 text-sm"
                >
                  Limpiar filtros
                </button>
              </>
            ) : (
              <>
                <p className="text-white font-semibold">Aún no hay productos para mostrar.</p>
                <p className="text-arise-muted text-sm mt-1">Agrega productos con imagen y descripción desde el panel de administración.</p>
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
              className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6"
            >
              {productosPagina.map((p) => (
                <motion.article
                  key={p.id}
                  variants={itemTarjeta}
                  whileHover={{ y: -6 }}
                  className="group card-neon card-neon-hover overflow-hidden flex flex-col"
                >
                  <div className="relative aspect-[4/5] bg-arise-bg2 overflow-hidden">
                    <ImagenProducto src={p.imagen} alt={p.nombre} className="w-full h-full group-hover:scale-[1.05] transition-transform duration-500" />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-arise-card/90 via-transparent to-transparent" />
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-arise-bg/75 border border-arise-neon/40 text-arise-lavender font-display text-xs font-bold uppercase tracking-wider backdrop-blur">
                      {p.categoria}
                    </span>
                    {p.esGranel && (
                      <span className="tag-fuchsia absolute top-3 right-3 px-2.5 text-xs">A granel</span>
                    )}
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="font-display text-xl font-bold uppercase tracking-wide text-white">{p.nombre}</h3>
                    <p className="mt-1 text-sm text-arise-text2 flex-1">
                      {p.descripcion?.trim() || 'Disponible en ARISE Athletic Shop.'}
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="font-display text-3xl font-bold text-white">
                        ${formatearMoneda(p.precio)}
                        {p.esGranel && <span className="text-arise-muted font-medium text-sm">/kg</span>}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-arise-lavender bg-arise-neon/10 px-2.5 py-1 rounded-full border border-arise-neon/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-arise-lavender" aria-hidden="true" />
                        Disponible
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => agregarAlCarrito(p)}
                      className="btn-neon mt-4 w-full py-2.5"
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
              <div className="mt-12 flex flex-col items-center gap-3">
                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                  <button
                    onClick={() => irAPagina(paginaActual - 1)}
                    disabled={paginaActual === 1}
                    className="px-3 py-2 rounded-lg font-display text-sm font-bold uppercase tracking-wider border border-arise-border bg-arise-card text-arise-text2 hover:border-arise-neon hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    Anterior
                  </button>

                  {/* Primera página + elipsis */}
                  {paginasVisibles[0] > 1 && (
                    <>
                      <button onClick={() => irAPagina(1)} className={`${botonPaginaBase} ${botonPaginaInactivo}`}>
                        1
                      </button>
                      {paginasVisibles[0] > 2 && <span className="px-1 text-arise-muted select-none">…</span>}
                    </>
                  )}

                  {paginasVisibles.map((n) => (
                    <button
                      key={n}
                      onClick={() => irAPagina(n)}
                      className={`${botonPaginaBase} ${
                        n === paginaActual ? 'bg-arise-primary text-white border-transparent shadow-glow' : botonPaginaInactivo
                      }`}
                    >
                      {n}
                    </button>
                  ))}

                  {/* Elipsis + última página */}
                  {paginasVisibles[paginasVisibles.length - 1] < totalPaginas && (
                    <>
                      {paginasVisibles[paginasVisibles.length - 1] < totalPaginas - 1 && <span className="px-1 text-arise-muted select-none">…</span>}
                      <button onClick={() => irAPagina(totalPaginas)} className={`${botonPaginaBase} ${botonPaginaInactivo}`}>
                        {totalPaginas}
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => irAPagina(paginaActual + 1)}
                    disabled={paginaActual === totalPaginas}
                    className="px-3 py-2 rounded-lg font-display text-sm font-bold uppercase tracking-wider border border-arise-border bg-arise-card text-arise-text2 hover:border-arise-neon hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    Siguiente
                  </button>
                </div>
                <p className="text-xs text-arise-muted">
                  Mostrando {(paginaActual - 1) * PRODUCTOS_POR_PAGINA + 1}
                  {'–'}
                  {Math.min(paginaActual * PRODUCTOS_POR_PAGINA, productosFiltrados.length)} de {productosFiltrados.length} productos
                </p>
              </div>
            )}
          </>
        )}
      </section>

      {/* Contacto */}
      <section id="contacto" className="relative overflow-hidden border-t border-arise-border bg-arise-dark scroll-mt-20">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[40rem] h-64 rounded-full bg-arise-neon/20 blur-[110px]" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <EncabezadoSeccion
            eyebrow="Contacto"
            titulo={
              <>
                Hablemos de tu <span className="text-gradient-neon">próximo nivel</span>
              </>
            }
            subtitulo="¿Dudas sobre tallas, pedidos o disponibilidad? Estamos para ayudarte."
          />
          {hayContacto ? (
            <motion.div variants={contenedorStagger} {...revelarAlEntrar} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {LINK_WHATSAPP && (
                <motion.a
                  variants={itemTarjeta}
                  href={LINK_WHATSAPP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card-neon card-neon-hover p-5 flex items-center gap-4"
                >
                  <span className="w-12 h-12 rounded-xl bg-arise-primary flex items-center justify-center shadow-glow flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d={ICONO_WHATSAPP} /></svg>
                  </span>
                  <span>
                    <span className="block font-display font-bold uppercase tracking-wider text-white">WhatsApp</span>
                    <span className="block text-sm text-arise-text2">Envíanos un mensaje</span>
                  </span>
                </motion.a>
              )}
              {TIENDA.telefono && (
                <motion.a variants={itemTarjeta} href={`tel:${TIENDA.telefono.replace(/\s/g, '')}`} className="card-neon card-neon-hover p-5 flex items-center gap-4">
                  <span className="w-12 h-12 rounded-xl bg-arise-neon/15 border border-arise-neon/40 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-arise-lavender" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </span>
                  <span>
                    <span className="block font-display font-bold uppercase tracking-wider text-white">Teléfono</span>
                    <span className="block text-sm text-arise-text2">{TIENDA.telefono}</span>
                  </span>
                </motion.a>
              )}
              {TIENDA.email && (
                <motion.a variants={itemTarjeta} href={`mailto:${TIENDA.email}`} className="card-neon card-neon-hover p-5 flex items-center gap-4">
                  <span className="w-12 h-12 rounded-xl bg-arise-neon/15 border border-arise-neon/40 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-arise-lavender" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display font-bold uppercase tracking-wider text-white">Correo</span>
                    <span className="block text-sm text-arise-text2 truncate">{TIENDA.email}</span>
                  </span>
                </motion.a>
              )}
              {TIENDA.direccion && (
                <motion.div variants={itemTarjeta} className="card-neon p-5 flex items-center gap-4">
                  <span className="w-12 h-12 rounded-xl bg-arise-neon/15 border border-arise-neon/40 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-arise-lavender" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </span>
                  <span>
                    <span className="block font-display font-bold uppercase tracking-wider text-white">Dirección</span>
                    <span className="block text-sm text-arise-text2">{TIENDA.direccion}</span>
                  </span>
                </motion.div>
              )}
              {TIENDA.horarios.length > 0 && (
                <motion.div variants={itemTarjeta} className="card-neon p-5 flex items-center gap-4">
                  <span className="w-12 h-12 rounded-xl bg-arise-neon/15 border border-arise-neon/40 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-arise-lavender" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                  <span>
                    <span className="block font-display font-bold uppercase tracking-wider text-white">Horario</span>
                    {TIENDA.horarios.map((h) => (
                      <span key={h} className="block text-sm text-arise-text2">{h}</span>
                    ))}
                  </span>
                </motion.div>
              )}
              {REDES.map((r) => (
                <motion.a
                  key={r.key}
                  variants={itemTarjeta}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card-neon card-neon-hover p-5 flex items-center gap-4"
                >
                  <span className="w-12 h-12 rounded-xl bg-arise-fuchsia/15 border border-arise-fuchsia/40 flex items-center justify-center flex-shrink-0 font-display font-bold text-arise-fuchsia">
                    {r.label.charAt(0)}
                  </span>
                  <span>
                    <span className="block font-display font-bold uppercase tracking-wider text-white">{r.label}</span>
                    <span className="block text-sm text-arise-text2">Síguenos</span>
                  </span>
                </motion.a>
              ))}
            </motion.div>
          ) : (
            <div className="card-neon p-6 max-w-xl">
              <p className="text-arise-text2">Muy pronto publicaremos nuestros canales de atención.</p>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative bg-arise-bg border-t border-arise-border text-arise-text2">
        <div className="h-px w-full bg-arise-electric opacity-60" aria-hidden="true" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid sm:grid-cols-2 md:grid-cols-3 gap-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-full ring-1 ring-arise-neon/50 shadow-glow overflow-hidden">
                <Logo size={56} />
              </div>
              <div className="leading-none">
                <span className="block font-display font-bold uppercase tracking-[0.18em] text-white text-xl">Arise</span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.3em] text-arise-lavender mt-1">Athletic Shop</span>
              </div>
            </div>
            <p className="mt-5 font-display text-lg font-semibold uppercase tracking-wide text-gradient-neon max-w-xs">
              {TIENDA.lema}
            </p>
          </div>
          <div>
            <h4 className="font-display text-white font-bold uppercase tracking-widest mb-4">Enlaces</h4>
            <ul className="space-y-2 text-sm">
              {ENLACES_NAV.map((e) => (
                <li key={e.href}>
                  <a href={e.href} className="hover:text-white hover:[text-shadow:0_0_10px_rgba(161,0,255,0.8)] transition">{e.label}</a>
                </li>
              ))}
              <li><Link href="/carrito" className="hover:text-white transition">Carrito</Link></li>
              <li><Link href="/acceso" className="hover:text-white transition">Acceso administrador</Link></li>
            </ul>
          </div>
          {hayContacto && (
            <div>
              <h4 className="font-display text-white font-bold uppercase tracking-widest mb-4">Contacto</h4>
              <ul className="space-y-2 text-sm">
                {TIENDA.telefono && <li><a href={`tel:${TIENDA.telefono.replace(/\s/g, '')}`} className="hover:text-white transition">{TIENDA.telefono}</a></li>}
                {TIENDA.email && <li><a href={`mailto:${TIENDA.email}`} className="hover:text-white transition break-all">{TIENDA.email}</a></li>}
                {TIENDA.direccion && <li>{TIENDA.direccion}</li>}
                {TIENDA.horarios.map((h) => <li key={h}>{h}</li>)}
                {REDES.map((r) => (
                  <li key={r.key}><a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition">{r.label}</a></li>
                ))}
                {LINK_WHATSAPP && (
                  <li><a href={LINK_WHATSAPP} target="_blank" rel="noopener noreferrer" className="hover:text-white transition">WhatsApp</a></li>
                )}
              </ul>
            </div>
          )}
        </div>
        <div className="border-t border-arise-border py-5 text-center text-xs text-arise-muted">
          © {new Date().getFullYear()} ARISE Athletic Shop · Todos los derechos reservados
        </div>
      </footer>

      {/* Botón flotante de WhatsApp (se muestra cuando hay número configurado) */}
      {LINK_WHATSAPP && (
        <motion.a
          href={LINK_WHATSAPP}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Enviar WhatsApp a ARISE Athletic Shop"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, type: 'spring', stiffness: 260, damping: 18 }}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          className="group fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-arise-primary text-white shadow-glow-strong transition-all p-4 sm:pr-5"
        >
          <svg className="w-7 h-7 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d={ICONO_WHATSAPP} />
          </svg>
          <span className="hidden sm:inline-block max-w-0 overflow-hidden whitespace-nowrap font-display font-bold uppercase tracking-wider text-sm transition-all duration-300 group-hover:max-w-[10rem] group-hover:ml-1">
            Escríbenos
          </span>
        </motion.a>
      )}

      {/* Aviso al agregar al carrito */}
      <AnimatePresence>
        {avisoCarrito && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-24 left-1/2 z-50 flex items-center gap-2 rounded-xl border border-arise-neon/50 bg-arise-card/95 backdrop-blur text-white px-4 py-3 shadow-glow-strong max-w-[calc(100vw-2rem)]"
          >
            <svg className="w-5 h-5 text-arise-fuchsia flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-semibold truncate">{avisoCarrito}</span>
            <Link href="/carrito" className="ml-2 text-xs font-bold text-arise-lavender underline flex-shrink-0">
              Ver carrito
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}
