/**
 * Impresión de tickets en la impresora térmica.
 *
 * El navegador siempre imprime con el tamaño de papel del driver de Windows (Carta), y no permite
 * quitar el cuadro de impresión. Por eso el ticket se manda al servicio local de impresión
 * (carpeta impresora-local/, corre en la computadora de la caja), que lo envía directo a la
 * impresora en ESC/POS: sin cuadro de impresión, del largo exacto del ticket y con corte al final.
 *
 * Si el servicio no responde, se usa la impresión del navegador como respaldo.
 */

const URL_IMPRESORA = process.env.NEXT_PUBLIC_IMPRESORA_URL || 'http://localhost:17777';

export type TicketTermico = {
  /** Líneas centradas; la primera se imprime en grande. */
  encabezado: string[];
  /** Líneas a la izquierda bajo el encabezado (cliente, folio...). */
  datos?: string[];
  titulo?: string;
  items: { nombre: string; detalle: string }[];
  totales: { etiqueta: string; valor: string; resaltar?: boolean }[];
  /** Avisos en negritas (venta a crédito, modificaciones...). */
  avisos?: string[];
  /** Líneas centradas al final. */
  pie: string[];
};

export function imprimirTicketTermico(ticket: TicketTermico, respaldo: () => void): void {
  fetch(`${URL_IMPRESORA}/imprimir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ticket),
    signal: AbortSignal.timeout(8000),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || `HTTP ${res.status}`);
    })
    .catch((err) => {
      console.warn('Servicio de impresión no disponible, se usa la impresión del navegador:', err);
      respaldo();
    });
}

/** Respaldo con el navegador: ajusta la hoja al largo del ticket. Llamar después de document.close() y antes de print(). */
export function ajustarHojaAlTicket(ventana: Window): void {
  const doc = ventana.document;
  const altoMm = Math.ceil((doc.body.getBoundingClientRect().bottom * 25.4) / 96) + 3;
  const pagina = doc.createElement('style');
  pagina.textContent = `@page { size: 80mm ${altoMm}mm; margin: 0; }`;
  doc.head.appendChild(pagina);
}
