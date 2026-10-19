'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '@/contexts/CartContext';
import { formatearMoneda } from '@/lib/utils';
import { getPagosConfig } from '@/lib/api';
import { Logo } from '@/components/Logo';
import { CheckoutPasos } from '@/components/CheckoutPasos';

function ImagenMini({ src, alt }: { src?: string; alt: string }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className="flex items-center justify-center bg-gradient-to-br from-arise-deep/40 to-arise-card w-full h-full rounded-lg">
        <svg className="w-1/2 h-1/2 text-arise-lavender/40" fill="none" stroke="currentColor" strokeWidth={1.4} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} onError={() => setError(true)} className="object-cover w-full h-full rounded-lg" />;
}

export default function CarritoPage() {
  const { items, actualizarCantidad, quitar, limpiar, subtotal, totalUnidades } = useCart();
  // Comisión de envío configurada en el POS (solo se cobra si eliges envío a domicilio)
  const [costoEnvio, setCostoEnvio] = useState<number | null>(null);
  useEffect(() => {
    getPagosConfig()
      .then((c) => setCostoEnvio(c.costoEnvio ?? null))
      .catch(() => setCostoEnvio(null));
  }, []);

  return (
    <div className="min-h-screen bg-arise-bg text-white">
      <header className="sticky top-0 z-40 bg-arise-bg/80 backdrop-blur-xl border-b border-arise-neon/30 text-white shadow-[0_8px_30px_-12px_rgba(161,0,255,0.45)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="rounded-full ring-1 ring-arise-neon/50 shadow-glow overflow-hidden">
              <Logo size={36} />
            </div>
            <span className="font-display font-bold uppercase tracking-wider text-lg">
              ARISE <span className="text-arise-lavender font-semibold">Athletic Shop</span>
            </span>
          </Link>
          <Link href="/" className="text-sm font-semibold hover:text-arise-lavender transition">
            ← Seguir comprando
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <CheckoutPasos actual={1} />
        <h1 className="heading-display text-4xl sm:text-5xl mb-6">Tu carrito</h1>

        {items.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-arise-neon/40 bg-arise-card p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-arise-border" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="mt-4 text-arise-text2 font-semibold">Tu carrito está vacío.</p>
            <Link
              href="/#productos"
              className="mt-5 inline-block px-6 py-3 rounded-xl bg-arise-primary text-white font-display font-bold uppercase tracking-wider shadow-glow hover:shadow-glow-strong transition"
            >
              Ver productos
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Lista de productos */}
            <div className="lg:col-span-2 space-y-3">
              <AnimatePresence initial={false}>
                {items.map((item) => {
                  const paso = item.esGranel ? 0.5 : 1;
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex items-center gap-4 bg-arise-card rounded-2xl border border-arise-border p-3 sm:p-4 shadow-sm"
                    >
                      <div className="w-20 h-20 flex-shrink-0">
                        <ImagenMini src={item.imagen} alt={item.nombre} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white truncate">{item.nombre}</p>
                        <p className="text-arise-lavender font-extrabold">
                          ${formatearMoneda(item.precio)}
                          {item.esGranel && <span className="text-arise-muted font-medium text-xs">/kg</span>}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="inline-flex items-center rounded-lg border border-arise-border overflow-hidden">
                            <button
                              type="button"
                              onClick={() => actualizarCantidad(item.id, Math.round((item.cantidad - paso) * 1000) / 1000)}
                              className="w-8 h-8 flex items-center justify-center text-arise-text2 hover:bg-arise-neon/15 transition"
                              aria-label="Disminuir"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              value={item.cantidad}
                              min={0}
                              step={paso}
                              onChange={(e) => actualizarCantidad(item.id, Number(e.target.value))}
                              className="w-14 h-8 bg-transparent text-white text-center text-sm font-semibold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              onClick={() => actualizarCantidad(item.id, Math.round((item.cantidad + paso) * 1000) / 1000)}
                              className="w-8 h-8 flex items-center justify-center text-arise-text2 hover:bg-arise-neon/15 transition"
                              aria-label="Aumentar"
                            >
                              +
                            </button>
                          </div>
                          {item.esGranel && <span className="text-xs text-arise-muted">kg</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold text-white">${formatearMoneda(item.precio * item.cantidad)}</p>
                        <button
                          type="button"
                          onClick={() => quitar(item.id)}
                          className="mt-2 text-xs font-semibold text-red-500 hover:text-red-400 transition"
                        >
                          Quitar
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              <button
                type="button"
                onClick={limpiar}
                className="text-sm font-semibold text-arise-muted hover:text-red-500 transition"
              >
                Vaciar carrito
              </button>
            </div>

            {/* Resumen */}
            <div className="lg:col-span-1">
              <div className="bg-arise-card rounded-2xl border border-arise-border shadow-sm p-5 sticky top-24">
                <h2 className="font-display font-bold uppercase tracking-wider text-xl text-white">Resumen</h2>
                <div className="mt-4 flex justify-between text-sm text-arise-text2">
                  <span>Productos ({totalUnidades % 1 === 0 ? totalUnidades : totalUnidades.toFixed(1)})</span>
                  <span className="font-semibold text-white">${formatearMoneda(subtotal)}</span>
                </div>
                <div className="mt-1 flex justify-between gap-3 text-sm text-arise-muted">
                  <span>Envío</span>
                  <span className="text-right">
                    {costoEnvio != null
                      ? `Gratis al recoger · $${formatearMoneda(costoEnvio)} a domicilio`
                      : 'Se calcula en el siguiente paso'}
                  </span>
                </div>
                <div className="my-4 border-t border-arise-border" />
                <div className="flex justify-between items-end">
                  <span className="font-bold text-white">Subtotal</span>
                  <span className="font-display text-3xl font-bold text-arise-fuchsia [text-shadow:0_0_18px_rgba(255,0,229,0.45)]">${formatearMoneda(subtotal)}</span>
                </div>
                <Link
                  href="/checkout"
                  className="mt-5 block text-center px-6 py-3 rounded-xl bg-arise-primary text-white font-display text-lg font-bold uppercase tracking-wider shadow-glow hover:shadow-glow-strong transition"
                >
                  Proceder al pago
                </Link>
                <p className="mt-3 text-xs text-arise-muted text-center">
                  Pago con tarjeta, Mercado Pago, transferencia o efectivo.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
