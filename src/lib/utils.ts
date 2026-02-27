/**
 * Formato de moneda con separador de miles (coma) y 2 decimales.
 * Ejemplo: 1234567.89 → "1,234,567.89"
 */
export function formatearMoneda(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Formato de cantidad (números enteros o con decimales) con separador de miles.
 * Ejemplo: 12345 → "12,345"
 */
export function formatearCantidad(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
