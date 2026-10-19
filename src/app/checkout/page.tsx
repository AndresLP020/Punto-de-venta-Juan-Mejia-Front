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
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-arise-muted">Cargando…</div>}>
      <CheckoutPage />
    </Suspense>
  );
}

function CheckoutPage() {
  const router = useRouter();
  const search = useSearchParams();
  const pedidoIdEdit = Number(search.get('pedido') || 0) || 0;
  const tokenEdit = search.get('t') || '';
  const enlacePedido = (id: number, token?: string, extra = '') => {
    const qs = [token ? `t=${encodeURIComponent(token)}` : '', extra].filter(Boolean).join('&');
    return `/pedido/${id}${qs ? `?${qs}` : ''}`;
  };
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
    getPedido(pedidoIdEdit, tokenEdit)
      .then((p) => {
        if (!vivo) return;
        if (p.estadoPago === 'pagado' || p.estadoPago === 'rechazado') {
          router.replace(enlacePedido(p.id, tokenEdit));
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
        ? await putPedidoCheckout(pedidoIdEdit, payload, tokenEdit)
        : await postPedido(payload);
      const token = pedido.token || tokenEdit;

      if (metodoPago === 'stripe' || metodoPago === 'mercadopago') {
        try {
          if (metodoPago === 'stripe') {
            const { url } = await crearStripeCheckout(pedido.id, token);
            window.location.href = url;
          } else {
            const { init_point } = await crearMercadoPagoPreference(pedido.id, token);
            window.location.href = init_point;
          }
        } catch (err) {
          // El pedido ya existe: lo mostramos para reintentar o cambiar de método sin duplicarlo
          alert((err as Error).message || 'No se pudo abrir el pago en línea.');
          router.push(enlacePedido(pedido.id, token, 'pago=cancelado'));
        }
        return;
      }
      // Efectivo o transferencia: vamos a la página de confirmación
      limpiar();
      router.push(enlacePedido(pedido.id, token));
    } catch (err) {
      setErrores([(err as Error).message || 'Ocurrió un error al procesar tu pedido.']);
      setEnviando(false);
    }
  };

  if (cargandoPedido) {
    return <div className="min-h-screen flex items-center justify-center text-arise-muted">Cargando pedido…</div>;
  }

  if (items.length === 0 && !enviando) {
    return (
      <div className="min-h-screen bg-arise-bg flex flex-col items-center justify-center px-4 text-center">
        <Logo size={90} />
        <p className="mt-4 text-arise-text2 font-semibold">Tu carrito está vacío.</p>
        <Link href="/#productos" className="mt-4 px-6 py-3 rounded-xl bg-arise-primary text-white font-display font-bold uppercase tracking-wider shadow-glow hover:shadow-glow-strong transition">
          Ver productos
        </Link>
      </div>
    );
  }

  const inputBase =
    'w-full px-4 py-2.5 rounded-xl border border-arise-border bg-arise-card text-white placeholder-arise-muted focus:border-arise-neon focus:ring-2 focus:ring-arise-neon/30 outline-none transition';

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
          <Link href="/carrito" className="text-sm font-semibold hover:text-arise-lavender transition">
            ← Volver al carrito
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <CheckoutPasos actual={2} />
        <h1 className="heading-display text-4xl sm:text-5xl mb-6">Finalizar compra</h1>

        {errores.length > 0 && (
          <div
            ref={resumenErroresRef}
            role="alert"
            tabIndex={-1}
            aria-labelledby="error-title"
            className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 outline-none"
          >
            <p id="error-title" className="font-bold text-red-300">Hay un problema</p>
            <ul className="mt-1 list-disc list-inside text-sm text-red-400">
              {errores.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Datos del cliente */}
            <section className="bg-arise-card rounded-2xl border border-arise-border shadow-sm p-5">
              <h2 className="font-display font-bold uppercase tracking-wider text-xl text-white mb-4">Tus datos</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="nombre" className="block text-sm font-semibold text-arise-text2 mb-1">Nombre completo *</label>
                  <input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputBase} placeholder="Tu nombre" />
                </div>
                <div>
                  <label htmlFor="telefono" className="block text-sm font-semibold text-arise-text2 mb-1">Teléfono / WhatsApp *</label>
                  <input id="telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} className={inputBase} placeholder="55 1234 5678" inputMode="tel" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="email" className="block text-sm font-semibold text-arise-text2 mb-1">Correo (opcional)</label>
                  <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputBase} placeholder="tucorreo@ejemplo.com" />
                </div>
              </div>
            </section>

            {/* Entrega */}
            <section className="bg-arise-card rounded-2xl border border-arise-border shadow-sm p-5">
              <h2 className="font-display font-bold uppercase tracking-wider text-xl text-white mb-4">¿Cómo lo quieres recibir?</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setEntrega('pickup')}
                  className={`text-left p-4 rounded-xl border-2 transition ${entrega === 'pickup' ? 'border-arise-neon bg-arise-neon/10 shadow-glow' : 'border-arise-border hover:border-arise-neon/60'}`}
                >
                  <p className="font-bold text-white">Recoger en tienda</p>
                  <p className="text-sm text-arise-muted">Pasa por tu pedido sin costo de envío.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setEntrega('envio')}
                  className={`text-left p-4 rounded-xl border-2 transition ${entrega === 'envio' ? 'border-arise-neon bg-arise-neon/10 shadow-glow' : 'border-arise-border hover:border-arise-neon/60'}`}
                >
                  <p className="font-bold text-white">Envío a domicilio</p>
                  <p className="text-sm text-arise-muted">Comisión del repartidor: ${formatearMoneda(config?.costoEnvio ?? 10)}</p>
                </button>
              </div>

              {entrega === 'envio' && (
                <div className="mt-4 grid gap-4">
                  <div>
                    <label htmlFor="direccion" className="block text-sm font-semibold text-arise-text2 mb-1">Dirección *</label>
                    <input id="direccion" value={direccion} onChange={(e) => setDireccion(e.target.value)} className={inputBase} placeholder="Calle, número, colonia, CP" />
                  </div>
                  <div>
                    <label htmlFor="referencias" className="block text-sm font-semibold text-arise-text2 mb-1">Referencias (opcional)</label>
                    <input id="referencias" value={referencias} onChange={(e) => setReferencias(e.target.value)} className={inputBase} placeholder="Entre calles, color de casa, etc." />
                  </div>
                </div>
              )}
            </section>

            {/* Método de pago */}
            <section className="bg-arise-card rounded-2xl border border-arise-border shadow-sm p-5">
              <h2 className="font-display font-bold uppercase tracking-wider text-xl text-white mb-4">Método de pago</h2>
              {config?.stripePendienteActivacion && (
                <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                  <p className="font-bold text-amber-200">Tarjeta aún no disponible</p>
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
                    className={`flex items-center gap-4 text-left p-4 rounded-xl border-2 transition ${metodoPago === m.id ? 'border-arise-neon bg-arise-neon/10 shadow-glow' : 'border-arise-border hover:border-arise-neon/60'}`}
                  >
                    <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${metodoPago === m.id ? 'border-arise-neon' : 'border-arise-border'}`}>
                      {metodoPago === m.id && <span className="w-2.5 h-2.5 rounded-full bg-arise-primary" />}
                    </span>
                    <span>
                      <span className="block font-bold text-white">{m.label}</span>
                      <span className="block text-sm text-arise-muted">{m.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
              {metodoPago === 'transferencia' && (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                  <p className="font-bold text-amber-200 mb-2">Procedimiento de transferencia</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Te mostraremos el número de cuenta y la CLABE.</li>
                    <li>Transfiere el total exacto.</li>
                    <li>Notifícanos por WhatsApp y envía la captura del movimiento.</li>
                    <li>Cuando el depósito caiga, armamos tu pedido. Si no cae, se omite la petición.</li>
                  </ol>
                </div>
              )}
            </section>

            <section className="bg-arise-card rounded-2xl border border-arise-border shadow-sm p-5">
              <h2 className="font-display font-bold uppercase tracking-wider text-xl text-white mb-4">Notas del pedido</h2>
              <label htmlFor="notas" className="block text-sm font-semibold text-arise-text2 mb-1">Comentarios (opcional)</label>
              <textarea
                id="notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={3}
                className={inputBase}
                placeholder="Ej. talla M, entregar por la tarde…"
              />
            </section>
          </div>

          {/* Resumen */}
          <div className="lg:col-span-1">
            <div className="bg-arise-card rounded-2xl border border-arise-border shadow-sm p-5 sticky top-24">
              <h2 className="font-display font-bold uppercase tracking-wider text-xl text-white">Tu pedido</h2>
              <div className="mt-4 space-y-2 max-h-52 overflow-auto pr-1">
                {items.map((i) => (
                  <div key={i.id} className="flex justify-between text-sm">
                    <span className="text-arise-text2 truncate mr-2">
                      {i.nombre} <span className="text-arise-muted">×{i.cantidad % 1 === 0 ? i.cantidad : i.cantidad.toFixed(1)}</span>
                    </span>
                    <span className="font-semibold text-white whitespace-nowrap">${formatearMoneda(i.precio * i.cantidad)}</span>
                  </div>
                ))}
              </div>
              <div className="my-4 border-t border-arise-border" />
              <div className="flex justify-between text-sm text-arise-text2">
                <span>Subtotal</span>
                <span className="font-semibold text-white">${formatearMoneda(subtotal)}</span>
              </div>
              <div className="mt-1 flex justify-between text-sm text-arise-text2">
                <span>Envío</span>
                <span className="font-semibold text-white">{entrega === 'envio' ? `$${formatearMoneda(envio)}` : '—'}</span>
              </div>
              <div className="my-4 border-t border-arise-border" />
              <div className="flex justify-between items-end">
                <span className="font-bold text-white">Total</span>
                <span className="font-display text-3xl font-bold text-arise-fuchsia [text-shadow:0_0_18px_rgba(255,0,229,0.45)]">${formatearMoneda(total)}</span>
              </div>
              <motion.button
                type="button"
                onClick={confirmar}
                disabled={enviando}
                whileTap={{ scale: 0.98 }}
                className="mt-5 w-full px-6 py-3 rounded-xl bg-arise-primary text-white font-display text-lg font-bold uppercase tracking-wider shadow-glow hover:shadow-glow-strong transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
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
