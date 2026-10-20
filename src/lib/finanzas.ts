import type { Devolucion, GastoAdmin, MovimientoLienzo, Producto, Venta } from './api';
import { parseFecha } from './utils';

/**
 * Cálculo financiero único para Dashboard, Reportes, Gastos Admin y Sueldos.
 *
 * Criterio (flujo de efectivo):
 *  - Ingresos por ventas: lo cobrado en la venta se cuenta en la fecha de la venta y cada abono en su
 *    propia fecha. Los reembolsos (devoluciones, correcciones de ticket) se restan en su fecha.
 *    El cambio entregado al cliente nunca cuenta como ingreso. Las ventas canceladas no cuentan.
 *  - Costo de lo vendido: costo de los productos en proporción a lo cobrado de cada venta, más los
 *    ajustes de las devoluciones (pérdidas, productos que regresan al inventario).
 *  - Gastos: todo lo registrado en Gastos Admin. Las nóminas ya están ahí (categoría "Sueldos"),
 *    por eso NO se restan otra vez por separado.
 */

export type Rango = { inicio: Date; fin: Date };

export type ResumenFinanciero = {
  ingresosVentas: number;
  ingresosLienzo: number;
  ingresosTotales: number;
  costoVentas: number;
  gananciaBruta: number;
  gastosAdmin: number;
  /** Parte de gastosAdmin que corresponde a nóminas (categoría Sueldos). Informativo. */
  gastosSueldos: number;
  gananciaNeta: number;
  reembolsos: number;
  ventasConsideradas: Venta[];
};

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const sumar = (arr: { monto: number }[] | undefined) => (arr || []).reduce((s, m) => s + n(m.monto), 0);

export function enRango(fecha: string | undefined, rango: Rango): boolean {
  const d = parseFecha(fecha);
  return !Number.isNaN(d.getTime()) && d >= rango.inicio && d <= rango.fin;
}

export function esCancelada(v: Venta): boolean {
  return v.estado === 'cancelada';
}

/** Dinero que el negocio conserva de una venta (cobrado − reembolsado), nunca mayor al total original. */
export function netoCobrado(v: Venta): number {
  const total = n(v.total);
  const reembolsado = sumar(v.reembolsos);
  return Math.max(0, Math.min(n(v.pagado), total + reembolsado) - reembolsado);
}

/** Lo cobrado al momento de la venta (sin abonos posteriores ni cambio). */
function pagoInicial(v: Venta): number {
  const total = n(v.total);
  const reembolsado = sumar(v.reembolsos);
  const cobrado = Math.min(n(v.pagado), total + reembolsado);
  return Math.max(0, cobrado - sumar(v.abonos));
}

function costoVenta(v: Venta, productos: Producto[]): number {
  const total = n(v.total);
  const fraccionCobrada = total > 0 ? Math.min(1, netoCobrado(v) / total) : 1;
  return (v.items || []).reduce((s, item) => {
    const costoUnit = item.costo != null ? n(item.costo) : n(productos.find((p) => p.id === item.id)?.costo);
    return s + costoUnit * n(item.cantidad) * fraccionCobrada;
  }, 0);
}

export function calcularFinanzas(
  datos: { ventas: Venta[]; gastos: GastoAdmin[]; lienzo?: MovimientoLienzo[]; devoluciones?: Devolucion[]; productos?: Producto[] },
  rango: Rango
): ResumenFinanciero {
  const productos = datos.productos || [];
  const ventasValidas = datos.ventas.filter((v) => !esCancelada(v));

  let ingresosVentas = 0;
  let reembolsos = 0;
  let costoVentas = 0;
  const ventasConsideradas: Venta[] = [];

  for (const v of ventasValidas) {
    if (enRango(v.fecha, rango)) {
      ingresosVentas += pagoInicial(v);
      costoVentas += costoVenta(v, productos);
      ventasConsideradas.push(v);
    }
    for (const a of v.abonos || []) if (enRango(a.fecha, rango)) ingresosVentas += n(a.monto);
    for (const r of v.reembolsos || []) if (enRango(r.fecha, rango)) reembolsos += n(r.monto);
  }

  // Devoluciones sin venta de referencia: el reembolso no está en ningún ticket.
  for (const d of datos.devoluciones || []) {
    if (!enRango(d.fecha, rango)) continue;
    costoVentas += n(d.ajusteCosto);
    if (!d.ventaId) reembolsos += n(d.reembolso);
  }

  ingresosVentas -= reembolsos;

  const ingresosLienzo = (datos.lienzo || [])
    .filter((m) => m.tipo === 'ingreso' && enRango(m.fecha, rango))
    .reduce((s, m) => s + n(m.monto), 0);

  const gastosPeriodo = datos.gastos.filter((g) => enRango(g.fecha, rango));
  const gastosAdmin = gastosPeriodo.reduce((s, g) => s + n(g.monto), 0);
  const gastosSueldos = gastosPeriodo.filter((g) => g.categoria === 'Sueldos').reduce((s, g) => s + n(g.monto), 0);

  const ingresosTotales = ingresosVentas + ingresosLienzo;
  const gananciaBruta = ingresosTotales - costoVentas;

  return {
    ingresosVentas,
    ingresosLienzo,
    ingresosTotales,
    costoVentas,
    gananciaBruta,
    gastosAdmin,
    gastosSueldos,
    gananciaNeta: gananciaBruta - gastosAdmin,
    reembolsos,
    ventasConsideradas,
  };
}

export function rangoMesActual(ahora = new Date()): Rango {
  return {
    inicio: new Date(ahora.getFullYear(), ahora.getMonth(), 1),
    fin: new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

export const RANGO_TODO: Rango = { inicio: new Date(0), fin: new Date(8640000000000000) };
