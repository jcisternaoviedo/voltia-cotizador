// =====================================================================
// calc.js — Lógica de cálculo PURA (sin DOM, sin almacenamiento).
// Se puede probar con Node:  node tests/calc.test.mjs
// Todos los montos en CLP enteros.
// =====================================================================

/** Redondeo a peso entero (half-up). */
export const redondear = (n) => Math.round(Number(n) || 0);

/** Total de una línea de cotización. */
export function totalLinea(item) {
  const cant = Math.max(0, Number(item.cantidad) || 0);
  const mo = Math.max(0, Number(item.precioMO) || 0);
  const mat = Math.max(0, Number(item.precioMat) || 0);
  return { mo: redondear(cant * mo), mat: redondear(cant * mat), total: redondear(cant * mo) + redondear(cant * mat) };
}

/**
 * Tasa de retención de boleta de honorarios para un año dado.
 * tabla = { "2026": 15.25, "2027": 16, "2028": 17 }  (configurable)
 * Usa el año exacto o, si no existe, el año más cercano anterior/posterior disponible.
 */
export function tasaRetencion(tabla, anio) {
  const anios = Object.keys(tabla || {}).map(Number).sort((a, b) => a - b);
  if (!anios.length) return 0;
  let elegido = anios[0];
  for (const a of anios) if (a <= anio) elegido = a;
  return Number(tabla[elegido]) || 0;
}

/**
 * Calcula todos los totales de una cotización.
 * Orden de cálculo (declarado):
 *  1. base = materiales + mano de obra
 *  2. margen = base × margen%            (por defecto 0%: el catálogo ya trae precio final)
 *  3. urgencia = MO × urgencia%          (el recargo por urgencia se aplica sobre la mano de obra)
 *  4. traslado = monto fijo
 *  5. subtotal = base + margen + urgencia + traslado
 *  6. descuento = monto fijo o % del subtotal (nunca mayor al subtotal)
 *  7. total al cliente = subtotal − descuento   ← NO depende del tipo de documento
 *  8. desglose: factura → neto = round(total/1,19), IVA = total − neto
 *               boleta  → retención = round(total × tasa), líquido = total − retención
 */
export function calcularCotizacion(cot, cfg) {
  const items = cot.items || [];
  let mat = 0, mo = 0;
  for (const it of items) { const l = totalLinea(it); mat += l.mat; mo += l.mo; }
  const base = mat + mo;

  const margen = redondear(base * (Number(cfg.margenPct) || 0) / 100);
  const urgencia = cot.urgencia ? redondear(mo * (Number(cfg.urgenciaPct) || 0) / 100) : 0;
  const traslado = cot.traslado ? redondear(Number(cfg.trasladoMonto) || 0) : 0;
  const subtotal = base + margen + urgencia + traslado;

  const d = cot.descuento || { tipo: 'monto', valor: 0 };
  let descuento = d.tipo === 'pct'
    ? redondear(subtotal * Math.min(100, Math.max(0, Number(d.valor) || 0)) / 100)
    : redondear(Math.max(0, Number(d.valor) || 0));
  descuento = Math.min(descuento, subtotal);

  const total = subtotal - descuento;

  const ivaPct = Number(cfg.ivaPct) || 0;
  const neto = redondear(total / (1 + ivaPct / 100));
  const iva = total - neto; // por diferencia: siempre cuadra con el total

  const anio = new Date(cot.creado || Date.now()).getFullYear();
  const retPct = tasaRetencion(cfg.retenciones, anio);
  const retencion = redondear(total * retPct / 100);
  const liquido = total - retencion;

  const esFactura = cot.tipoDoc === 'factura';
  return {
    mat, mo, base, margen, urgencia, traslado, subtotal, descuento, total,
    factura: { neto, iva, ivaPct },
    boleta: { bruto: total, retencion, liquido, retPct },
    recibe: esFactura ? neto : liquido, // lo que realmente queda para el electricista
  };
}

// ---------------------------------------------------------------------
// MODELO COSTO + MARGEN (forma de cobrar del electricista)
//   precio material al cliente = costo neto de compra × (1 + IVA si se
//   configura) × (1 + margen materiales %)
// Las reglas se guardan en cada cotización (snapshot), así cambiar la
// configuración después no altera cotizaciones antiguas.
// ---------------------------------------------------------------------

/** Reglas de precio de materiales: de la cotización o, si no tiene, de la configuración. */
export function reglasMateriales(cot, cfg) {
  return {
    margenMatPct: Number(cot?.margenMatPct ?? cfg.margenMatPct ?? 0),
    ivaCompraEnCosto: Boolean(cot?.ivaCompraEnCosto ?? cfg.ivaCompraEnCosto),
    ivaPct: Number(cfg.ivaPct) || 0,
  };
}

/** Costo real pagado por unidad de material (con IVA de compra si corresponde). */
export function costoRealUnit(costoNeto, reglas) {
  const c = Math.max(0, Number(costoNeto) || 0);
  return reglas.ivaCompraEnCosto ? c * (1 + reglas.ivaPct / 100) : c;
}

/** Precio unitario de material al cliente a partir del costo neto de compra. */
export function precioDesdeCosto(costoNeto, reglas) {
  return redondear(costoRealUnit(costoNeto, reglas) * (1 + reglas.margenMatPct / 100));
}

/** ¿La línea usa el modelo costo + margen? (líneas antiguas solo tienen precioMat) */
export const usaCosto = (it) => it.costoMat !== undefined && it.costoMat !== null;

/** Recalcula precioMat de todas las líneas con costo (al cambiar margen o costo). */
export function aplicarReglas(items, reglas) {
  for (const it of items || []) if (usaCosto(it)) it.precioMat = precioDesdeCosto(it.costoMat, reglas);
  return items;
}

/**
 * Anexo interno de utilidad (nunca va en el PDF).
 *  costoMateriales = lo que pagas en la ferretería
 *  margenMateriales = precio materiales al cliente − costo
 *  utilidad = lo que recibes (neto o líquido) − costo de materiales
 * Líneas sin costo registrado: se asume costo = precio (sin margen), conservador.
 */
export function calcularUtilidad(cot, t, cfg) {
  const reglas = reglasMateriales(cot, cfg);
  let costoMateriales = 0, sinCosto = 0;
  for (const it of cot.items || []) {
    const cant = Math.max(0, Number(it.cantidad) || 0);
    if (usaCosto(it)) costoMateriales += redondear(cant * costoRealUnit(it.costoMat, reglas));
    else if ((Number(it.precioMat) || 0) > 0) { costoMateriales += redondear(cant * it.precioMat); sinCosto++; }
  }
  const margenMateriales = t.mat - costoMateriales;
  const utilidad = t.recibe - costoMateriales;
  return {
    costoMateriales, margenMateriales, manoObra: t.mo, sinCosto, utilidad,
    impuesto: cot.tipoDoc === 'factura' ? t.factura.iva : t.boleta.retencion,
    margenSobreVenta: t.total ? Math.round((utilidad / t.total) * 1000) / 10 : 0,
  };
}

/** Estado de cobro a partir del total y los pagos registrados. */
export function estadoCobro(total, pagos) {
  const pagado = (pagos || []).reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const saldo = Math.max(0, total - pagado);
  const estado = pagado <= 0 ? 'pendiente' : saldo > 0 ? 'abonada' : 'pagada';
  return { pagado, saldo, estado };
}

/** Lista de materiales a comprar generada desde los ítems (solo los que tienen materiales). */
export function listaMateriales(items) {
  return (items || [])
    .filter((it) => (Number(it.precioMat) || 0) > 0 && (Number(it.cantidad) || 0) > 0)
    .map((it) => ({
      texto: `Materiales: ${it.nombre}`, cantidad: Number(it.cantidad), unidad: it.unidad, comprado: false,
      proveedor: it.proveedor || '', costoUnit: usaCosto(it) ? Number(it.costoMat) || 0 : null,
    }));
}
