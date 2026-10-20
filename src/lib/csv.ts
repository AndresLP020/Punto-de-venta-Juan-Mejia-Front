/** Utilidades CSV mínimas (separador coma, comillas dobles) para exportar/importar productos. */

function celda(v: unknown): string {
  const s = v == null ? '' : String(v);
  // Evita que Excel interprete el contenido como fórmula (inyección CSV).
  const seguro = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

export function aCSV(encabezados: string[], filas: unknown[][]): string {
  return [encabezados, ...filas].map((f) => f.map(celda).join(',')).join('\r\n');
}

export function descargarCSV(nombreArchivo: string, contenido: string) {
  const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}

/** Convierte texto CSV en filas de objetos usando la primera fila como encabezados (en minúsculas). */
export function leerCSV(texto: string): Record<string, string>[] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let comillas = false;
  const t = texto.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"' && t[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ',' || c === ';') {
      fila.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else campo += c;
  }
  if (campo !== '' || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  const [encabezado, ...resto] = filas.filter((f) => f.some((x) => x.trim() !== ''));
  if (!encabezado) return [];
  const claves = encabezado.map((h) => h.trim().toLowerCase());
  return resto.map((f) => Object.fromEntries(claves.map((k, i) => [k, (f[i] ?? '').trim()])));
}
