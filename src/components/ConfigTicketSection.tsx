'use client';

import { useEffect, useMemo, useState } from 'react';
import { getConfigTicket, putConfigTicket, type ConfigTicket } from '@/lib/api';
import {
  htmlTicketImpresion,
  imprimirTicket,
  logoParaTicket,
  setConfigTicket,
  textoTicket,
  TICKET_PRUEBA,
  anchoImprimibleMm,
} from '@/lib/ticketPrint';

const VACIA: ConfigTicket = { anchoPapel: 80, mostrarLogo: false, ticketLogo58: '', ticketLogo80: '' };

/** Ancho en píxeles que espera cada impresora térmica (8 puntos por mm). */
const PX_ESPERADOS: Record<58 | 80, number> = { 58: 384, 80: 576 };

function leerArchivo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('No se pudo leer el archivo'));
    r.readAsDataURL(file);
  });
}

function anchoImagen(src: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth);
    img.onerror = () => resolve(0);
    img.src = src;
  });
}

export default function ConfigTicketSection() {
  const [guardada, setGuardada] = useState<ConfigTicket | null>(null);
  const [form, setForm] = useState<ConfigTicket>(VACIA);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [avisos, setAvisos] = useState<Partial<Record<58 | 80, string>>>({});

  useEffect(() => {
    getConfigTicket()
      .then((c) => {
        setGuardada(c);
        setForm(c);
      })
      .catch((err) => setMensaje({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo cargar la configuración' }))
      .finally(() => setCargando(false));
  }, []);

  const cambios = guardada != null && JSON.stringify(guardada) !== JSON.stringify(form);

  const vistaPrevia = useMemo(
    () => htmlTicketImpresion('Vista previa', textoTicket(TICKET_PRUEBA, form.anchoPapel), form.anchoPapel, logoParaTicket(form)),
    [form]
  );

  const subirLogo = async (papel: 58 | 80, file: File | undefined) => {
    if (!file) return;
    setMensaje(null);
    if (file.type !== 'image/png') {
      setMensaje({ tipo: 'error', texto: 'El logo debe ser un archivo PNG.' });
      return;
    }
    const dataUrl = await leerArchivo(file);
    const ancho = await anchoImagen(dataUrl);
    setAvisos((a) => ({
      ...a,
      [papel]: ancho && ancho !== PX_ESPERADOS[papel] ? `Mide ${ancho} px de ancho; para ${papel} mm se recomiendan ${PX_ESPERADOS[papel]} px.` : '',
    }));
    setForm((f) => ({ ...f, [papel === 58 ? 'ticketLogo58' : 'ticketLogo80']: dataUrl }));
  };

  const guardar = async () => {
    setGuardando(true);
    setMensaje(null);
    try {
      const c = await putConfigTicket(form);
      setGuardada(c);
      setForm(c);
      setConfigTicket(c); // Los siguientes tickets de esta pestaña ya usan la nueva configuración.
      setMensaje({ tipo: 'ok', texto: 'Configuración del ticket guardada.' });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo guardar' });
    } finally {
      setGuardando(false);
    }
  };

  const slotLogo = (papel: 58 | 80) => {
    const campo = papel === 58 ? 'ticketLogo58' : 'ticketLogo80';
    const src = form[campo];
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
        <p className="text-sm font-medium text-white mb-2">
          Logo {papel} mm <span className="text-slate-400 font-normal">({PX_ESPERADOS[papel]} px de ancho)</span>
        </p>
        <div className="h-24 rounded-lg bg-white flex items-center justify-center mb-2 overflow-hidden">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={`Logo ${papel} mm`} className="max-h-full max-w-full" style={{ imageRendering: 'pixelated' }} />
          ) : (
            <span className="text-xs text-slate-500">Sin logo</span>
          )}
        </div>
        {avisos[papel] && <p className="text-xs text-amber-400 mb-2">{avisos[papel]}</p>}
        <div className="flex gap-2">
          <label className="flex-1 text-center cursor-pointer px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-white">
            {src ? 'Cambiar' : 'Subir PNG'}
            <input
              type="file"
              accept="image/png"
              className="hidden"
              onChange={(e) => {
                subirLogo(papel, e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          {src && (
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, [campo]: '' }))}
              className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-red-500/30 text-sm text-red-300"
            >
              Quitar
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="rounded-2xl bg-slate-800/80 border border-slate-700/80 p-6 shadow-elevated">
      <h2 className="text-lg font-semibold text-white mb-1">Ticket</h2>
      <p className="text-slate-400 text-sm mb-4">Ancho del papel de la impresora y logo al inicio del ticket.</p>

      {cargando ? (
        <p className="text-slate-400 text-sm">Cargando…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium text-slate-300 mb-2">Ancho del papel</p>
              <div className="flex gap-2">
                {([80, 58] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, anchoPapel: p }))}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium ${
                      form.anchoPapel === p ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {p} mm
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                role="switch"
                aria-checked={form.mostrarLogo}
                onClick={() => setForm((f) => ({ ...f, mostrarLogo: !f.mostrarLogo }))}
                className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  form.mostrarLogo ? 'bg-emerald-500' : 'bg-slate-600'
                }`}
              >
                <span className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow transition ${form.mostrarLogo ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className="text-sm font-medium text-white">Mostrar logo en el ticket</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {slotLogo(80)}
              {slotLogo(58)}
            </div>
            <p className="text-xs text-slate-500">
              Usa PNG en blanco y negro (1 bit) con el ancho indicado: se imprimen tal cual, sin recortar ni ajustar.
            </p>

            {mensaje && <p className={`text-sm ${mensaje.tipo === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{mensaje.texto}</p>}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!cambios || guardando}
                onClick={guardar}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold"
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={() => imprimirTicket(TICKET_PRUEBA, form)}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium"
              >
                Imprimir ticket de prueba
              </button>
            </div>
            {cambios && <p className="text-xs text-amber-400">Hay cambios sin guardar. El ticket de prueba ya los usa.</p>}
          </div>

          <div>
            <p className="text-sm font-medium text-slate-300 mb-2">Vista previa</p>
            <div className="rounded-lg bg-white p-2 overflow-auto max-h-[640px]" style={{ width: `calc(${anchoImprimibleMm(form.anchoPapel)}mm + 40px)` }}>
              <iframe title="Vista previa del ticket" srcDoc={vistaPrevia} className="w-full border-0" style={{ height: 1100 }} sandbox="" />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
