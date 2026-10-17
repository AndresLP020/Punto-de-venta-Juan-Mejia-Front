'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '@/contexts/CartContext';
import { formatearMoneda } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import { CheckoutPasos } from '@/components/CheckoutPasos';

function ImagenMini({ src, alt }: { src?: string; alt: string }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className="flex items-center justify-center bg-gradient-to-br from-amber-100 to-blue-100 w-full h-full rounded-lg">
        <svg className="w-1/2 h-1/2 text-blue-800/40" fill="none" stroke="currentColor" strokeWidth={1.4} viewBox="0 0 24 24">
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 bg-[#0b3d91] text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center overflow-hidden ring-2 ring-yellow-400">
              <Logo size={36} />
            </div>
            <span className="font-extrabold tracking-tight text-lg">
              Nutri<span className="text-yellow-400">-</span>Ala
            </span>
          </Link>
          <Link href="/" className="text-sm font-semibold hover:text-yellow-300 transition">
            ← Seguir comprando
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <CheckoutPasos actual={1} />
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0b3d91] mb-6">Tu carrito</h1>

        {items.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-blue-200 bg-white p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-slate-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="mt-4 text-slate-600 font-semibold">Tu carrito está vacío.</p>
            <Link
              href="/#productos"
              className="mt-5 inline-block px-6 py-3 rounded-xl bg-yellow-400 text-[#0b3d91] font-bold hover:bg-yellow-300 transition shadow"
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
                      className="flex items-center gap-4 bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm"
                    >
                      <div className="w-20 h-20 flex-shrink-0">
                        <ImagenMini src={item.imagen} alt={item.nombre} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 truncate">{item.nombre}</p>
                        <p className="text-red-600 font-extrabold">
                          ${formatearMoneda(item.precio)}
                          {item.esGranel && <span className="text-slate-400 font-medium text-xs">/kg</span>}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="inline-flex items-center rounded-lg border border-slate-200 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => actualizarCantidad(item.id, Math.round((item.cantidad - paso) * 1000) / 1000)}
                              className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition"
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
                              className="w-14 h-8 text-center text-sm font-semibold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              onClick={() => actualizarCantidad(item.id, Math.round((item.cantidad + paso) * 1000) / 1000)}
                              className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition"
                              aria-label="Aumentar"
                            >
                              +
                            </button>
                          </div>
                          {item.esGranel && <span className="text-xs text-slate-400">kg</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold text-slate-900">${formatearMoneda(item.precio * item.cantidad)}</p>
                        <button
                          type="button"
                          onClick={() => quitar(item.id)}
                          className="mt-2 text-xs font-semibold text-red-500 hover:text-red-600 transition"
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
                className="text-sm font-semibold text-slate-500 hover:text-red-500 transition"
              >
                Vaciar carrito
              </button>
            </div>

            {/* Resumen */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sticky top-24">
                <h2 className="font-extrabold text-lg text-[#0b3d91]">Resumen</h2>
                <div className="mt-4 flex justify-between text-sm text-slate-600">
                  <span>Productos ({totalUnidades % 1 === 0 ? totalUnidades : totalUnidades.toFixed(1)})</span>
                  <span className="font-semibold text-slate-900">${formatearMoneda(subtotal)}</span>
                </div>
                <div className="mt-1 flex justify-between text-sm text-slate-500">
                  <span>Envío</span>
                  <span>${formatearMoneda(10)} (repartidor)</span>
                </div>
                <div className="my-4 border-t border-slate-100" />
                <div className="flex justify-between items-end">
                  <span className="font-bold text-slate-900">Subtotal</span>
                  <span className="text-2xl font-extrabold text-red-600">${formatearMoneda(subtotal)}</span>
                </div>
                <Link
                  href="/checkout"
                  className="mt-5 block text-center px-6 py-3 rounded-xl bg-[#0b3d91] text-white font-bold hover:bg-[#0a3378] transition shadow-lg"
                >
                  Proceder al pago
                </Link>
                <p className="mt-3 text-xs text-slate-400 text-center">
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
