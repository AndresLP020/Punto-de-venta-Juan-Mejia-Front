'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getPedidos,
  getClientes,
  pagarPedido,
  entregarPedido,
  cancelarPedido,
  type Pedido,
  type EstadoPedido,
  type Cliente,
} from '@/lib/api';
import { formatearMoneda } from '@/lib/utils';
import { useAdminMode } from '@/contexts/AdminModeContext';

type Pestana = 'por_pagar' | 'pagado' | 'entregado';

const PESTANAS: { id: Pestana; titulo: string; ayuda: string }[] = [
  { id: 'por_pagar', titulo: 'Por pagar', ayuda: 'Pedidos que el cliente debe pagar en caja.' },
  { id: 'pagado', titulo: 'Por entregar', ayuda: 'Ya se pagaron en caja: entrega la mercancía y confírmalo.' },
  { id: 'entregado', titulo: 'Entregados', ayuda: 'Últimos pedidos entregados.' },
];

/** Cada cuánto se actualiza la lista (para ver lo que cobra la caja o toman otros vendedores). */
const REFRESCO_MS = 8000;

function hora(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

function cantidad(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export default function PedidosPage() {
  const { puede } = useAdminMode();
  const puedeCobrar = puede('cobrarEnCaja');
  const puedeEntregar = puede('hacerVentas');
  const puedeCancelar = puedeCobrar || puedeEntregar;

  const [pestana, setPestanaEstado] = useState<Pestana>('por_pagar');
  // Los permisos se conocen después del primer render: hasta que el usuario elija una pestaña,
  // el cajero empieza en "Por pagar" y quien toma pedidos en "Por entregar".
  const eligioPestana = useRef(false);
  const setPestana = (p: Pestana) => {
    eligioPestana.current = true;
    setPestanaEstado(p);
  };
  useEffect(() => {
    if (!eligioPestana.current) setPestanaEstado(puedeCobrar ? 'por_pagar' : 'pagado');
  }, [puedeCobrar]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [aviso, setAviso] = useState('');

  // Modal de cobro
  const [cobrando, setCobrando] = useState<Pedido | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState<number | ''>('');
  const [recibido, setRecibido] = useState('');
  const [errorCobro, setErrorCobro] = useState('');

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      // Se cargan los tres estados a la vez para mostrar los contadores de cada pestaña.
      const lista = await getPedidos(['por_pagar', 'pagado', 'entregado'] as EstadoPedido[], 300);
      setPedidos(lista);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los pedidos');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(() => cargar(true), REFRESCO_MS);
    return () => clearInterval(t);
  }, [cargar]);

  useEffect(() => {
    getClientes()
      .then(setClientes)
      .catch(() => setClientes([]));
  }, []);

  const conteo = useMemo(() => {
    const c: Record<Pestana, number> = { por_pagar: 0, pagado: 0, entregado: 0 };
    for (const p of pedidos) if (p.estado in c) c[p.estado as Pestana] += 1;
    return c;
  }, [pedidos]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().replace(/^#/, '').toLowerCase();
    let lista = pedidos.filter((p) => p.estado === pestana);
    if (pestana === 'entregado') lista = lista.slice(0, 50);
    // En "Por pagar" se atiende en orden de llegada (el más antiguo primero).
    if (pestana === 'por_pagar') lista = [...lista].reverse();
    if (!q) return lista;
    return lista.filter(
      (p) => String(p.id) === q || (p.cliente || '').toLowerCase().includes(q) || (p.usuarioNombre || '').toLowerCase().includes(q)
    );
  }, [pedidos, pestana, busqueda]);

  /** Buscar por número de ticket: si existe en otra pestaña, saltar a ella. */
  const buscarNumero = () => {
    const n = Number(busqueda.trim().replace(/^#/, ''));
    if (!Number.isInteger(n) || n <= 0) return;
    const p = pedidos.find((x) => x.id === n);
    if (!p) {
      setAviso(`No se encontró el pedido #${n} (puede estar cancelado o ser muy antiguo).`);
      return;
    }
    setAviso('');
    if (p.estado !== pestana && (p.estado === 'por_pagar' || p.estado === 'pagado' || p.estado === 'entregado')) setPestana(p.estado);
    if (p.estado === 'por_pagar' && puedeCobrar) abrirCobro(p);
  };

  const abrirCobro = (p: Pedido) => {
    setCobrando(p);
    setClienteId(p.clienteId ?? '');
    setRecibido('');
    setErrorCobro('');
  };

  const recibidoNum = recibido.trim() === '' ? null : Number(recibido.replace(/,/g, ''));
  const totalCobro = cobrando?.total ?? 0;
  const pagadoCobro = recibidoNum == null ? totalCobro : recibidoNum;
  const cambio = Math.max(0, pagadoCobro - totalCobro);
  const pendiente = Math.max(0, totalCobro - pagadoCobro);

  const confirmarCobro = async () => {
    if (!cobrando) return;
    if (recibidoNum != null && (!Number.isFinite(recibidoNum) || recibidoNum < 0)) {
      setErrorCobro('El monto recibido no es válido.');
      return;
    }
    if (pendiente > 0 && !clienteId) {
      setErrorCobro('Para dejar saldo pendiente (crédito) selecciona un cliente.');
      return;
    }
    setOcupado(cobrando.id);
    setErrorCobro('');
    try {
      const r = await pagarPedido(cobrando.id, { pagado: recibidoNum ?? undefined, clienteId: clienteId === '' ? null : clienteId });
      setCobrando(null);
      setAviso(
        `Pedido #${r.pedido.id} pagado.` +
          (r.cambio > 0 ? ` Cambio: $${formatearMoneda(r.cambio)}.` : '') +
          (r.venta.pendiente ? ` Queda a crédito: $${formatearMoneda(r.venta.pendiente)}.` : '')
      );
      await cargar(true);
    } catch (err) {
      setErrorCobro(err instanceof Error ? err.message : 'No se pudo cobrar el pedido');
      await cargar(true);
    } finally {
      setOcupado(null);
    }
  };

  const entregar = async (p: Pedido) => {
    if (!confirm(`¿Confirmas que el pedido #${p.id} ya está pagado y entregas la mercancía?`)) return;
    setOcupado(p.id);
    try {
      await entregarPedido(p.id);
      setAviso(`Pedido #${p.id} entregado.`);
      await cargar(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo entregar el pedido');
      await cargar(true);
    } finally {
      setOcupado(null);
    }
  };

  const cancelar = async (p: Pedido) => {
    if (!confirm(`¿Cancelar el pedido #${p.id}? Los productos regresan al inventario.`)) return;
    setOcupado(p.id);
    try {
      await cancelarPedido(p.id);
      setAviso(`Pedido #${p.id} cancelado.`);
      await cargar(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo cancelar el pedido');
      await cargar(true);
    } finally {
      setOcupado(null);
    }
  };

  const ayuda = PESTANAS.find((t) => t.id === pestana)?.ayuda;

  return (
    <div className="flex flex-col min-h-full text-white">
      <header className="sticky top-0 z-10 px-4 sm:px-6 py-4 border-b border-slate-700/80 bg-slate-900/90 backdrop-blur-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Pedidos</h1>
            <p className="text-slate-400 text-sm mt-0.5">Cobro en caja y entrega de mercancía</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              buscarNumero();
            }}
            className="flex gap-2 w-full sm:w-auto"
          >
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="No. de pedido o cliente"
              className="flex-1 sm:w-64 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button type="submit" className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium">
              Buscar
            </button>
          </form>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {PESTANAS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setPestana(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap border ${
                pestana === t.id ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {t.titulo}
              {t.id !== 'entregado' && (
                <span className={`ml-2 inline-flex min-w-[22px] justify-center rounded-full px-1.5 text-xs ${pestana === t.id ? 'bg-white/25' : 'bg-slate-700'}`}>
                  {conteo[t.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 p-4 sm:p-6 space-y-4">
        {ayuda && <p className="text-sm text-slate-400">{ayuda}</p>}
        {aviso && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            <span>{aviso}</span>
            <button type="button" onClick={() => setAviso('')} className="text-emerald-300/70 hover:text-emerald-200">
              ✕
            </button>
          </div>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {cargando ? (
          <p className="text-slate-400">Cargando pedidos…</p>
        ) : visibles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-slate-400">
            {busqueda ? 'Ningún pedido coincide con la búsqueda.' : 'No hay pedidos en esta sección.'}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibles.map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-700 bg-slate-800 p-4 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-2xl font-black tracking-tight">#{p.id}</p>
                    <p className="text-xs text-slate-400">{hora(p.fecha)} · Atendió: {p.usuarioNombre || '—'}</p>
                    {p.cliente && <p className="text-sm text-pink-300 mt-0.5">{p.cliente}</p>}
                  </div>
                  <p className="text-xl font-bold text-white tabular-nums">${formatearMoneda(p.total)}</p>
                </div>
                <ul className="text-sm text-slate-300 space-y-0.5 mb-3 flex-1">
                  {p.items.map((it, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="truncate">
                        {cantidad(it.cantidad)} × {it.nombre}
                      </span>
                      <span className="tabular-nums text-slate-400">${formatearMoneda(it.precio * it.cantidad)}</span>
                    </li>
                  ))}
                </ul>
                {p.estado === 'pagado' && (
                  <p className="text-xs text-emerald-300 mb-3">
                    ✓ Pagado en caja{p.cajeroNombre ? ` por ${p.cajeroNombre}` : ''} · {hora(p.fechaPago)}
                    {p.ventaId ? ` · Venta #${p.ventaId}` : ''}
                  </p>
                )}
                {p.estado === 'entregado' && (
                  <p className="text-xs text-slate-400 mb-1">
                    Entregado{p.entregadoPorNombre ? ` por ${p.entregadoPorNombre}` : ''} · {hora(p.fechaEntrega)}
                    {p.ventaId ? ` · Venta #${p.ventaId}` : ''}
                  </p>
                )}
                <div className="flex gap-2">
                  {p.estado === 'por_pagar' && puedeCobrar && (
                    <button
                      type="button"
                      disabled={ocupado === p.id}
                      onClick={() => abrirCobro(p)}
                      className="flex-1 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 font-semibold"
                    >
                      Cobrar
                    </button>
                  )}
                  {p.estado === 'por_pagar' && !puedeCobrar && (
                    <p className="flex-1 text-xs text-amber-300 self-center">Esperando pago en caja…</p>
                  )}
                  {p.estado === 'por_pagar' && puedeCancelar && (
                    <button
                      type="button"
                      disabled={ocupado === p.id}
                      onClick={() => cancelar(p)}
                      className="px-3 py-2.5 rounded-lg bg-slate-700 hover:bg-red-500/30 text-red-300 text-sm disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  )}
                  {p.estado === 'pagado' && puedeEntregar && (
                    <button
                      type="button"
                      disabled={ocupado === p.id}
                      onClick={() => entregar(p)}
                      className="flex-1 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 font-semibold"
                    >
                      {ocupado === p.id ? 'Guardando…' : 'Confirmar entrega'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de cobro */}
      {cobrando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setCobrando(null)}>
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Cobrar pedido #{cobrando.id}</h2>
                <p className="text-xs text-slate-400">Atendió: {cobrando.usuarioNombre || '—'}</p>
              </div>
              <p className="text-2xl font-black tabular-nums">${formatearMoneda(cobrando.total)}</p>
            </div>

            <ul className="text-sm text-slate-300 space-y-0.5 mb-4 border-y border-slate-700 py-3">
              {cobrando.items.map((it, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate">
                    {cantidad(it.cantidad)} × {it.nombre}
                  </span>
                  <span className="tabular-nums">${formatearMoneda(it.precio * it.cantidad)}</span>
                </li>
              ))}
            </ul>

            <label className="block text-sm font-medium text-slate-300 mb-1">Cliente</label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : '')}
              className="w-full mb-3 px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Público en general</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>

            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-slate-300">Monto recibido</label>
              <button
                type="button"
                onClick={() => setRecibido(String(cobrando.total))}
                className="text-xs font-medium text-emerald-400 border border-emerald-500/50 rounded-lg px-2.5 py-1 hover:border-emerald-400"
              >
                Pagado completo
              </button>
            </div>
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                autoFocus
                value={recibido}
                onChange={(e) => setRecibido(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmarCobro();
                }}
                placeholder={formatearMoneda(cobrando.total)}
                className="w-full pl-6 pr-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <p className="text-xs text-slate-500 -mt-2 mb-3">Si lo dejas vacío se toma como pago completo.</p>

            {cambio > 0 && (
              <div className="mb-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex justify-between">
                <span className="text-sm text-slate-300">Cambio:</span>
                <span className="text-lg font-bold text-green-400">${formatearMoneda(cambio)}</span>
              </div>
            )}
            {pendiente > 0 && (
              <div className="mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex justify-between">
                <span className="text-sm text-slate-300">Queda a crédito:</span>
                <span className="text-lg font-bold text-amber-400">${formatearMoneda(pendiente)}</span>
              </div>
            )}
            {errorCobro && <p className="text-sm text-red-400 mb-3">{errorCobro}</p>}

            <div className="flex gap-2">
              <button type="button" onClick={() => setCobrando(null)} className="flex-1 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 font-medium">
                Cerrar
              </button>
              <button
                type="button"
                disabled={ocupado === cobrando.id}
                onClick={confirmarCobro}
                className="flex-1 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 font-semibold"
              >
                {ocupado === cobrando.id ? 'Cobrando…' : pendiente > 0 ? 'Registrar con crédito' : 'Confirmar pago'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
