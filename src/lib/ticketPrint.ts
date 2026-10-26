import { getToken } from './api';
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

/** Ancho útil de la OKI POS407II en 80 mm (fuente 12x24). */
const ANCHO = 42;

const TICKET_CSS = `
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

function textoTicket(d: TicketDatos): string {
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
  for (let n = 0; n < 8; n += 1) lineas.push('');
  return lineas.join('\n');
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

function abrirVistaImpresion(titulo: string, texto: string) {
  const ventana = window.open('', '_blank', 'width=320,height=640');
  if (!ventana) {
    alert('Permite ventanas emergentes para imprimir el ticket.');
    return;
  }
  ventana.document.open();
  ventana.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(titulo)}</title>
  <style>${TICKET_CSS}</style>
</head>
<body>
<pre>${escapeHtml(texto)}</pre>
</body>
</html>`);
  ventana.document.close();
  const lanzar = () => {
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

export function imprimirTicket(d: TicketDatos): void {
  const titulo = d.tipo === 'correccion' && d.ventaId != null
    ? `Ticket corregido #${d.ventaId}`
    : 'Ticket de venta';
  const texto = textoTicket(d);
  void enviarAImpresoraLocal(texto)
    .then((ok) => {
      if (!ok) abrirVistaImpresion(titulo, texto);
    })
    .catch(() => abrirVistaImpresion(titulo, texto));
}
