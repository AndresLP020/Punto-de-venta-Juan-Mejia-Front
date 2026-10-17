'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getPedido, getPagosConfig, subirComprobante, confirmarStripePago, crearStripeCheckout, type Pedido, type PagosConfig, type EstadoPago } from '@/lib/api';
import { formatearMoneda } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import { CheckoutPasos } from '@/components/CheckoutPasos';
import { useCart } from '@/contexts/CartContext';

const ESTADO_PAGO_INFO: Record<EstadoPago, { texto: string; clase: string }> = {
  pendiente: { texto: 'Pago pendiente', clase: 'bg-amber-100 text-amber-700' },
  en_revision: { texto: 'En revisión', clase: 'bg-blue-100 text-blue-700' },
  pagado: { texto: 'Pago confirmado', clase: 'bg-green-100 text-green-700' },
  rechazado: { texto: 'Pago rechazado', clase: 'bg-red-100 text-red-700' },
};

function CopiarBtn({ valor }: { valor: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(valor).then(() => {
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1500);
        });
      }}
      className="text-xs font-bold text-[#0b3d91] hover:underline cursor-pointer"
    >
      {copiado ? '¡Copiado!' : 'Copiar'}
    </button>
  );
}

function PedidoPage() {
  const params = useParams();
  const search = useSearchParams();
  const id = Number(params.id);
  const pagoQuery = search.get('pago');
  const router = useRouter();
  const { limpiar, reemplazar } = useCart();

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [config, setConfig] = useState<PagosConfig | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [reintentando, setReintentando] = useState(false);
  const [volviendo, setVolviendo] = useState(false);
  const [mensajeComprobante, setMensajeComprobante] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    try {
      let p = await getPedido(id);
      if (pagoQuery === 'exito' && p.metodoPago === 'stripe' && p.estadoPago !== 'pagado') {
        try {
          p = await confirmarStripePago(id);
        } catch {
          /* el webhook o un reintento posterior lo confirmarán */
        }
      }
      const c = await getPagosConfig().catch(() => null);
      setPedido(p);
      if (c) setConfig(c);
    } catch {
      setError('No encontramos este pedido.');
    } finally {
      setCargando(false);
    }
  }, [id, pagoQuery]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (pagoQuery === 'exito' && pedido?.estadoPago === 'pagado') {
      limpiar();
    }
  }, [pagoQuery, pedido?.estadoPago, limpiar]);

  useEffect(() => {
    if (pagoQuery !== 'exito' || !pedido || pedido.estadoPago === 'pagado') return;
    if (pedido.metodoPago !== 'stripe') return;
    let intentos = 0;
    const timer = setInterval(async () => {
      intentos += 1;
      try {
        const p = await confirmarStripePago(id);
        setPedido(p);
        if (p.estadoPago === 'pagado' || intentos >= 8) clearInterval(timer);
      } catch {
        if (intentos >= 8) clearInterval(timer);
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [pagoQuery, pedido?.estadoPago, pedido?.metodoPago, id]);

  const reintentarStripe = async () => {
    if (!pedido) return;
    setReintentando(true);
    try {
      const { url } = await crearStripeCheckout(pedido.id);
      window.location.href = url;
    } catch (err) {
      setMensajeComprobante((err as Error).message || 'No se pudo reintentar el pago.');
      setReintentando(false);
    }
  };

  const puedeEditar =
    pedido != null &&
    pedido.estadoPago !== 'pagado' &&
    pedido.estadoPago !== 'rechazado' &&
    pedido.estadoPedido !== 'cancelado' &&
    pedido.estadoPedido !== 'entregado' &&
    pedido.estadoPedido !== 'listo';

  const volverAtras = () => {
    if (!pedido || !puedeEditar) return;
    setVolviendo(true);
    reemplazar(
      pedido.items.map((i) => ({
        id: i.id,
        nombre: i.nombre,
        precio: i.precio,
        cantidad: i.cantidad,
        esGranel: i.esGranel,
        imagen: i.imagen,
      }))
    );
    router.push(`/checkout?pedido=${pedido.id}`);
  };

  const onArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pedido) return;
    if (file.size > 8 * 1024 * 1024) {
      setMensajeComprobante('La imagen es muy grande (máx. 8 MB).');
      return;
    }
    setSubiendo(true);
    setMensajeComprobante('');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const actualizado = await subirComprobante(pedido.id, base64);
      setPedido(actualizado);
      setMensajeComprobante('Comprobante guardado. Ahora envía la captura del movimiento por WhatsApp.');
      const wa = config?.whatsapp || '527121537999';
      const msg = encodeURIComponent(
        `Hola Nutri-Ala, hice el pedido #${pedido.id} por $${formatearMoneda(pedido.total)}.\nYa realicé la transferencia. Adjunto la captura del movimiento.`
      );
      window.open(`https://wa.me/${wa}?text=${msg}`, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setMensajeComprobante((err as Error).message || 'Error al subir el comprobante.');
    } finally {
      setSubiendo(false);
    }
  };

  if (cargando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Cargando pedido…</div>;
  }

  if (error || !pedido) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 text-center">
        <Logo size={90} />
        <p className="mt-4 text-slate-600 font-semibold">{error || 'Pedido no encontrado.'}</p>
        <Link href="/" className="mt-4 px-6 py-3 rounded-xl bg-yellow-400 text-[#0b3d91] font-bold hover:bg-yellow-300 transition shadow">
          Volver al inicio
        </Link>
      </div>
    );
  }

  const banco = config?.banco;
  const whatsapp = config?.whatsapp || '527121537999';
  const estadoPago = ESTADO_PAGO_INFO[pedido.estadoPago];

  const resumenItems = pedido.items
    .map((i) => `• ${i.nombre} x${i.cantidad} = $${formatearMoneda(i.precio * i.cantidad)}`)
    .join('\n');
  const mensajeWhatsApp = encodeURIComponent(
    `Hola Nutri-Ala, hice el pedido #${pedido.id}.\n\n${resumenItems}\n\nTotal: $${formatearMoneda(pedido.total)}\nMétodo: transferencia\n\nYa envié el dinero. Adjunto la captura del movimiento.`
  );
  const linkWhatsApp = `https://wa.me/${whatsapp}?text=${mensajeWhatsApp}`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 bg-[#0b3d91] text-white shadow-md">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center overflow-hidden ring-2 ring-yellow-400">
              <Logo size={36} />
            </div>
            <span className="font-extrabold tracking-tight text-lg">
              Nutri<span className="text-yellow-400">-</span>Ala
            </span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-4">
            {puedeEditar && (
              <button
                type="button"
                onClick={volverAtras}
                disabled={volviendo}
                className="text-sm font-semibold hover:text-yellow-300 transition disabled:opacity-60 cursor-pointer"
              >
                {volviendo ? 'Volviendo…' : '← Atrás'}
              </button>
            )}
            <Link href="/" className="text-sm font-semibold hover:text-yellow-300 transition">Inicio</Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <CheckoutPasos actual={3} />
        {puedeEditar && (
          <div className="mb-6">
            <button
              type="button"
              onClick={volverAtras}
              disabled={volviendo}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-[#0b3d91] text-[#0b3d91] font-bold hover:bg-blue-50 transition disabled:opacity-60 cursor-pointer"
            >
              {volviendo ? 'Volviendo…' : '← Atrás, cambiar método de pago'}
            </button>
            <p className="mt-2 text-sm text-slate-500">
              Puedes volver a datos y pago para elegir efectivo u otro método. Se actualiza este mismo pedido.
            </p>
          </div>
        )}
        {/* Banner de retorno de pasarela */}
        {pagoQuery === 'exito' && pedido.estadoPago === 'pagado' && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-green-700 font-semibold">
            ¡Pago confirmado! Gracias por tu compra.
          </div>
        )}
        {pagoQuery === 'exito' && pedido.estadoPago !== 'pagado' && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-700 font-semibold">
            Estamos confirmando tu pago con la tarjeta. Esto suele tardar unos segundos…
          </div>
        )}
        {pagoQuery === 'cancelado' && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <p className="font-semibold">El pago se canceló. Tu pedido sigue pendiente.</p>
            {pedido.metodoPago === 'stripe' && (
              <button
                type="button"
                onClick={reintentarStripe}
                disabled={reintentando}
                className="mt-3 px-4 py-2 rounded-xl bg-[#0b3d91] text-white font-bold hover:bg-[#0a3480] disabled:opacity-60 cursor-pointer"
              >
                {reintentando ? 'Redirigiendo…' : 'Intentar pago con tarjeta de nuevo'}
              </button>
            )}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Pedido</p>
              <h1 className="text-2xl font-extrabold text-[#0b3d91]">#{pedido.id}</h1>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${estadoPago.clase}`}>{estadoPago.texto}</span>
          </div>

          {/* Estado del pago según método */}
          {pedido.estadoPago === 'pagado' ? (
            <div className="mt-4 rounded-xl bg-green-50 border border-green-200 p-4">
              <p className="font-bold text-green-700">¡Pago confirmado! 🎉</p>
              <p className="text-sm text-green-600 mt-1">Estamos preparando tu pedido. ¡Gracias por tu compra!</p>
            </div>
          ) : pedido.estadoPago === 'rechazado' ? (
            <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-4">
              <p className="font-bold text-red-700">Pago no confirmado</p>
              <p className="text-sm text-red-600 mt-1">
                No pudimos verificar el depósito, por lo que este pedido no se preparará. Si crees que es un error,
                contáctanos por WhatsApp.
              </p>
            </div>
          ) : pedido.metodoPago === 'transferencia' ? (
            <div className="mt-5">
              <h2 className="font-extrabold text-lg text-[#0b3d91]">Procedimiento de transferencia</h2>
              <ol className="mt-3 space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#0b3d91] text-white text-xs font-extrabold flex items-center justify-center">1</span>
                  <span className="text-slate-700">Transfiere <strong className="text-slate-900">${formatearMoneda(pedido.total)}</strong> a la cuenta de abajo (usa el número de cuenta o la CLABE).</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#0b3d91] text-white text-xs font-extrabold flex items-center justify-center">2</span>
                  <span className="text-slate-700">Notifícanos por WhatsApp y envía la captura del movimiento.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#0b3d91] text-white text-xs font-extrabold flex items-center justify-center">3</span>
                  <span className="text-slate-700">Esperamos a que el depósito caiga en la cuenta.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-600 text-white text-xs font-extrabold flex items-center justify-center">4</span>
                  <span className="text-slate-700">Si el depósito no cae, el pedido no se arma y se omite tu petición.</span>
                </li>
              </ol>

              {banco && (banco.cuenta || banco.clabe || banco.titular) && (
                <div className="mt-4 rounded-xl border-2 border-[#0b3d91]/20 bg-blue-50 p-4 space-y-2 text-sm">
                  <p className="font-extrabold text-[#0b3d91]">Datos de la cuenta</p>
                  {banco.titular && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Titular</span>
                      <span className="font-semibold text-slate-900">{banco.titular}</span>
                    </div>
                  )}
                  {banco.banco && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Banco</span>
                      <span className="font-semibold text-slate-900">{banco.banco}</span>
                    </div>
                  )}
                  {banco.cuenta && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Número de cuenta</span>
                      <span className="font-semibold text-slate-900 flex items-center gap-2 font-mono">{banco.cuenta} <CopiarBtn valor={banco.cuenta} /></span>
                    </div>
                  )}
                  {banco.clabe && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">CLABE</span>
                      <span className="font-semibold text-slate-900 flex items-center gap-2 font-mono">{banco.clabe} <CopiarBtn valor={banco.clabe} /></span>
                    </div>
                  )}
                  {banco.tarjeta && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Tarjeta</span>
                      <span className="font-semibold text-slate-900 flex items-center gap-2 font-mono">{banco.tarjeta} <CopiarBtn valor={banco.tarjeta} /></span>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                <a
                  href={linkWhatsApp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold transition shadow cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" />
                  </svg>
                  Notificar por WhatsApp con captura
                </a>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={subiendo}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-[#0b3d91] text-[#0b3d91] font-bold hover:bg-blue-50 transition disabled:opacity-60 cursor-pointer"
                >
                  {subiendo ? 'Subiendo…' : pedido.comprobante ? 'Cambiar captura' : 'Subir captura del movimiento'}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onArchivo} />
              </div>
              {mensajeComprobante && <p className="mt-2 text-sm text-slate-600">{mensajeComprobante}</p>}
              {pedido.comprobante && (
                <p className="mt-2 text-sm text-green-700 font-semibold">Captura recibida. Cuando el depósito caiga, armamos el pedido.</p>
              )}
            </div>
          ) : pedido.metodoPago === 'efectivo' ? (
            <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4">
              <p className="font-bold text-amber-700">Pago en efectivo</p>
              <p className="text-sm text-amber-600 mt-1">
                {pedido.entrega === 'envio'
                  ? 'Paga en efectivo al recibir tu pedido. Confirmaremos tu pedido por WhatsApp.'
                  : 'Paga en efectivo al recoger tu pedido en la tienda.'}
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-blue-50 border border-blue-200 p-4">
              <p className="font-bold text-blue-700">Estamos esperando la confirmación del pago…</p>
              {pedido.metodoPago === 'stripe' && (
                <button
                  type="button"
                  onClick={reintentarStripe}
                  disabled={reintentando}
                  className="mt-3 mr-3 px-4 py-2 rounded-xl bg-[#0b3d91] text-white text-sm font-bold hover:bg-[#0a3480] disabled:opacity-60 cursor-pointer"
                >
                  {reintentando ? 'Redirigiendo…' : 'Pagar con tarjeta'}
                </button>
              )}
              <button onClick={cargar} className="mt-2 text-sm font-bold text-[#0b3d91] hover:underline">Actualizar estado</button>
            </div>
          )}

          {/* Resumen del pedido */}
          <div className="mt-6 border-t border-slate-100 pt-5">
            <h3 className="font-bold text-slate-900 mb-3">Resumen</h3>
            <div className="space-y-2">
              {pedido.items.map((i, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-slate-600">{i.nombre} <span className="text-slate-400">×{i.cantidad}</span></span>
                  <span className="font-semibold text-slate-900">${formatearMoneda(i.precio * i.cantidad)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-sm">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>${formatearMoneda(pedido.subtotal)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Envío</span><span>{pedido.envio > 0 ? `$${formatearMoneda(pedido.envio)}` : pedido.entrega === 'envio' ? 'Gratis' : '—'}</span></div>
              <div className="flex justify-between font-extrabold text-slate-900 text-base mt-1"><span>Total</span><span className="text-red-600">${formatearMoneda(pedido.total)}</span></div>
            </div>
            <div className="mt-4 text-sm text-slate-500">
              <p><strong className="text-slate-700">Entrega:</strong> {pedido.entrega === 'envio' ? `Envío a ${pedido.cliente.direccion}` : 'Recoger en tienda'}</p>
              <p><strong className="text-slate-700">Cliente:</strong> {pedido.cliente.nombre} · {pedido.cliente.telefono}</p>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          ¿Dudas con tu pedido?{' '}
          <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="font-bold text-green-600 hover:underline">
            Escríbenos por WhatsApp
          </a>
        </p>
      </main>
    </div>
  );
}

export default function PedidoPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500">Cargando pedido…</div>}>
      <PedidoPage />
    </Suspense>
  );
}
