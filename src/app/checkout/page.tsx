'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useCart } from '@/contexts/CartContext';
import { formatearMoneda } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import { CheckoutPasos } from '@/components/CheckoutPasos';
import {
  getPagosConfig,
  getPedido,
  postPedido,
  putPedidoCheckout,
  crearStripeCheckout,
  crearMercadoPagoPreference,
  type PagosConfig,
  type MetodoPago,
  type TipoEntrega,
} from '@/lib/api';

const METODOS: { id: MetodoPago; label: string; desc: string; icono: string }[] = [
  { id: 'transferencia', label: 'Transferencia bancaria', desc: 'Transfiere y envía tu comprobante por WhatsApp', icono: 'bank' },
  { id: 'stripe', label: 'Tarjeta (Stripe)', desc: 'Paga con tarjeta de crédito o débito', icono: 'card' },
  { id: 'mercadopago', label: 'Mercado Pago', desc: 'Paga con tu cuenta de Mercado Pago', icono: 'mp' },
  { id: 'efectivo', label: 'Efectivo', desc: 'Paga al recoger o al recibir tu pedido', icono: 'cash' },
];

export default function CheckoutPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500">Cargando…</div>}>
      <CheckoutPage />
    </Suspense>
  );
}

function CheckoutPage() {
  const router = useRouter();
  const search = useSearchParams();
  const pedidoIdEdit = Number(search.get('pedido') || 0) || 0;
  const { items, subtotal, limpiar, reemplazar } = useCart();
  const [config, setConfig] = useState<PagosConfig | null>(null);
  const [cargandoPedido, setCargandoPedido] = useState(!!pedidoIdEdit);

  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [entrega, setEntrega] = useState<TipoEntrega>('pickup');
  const [direccion, setDireccion] = useState('');
  const [referencias, setReferencias] = useState('');
  const [notas, setNotas] = useState('');
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('transferencia');

  const [errores, setErrores] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const resumenErroresRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getPagosConfig()
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    if (!pedidoIdEdit) {
      setCargandoPedido(false);
      return;
    }
    let vivo = true;
    getPedido(pedidoIdEdit)
      .then((p) => {
        if (!vivo) return;
        if (p.estadoPago === 'pagado' || p.estadoPago === 'rechazado') {
          router.replace(`/pedido/${p.id}`);
          return;
        }
        reemplazar(
          p.items.map((i) => ({
            id: i.id,
            nombre: i.nombre,
            precio: i.precio,
            cantidad: i.cantidad,
            esGranel: i.esGranel,
            imagen: i.imagen,
          }))
        );
        setNombre(p.cliente.nombre || '');
        setTelefono(p.cliente.telefono || '');
        setEmail(p.cliente.email || '');
        setEntrega(p.entrega);
        setDireccion(p.cliente.direccion || '');
        setReferencias(p.cliente.referencias || '');
        setNotas(p.notas || '');
        setMetodoPago(p.metodoPago);
        setCargandoPedido(false);
      })
      .catch(() => {
        if (vivo) setCargandoPedido(false);
      });
    return () => {
      vivo = false;
    };
  }, [pedidoIdEdit, reemplazar, router]);

  // Solo mostramos los métodos que están habilitados en el backend
  const metodosDisponibles = METODOS.filter((m) => {
    if (!config) return m.id === 'transferencia' || m.id === 'efectivo';
    return config.metodos[m.id];
  });

  const envio = entrega === 'envio' ? (config?.costoEnvio ?? 10) : 0;
  const total = subtotal + envio;

  const validar = () => {
    const errs: string[] = [];
    if (!nombre.trim()) errs.push('Escribe tu nombre.');
    if (!telefono.trim()) errs.push('Escribe tu teléfono.');
    if (entrega === 'envio' && !direccion.trim()) errs.push('Escribe la dirección de envío.');
    if (items.length === 0) errs.push('Tu carrito está vacío.');
    setErrores(errs);
    if (errs.length > 0) {
      setTimeout(() => resumenErroresRef.current?.focus(), 0);
    }
    return errs.length === 0;
  };

  const confirmar = async () => {
    if (!validar()) return;
    setEnviando(true);
    try {
      const payload = {
        items: items.map((i) => ({
          id: i.id,
          nombre: i.nombre,
          precio: i.precio,
          cantidad: i.cantidad,
          esGranel: i.esGranel,
          imagen: i.imagen,
        })),
        cliente: {
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          email: email.trim(),
          direccion: direccion.trim(),
          referencias: referencias.trim(),
        },
        entrega,
        metodoPago,
        envio: envio,
        notas: notas.trim(),
      };
      const pedido = pedidoIdEdit
        ? await putPedidoCheckout(pedidoIdEdit, payload)
        : await postPedido(payload);

      if (metodoPago === 'stripe') {
        const { url } = await crearStripeCheckout(pedido.id);
        window.location.href = url;
        return;
      }
      if (metodoPago === 'mercadopago') {
        const { init_point } = await crearMercadoPagoPreference(pedido.id);
        window.location.href = init_point;
        return;
      }
      // Efectivo o transferencia: vamos a la página de confirmación
      limpiar();
      router.push(`/pedido/${pedido.id}`);
    } catch (err) {
      setErrores([(err as Error).message || 'Ocurrió un error al procesar tu pedido.']);
      setEnviando(false);
    }
  };

  if (cargandoPedido) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Cargando pedido…</div>;
  }

  if (items.length === 0 && !enviando) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 text-center">
        <Logo size={90} />
        <p className="mt-4 text-slate-600 font-semibold">Tu carrito está vacío.</p>
        <Link href="/#productos" className="mt-4 px-6 py-3 rounded-xl bg-yellow-400 text-[#0b3d91] font-bold hover:bg-yellow-300 transition shadow">
          Ver productos
        </Link>
      </div>
    );
  }

  const inputBase =
    'w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:border-[#0b3d91] focus:ring-2 focus:ring-[#0b3d91]/20 outline-none transition';

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
          <Link href="/carrito" className="text-sm font-semibold hover:text-yellow-300 transition">
            ← Volver al carrito
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <CheckoutPasos actual={2} />
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0b3d91] mb-6">Finalizar compra</h1>

        {errores.length > 0 && (
          <div
            ref={resumenErroresRef}
            role="alert"
            tabIndex={-1}
            aria-labelledby="error-title"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 outline-none"
          >
            <p id="error-title" className="font-bold text-red-700">Hay un problema</p>
            <ul className="mt-1 list-disc list-inside text-sm text-red-600">
              {errores.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Datos del cliente */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="font-extrabold text-lg text-[#0b3d91] mb-4">Tus datos</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="nombre" className="block text-sm font-semibold text-slate-700 mb-1">Nombre completo *</label>
                  <input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputBase} placeholder="Tu nombre" />
                </div>
                <div>
                  <label htmlFor="telefono" className="block text-sm font-semibold text-slate-700 mb-1">Teléfono / WhatsApp *</label>
                  <input id="telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} className={inputBase} placeholder="55 1234 5678" inputMode="tel" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1">Correo (opcional)</label>
                  <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputBase} placeholder="tucorreo@ejemplo.com" />
                </div>
              </div>
            </section>

            {/* Entrega */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="font-extrabold text-lg text-[#0b3d91] mb-4">¿Cómo lo quieres recibir?</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setEntrega('pickup')}
                  className={`text-left p-4 rounded-xl border-2 transition ${entrega === 'pickup' ? 'border-[#0b3d91] bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <p className="font-bold text-slate-900">Recoger en tienda</p>
                  <p className="text-sm text-slate-500">Pasa por tu pedido sin costo de envío.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setEntrega('envio')}
                  className={`text-left p-4 rounded-xl border-2 transition ${entrega === 'envio' ? 'border-[#0b3d91] bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <p className="font-bold text-slate-900">Envío a domicilio</p>
                  <p className="text-sm text-slate-500">Comisión del repartidor: ${formatearMoneda(config?.costoEnvio ?? 10)}</p>
                </button>
              </div>

              {entrega === 'envio' && (
                <div className="mt-4 grid gap-4">
                  <div>
                    <label htmlFor="direccion" className="block text-sm font-semibold text-slate-700 mb-1">Dirección *</label>
                    <input id="direccion" value={direccion} onChange={(e) => setDireccion(e.target.value)} className={inputBase} placeholder="Calle, número, colonia, CP" />
                  </div>
                  <div>
                    <label htmlFor="referencias" className="block text-sm font-semibold text-slate-700 mb-1">Referencias (opcional)</label>
                    <input id="referencias" value={referencias} onChange={(e) => setReferencias(e.target.value)} className={inputBase} placeholder="Entre calles, color de casa, etc." />
                  </div>
                </div>
              )}
            </section>

            {/* Método de pago */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="font-extrabold text-lg text-[#0b3d91] mb-4">Método de pago</h2>
              {config?.stripePendienteActivacion && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-bold text-amber-800">Tarjeta aún no disponible</p>
                  <p className="mt-1">
                    Stripe está conectado, pero la cuenta no está activada para cobrar. Completa la verificación en el Dashboard de Stripe. Por ahora paga con transferencia o efectivo.
                  </p>
                </div>
              )}
              <div className="grid gap-3">
                {metodosDisponibles.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMetodoPago(m.id)}
                    className={`flex items-center gap-4 text-left p-4 rounded-xl border-2 transition ${metodoPago === m.id ? 'border-[#0b3d91] bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${metodoPago === m.id ? 'border-[#0b3d91]' : 'border-slate-300'}`}>
                      {metodoPago === m.id && <span className="w-2.5 h-2.5 rounded-full bg-[#0b3d91]" />}
                    </span>
                    <span>
                      <span className="block font-bold text-slate-900">{m.label}</span>
                      <span className="block text-sm text-slate-500">{m.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
              {metodoPago === 'transferencia' && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-bold text-amber-800 mb-2">Procedimiento de transferencia</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Te mostraremos el número de cuenta y la CLABE.</li>
                    <li>Transfiere el total exacto.</li>
                    <li>Notifícanos por WhatsApp y envía la captura del movimiento.</li>
                    <li>Cuando el depósito caiga, armamos tu pedido. Si no cae, se omite la petición.</li>
                  </ol>
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="font-extrabold text-lg text-[#0b3d91] mb-4">Notas del pedido</h2>
              <label htmlFor="notas" className="block text-sm font-semibold text-slate-700 mb-1">Comentarios (opcional)</label>
              <textarea
                id="notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={3}
                className={inputBase}
                placeholder="Ej. sin piel, entregar por la tarde…"
              />
            </section>
          </div>

          {/* Resumen */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sticky top-24">
              <h2 className="font-extrabold text-lg text-[#0b3d91]">Tu pedido</h2>
              <div className="mt-4 space-y-2 max-h-52 overflow-auto pr-1">
                {items.map((i) => (
                  <div key={i.id} className="flex justify-between text-sm">
                    <span className="text-slate-600 truncate mr-2">
                      {i.nombre} <span className="text-slate-400">×{i.cantidad % 1 === 0 ? i.cantidad : i.cantidad.toFixed(1)}</span>
                    </span>
                    <span className="font-semibold text-slate-900 whitespace-nowrap">${formatearMoneda(i.precio * i.cantidad)}</span>
                  </div>
                ))}
              </div>
              <div className="my-4 border-t border-slate-100" />
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900">${formatearMoneda(subtotal)}</span>
              </div>
              <div className="mt-1 flex justify-between text-sm text-slate-600">
                <span>Envío</span>
                <span className="font-semibold text-slate-900">{entrega === 'envio' ? `$${formatearMoneda(envio)}` : '—'}</span>
              </div>
              <div className="my-4 border-t border-slate-100" />
              <div className="flex justify-between items-end">
                <span className="font-bold text-slate-900">Total</span>
                <span className="text-2xl font-extrabold text-red-600">${formatearMoneda(total)}</span>
              </div>
              <motion.button
                type="button"
                onClick={confirmar}
                disabled={enviando}
                whileTap={{ scale: 0.98 }}
                className="mt-5 w-full px-6 py-3 rounded-xl bg-[#0b3d91] text-white font-bold hover:bg-[#0a3378] transition shadow-lg disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {enviando ? 'Procesando…' : pedidoIdEdit ? 'Guardar y continuar' : 'Confirmar pedido'}
              </motion.button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
