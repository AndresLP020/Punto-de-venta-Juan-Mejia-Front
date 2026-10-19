// Utilidades CSV (compatibles con Excel: BOM UTF-8, comillas y separador , o ;)

function celda(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function generarCSV(columnas: string[], filas: unknown[][]): string {
  return '﻿' + [columnas, ...filas].map((f) => f.map(celda).join(',')).join('\r\n');
}

export function descargarArchivo(contenido: string, nombre: string, tipo = 'text/csv;charset=utf-8') {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Lee un CSV a filas de texto. Detecta si el separador es coma o punto y coma. */
export function leerCSV(texto: string): string[][] {
  const t = texto.replace(/^﻿/, '');
  const primera = t.split(/\r?\n/, 1)[0] || '';
  const sep = (primera.match(/;/g) || []).length > (primera.match(/,/g) || []).length ? ';' : ',';
  const filas: string[][] = [];
  let fila: string[] = [];
  let actual = '';
  let comillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"' && t[i + 1] === '"') {
        actual += '"';
        i++;
      } else if (c === '"') comillas = false;
      else actual += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) {
      fila.push(actual);
      actual = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      fila.push(actual);
      filas.push(fila);
      fila = [];
      actual = '';
    } else actual += c;
  }
  if (actual !== '' || fila.length > 0) {
    fila.push(actual);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((v) => v.trim() !== ''));
}

/** Normaliza un encabezado: minúsculas, sin acentos ni espacios ("Stock mínimo" -> "stockminimo") */
export const normalizarEncabezado = (h: string) =>
  h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
