/**
 * Ajusta la hoja de impresión al ticket para la impresora térmica: el largo se mide del contenido
 * ya renderizado y se fija con @page, para que la impresora avance solo lo que mide el ticket y no
 * una hoja Carta/A4 completa.
 */

/** Ancho del rollo de papel en milímetros (rollo 80 x 70: 80 mm de ancho). */
const ANCHO_PAPEL_MM = 80;
/** Papel extra al final para que el corte no toque la última línea. */
const MARGEN_CORTE_MM = 3;

const PX_A_MM = 25.4 / 96;

/** Llamar después de document.write/close y antes de print(). */
export function ajustarHojaAlTicket(ventana: Window): void {
  const doc = ventana.document;
  const altoMm = Math.ceil(doc.body.getBoundingClientRect().bottom * PX_A_MM) + MARGEN_CORTE_MM;
  const pagina = doc.createElement('style');
  pagina.textContent = `@page { size: ${ANCHO_PAPEL_MM}mm ${altoMm}mm; margin: 0; }`;
  doc.head.appendChild(pagina);
}
