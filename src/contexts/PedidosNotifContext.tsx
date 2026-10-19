'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { getPedidosResumen, type PedidoResumen } from '@/lib/api';
import { formatearMoneda } from '@/lib/utils';

/**
 * Avisos de pedidos por transferencia dentro del POS.
 * Revisa los pedidos cada INTERVALO_MS y avisa (aviso en pantalla, sonido y
 * notificación del navegador) cuando entra un pedido nuevo por transferencia
 * o cuando el cliente sube su comprobante.
 */

const INTERVALO_MS = 20000;
const STORAGE_KEY = 'arise-pos-pedidos-vistos';
/** Evento que se emite cuando hay cambios, para que la página de Pedidos se recargue */
export const EVENTO_PEDIDOS_ACTUALIZADOS = 'arise:pedidos-actualizados';

type Aviso = { key: string; titulo: string; detalle: string };
type Vistos = { maxId: number; conComprobante: number[] };

const PedidosNotifContext = createContext<{ porVerificar: number }>({ porVerificar: 0 });

export const usePedidosNotif = () => useContext(PedidosNotifContext);

function leerVistos(): Vistos | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Vistos) : null;
  } catch {
    return null;
  }
}

function guardarVistos(v: Vistos) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {}
}

function sonar() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.17);
    });
    setTimeout(() => ctx.close(), 600);
  } catch {}
}

function notificarNavegador(aviso: Aviso) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const n = new Notification(aviso.titulo, { body: aviso.detalle, tag: aviso.key, icon: '/arise-logo.png' });
    n.onclick = () => {
      window.focus();
      window.location.href = '/pos/pedidos';
    };
  } catch {}
}

const esPorVerificar = (p: PedidoResumen) =>
  p.metodoPago === 'transferencia' && (p.estadoPago === 'en_revision' || p.estadoPago === 'pendiente');

export function PedidosNotifProvider({ children }: { children: React.ReactNode }) {
  const [porVerificar, setPorVerificar] = useState(0);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [permiso, setPermiso] = useState<NotificationPermission | 'no-soportado'>('no-soportado');
  const vistosRef = useRef<Vistos | null>(null);

  const quitarAviso = useCallback((key: string) => setAvisos((a) => a.filter((x) => x.key !== key)), []);

  const revisar = useCallback(async () => {
    let lista: PedidoResumen[];
    try {
      lista = await getPedidosResumen();
    } catch {
      return;
    }
    setPorVerificar(lista.filter(esPorVerificar).length);

    const maxId = lista.reduce((m, p) => Math.max(m, p.id), 0);
    const conComprobante = lista.filter((p) => p.tieneComprobante).map((p) => p.id);
    const previos = vistosRef.current ?? leerVistos();

    // Primera vez en este navegador: solo se toma la referencia, sin avisar de pedidos viejos
    if (!previos) {
      vistosRef.current = { maxId, conComprobante };
      guardarVistos(vistosRef.current);
      return;
    }

    const nuevos: Aviso[] = [];
    for (const p of lista) {
      if (p.metodoPago !== 'transferencia') continue;
      const nombre = p.cliente?.nombre ? ` · ${p.cliente.nombre}` : '';
      if (p.id > previos.maxId) {
        nuevos.push({
          key: `nuevo-${p.id}`,
          titulo: `Nuevo pedido #${p.id} por transferencia`,
          detalle: `$${formatearMoneda(p.total)}${nombre}`,
        });
      }
      if (p.tieneComprobante && !previos.conComprobante.includes(p.id)) {
        nuevos.push({
          key: `comprobante-${p.id}`,
          titulo: `Comprobante recibido · pedido #${p.id}`,
          detalle: `$${formatearMoneda(p.total)}${nombre} · listo para verificar`,
        });
      }
    }

    vistosRef.current = { maxId: Math.max(maxId, previos.maxId), conComprobante };
    guardarVistos(vistosRef.current);

    if (nuevos.length > 0) {
      setAvisos((a) => [...nuevos.filter((n) => !a.some((x) => x.key === n.key)), ...a].slice(0, 4));
      sonar();
      nuevos.forEach(notificarNavegador);
      window.dispatchEvent(new Event(EVENTO_PEDIDOS_ACTUALIZADOS));
    }
  }, []);

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPermiso(Notification.permission);
    revisar();
    const t = setInterval(revisar, INTERVALO_MS);
    const alVolver = () => document.visibilityState === 'visible' && revisar();
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [revisar]);

  // Los avisos en pantalla se cierran solos después de 12 s
  useEffect(() => {
    if (avisos.length === 0) return;
    const t = setTimeout(() => setAvisos((a) => a.slice(0, -1)), 12000);
    return () => clearTimeout(t);
  }, [avisos]);

  const pedirPermiso = async () => {
    try {
      setPermiso(await Notification.requestPermission());
    } catch {}
  };

  return (
    <PedidosNotifContext.Provider value={{ porVerificar }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[120] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        <AnimatePresence initial={false}>
          {avisos.map((a) => (
            <motion.div
              key={a.key}
              layout
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              className="rounded-xl border border-fuchsia-500/50 bg-[#160A24]/95 p-4 text-white shadow-[0_0_30px_rgba(161,0,255,0.45)] backdrop-blur"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#7900FF] via-[#A100FF] to-[#FF00E5]">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{a.titulo}</p>
                  <p className="mt-0.5 truncate text-xs text-[#C9B8D9]">{a.detalle}</p>
                  <Link
                    href="/pos/pedidos"
                    onClick={() => quitarAviso(a.key)}
                    className="mt-2 inline-block text-xs font-bold text-fuchsia-300 hover:text-white"
                  >
                    Ver pedidos →
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={() => quitarAviso(a.key)}
                  className="rounded p-1 text-[#9787A7] hover:text-white"
                  aria-label="Cerrar aviso"
                >
                  ✕
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {permiso === 'default' && (
          <button
            type="button"
            onClick={pedirPermiso}
            className="self-end rounded-full border border-fuchsia-500/40 bg-[#160A24]/90 px-3 py-1.5 text-xs font-semibold text-fuchsia-200 backdrop-blur hover:text-white"
          >
            🔔 Activar avisos del navegador
          </button>
        )}
      </div>
    </PedidosNotifContext.Provider>
  );
}
