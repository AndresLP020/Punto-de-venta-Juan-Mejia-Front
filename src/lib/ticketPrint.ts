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
  /** 'pedido' = ticket para pasar a pagar a caja: igual al de venta pero sin lo pagado. */
  tipo?: 'venta' | 'correccion' | 'pedido';
  /** Lo que el cliente ya debía antes de esta compra (para el total de su cuenta). */
  saldoAnterior?: number | null;
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

/** CSS del ticket según el ancho de papel; agrega el estilo del logo solo si hay logo. */
function ticketCss(papel: AnchoPapel, conLogo: boolean): string {
  const css = TICKET_CSS_80.replace('size: 80mm auto', `size: ${papel}mm auto`)
    .replace('width: 72mm', `width: ${anchoImprimibleMm(papel)}mm`)
    .replace(/width: 42ch/g, `width: ${caracteresPorLinea(papel)}ch`);
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
    font-weight: 700 !important;
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
    font-weight: 700;
    white-space: pre-wrap;
    word-break: break-word;
    width: 42ch;
  }
  /* Trazo extra para que las letras salgan más oscuras en la térmica. */
  pre, .pagare-texto { -webkit-text-stroke: 0.25px #000; }
  /* Párrafo "Debo y pagare..." en letra más chica; mismo ancho que el resto del ticket. */
  /* El margen reemplaza el renglón en blanco de antes y después, que el <pre> no muestra en sus bordes. */
  .pagare-texto { width: 42ch; margin: 13.75px 0 !important; }
  .pagare-texto p {
    font-size: 9.5px;
    line-height: 1.25;
    white-space: normal;
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

/**
 * Marcas (renglones con caracteres de control) que encierran el texto que se imprime con letra más chica
 * en la vista HTML. En la impresión directa se quitan con textoPlano().
 */
const MARCA_INICIO_CHICA = '\u0001';
const MARCA_FIN_CHICA = '\u0002';

/** Texto del ticket sin las marcas internas (lo que se manda a la impresora directa). */
export function textoPlano(texto: string): string {
  return texto
    .split('\n')
    .filter((l) => l !== MARCA_INICIO_CHICA && l !== MARCA_FIN_CHICA)
    .join('\n');
}

/** Cuerpo HTML: renglones en <pre> y los bloques marcados como párrafo de letra chica. */
function cuerpoHtml(texto: string): string {
  const partes: string[] = [];
  let pre: string[] = [];
  let chica: string[] | null = null;
  const cerrarPre = () => {
    if (pre.length) partes.push(`<pre>${escapeHtml(pre.join('\n'))}</pre>`);
    pre = [];
  };
  for (const l of texto.split('\n')) {
    if (l === MARCA_INICIO_CHICA) {
      cerrarPre();
      chica = [];
    } else if (l === MARCA_FIN_CHICA && chica) {
      partes.push(`<div class="pagare-texto"><p>${escapeHtml(chica.join(' '))}</p></div>`);
      chica = null;
    } else if (chica) chica.push(l);
    else pre.push(l);
  }
  if (chica) pre.push(...chica);
  cerrarPre();
  return partes.join('\n');
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
    MARCA_INICIO_CHICA,
    ...parrafo(
      `Debo y pagare incondicionalmente, a la vista, por este pagare a la orden de ${BENEFICIARIO_PAGARE}, ` +
        `en el lugar arriba indicado, la cantidad de ${monto} (${importeEnLetras(pendiente)}), ` +
        'valor recibido en mercancia a mi entera satisfaccion.'
    ),
    MARCA_FIN_CHICA
  );
  l.push('');
  l.push(linea('Total de la compra:', `$${formatearMoneda(d.total)}`));
  if (d.tipo !== 'pedido') l.push(linea('Cantidad pagada:', `$${formatearMoneda(Math.min(d.pagado, d.total))}`));
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
  const pedido = d.tipo === 'pedido';
  const pagado = pedido ? 0 : d.pagado;
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
  if (pedido && d.ventaId != null) lineas.push(centro(`Pedido No. ${d.ventaId}`));
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
  if (!pedido) lineas.push(linea(correccion ? 'Pagado antes' : 'Pagado', `$${formatearMoneda(pagado)}`));
  if (!correccion && cambio > 0) {
    lineas.push(linea('Cambio', `$${formatearMoneda(cambio)}`));
  }
  if (correccion && pagado > d.total) {
    lineas.push(linea('Se le debe', `$${formatearMoneda(pagado - d.total)}`));
  }
  if (pendiente > 0 && !pedido) {
    lineas.push(linea(correccion ? 'Nos debe' : 'PENDIENTE', `$${formatearMoneda(pendiente)}`));
  }
  if (correccion && pendiente === 0 && pagado <= d.total) {
    lineas.push(linea('Estado', 'Cuenta saldada'));
  }
  if (pendiente > 0 && !correccion && !pedido) {
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
  if (pedido && d.cliente && d.saldoAnterior != null) {
    // Total de la cuenta general del cliente: lo que ya debía más esta compra.
    lineas.push(sep());
    lineas.push(centro('ESTADO DE CUENTA'));
    lineas.push(linea('Saldo anterior', `$${formatearMoneda(d.saldoAnterior)}`));
    lineas.push(linea('Esta compra', `$${formatearMoneda(d.total)}`));
    lineas.push(linea('TOTAL DE SU CUENTA', `$${formatearMoneda(d.saldoAnterior + d.total)}`));
  }
  lineas.push(sep());
  if (pedido) lineas.push(centro('Pase a caja a pagar'));
  lineas.push(centro(correccion ? 'Ticket reimpreso' : pedido ? 'con este ticket' : pendiente > 0 ? 'Venta a credito' : 'Gracias por su compra'));
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

// ---------------------------------------------------------------------------
// Texto como imagen de 1 bit
//
// Windows imprime el texto del navegador con bordes suavizados (grises) y el controlador de la térmica
// los convierte en puntos sueltos: la letra sale clara aunque sea negrita. Para que salga igual de negra
// que el logo, el texto se dibuja en un canvas a la resolución de la impresora (8 puntos/mm) y se deja
// en blanco y negro puro, sin grises.
// ---------------------------------------------------------------------------

/** Puntos de ancho de la cabeza térmica: 576 en 80 mm y 384 en 58 mm. */
export function puntosPorLinea(papel: AnchoPapel): number {
  return papel === 58 ? 384 : 576;
}

const FUENTE_TICKET = '"Courier New", Courier, "Liberation Mono", "DejaVu Sans Mono", monospace';
/** Proporción de la letra del párrafo del pagaré respecto al resto (9.5 / 11). */
const ESCALA_CHICA = 9.5 / 11;
/** Nivel de gris (0-255) por debajo del cual un punto se imprime negro. Más alto = letra más gruesa. */
const UMBRAL_NEGRO = 150;

/** Parte un párrafo en renglones que quepan en `ancho` píxeles. */
function envolver(ctx: CanvasRenderingContext2D, texto: string, ancho: number): string[] {
  const out: string[] = [];
  let actual = '';
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    const prueba = actual ? actual + ' ' + palabra : palabra;
    if (!actual || ctx.measureText(prueba).width <= ancho) actual = prueba;
    else {
      out.push(actual);
      actual = palabra;
    }
  }
  if (actual) out.push(actual);
  return out;
}

/**
 * Dibuja el texto del ticket como PNG de blanco y negro puro (data URL), o null si no hay navegador.
 * Respeta el ancho en caracteres del ticket y el párrafo de letra chica del pagaré.
 */
export function textoComoImagen(texto: string, papel: AnchoPapel): string | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const anchoPx = puntosPorLinea(papel);
  const columnas = caracteresPorLinea(papel);

  // Tamaño de letra para que `columnas` caracteres llenen exactamente el ancho de la cabeza.
  ctx.font = `bold 100px ${FUENTE_TICKET}`;
  const anchoCaracter100 = ctx.measureText('M'.repeat(20)).width / 20;
  const tam = Math.floor(((100 * anchoPx) / (columnas * anchoCaracter100)) * 100) / 100;
  const tamChico = tam * ESCALA_CHICA;
  const fuente = `bold ${tam}px ${FUENTE_TICKET}`;
  const fuenteChica = `bold ${tamChico}px ${FUENTE_TICKET}`;
  const alto = Math.round(tam * 1.25);
  const altoChico = Math.round(tamChico * 1.25);

  // Renglones a dibujar (los del párrafo chico se vuelven a partir según el ancho real).
  const renglones: { t: string; chico: boolean }[] = [];
  let bloque: string[] | null = null;
  for (const l of texto.split('\n')) {
    if (l === MARCA_INICIO_CHICA) bloque = [];
    else if (l === MARCA_FIN_CHICA && bloque) {
      ctx.font = fuenteChica;
      for (const r of envolver(ctx, bloque.join(' '), anchoPx)) renglones.push({ t: r, chico: true });
      bloque = null;
    } else if (bloque) bloque.push(l);
    else renglones.push({ t: l, chico: false });
  }
  if (bloque) bloque.forEach((t) => renglones.push({ t, chico: false }));

  canvas.width = anchoPx;
  canvas.height = Math.max(1, renglones.reduce((h, r) => h + (r.chico ? altoChico : alto), 0));
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  let y = 0;
  for (const r of renglones) {
    const h = r.chico ? altoChico : alto;
    if (r.t.trim()) {
      ctx.font = r.chico ? fuenteChica : fuente;
      ctx.lineWidth = Math.max(1, (r.chico ? tamChico : tam) * 0.035); // engrosa el trazo como el del logo
      const yTexto = y + (h - (r.chico ? tamChico : tam)) / 2;
      ctx.fillText(r.t, 0, yTexto);
      ctx.strokeText(r.t, 0, yTexto);
    }
    y += h;
  }

  // Blanco y negro puro: sin grises que el controlador de la impresora convierta en puntos claros.
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const v = px[i] < UMBRAL_NEGRO ? 0 : 255;
    px[i] = px[i + 1] = px[i + 2] = v;
    px[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Documento HTML del ticket (con el logo al inicio si se indica).
 * Con `textoImagen` el texto va como imagen de 1 bit (lo que se imprime); sin ella, como texto.
 */
export function htmlTicket(
  titulo: string,
  texto: string,
  papel: AnchoPapel = 80,
  logo: string | null = null,
  textoImagen: string | null = null
): string {
  const cuerpo = textoImagen
    ? `<img class="texto" src="${escapeHtml(textoImagen)}" alt="${escapeHtml(textoPlano(texto))}">`
    : cuerpoHtml(texto);
  const cssImagen = textoImagen
    ? `  img.texto {
    display: block;
    width: ${anchoImprimibleMm(papel)}mm;
    height: auto;
    image-rendering: pixelated;
  }
`
    : '';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(titulo)}</title>
  <style>${ticketCss(papel, Boolean(logo))}${cssImagen}</style>
</head>
<body>
${logo ? `<img class="logo" src="${escapeHtml(logo)}" alt="">\n` : ''}${cuerpo}
</body>
</html>`;
}

/** HTML listo para imprimir: el texto como imagen de 1 bit (si el navegador puede dibujarla). */
export function htmlTicketImpresion(titulo: string, texto: string, papel: AnchoPapel, logo: string | null): string {
  let imagen: string | null = null;
  try {
    imagen = textoComoImagen(texto, papel);
  } catch {
    // Si el canvas falla, se imprime como texto normal.
  }
  return htmlTicket(titulo, texto, papel, logo, imagen);
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
  ventana.document.write(htmlTicketImpresion(titulo, texto, papel, logo));
  ventana.document.close();
  const lanzar = async () => {
    // Esperar a que el logo y el texto estén decodificados para que nunca salga el ticket incompleto.
    const imgs = Array.from(ventana.document.querySelectorAll('img')) as HTMLImageElement[];
    await Promise.all(imgs.map((img) => img.decode().catch(() => undefined)));
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
    : d.tipo === 'pedido'
      ? `Pedido #${d.ventaId ?? ''}`
      : 'Ticket de venta';
  void (config ? Promise.resolve(config) : obtenerConfig()).then((c) => {
    const papel: AnchoPapel = c?.anchoPapel === 58 ? 58 : 80;
    const logo = logoParaTicket(c);
    const texto = textoTicket(d, papel);
    return enviarAImpresoraLocal(textoPlano(texto))
      .then((ok) => {
        if (!ok) abrirVistaImpresion(titulo, texto, papel, logo);
      })
      .catch(() => abrirVistaImpresion(titulo, texto, papel, logo));
  });
}
