// =====================================================================
// cotizaciones.js — Reglas de negocio de cotizaciones, clientes,
// órdenes de trabajo y cobros (sin DOM). Conecta db + calc + config.
// =====================================================================
import * as db from './db.js';
import { getConfig } from './config.js';
import { calcularCotizacion, estadoCobro, listaMateriales, reglasMateriales, precioDesdeCosto, calcularUtilidad } from './calc.js';
import { uid, diasDesde } from './util.js';

export const ESTADOS = { borrador: 'Borrador', enviada: 'Enviada', aceptada: 'Aceptada', rechazada: 'Rechazada' };
export const ESTADOS_OT = { programada: 'Programada', en_ejecucion: 'En ejecución', terminada: 'Terminada' };
export const MEDIOS_PAGO = ['Transferencia', 'Efectivo', 'Tarjeta', 'Otro'];

// ---------------- Clientes ----------------
export async function guardarCliente(c) {
  const ahora = Date.now();
  const cli = { id: uid(), nombre: '', local: '', rut: '', telefono: '', direccion: '', comuna: '', notas: '', creado: ahora, ...c, actualizado: ahora };
  return db.guardar('clientes', cli);
}

// ---------------- Cotizaciones ----------------
/** Crea un borrador con lo mínimo (captura rápida). */
export async function crearBorrador({ nombre = '', telefono = '', nota = '' } = {}) {
  const cfg = getConfig();
  const cliente = await guardarCliente({ nombre, telefono });
  const ahora = Date.now();
  const cot = {
    id: uid(), numero: await db.siguienteNumero(), clienteId: cliente.id,
    estado: 'borrador', paso: 1, nota, items: [],
    descuento: { tipo: 'monto', valor: 0 }, urgencia: false, traslado: false,
    tipoDoc: cfg.tipoDocDefecto, validezDias: cfg.validezDias,
    margenMatPct: cfg.margenMatPct, ivaCompraEnCosto: cfg.ivaCompraEnCosto, // snapshot de reglas de precio
    condiciones: cfg.condicionesPago, garantia: cfg.garantia, incluirFotos: false,
    fechaVisita: ahora, creado: ahora, actualizado: ahora,
    enviada: null, respondida: null, ultimoSeguimiento: null,
  };
  return db.guardar('cotizaciones', cot);
}

export async function guardarCotizacion(cot) {
  cot.actualizado = Date.now();
  return db.guardar('cotizaciones', cot);
}

export async function cargarCotizacion(id) {
  const cot = await db.obtener('cotizaciones', id);
  if (!cot) return null;
  const cliente = (await db.obtener('clientes', cot.clienteId)) || { nombre: '', telefono: '' };
  return { cot, cliente };
}

export function totales(cot) { return calcularCotizacion(cot, getConfig()); }

export async function cambiarEstado(cot, estado) {
  cot.estado = estado;
  const ahora = Date.now();
  if (estado === 'enviada' && !cot.enviada) cot.enviada = ahora;
  if (estado === 'aceptada' || estado === 'rechazada') cot.respondida = ahora;
  return guardarCotizacion(cot);
}

/** Duplica una cotización (con cliente igual) como nuevo borrador. */
export async function duplicar(id) {
  const orig = await db.obtener('cotizaciones', id);
  const ahora = Date.now();
  const copia = {
    ...structuredClone(orig), id: uid(), numero: await db.siguienteNumero(),
    estado: 'borrador', paso: 2, creado: ahora, actualizado: ahora,
    enviada: null, respondida: null, ultimoSeguimiento: null,
    items: orig.items.map((it) => ({ ...it, id: uid() })),
  };
  return db.guardar('cotizaciones', copia);
}

export async function eliminarCotizacion(id) {
  for (const f of await db.porIndice('fotos', 'cotizacionId', id)) await db.borrar('fotos', f.id);
  for (const o of await db.porIndice('ordenes', 'cotizacionId', id)) await db.borrar('ordenes', o.id);
  for (const p of await db.porIndice('pagos', 'cotizacionId', id)) await db.borrar('pagos', p.id);
  await db.borrar('cotizaciones', id);
}

/** Reglas de precio de materiales de una cotización. */
export const reglasDe = (cot) => reglasMateriales(cot, getConfig());

/**
 * Convierte un ítem del catálogo en línea de cotización (copia editable).
 * Si el ítem tiene costo, el precio de materiales se calcula con el margen de la cotización.
 */
export function lineaDesdeCatalogo(c, cantidad = 1, cot = null) {
  const linea = { id: uid(), catalogId: c.id, nombre: c.nombre, unidad: c.unidad, modo: c.modo, marca: c.marca || '', cantidad, precioMO: c.precioMO, precioMat: c.precioMat, proveedor: c.proveedor || '' };
  if (c.costoMat !== undefined) { linea.costoMat = c.costoMat; linea.precioMat = precioDesdeCosto(c.costoMat, reglasDe(cot)); }
  return linea;
}
export function lineaLibre() {
  return { id: uid(), catalogId: null, nombre: '', unidad: 'unidad', modo: 'mat_mo', marca: '', cantidad: 1, precioMO: 0, costoMat: 0, precioMat: 0, proveedor: '' };
}

export function utilidad(cot) { return calcularUtilidad(cot, totales(cot), getConfig()); }

/** Qué le falta a la cotización para poder enviarse (guía para completar). */
export function faltantes(cot, cliente) {
  const f = [];
  if (!cliente.nombre) f.push('nombre del cliente');
  if (!cliente.telefono) f.push('teléfono');
  if (!cot.items.length) f.push('ítems');
  if (cot.tipoDoc === 'factura' && !cliente.rut) f.push('RUT (para factura)');
  return f;
}

// ---------------- Órdenes de trabajo ----------------
export async function ordenDe(cotId) { return (await db.porIndice('ordenes', 'cotizacionId', cotId))[0] || null; }

export async function crearOrden(cot) {
  const existente = await ordenDe(cot.id);
  if (existente) return existente;
  const manana = new Date(); manana.setDate(manana.getDate() + 1); manana.setHours(9, 0, 0, 0);
  const ot = {
    id: uid(), cotizacionId: cot.id, fechaProgramada: manana.getTime(), estado: 'programada',
    checklist: cot.items.map((it) => ({ id: uid(), texto: `${it.cantidad} ${it.unidad} — ${it.nombre}`, hecho: false })),
    materiales: listaMateriales(cot.items), notas: '', creado: Date.now(), actualizado: Date.now(),
  };
  return db.guardar('ordenes', ot);
}
export async function guardarOrden(ot) { ot.actualizado = Date.now(); return db.guardar('ordenes', ot); }

// ---------------- Cobros ----------------
export async function pagosDe(cotId) {
  return (await db.porIndice('pagos', 'cotizacionId', cotId)).sort((a, b) => a.fecha - b.fecha);
}
export async function registrarPago(cotId, { monto, fecha, medio, nota }) {
  return db.guardar('pagos', { id: uid(), cotizacionId: cotId, monto, fecha, medio, nota: nota || '', creado: Date.now() });
}
export async function cobroDe(cot) {
  const pagos = await pagosDe(cot.id);
  return { pagos, ...estadoCobro(totales(cot).total, pagos) };
}

// ---------------- Pantalla de pendientes ----------------
/**
 * Construye la lista de pendientes ordenada por urgencia:
 *  1) borradores sin enviar, 2) seguimientos vencidos, 3) aceptadas sin orden,
 *  4) trabajos programados/en ejecución, 5) cobros con saldo.
 */
export async function calcularPendientes() {
  const cfg = getConfig();
  const [cots, clientes, ordenes, pagos] = await Promise.all(['cotizaciones', 'clientes', 'ordenes', 'pagos'].map(db.todos));
  const cliPor = Object.fromEntries(clientes.map((c) => [c.id, c]));
  const otPor = Object.fromEntries(ordenes.map((o) => [o.cotizacionId, o]));
  const pagosPor = {};
  for (const p of pagos) (pagosPor[p.cotizacionId] ||= []).push(p);

  const borradores = [], seguimientos = [], sinOrden = [], trabajos = [], cobros = [];
  let porCobrar = 0;

  for (const cot of cots) {
    const cliente = cliPor[cot.clienteId] || {};
    const t = calcularCotizacion(cot, cfg);
    const base = { cot, cliente, total: t.total };
    if (cot.estado === 'borrador') borradores.push(base);
    if (cot.estado === 'enviada') {
      const desde = cot.ultimoSeguimiento || cot.enviada || cot.actualizado;
      const dias = diasDesde(desde);
      if (dias >= cfg.diasSeguimiento) seguimientos.push({ ...base, dias: diasDesde(cot.enviada || desde) });
    }
    if (cot.estado === 'aceptada') {
      const ot = otPor[cot.id];
      if (!ot) sinOrden.push(base);
      else if (ot.estado !== 'terminada') trabajos.push({ ...base, ot });
      const c = estadoCobro(t.total, pagosPor[cot.id]);
      if (c.saldo > 0) { porCobrar += c.saldo; cobros.push({ ...base, ot, ...c }); }
    }
  }
  borradores.sort((a, b) => b.cot.actualizado - a.cot.actualizado);
  seguimientos.sort((a, b) => b.dias - a.dias);
  trabajos.sort((a, b) => a.ot.fechaProgramada - b.ot.fechaProgramada);
  // Primero los cobros de trabajos terminados (ya se puede cobrar todo)
  cobros.sort((a, b) => (b.ot?.estado === 'terminada') - (a.ot?.estado === 'terminada') || b.saldo - a.saldo);

  const ultimoRespaldo = await db.getMeta('ultimoRespaldo');
  const instalado = await db.getMeta('instalado', Date.now());
  const respaldoVencido = cots.length > 0 && diasDesde(ultimoRespaldo || instalado) > cfg.diasRespaldo;

  return { borradores, seguimientos, sinOrden, trabajos, cobros, porCobrar, respaldoVencido, ultimoRespaldo };
}
