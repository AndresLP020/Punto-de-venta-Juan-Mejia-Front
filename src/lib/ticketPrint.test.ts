import { describe, expect, it } from 'vitest';
import { htmlTicket, logoParaTicket, textoTicket, textoPlano, importeEnLetras, TICKET_PRUEBA } from './ticketPrint';
import type { ConfigTicket } from './api';

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

  it('sin logo o con el interruptor apagado no se agrega imagen ni espacio extra', () => {
    const texto = textoTicket(TICKET_PRUEBA, 80);
    const sinLogo = htmlTicket('Ticket de venta', texto, 80, null);
    expect(logoParaTicket(config({ mostrarLogo: false }))).toBeNull();
    expect(logoParaTicket(config({ ticketLogo80: '' }))).toBeNull();
    expect(logoParaTicket(null)).toBeNull();
    expect(htmlTicket('Ticket de venta', texto, 80, logoParaTicket(config({ mostrarLogo: false })))).toBe(sinLogo);
    expect(sinLogo).not.toContain('<img');
    expect(sinLogo).not.toContain('img.logo');
    expect(sinLogo).toMatch(/<body>\n<pre>/);
  });
});

describe('formato', () => {
  it('las letras van en negrita', () => {
    const html = htmlTicket('T', textoTicket(TICKET_PRUEBA, 80), 80, null);
    expect(html).toContain('font-weight: 700 !important');
    expect(html).not.toContain('font-weight: 400');
  });

  it('el parrafo "Debo y pagare" va aparte con letra mas chica', () => {
    const html = htmlTicket('T', textoTicket(TICKET_PRUEBA, 80), 80, null);
    expect(html).toMatch(/<div class="pagare-texto"><p>Debo y pagare incondicionalmente[^<]*satisfaccion\.<\/p><\/div>/);
    expect(html).toContain('font-size: 9.5px');
    // El resto del pagaré sigue en el bloque normal.
    expect(html).toMatch(/<pre>[^<]*P A G A R E/);
    expect(html).toMatch(/<pre>[^<]*Total de la compra/);
  });

  it('la impresion directa recibe el texto sin marcas internas', () => {
    const plano = textoPlano(textoTicket(TICKET_PRUEBA, 80));
    expect(plano).not.toMatch(/[\u0001\u0002]/);
    expect(plano).toContain('Debo y pagare incondicionalmente');
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

describe('ticket de pedido', () => {
  const pedido = { ...TICKET_PRUEBA, tipo: 'pedido' as const, ventaId: 15, pagado: 0, cliente: 'Maria Lopez', saldoAnterior: 200 };

  it('es igual al de venta pero sin lo pagado: solo el total de la compra', () => {
    const t = textoTicket(pedido, 80);
    expect(t).toContain('Pedido No. 15');
    expect(t).toMatch(/TOTAL\s+\$110\.00/);
    expect(t).not.toMatch(/^Pagado/m);
    expect(t).not.toContain('Cantidad pagada');
    expect(t).not.toContain('VENTA A CREDITO');
    expect(t).toContain('Pase a caja a pagar');
  });

  it('incluye el pagaré como antes, por el total de la compra', () => {
    const t = textoTicket(pedido, 80);
    expect(t).toContain('P A G A R E');
    expect(t).toMatch(/Bueno por \$110\.00/);
    expect(t).toMatch(/Cantidad que se debe:\s+\$110\.00/);
  });

  it('muestra el total de la cuenta general del cliente', () => {
    const t = textoTicket(pedido, 80);
    expect(t).toContain('ESTADO DE CUENTA');
    expect(t).toMatch(/Saldo anterior\s+\$200\.00/);
    expect(t).toMatch(/Esta compra\s+\$110\.00/);
    expect(t).toMatch(/TOTAL DE SU CUENTA\s+\$310\.00/);
    // Sin cliente (público en general) no hay cuenta que mostrar.
    expect(textoTicket({ ...pedido, cliente: undefined, saldoAnterior: null }, 80)).not.toContain('ESTADO DE CUENTA');
    expect(Math.max(...textoTicket(pedido, 58).split('\n').map((l) => l.length))).toBeLessThanOrEqual(32);
  });
});
