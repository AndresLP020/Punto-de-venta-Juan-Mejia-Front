/**
 * Lectura de la báscula por puerto serial (USB / RS-232) con la Web Serial API de Chrome o Edge.
 *
 * - Se conecta sola: al abrir la página y cada vez que se enchufa la báscula (el navegador solo exige
 *   elegir el puerto UNA vez por computadora; después lo recuerda).
 * - Detecta sola la velocidad y el formato: si no llega un peso que se entienda, prueba la siguiente
 *   configuración común y guarda la que funcionó.
 * - Funciona con básculas que envían el peso todo el tiempo y con las que responden a un comando (ej. "P").
 */

export type ConfigBascula = {
  baudRate: number;
  /** Texto que se envía para pedir el peso ('' = la báscula transmite sola). */
  comando: string;
  dataBits: 7 | 8;
  parity: 'none' | 'even' | 'odd';
};

export const CONFIG_BASCULA_DEFAULT: ConfigBascula = { baudRate: 9600, comando: 'P', dataBits: 8, parity: 'none' };

/** Configuraciones que se prueban en orden al detectar automáticamente. */
const CANDIDATAS: ConfigBascula[] = [
  { baudRate: 9600, comando: 'P', dataBits: 8, parity: 'none' },
  { baudRate: 9600, comando: '', dataBits: 8, parity: 'none' },
  { baudRate: 4800, comando: 'P', dataBits: 8, parity: 'none' },
  { baudRate: 2400, comando: 'P', dataBits: 8, parity: 'none' },
  { baudRate: 19200, comando: 'P', dataBits: 8, parity: 'none' },
  { baudRate: 9600, comando: 'W', dataBits: 8, parity: 'none' },
  { baudRate: 9600, comando: '$', dataBits: 8, parity: 'none' },
  { baudRate: 9600, comando: 'P', dataBits: 7, parity: 'even' },
  { baudRate: 2400, comando: '', dataBits: 8, parity: 'none' },
  { baudRate: 4800, comando: '', dataBits: 8, parity: 'none' },
  { baudRate: 19200, comando: '', dataBits: 8, parity: 'none' },
  { baudRate: 9600, comando: '', dataBits: 7, parity: 'even' },
];

const CONFIG_KEY = 'pos.bascula.config';
const DESACTIVADA_KEY = 'pos.bascula.desactivada';
/** Tiempo de espera por cada configuración antes de probar la siguiente. */
const ESPERA_DETECCION_MS = 2500;

export type EstadoBascula = {
  soportada: boolean;
  conectada: boolean;
  /** true mientras prueba configuraciones para entender la señal. */
  detectando: boolean;
  /** Último peso leído en kg (null si aún no llega nada que se entienda). */
  pesoKg: number | null;
  /** true si las últimas lecturas coinciden (la báscula dejó de moverse). */
  estable: boolean;
  /** Último texto recibido, para diagnosticar si el formato no se reconoce. */
  crudo: string;
  error: string;
  /** Configuración con la que está leyendo ahora. */
  config: ConfigBascula;
};

type Listener = (e: EstadoBascula) => void;

const serial = (): any => (typeof navigator !== 'undefined' ? (navigator as any).serial : undefined);

export function basculaSoportada(): boolean {
  return Boolean(serial());
}

export function leerConfigBascula(): ConfigBascula {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return { ...CONFIG_BASCULA_DEFAULT, ...JSON.parse(raw) };
  } catch {}
  return { ...CONFIG_BASCULA_DEFAULT };
}

export function guardarConfigBascula(c: ConfigBascula) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
  } catch {}
}

const mismaConfig = (a: ConfigBascula, b: ConfigBascula) =>
  a.baudRate === b.baudRate && a.comando === b.comando && a.dataBits === b.dataBits && a.parity === b.parity;

/**
 * Extrae el peso en kg de un texto de la báscula. Ejemplos que entiende:
 * "  1.234 kg", "ST,GS,+001.234kg", "W:  0.850", "1234 g", "2.50 lb", "\x02 00.500\x03".
 */
export function interpretarPeso(texto: string): number | null {
  const limpio = texto.replace(/[\x00-\x1f]/g, ' ');
  const matches = [...limpio.matchAll(/([-+]?\s*\d+(?:[.,]\d+)?)\s*(kg|g|lb|oz)?/gi)];
  if (matches.length === 0) return null;
  // Si alguna lectura trae unidad, se prefiere esa; si no, la última cifra del texto.
  const m = [...matches].reverse().find((x) => x[2]) || matches[matches.length - 1];
  let n = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  const unidad = (m[2] || 'kg').toLowerCase();
  if (unidad === 'g') n /= 1000;
  else if (unidad === 'lb') n *= 0.45359237;
  else if (unidad === 'oz') n *= 0.028349523;
  return Math.round(n * 1000) / 1000;
}

function mensajeError(err: any): string {
  const msg = String(err?.message || '');
  const linux = typeof navigator !== 'undefined' && /linux/i.test(navigator.userAgent) && !/android/i.test(navigator.userAgent);
  // En Linux, Chrome reporta la falta de permiso sobre /dev/ttyUSB* como un genérico "Failed to open serial port".
  if (/access denied|permission/i.test(msg) || (linux && /failed to open/i.test(msg))) {
    return 'La computadora no le da permiso al navegador para usar el puerto de la báscula.';
  }
  if (/already open|in use/i.test(msg)) {
    return 'El puerto de la báscula está ocupado (cierra el programa de la báscula u otra pestaña del punto de venta).';
  }
  if (/failed to open/i.test(msg)) {
    return 'No se pudo abrir el puerto: puede estar ocupado por otro programa o faltar el controlador de la báscula (Prolific / CH340).';
  }
  return msg || 'No se pudo abrir el puerto de la báscula';
}

class Bascula {
  private port: any = null;
  private reader: any = null;
  /** Cambia cada vez que se abre o cierra el puerto: así un ciclo de lectura viejo sabe que debe terminar. */
  private sesion = 0;
  private pidiendo: ReturnType<typeof setInterval> | null = null;
  private detector: ReturnType<typeof setTimeout> | null = null;
  private indiceCandidata = -1;
  private buffer = '';
  private ultimas: number[] = [];
  private escuchandoConexiones = false;
  private listeners = new Set<Listener>();
  private estado: EstadoBascula = {
    soportada: false,
    conectada: false,
    detectando: false,
    pesoKg: null,
    estable: false,
    crudo: '',
    error: '',
    config: { ...CONFIG_BASCULA_DEFAULT },
  };

  constructor() {
    this.estado.soportada = basculaSoportada();
  }

  suscribir(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.estado);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emitir(cambios: Partial<EstadoBascula>) {
    this.estado = { ...this.estado, ...cambios };
    this.listeners.forEach((fn) => fn(this.estado));
  }

  private desactivada(): boolean {
    try {
      return localStorage.getItem(DESACTIVADA_KEY) === '1';
    } catch {
      return false;
    }
  }

  /**
   * Conexión automática: abre el puerto ya autorizado y queda atento a cuando se enchufe la báscula.
   * Se llama al cargar la página; no muestra ninguna ventana.
   */
  async iniciarAutomatico(): Promise<void> {
    const s = serial();
    if (!s) return;
    if (!this.escuchandoConexiones) {
      this.escuchandoConexiones = true;
      s.addEventListener('connect', (e: any) => {
        if (!this.port && !this.desactivada()) this.abrir(e.target, true);
      });
      s.addEventListener('disconnect', (e: any) => {
        if (e.target === this.port) {
          this.sesion++;
          this.port = null;
          this.limpiarTimers();
          this.emitir({ conectada: false, detectando: false, pesoKg: null, estable: false, error: 'Se desconectó la báscula. Se volverá a conectar sola al enchufarla.' });
        }
      });
    }
    if (this.port || this.desactivada()) return;
    const puertos = await s.getPorts();
    for (const p of puertos) {
      if (await this.abrir(p, true)) return;
    }
  }

  /** Muestra la ventana del navegador para elegir el puerto (solo hace falta la primera vez). */
  async conectar(): Promise<boolean> {
    const s = serial();
    if (!s) {
      this.emitir({ error: 'Este navegador no puede leer la báscula. Usa Google Chrome o Microsoft Edge.' });
      return false;
    }
    try {
      localStorage.removeItem(DESACTIVADA_KEY);
    } catch {}
    // Si ya hay un puerto autorizado, intentar con él antes de preguntar.
    const autorizados = await s.getPorts();
    for (const p of autorizados) {
      if (await this.abrir(p, true)) return true;
    }
    try {
      const port = await s.requestPort();
      return this.abrir(port, true);
    } catch (err: any) {
      if (err?.name === 'NotFoundError') return false; // Se cerró la ventana sin elegir.
      this.emitir({ error: mensajeError(err) });
      return false;
    }
  }

  /**
   * Abre el puerto. Con `detectar`, si la configuración guardada no da lecturas, prueba las demás.
   */
  private async abrir(port: any, detectar: boolean, config?: ConfigBascula): Promise<boolean> {
    await this.cerrar(false);
    const c = config || leerConfigBascula();
    try {
      await port.open({ baudRate: c.baudRate, dataBits: c.dataBits, parity: c.parity, stopBits: 1, flowControl: 'none' });
    } catch (err: any) {
      this.emitir({ conectada: false, detectando: false, error: mensajeError(err) });
      return false;
    }
    this.port = port;
    this.buffer = '';
    this.ultimas = [];
    if (!config) this.indiceCandidata = -1;
    this.emitir({ conectada: true, error: '', pesoKg: null, estable: false, crudo: '', config: c, detectando: detectar });
    this.escuchar();
    this.iniciarPedidos();
    if (detectar) this.programarDeteccion(port);
    return true;
  }

  /** Si en unos segundos no llega un peso válido, reabre con la siguiente configuración candidata. */
  private programarDeteccion(port: any) {
    if (this.detector) clearTimeout(this.detector);
    const sesion = this.sesion;
    this.detector = setTimeout(async () => {
      this.detector = null;
      if (sesion !== this.sesion || this.estado.pesoKg != null) return;
      const actual = this.estado.config;
      let siguiente = this.indiceCandidata + 1;
      while (siguiente < CANDIDATAS.length && mismaConfig(CANDIDATAS[siguiente], actual)) siguiente++;
      if (siguiente >= CANDIDATAS.length) {
        // Ninguna funcionó: dejar abierta la configuración guardada para poder ver la señal en Ajustes.
        this.indiceCandidata = -1;
        await this.abrir(port, false);
        this.emitir({
          error: this.estado.crudo
            ? 'Llega señal de la báscula pero no se reconoce el peso. Revisa los Ajustes (⚙).'
            : 'La báscula está conectada pero no envía datos. Revisa que esté encendida y el cable bien puesto.',
        });
        return;
      }
      this.indiceCandidata = siguiente;
      await this.abrir(port, true, CANDIDATAS[siguiente]);
    }, ESPERA_DETECCION_MS);
  }

  private async escuchar() {
    const port = this.port;
    if (!port?.readable) return;
    const sesion = this.sesion;
    const decoder = new TextDecoder();
    while (sesion === this.sesion && port.readable) {
      this.reader = port.readable.getReader();
      try {
        for (;;) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value) this.procesar(decoder.decode(value, { stream: true }));
        }
      } catch {
        // Error de lectura (ruido en la línea): se reintenta mientras el puerto siga abierto.
      } finally {
        try {
          this.reader?.releaseLock();
        } catch {}
        this.reader = null;
      }
    }
  }

  private procesar(texto: string) {
    this.buffer += texto;
    // Separar en mensajes por fin de línea o por los caracteres STX/ETX que usan algunas básculas.
    const partes = this.buffer.split(/[\r\n\x02\x03]+/);
    this.buffer = partes.pop() || '';
    // Si la báscula no manda fin de línea, no dejar crecer el buffer sin límite.
    if (this.buffer.length > 200) {
      partes.push(this.buffer);
      this.buffer = '';
    }
    for (const linea of partes) {
      if (!linea.trim()) continue;
      const kg = interpretarPeso(linea);
      if (kg == null || kg < 0 || kg > 2000) {
        this.emitir({ crudo: linea.trim().slice(0, 60) });
        continue;
      }
      if (this.estado.detectando || !mismaConfig(this.estado.config, leerConfigBascula())) {
        // Esta configuración sí funciona: guardarla para la próxima vez.
        guardarConfigBascula(this.estado.config);
        if (this.detector) clearTimeout(this.detector);
        this.detector = null;
      }
      this.ultimas = [...this.ultimas, kg].slice(-3);
      const estable = this.ultimas.length >= 3 && this.ultimas.every((x) => x === kg);
      this.emitir({ pesoKg: kg, estable, crudo: linea.trim().slice(0, 60), error: '', detectando: false });
    }
  }

  /** Pide el peso cada ~0.4 s (para básculas que solo responden a un comando). */
  private iniciarPedidos() {
    if (this.pidiendo) clearInterval(this.pidiendo);
    this.pidiendo = null;
    const comando = this.estado.config.comando;
    if (!comando || !this.port?.writable) return;
    const port = this.port;
    const bytes = new TextEncoder().encode(comando);
    const enviar = async () => {
      if (port !== this.port || !port.writable || port.writable.locked) return;
      const w = port.writable.getWriter();
      try {
        await w.write(bytes);
      } catch {
      } finally {
        w.releaseLock();
      }
    };
    enviar();
    this.pidiendo = setInterval(enviar, 400);
  }

  private limpiarTimers() {
    if (this.pidiendo) clearInterval(this.pidiendo);
    if (this.detector) clearTimeout(this.detector);
    this.pidiendo = null;
    this.detector = null;
  }

  private async cerrar(avisar = true) {
    this.limpiarTimers();
    this.sesion++;
    const port = this.port;
    this.port = null;
    try {
      await this.reader?.cancel();
    } catch {}
    try {
      await port?.close();
    } catch {}
    if (avisar) this.emitir({ conectada: false, detectando: false, pesoKg: null, estable: false });
  }

  /** Desconecta y no vuelve a conectarse sola hasta que se presione "Conectar báscula". */
  async desactivar() {
    try {
      localStorage.setItem(DESACTIVADA_KEY, '1');
    } catch {}
    await this.cerrar();
  }

  /** Aplica una configuración elegida a mano (sin detección automática). */
  async reconfigurar(c: ConfigBascula) {
    guardarConfigBascula(c);
    const port = this.port;
    if (port) await this.abrir(port, false, c);
    else this.emitir({ config: c });
  }

  /** Vuelve a probar todas las configuraciones. */
  async detectarDeNuevo() {
    const port = this.port;
    if (!port) return this.conectar();
    this.indiceCandidata = -1;
    return this.abrir(port, true, CANDIDATAS[0]);
  }
}

let instancia: Bascula | null = null;
export function getBascula(): Bascula {
  if (!instancia) instancia = new Bascula();
  return instancia;
}
