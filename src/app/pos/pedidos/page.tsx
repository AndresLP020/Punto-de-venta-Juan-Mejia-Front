'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getPedidos,
  getPagosConfig,
  putPagosConfig,
  verificarPedido,
  rechazarPedido,
  actualizarEstadoPedido,
  type Pedido,
  type EstadoPago,
  type EstadoPedido,
  type PagosConfig,
} from '@/lib/api';
import { EVENTO_PEDIDOS_ACTUALIZADOS } from '@/contexts/PedidosNotifContext';
import { formatearMoneda } from '@/lib/utils';

const METODO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  stripe: 'Tarjeta (Stripe)',
  mercadopago: 'Mercado Pago',
};

const PAGO_BADGE: Record<EstadoPago, string> = {
  pendiente: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  en_revision: 'bg-violet-500/20 text-violet-200 border border-violet-500/30',
  pagado: 'bg-green-500/20 text-green-300 border border-green-500/30',
  rechazado: 'bg-red-500/20 text-red-300 border border-red-500/30',
};

const PAGO_TEXTO: Record<EstadoPago, string> = {
  pendiente: 'Pago pendiente',
  en_revision: 'En revisión',
  pagado: 'Pagado',
  rechazado: 'Rechazado',
};

const ESTADOS_PEDIDO: EstadoPedido[] = ['nuevo', 'confirmado', 'preparando', 'listo', 'entregado', 'cancelado'];

type Filtro = 'porVerificar' | 'todos' | 'pagados' | 'rechazados';

export default function PedidosAdminPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('porVerificar');
  const [procesando, setProcesando] = useState<number | null>(null);
  const [comprobanteVista, setComprobanteVista] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [bancoForm, setBancoForm] = useState({
    titular: '',
    banco: '',
    cuenta: '',
    clabe: '',
    tarjeta: '',
    whatsapp: '',
    costoEnvio: '10',
  });
  const [guardandoBanco, setGuardandoBanco] = useState(false);
  const [bancoOk, setBancoOk] = useState('');

  const cargar = useCallback(() => {
    setLoading(true);
    Promise.all([getPedidos(), getPagosConfig().catch(() => null as PagosConfig | null)])
      .then(([lista, cfg]) => {
        setPedidos(lista);
        if (cfg) {
          setBancoForm({
            titular: cfg.banco.titular || '',
            banco: cfg.banco.banco || '',
            cuenta: cfg.banco.cuenta || '',
            clabe: cfg.banco.clabe || '',
            tarjeta: cfg.banco.tarjeta || '',
            whatsapp: cfg.whatsapp || '',
            costoEnvio: String(cfg.costoEnvio ?? 10),
          });
        }
      })
      .catch(() => setPedidos([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Se recarga sola cuando el aviso del POS detecta un pedido nuevo o un comprobante
  useEffect(() => {
    const recargar = () => getPedidos().then(setPedidos).catch(() => {});
    window.addEventListener(EVENTO_PEDIDOS_ACTUALIZADOS, recargar);
    return () => window.removeEventListener(EVENTO_PEDIDOS_ACTUALIZADOS, recargar);
  }, []);

  const pedidosFiltrados = useMemo(() => {
    switch (filtro) {
      case 'porVerificar':
        return pedidos.filter((p) => p.estadoPago === 'en_revision' || p.estadoPago === 'pendiente');
      case 'pagados':
        return pedidos.filter((p) => p.estadoPago === 'pagado');
      case 'rechazados':
        return pedidos.filter((p) => p.estadoPago === 'rechazado');
      default:
        return pedidos;
    }
  }, [pedidos, filtro]);

  const confirmar = async (p: Pedido) => {
    if (!confirm(`¿Confirmar que el pago del pedido #${p.id} ya cayó? Se armará el pedido y se descontará del inventario.`)) return;
    setProcesando(p.id);
    setError('');
    try {
      const actualizado = await verificarPedido(p.id);
      setPedidos((prev) => prev.map((x) => (x.id === p.id ? actualizado : x)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProcesando(null);
    }
  };

  const rechazar = async (p: Pedido) => {
    const motivo = prompt(`Rechazar el pedido #${p.id}. Motivo (opcional):`, '');
    if (motivo === null) return;
    setProcesando(p.id);
    setError('');
    try {
      const actualizado = await rechazarPedido(p.id, motivo);
      setPedidos((prev) => prev.map((x) => (x.id === p.id ? actualizado : x)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProcesando(null);
    }
  };

  const cambiarEstado = async (p: Pedido, estadoPedido: EstadoPedido) => {
    setProcesando(p.id);
    try {
      const actualizado = await actualizarEstadoPedido(p.id, estadoPedido);
      setPedidos((prev) => prev.map((x) => (x.id === p.id ? actualizado : x)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProcesando(null);
    }
  };

  const contador = (f: Filtro) => {
    if (f === 'porVerificar') return pedidos.filter((p) => p.estadoPago === 'en_revision' || p.estadoPago === 'pendiente').length;
    if (f === 'pagados') return pedidos.filter((p) => p.estadoPago === 'pagado').length;
    if (f === 'rechazados') return pedidos.filter((p) => p.estadoPago === 'rechazado').length;
    return pedidos.length;
  };

  const guardarBanco = async () => {
    setGuardandoBanco(true);
    setBancoOk('');
    setError('');
    try {
      await putPagosConfig({
        ...bancoForm,
        costoEnvio: Number(bancoForm.costoEnvio) || 10,
      });
      setBancoOk('Datos de cuenta guardados. Ya se muestran en las transferencias.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGuardandoBanco(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Pedidos en línea</h1>
          <p className="text-sm text-slate-400">Verifica los pagos por transferencia antes de armar cada pedido.</p>
        </div>
        <button
          onClick={cargar}
          className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-semibold hover:bg-slate-700 transition"
        >
          Actualizar
        </button>
      </div>

      <section className="mb-6 rounded-2xl bg-slate-800/60 border border-slate-700 p-5">
        <h2 className="font-extrabold text-white">Cuenta para transferencias</h2>
        <p className="text-xs text-slate-400 mt-1 mb-4">Estos datos se muestran al cliente cuando paga por transferencia.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {([
            ['titular', 'Titular'],
            ['banco', 'Banco'],
            ['cuenta', 'Número de cuenta'],
            ['clabe', 'CLABE'],
            ['tarjeta', 'Tarjeta (opcional)'],
            ['whatsapp', 'WhatsApp (solo números, con 52)'],
            ['costoEnvio', 'Comisión de envío ($)'],
          ] as const).map(([key, label]) => (
            <div key={key}>
              <label htmlFor={`banco-${key}`} className="block text-xs font-semibold text-slate-400 mb-1">{label}</label>
              <input
                id={`banco-${key}`}
                value={bancoForm[key]}
                onChange={(e) => setBancoForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-sm outline-none focus:border-yellow-400"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={guardarBanco}
          disabled={guardandoBanco}
          className="mt-4 px-4 py-2 rounded-xl bg-yellow-400 text-slate-900 text-sm font-bold hover:bg-yellow-300 transition disabled:opacity-60 cursor-pointer"
        >
          {guardandoBanco ? 'Guardando…' : 'Guardar datos de cuenta'}
        </button>
        {bancoOk && <p className="mt-2 text-sm text-green-300">{bancoOk}</p>}
      </section>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-5">
        {([
          ['porVerificar', 'Por verificar'],
          ['todos', 'Todos'],
          ['pagados', 'Pagados'],
          ['rechazados', 'Rechazados'],
        ] as [Filtro, string][]).map(([f, label]) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition border ${
              filtro === f
                ? 'bg-yellow-400 text-slate-900 border-yellow-400'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
            }`}
          >
            {label} <span className="opacity-70">({contador(f)})</span>
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-500/15 border border-red-500/30 p-3 text-red-300 text-sm">{error}</div>}

      {loading ? (
        <p className="text-slate-400">Cargando pedidos…</p>
      ) : pedidosFiltrados.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-700 bg-slate-800/40 p-10 text-center text-slate-400">
          No hay pedidos en esta vista.
        </div>
      ) : (
        <div className="space-y-4">
          {pedidosFiltrados.map((p) => (
            <div key={p.id} className="rounded-2xl bg-slate-800/60 border border-slate-700 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-extrabold text-white">Pedido #{p.id}</h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${PAGO_BADGE[p.estadoPago]}`}>{PAGO_TEXTO[p.estadoPago]}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(p.fecha).toLocaleString('es-MX')} · {METODO_LABEL[p.metodoPago] || p.metodoPago}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-extrabold text-yellow-400">${formatearMoneda(p.total)}</p>
                  <p className="text-xs text-slate-400">{p.entrega === 'envio' ? 'Envío a domicilio' : 'Recoger en tienda'}</p>
                </div>
              </div>

              {/* Cliente */}
              <div className="mt-3 text-sm text-slate-300">
                <p><span className="text-slate-500">Cliente:</span> {p.cliente?.nombre} · {p.cliente?.telefono}{p.cliente?.email ? ` · ${p.cliente.email}` : ''}</p>
                {p.entrega === 'envio' && p.cliente?.direccion && (
                  <p><span className="text-slate-500">Dirección:</span> {p.cliente.direccion}{p.cliente.referencias ? ` (${p.cliente.referencias})` : ''}</p>
                )}
              </div>

              {/* Items */}
              <div className="mt-3 rounded-xl bg-slate-900/50 border border-slate-700/60 p-3">
                {p.items.map((it, i) => (
                  <div key={i} className="flex justify-between text-sm text-slate-300 py-0.5">
                    <span>{it.nombre} <span className="text-slate-500">×{it.cantidad}</span></span>
                    <span className="font-semibold">${formatearMoneda(it.precio * it.cantidad)}</span>
                  </div>
                ))}
              </div>

              {p.notas && <p className="mt-2 text-xs text-slate-400">Notas: {p.notas}</p>}

              {/* Comprobante */}
              {p.comprobante && (
                <div className="mt-3">
                  <p className="text-xs text-slate-500 mb-1">Comprobante de transferencia:</p>
                  <button onClick={() => setComprobanteVista(p.comprobante!)} className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.comprobante} alt={`Comprobante pedido ${p.id}`} className="h-28 rounded-lg border border-slate-700 object-cover hover:opacity-90 transition" />
                  </button>
                </div>
              )}

              {/* Acciones */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {p.estadoPago !== 'pagado' && p.estadoPago !== 'rechazado' && (
                  <>
                    <button
                      onClick={() => confirmar(p)}
                      disabled={procesando === p.id}
                      className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold transition disabled:opacity-60"
                    >
                      {procesando === p.id ? 'Procesando…' : 'Confirmar pago y armar pedido'}
                    </button>
                    <button
                      onClick={() => rechazar(p)}
                      disabled={procesando === p.id}
                      className="px-4 py-2 rounded-xl bg-red-600/90 hover:bg-red-500 text-white text-sm font-bold transition disabled:opacity-60"
                    >
                      Rechazar
                    </button>
                  </>
                )}
                {p.estadoPago === 'pagado' && (
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="text-slate-500">Estado:</span>
                    <select
                      value={p.estadoPedido}
                      onChange={(e) => cambiarEstado(p, e.target.value as EstadoPedido)}
                      disabled={procesando === p.id}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm outline-none"
                    >
                      {ESTADOS_PEDIDO.map((e) => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal comprobante */}
      {comprobanteVista && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setComprobanteVista(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={comprobanteVista} alt="Comprobante" className="max-h-[90vh] max-w-full rounded-xl shadow-2xl" />
        </div>
      )}
    </div>
  );
}
