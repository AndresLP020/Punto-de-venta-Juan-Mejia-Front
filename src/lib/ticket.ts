/**
 * Impresión de tickets en impresora térmica.
 *
 *  - El ticket se imprime desde la misma página: al imprimir se oculta todo lo demás. No se usan
 *    pestañas (el bloqueador de ventanas emergentes las impide después de un await) ni iframes
 *    ocultos (Chrome los imprime en blanco).
 *  - El largo de la hoja se mide del ticket ya renderizado y se fija con @page, para que la
 *    impresora avance solo lo que mide el ticket y no una hoja Carta/A4 completa. Con margen 0
 *    Chrome tampoco imprime su encabezado (fecha) ni su pie (URL).
 */

/** Ancho del rollo de papel en milímetros (rollo 80 x 70: 80 mm de ancho). */
export const ANCHO_PAPEL_MM = 80;
/** Margen lateral dentro del rollo; el cabezal de 80 mm imprime ~72 mm. */
const MARGEN_LATERAL_MM = 4;
/** Papel extra al final para que el corte no toque la última línea. */
const MARGEN_CORTE_MM = 3;

const PX_A_MM = 25.4 / 96;
const ID = 'ticket-impresion';

const ESTILOS_BASE = `
  #${ID} {
    position: absolute; left: -10000px; top: 0;
    width: ${ANCHO_PAPEL_MM}mm;
    padding: 0 ${MARGEN_LATERAL_MM}mm;
    box-sizing: border-box;
    font-family: monospace;
    font-size: 12px;
    line-height: 1.3;
    background: #fff;
  }
  /* La térmica solo imprime negro: los colores y fondos claros salen grises o se pierden. */
  #${ID}, #${ID} * { color: #000 !important; background: transparent !important; }
  #${ID} ul { list-style: disc; }
  @media print {
    html, body {
      margin: 0 !important; padding: 0 !important;
      height: auto !important; min-height: 0 !important; overflow: visible !important;
      background: #fff !important;
    }
    body > *:not(#${ID}) { display: none !important; }
    #${ID} { position: static; left: auto; }
  }
`;

/** Antepone #ticket-impresion a cada selector para que los estilos del ticket no toquen la pantalla. */
function limitarAlTicket(estilos: string): string {
  return estilos.replace(/(^|\})\s*([^{}@]+)\{/g, (_, cierre: string, selectores: string) =>
    `${cierre}\n${selectores.split(',').map((s) => `#${ID} ${s.trim()}`).join(', ')} {`
  );
}

export function imprimirTicket(titulo: string, estilos: string, cuerpo: string): void {
  document.getElementById(ID)?.remove();

  const ticket = document.createElement('div');
  ticket.id = ID;
  ticket.innerHTML = `<style>${limitarAlTicket(estilos)}${ESTILOS_BASE}</style>${cuerpo}`;
  document.body.appendChild(ticket);

  const altoMm = Math.ceil(ticket.getBoundingClientRect().height * PX_A_MM) + MARGEN_CORTE_MM;
  const pagina = document.createElement('style');
  pagina.textContent = `@page { size: ${ANCHO_PAPEL_MM}mm ${altoMm}mm; margin: 0; }`;
  document.head.appendChild(pagina);

  const tituloAnterior = document.title;
  document.title = titulo;

  let limpiado = false;
  const limpiar = () => {
    if (limpiado) return;
    limpiado = true;
    ticket.remove();
    pagina.remove();
    document.title = tituloAnterior;
    window.removeEventListener('afterprint', limpiar);
  };
  window.addEventListener('afterprint', limpiar);
  window.print();
  // Chrome bloquea en print() hasta cerrar el diálogo; en otros navegadores afterprint limpia después.
  setTimeout(limpiar, 60_000);
}
