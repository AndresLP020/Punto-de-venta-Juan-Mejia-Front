import { getToken, getConfigTicket, type ConfigTicket } from './api';
import { escapeHtml, formatearMoneda } from './utils';

export type TicketItem = {
  nombre: string;
  cantidad: number;
  precio: number;
  esGranel?: boolean;
};

export type TicketDatos = {
  items: TicketItem[];
  total: number;
  pagado: number;
  cliente?: string;
  /** Nombre de quien hizo la venta. */
  vendedor?: string;
  tipo?: 'venta' | 'correccion';
  ventaId?: number;
  modificaciones?: string[];
};

export type AnchoPapel = 58 | 80;

/** Caracteres por renglón (fuente 12x24): 42 en 80 mm (OKI POS407II) y 32 en 58 mm. */
export function caracteresPorLinea(papel: AnchoPapel): number {
  return papel === 58 ? 32 : 42;
}

/** Ancho imprimible en mm: 72 mm en papel de 80 mm y 48 mm en papel de 58 mm. */
export function anchoImprimibleMm(papel: AnchoPapel): number {
  return papel === 58 ? 48 : 72;
}

/** Ancho con el que se está armando el ticket actual (lo fija textoTicket). */
let ANCHO = 42;

/** CSS del ticket. Con papel de 80 mm y sin logo es idéntico al de siempre. */
function ticketCss(papel: AnchoPapel, conLogo: boolean): string {
  const css = TICKET_CSS_80.replace('size: 80mm auto', `size: ${papel}mm auto`)
    .replace('width: 72mm', `width: ${anchoImprimibleMm(papel)}mm`)
    .replace('width: 42ch', `width: ${caracteresPorLinea(papel)}ch`);
  if (!conLogo) return css;
  return (
    css +
    `  img.logo {
    display: block;
    margin: 0 auto;
    width: ${anchoImprimibleMm(papel)}mm;
    height: auto;
    image-rendering: pixelated;
  }
`
  );
}

const TICKET_CSS_80 = `
  @page { size: 80mm auto; margin: 0; }
  * {
    margin: 0;
    padding: 0;
    font-weight: 400 !important;
    text-shadow: none !important;
    box-shadow: none !important;
    background: #fff !important;
    color: #000 !important;
  }
  html, body {
    width: 72mm;
    margin: 0;
    background: #fff !important;
    font-family: "Courier New", Courier, monospace;
    font-size: 11px;
    line-height: 1.25;
  }
  body { padding: 2mm 2mm 28mm; }
  pre {
    font-family: "Courier New", Courier, monospace;
    font-size: 11px;
    font-weight: 400;
    white-space: pre-wrap;
    word-break: break-word;
    width: 42ch;
  }
`;

function linea(izq: string, der = ''): string {
  const i = izq.slice(0, ANCHO);
  const d = der.slice(0, ANCHO);
  if (!d) return i;
  // Si no caben juntos (papel angosto), el monto pasa al renglón de abajo alineado a la derecha.
  if (i.length + 1 + d.length > ANCHO) return i + '\n' + ' '.repeat(Math.max(0, ANCHO - d.length)) + d;
  const hueco = Math.max(1, ANCHO - i.length - d.length);
  return i + ' '.repeat(hueco) + d;
}

function centro(texto: string): string {
  const t = texto.slice(0, ANCHO);
  const pad = Math.max(0, Math.floor((ANCHO - t.length) / 2));
  return ' '.repeat(pad) + t;
}

function sep(char = '-'): string {
  return char.repeat(ANCHO);
}

function fechaTicket(): string {
  return new Date().toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// ---------------------------------------------------------------------------
// Pagaré (art. 170 LGTOC): mención de ser pagaré, promesa incondicional de pagar una suma determinada,
// nombre del beneficiario, época de pago (a la vista, art. 171), fecha y lugar de suscripción y firma.
// Sin acentos: la térmica en modo Star no imprime bien caracteres fuera de ASCII.
// ---------------------------------------------------------------------------

/** Beneficiario del pagaré. */
const BENEFICIARIO_PAGARE = 'JUAN MIGUEL MEJIA ALTAMIRANO';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUN', 'VEINTIDOS', 'VEINTITRES', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISEIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

/** 0..999 en letras ("UN" en lugar de "UNO" porque siempre va antes de "MIL" o "PESOS"). */
function centenasEnLetras(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c]);
  if (resto > 0 && resto < 30) partes.push(UNIDADES[resto]);
  else if (resto >= 30) {
    const d = Math.floor(resto / 10);
    const u = resto % 10;
    partes.push(u ? `${DECENAS[d]} Y ${UNIDADES[u]}` : DECENAS[d]);
  }
  return partes.join(' ');
}

/** Entero en letras (hasta cientos de millones). */
function enteroEnLetras(n: number): string {
  if (n === 0) return 'CERO';
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? 'UN MILLON' : `${centenasEnLetras(millones)} MILLONES`);
  if (miles) partes.push(miles === 1 ? 'MIL' : `${centenasEnLetras(miles)} MIL`);
  if (resto) partes.push(centenasEnLetras(resto));
  return partes.join(' ');
}

/** Importe en letras al estilo de cheques y pagarés: "MIL DOSCIENTOS PESOS 50/100 M.N." */
export function importeEnLetras(monto: number): string {
  const centavosTotales = Math.round(Math.max(0, monto) * 100);
  const pesos = Math.floor(centavosTotales / 100);
  const centavos = centavosTotales % 100;
  const letras = enteroEnLetras(pesos);
  // "UN MILLON DE PESOS", "DOS MILLONES DE PESOS" (cuando no hay miles ni unidades después).
  const de = pesos >= 1_000_000 && pesos % 1_000_000 === 0 ? ' DE' : '';
  return `${letras}${de} ${pesos === 1 ? 'PESO' : 'PESOS'} ${String(centavos).padStart(2, '0')}/100 M.N.`;
}

/** Ajusta un párrafo al ancho del ticket sin cortar palabras. */
function parrafo(texto: string): string[] {
  const out: string[] = [];
  let actual = '';
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    if (!actual) actual = palabra;
    else if (actual.length + 1 + palabra.length <= ANCHO) actual += ' ' + palabra;
    else {
      out.push(actual);
      actual = palabra;
    }
  }
  if (actual) out.push(actual);
  return out;
}

/** Línea para llenar a mano. */
function raya(n: number): string {
  return '_'.repeat(Math.max(4, n));
}

function lineasPagare(d: TicketDatos, pendiente: number): string[] {
  const hoy = new Date();
  const fecha = `${hoy.getDate()} de ${MESES[hoy.getMonth()]} de ${hoy.getFullYear()}`;
  const monto = `$${formatearMoneda(pendiente)}`;
  const l: string[] = [];
  l.push(sep('='));
  l.push(centro('P A G A R E'));
  l.push(linea(d.ventaId != null ? `No. ${d.ventaId}` : 'No. ______', `Bueno por ${monto}`));
  l.push('');
  l.push(`En ${raya(ANCHO - 6)}`);
  l.push(`a ${fecha}.`);
  l.push('');
  l.push(
    ...parrafo(
      `Debo y pagare incondicionalmente, a la vista, por este pagare a la orden de ${BENEFICIARIO_PAGARE}, ` +
        `en el lugar arriba indicado, la cantidad de ${monto} (${importeEnLetras(pendiente)}), ` +
        'valor recibido en mercancia a mi entera satisfaccion.'
    )
  );
  l.push('');
  l.push(linea('Total de la compra:', `$${formatearMoneda(d.total)}`));
  l.push(linea('Cantidad pagada:', `$${formatearMoneda(Math.min(d.pagado, d.total))}`));
  l.push(linea('Cantidad que se debe:', monto));
  l.push(linea('Se pagara con este pagare:', monto));
  l.push('');
  l.push(`Nombre: ${d.cliente ? d.cliente : raya(ANCHO - 12)}`);
  l.push('');
  l.push(`Domicilio: ${raya(ANCHO - 12)}`);
  l.push(raya(ANCHO));
  l.push('');
  l.push('');
  l.push('');
  l.push(centro(raya(ANCHO - 12)));
  l.push(centro('Firma del deudor'));
  return l;
}

export function textoTicket(d: TicketDatos, papel: AnchoPapel = 80): string {
  ANCHO = caracteresPorLinea(papel);
  const pagado = d.pagado;
  const pendiente = Math.max(0, d.total - pagado);
  const cambio = pagado > d.total ? pagado - d.total : 0;
  const correccion = d.tipo === 'correccion';
  const lineas: string[] = [
    centro('EL POLLITO MIXTECO'),
  ];

  if (correccion && d.ventaId != null) {
    lineas.push(centro(`Ticket corregido #${d.ventaId}`));
  }
  lineas.push(centro(fechaTicket()));
  if (d.vendedor) lineas.push(`Le atendio: ${d.vendedor}`);
  if (d.cliente) lineas.push(`Cliente: ${d.cliente}`);
  lineas.push(sep('='));
  lineas.push(correccion ? 'PRODUCTOS (actualizados)' : 'PRODUCTOS');
  lineas.push(sep());

  for (const i of d.items) {
    const cant = i.esGranel ? `${i.cantidad.toFixed(2)} kg` : String(i.cantidad);
    lineas.push(i.nombre);
    lineas.push(linea(`  ${cant} x $${formatearMoneda(i.precio)}`, `$${formatearMoneda(i.precio * i.cantidad)}`));
  }

  lineas.push(sep('='));
  lineas.push(linea(correccion ? 'TOTAL (nuevo)' : 'TOTAL', `$${formatearMoneda(d.total)}`));
  lineas.push(linea(correccion ? 'Pagado antes' : 'Pagado', `$${formatearMoneda(pagado)}`));
  if (!correccion && cambio > 0) {
    lineas.push(linea('Cambio', `$${formatearMoneda(cambio)}`));
  }
  if (correccion && pagado > d.total) {
    lineas.push(linea('Se le debe', `$${formatearMoneda(pagado - d.total)}`));
  }
  if (pendiente > 0) {
    lineas.push(linea(correccion ? 'Nos debe' : 'PENDIENTE', `$${formatearMoneda(pendiente)}`));
  }
  if (correccion && pendiente === 0 && pagado <= d.total) {
    lineas.push(linea('Estado', 'Cuenta saldada'));
  }
  if (pendiente > 0 && !correccion) {
    lineas.push(sep());
    lineas.push(centro('VENTA A CREDITO'));
    lineas.push(centro(`Pendiente: $${formatearMoneda(pendiente)}`));
  }
  if (correccion && d.modificaciones && d.modificaciones.length > 0) {
    lineas.push(sep());
    lineas.push('Cambios:');
    for (const m of d.modificaciones) {
      lineas.push(`- ${m.replace(/^•\s*/, '')}`);
    }
  }
  lineas.push(sep());
  lineas.push(centro(correccion ? 'Ticket reimpreso' : pendiente > 0 ? 'Venta a credito' : 'Gracias por su compra'));
  lineas.push(centro('Conserve este ticket'));
  lineas.push(...lineasPagare(d, pendiente));
  for (let n = 0; n < 8; n += 1) lineas.push('');
  return lineas.join('\n');
}

// ---------------------------------------------------------------------------
// Configuración del ticket (ancho de papel y logo)
// ---------------------------------------------------------------------------

let configCache: ConfigTicket | null = null;

/** Actualiza la configuración en memoria (la usa Configuración al guardar o al imprimir una prueba). */
export function setConfigTicket(c: ConfigTicket | null) {
  configCache = c;
}

async function obtenerConfig(): Promise<ConfigTicket | null> {
  if (configCache) return configCache;
  try {
    configCache = await getConfigTicket();
  } catch {
    // Sin configuración el ticket sale como siempre: 80 mm y sin logo.
  }
  return configCache;
}

/** Logo que corresponde al ancho de papel, o null si está apagado o no hay archivo. */
export function logoParaTicket(c: ConfigTicket | null): string | null {
  if (!c?.mostrarLogo) return null;
  const src = c.anchoPapel === 58 ? c.ticketLogo58 : c.ticketLogo80;
  return src || null;
}

/** Documento HTML del ticket. Sin logo y en 80 mm es idéntico al de siempre. */
export function htmlTicket(titulo: string, texto: string, papel: AnchoPapel = 80, logo: string | null = null): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(titulo)}</title>
  <style>${ticketCss(papel, Boolean(logo))}</style>
</head>
<body>
${logo ? `<img class="logo" src="${escapeHtml(logo)}" alt="">\n` : ''}<pre>${escapeHtml(texto)}</pre>
</body>
</html>`;
}

async function enviarAImpresoraLocal(texto: string): Promise<boolean> {
  const token = getToken();
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/tickets/imprimir`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ texto }),
  });
  return res.ok;
}

function abrirVistaImpresion(titulo: string, texto: string, papel: AnchoPapel, logo: string | null) {
  const ventana = window.open('', '_blank', 'width=320,height=640');
  if (!ventana) {
    alert('Permite ventanas emergentes para imprimir el ticket.');
    return;
  }
  ventana.document.open();
  ventana.document.write(htmlTicket(titulo, texto, papel, logo));
  ventana.document.close();
  const lanzar = async () => {
    // Esperar a que el logo esté decodificado para que nunca salga el ticket sin él.
    const img = ventana.document.querySelector('img.logo') as HTMLImageElement | null;
    if (img) {
      try {
        await img.decode();
      } catch {
        // Si la imagen falla, se imprime igual el ticket.
      }
    }
    ventana.focus();
    ventana.print();
    ventana.close();
  };
  if (ventana.document.readyState === 'complete') {
    setTimeout(lanzar, 250);
  } else {
    ventana.onload = () => setTimeout(lanzar, 250);
  }
}

/** Venta de ejemplo para la vista previa y el ticket de prueba de Configuración. */
export const TICKET_PRUEBA: TicketDatos = {
  ventaId: 0,
  cliente: 'Cliente de prueba',
  vendedor: 'Prueba',
  items: [
    { nombre: 'Producto a granel', cantidad: 1.5, precio: 40, esGranel: true },
    { nombre: 'Producto por pieza', cantidad: 2, precio: 25 },
  ],
  total: 110,
  pagado: 60,
};

/**
 * Imprime el ticket. `config` permite probar una configuración sin guardarla
 * (si no se pasa, se usa la guardada en el servidor).
 */
export function imprimirTicket(d: TicketDatos, config?: ConfigTicket): void {
  const titulo = d.tipo === 'correccion' && d.ventaId != null
    ? `Ticket corregido #${d.ventaId}`
    : 'Ticket de venta';
  void (config ? Promise.resolve(config) : obtenerConfig()).then((c) => {
    const papel: AnchoPapel = c?.anchoPapel === 58 ? 58 : 80;
    const logo = logoParaTicket(c);
    const texto = textoTicket(d, papel);
    return enviarAImpresoraLocal(texto)
      .then((ok) => {
        if (!ok) abrirVistaImpresion(titulo, texto, papel, logo);
      })
      .catch(() => abrirVistaImpresion(titulo, texto, papel, logo));
  });
}
