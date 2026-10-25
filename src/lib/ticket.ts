/**
 * Impresión de tickets en impresora térmica.
 *
 *  - Se imprime desde un iframe oculto: no abre pestañas ni lo bloquea el bloqueador de ventanas
 *    emergentes (window.open después de un await sí se bloquea).
 *  - El largo de la hoja se mide del contenido ya renderizado y se fija con @page, para que la
 *    impresora avance solo lo que mide el ticket y no una hoja Carta/A4 completa.
 */

/** Ancho del rollo de papel en milímetros (80 o 58). */
export const ANCHO_PAPEL_MM = 80;
/** Margen lateral dentro del rollo; el cabezal de 80 mm imprime ~72 mm. */
const MARGEN_LATERAL_MM = 4;
/** Papel extra al final para que el corte no toque la última línea. */
const MARGEN_CORTE_MM = 3;

const PX_A_MM = 25.4 / 96;

const ESTILOS_BASE = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    width: ${ANCHO_PAPEL_MM}mm;
    padding: 0 ${MARGEN_LATERAL_MM}mm;
    font-family: monospace;
    font-size: 12px;
    color: #000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  /* La térmica solo imprime negro: los colores y fondos claros salen grises o se pierden. */
  body * { color: #000 !important; background: transparent !important; }
`;

export function imprimirTicket(titulo: string, estilos: string, cuerpo: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = `position:fixed;right:0;bottom:0;width:${ANCHO_PAPEL_MM}mm;height:0;border:0;opacity:0;pointer-events:none;`;

  const quitar = () => iframe.remove();

  iframe.onload = () => {
    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;
    if (!win || !doc) return quitar();

    const altoMm = Math.ceil(doc.body.scrollHeight * PX_A_MM) + MARGEN_CORTE_MM;
    const pagina = doc.createElement('style');
    pagina.textContent = `@page { size: ${ANCHO_PAPEL_MM}mm ${altoMm}mm; margin: 0; }`;
    doc.head.appendChild(pagina);

    win.onafterprint = quitar;
    setTimeout(quitar, 60_000);
    win.focus();
    win.print();
  };

  iframe.srcdoc = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${titulo}</title>
    <style>${estilos}${ESTILOS_BASE}</style>
  </head>
  <body>${cuerpo}</body>
</html>`;
  document.body.appendChild(iframe);
}
