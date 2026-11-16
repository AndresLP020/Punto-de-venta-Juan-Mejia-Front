import { describe, expect, it } from 'vitest';
import { htmlTicket, logoParaTicket, textoTicket, importeEnLetras, TICKET_PRUEBA } from './ticketPrint';
import { escapeHtml } from './utils';
import type { ConfigTicket } from './api';

/** HTML del ticket tal como se generaba antes de agregar el logo (80 mm). */
function htmlAnterior(titulo: string, texto: string): string {
  const css = `
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
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(titulo)}</title>
  <style>${css}</style>
</head>
<body>
<pre>${escapeHtml(texto)}</pre>
</body>
</html>`;
}

const LOGO = 'data:image/png;base64,iVBORw0KGgo=';
const config = (c: Partial<ConfigTicket>): ConfigTicket => ({
  anchoPapel: 80,
  mostrarLogo: true,
  ticketLogo58: LOGO + '58',
  ticketLogo80: LOGO + '80',
  ...c,
});

describe('logo del ticket', () => {
  it('con logo activo el ticket empieza con el bloque de imagen', () => {
    const logo = logoParaTicket(config({}));
    const html = htmlTicket('T', textoTicket(TICKET_PRUEBA, 80), 80, logo);
    const body = html.slice(html.indexOf('<body>') + '<body>'.length).trimStart();
    expect(body.startsWith(`<img class="logo" src="${LOGO}80"`)).toBe(true);
    expect(body.indexOf('<img')).toBeLessThan(body.indexOf('<pre>'));
    expect(html).toContain('image-rendering: pixelated');
    expect(html).toContain('width: 72mm;\n    height: auto;');
  });

  it('elige el logo según el ancho de papel', () => {
    expect(logoParaTicket(config({ anchoPapel: 58 }))).toBe(LOGO + '58');
    expect(logoParaTicket(config({ anchoPapel: 80 }))).toBe(LOGO + '80');
    const html = htmlTicket('T', 'x', 58, logoParaTicket(config({ anchoPapel: 58 })));
    expect(html).toContain('size: 58mm auto');
    expect(html).toContain('width: 48mm');
  });

  it('sin logo o con el interruptor apagado el resultado es idéntico al de antes', () => {
    const texto = textoTicket(TICKET_PRUEBA, 80);
    const antes = htmlAnterior('Ticket de venta', texto);
    expect(logoParaTicket(config({ mostrarLogo: false }))).toBeNull();
    expect(logoParaTicket(config({ ticketLogo80: '' }))).toBeNull();
    expect(logoParaTicket(null)).toBeNull();
    expect(htmlTicket('Ticket de venta', texto, 80, logoParaTicket(config({ mostrarLogo: false })))).toBe(antes);
    expect(htmlTicket('Ticket de venta', texto, 80, logoParaTicket(config({ ticketLogo80: '' })))).toBe(antes);
    expect(htmlTicket('Ticket de venta', texto, 80, null)).toBe(antes);
  });
});

describe('ancho de papel', () => {
  it('80 mm usa 42 caracteres (el formato de siempre) y 58 mm usa 32', () => {
    const t80 = textoTicket(TICKET_PRUEBA, 80);
    expect(textoTicket(TICKET_PRUEBA)).toBe(t80);
    expect(Math.max(...t80.split('\n').map((l) => l.length))).toBe(42);
    const t58 = textoTicket(TICKET_PRUEBA, 58);
    expect(Math.max(...t58.split('\n').map((l) => l.length))).toBe(32);
  });
});

describe('pagaré', () => {
  it('escribe el importe en letras', () => {
    expect(importeEnLetras(151)).toBe('CIENTO CINCUENTA Y UN PESOS 00/100 M.N.');
    expect(importeEnLetras(1250.75)).toBe('MIL DOSCIENTOS CINCUENTA PESOS 75/100 M.N.');
    expect(importeEnLetras(1)).toBe('UN PESO 00/100 M.N.');
    expect(importeEnLetras(2000000)).toBe('DOS MILLONES DE PESOS 00/100 M.N.');
  });
});
