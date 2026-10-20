/**
 * Formato de moneda con separador de miles (coma) y 2 decimales.
 * Ejemplo: 1234567.89 → "1,234,567.89"
 */
export function formatearMoneda(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Formato de cantidad (números enteros o con decimales) con separador de miles.
 * Ejemplo: 12345 → "12,345"
 */
export function formatearCantidad(n: number, decimals = 0): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Escapa texto para insertarlo en HTML generado a mano (tickets impresos). Evita XSS. */
export function escapeHtml(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Convierte una fecha guardada a Date. Las fechas de solo día ('YYYY-MM-DD') se interpretan
 * en hora local; `new Date('YYYY-MM-DD')` las toma como UTC y en México aparecen un día antes.
 */
export function parseFecha(f: string | null | undefined): Date {
  if (!f) return new Date(NaN);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(f);
}

/** Fecha local de hoy (o de la fecha dada) en formato YYYY-MM-DD, sin desfase por UTC. */
export function hoyISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

/** Mensaje de error legible a partir de una excepción. */
export function mensajeError(err: unknown, porDefecto = 'Ocurrió un error'): string {
  return err instanceof Error && err.message ? err.message : porDefecto;
}
