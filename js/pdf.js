// =====================================================================
// pdf.js — PDF de la cotización con jsPDF (vendor/jspdf.umd.min.js,
// incluido localmente). Un solo color de marca; legible en B/N.
// La vista interna (neto/líquido/retención) NUNCA va en el PDF.
// =====================================================================
import { getConfig } from './config.js';
import { clp, fecha, formatearRut, telBonito } from './util.js';
import { fotosDe, aDataUrl } from './fotos.js';
import { totalLinea } from './calc.js';

const MARCA = [14, 74, 92];   // #0E4A5C
const AMBAR = [242, 169, 0];  // #F2A900 (acento de la marca Voltia: línea bajo el encabezado)

/** El logo puede ser un dataURL (subido en Ajustes) o una ruta de la app (precargado). */
async function resolverLogo(src) {
  if (!src || src.startsWith('data:')) return src || '';
  try { return await aDataUrl(await (await fetch(src)).blob()); } catch { return ''; }
}
const NEGRO = [26, 26, 26];
const GRIS = [74, 79, 82];
const LINEA = [190, 196, 200];

// ---------------------------------------------------------------------
// Bloques comunes (cotización e informe técnico)
// ---------------------------------------------------------------------

/** Crea el documento y la función de texto. */
function nuevoDoc() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const txt = (s, x, yy, o = {}) => {
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal');
    doc.setFontSize(o.size || 10);
    doc.setTextColor(...(o.color || NEGRO));
    doc.text(String(s), x, yy, { align: o.align || 'left', maxWidth: o.maxWidth });
  };
  return { doc, txt };
}

/** Logo + nombre y datos del electricista. Devuelve el alto usado. */
function encabezadoNegocio(doc, txt, neg, M, y) {
  let xDatos = M;
  if (neg.logo) {
    try {
      const p = doc.getImageProperties(neg.logo);
      const h = 20, w = Math.min(45, (p.width / p.height) * h);
      doc.addImage(neg.logo, 'PNG', M, y, w, h, 'logo', 'FAST'); // comprimido: sin esto el PDF pesa ~1 MB
      xDatos = M + w + 5;
    } catch { /* logo inválido: se omite */ }
  }
  // El nombre se achica si no cabe al lado del título de la derecha (máx. ~110 mm).
  const nombre = neg.nombre || 'Servicios eléctricos';
  const disponible = 110 - (xDatos - M);
  doc.setFont('helvetica', 'bold');
  let tam = 14;
  while (tam > 9 && (doc.getStringUnitWidth(nombre) * tam) / doc.internal.scaleFactor > disponible) tam -= 0.5;
  txt(nombre, xDatos, y + 5, { bold: true, size: tam, color: MARCA });
  const datos = [
    neg.representante,
    neg.rut && `RUT ${formatearRut(neg.rut)}`,
    neg.telefono && telBonito(neg.telefono),
    neg.correo,
    neg.sec && `Instalador SEC N° ${neg.sec}`,
  ].filter(Boolean);
  datos.forEach((d, i) => txt(d, xDatos, y + 10 + i * 4.5, { size: 9, color: GRIS }));
  return Math.max(30, 12 + datos.length * 4.5);
}

/** Bloque CLIENTE (incluye local / sucursal). Devuelve la nueva y. */
function bloqueCliente(txt, cliente, M, y) {
  txt('CLIENTE', M, y, { bold: true, size: 9, color: MARCA });
  y += 5;
  const cli = [
    cliente.nombre,
    cliente.local,
    cliente.rut && `RUT ${formatearRut(cliente.rut)}`,
    [cliente.direccion, cliente.comuna].filter(Boolean).join(', '),
    cliente.telefono && telBonito(cliente.telefono),
  ].filter(Boolean);
  cli.forEach((c, i) => txt(c, M, y + i * 4.8, { size: 10, bold: i === 0 }));
  return y + cli.length * 4.8 + 5;
}

/** Pie con número de página en todas las hojas. */
function pieDePagina(doc, txt, texto) {
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    txt(`${texto}  ·  Página ${i} de ${paginas}`, 105, 290, { size: 8, color: GRIS, align: 'center' });
  }
}

/** Anexo de fotos (una o dos por página). Devuelve la nueva y. */
async function anexoFotos(doc, txt, fotos, M, ANCHO, titulo) {
  doc.addPage();
  let y = M;
  txt(titulo, M, y + 4, { bold: true, size: 12, color: MARCA }); y += 12;
  for (const f of fotos) {
    const url = await aDataUrl(f.blob);
    const esc = Math.min(ANCHO / f.ancho, 110 / f.alto);
    const w = f.ancho * esc, h = f.alto * esc;
    if (y + h + 12 > 277) { doc.addPage(); y = M; }
    doc.addImage(url, 'JPEG', M + (ANCHO - w) / 2, y, w, h);
    y += h + 5;
    if (f.nota) { txt(f.nota, M, y, { size: 9, color: GRIS, maxWidth: ANCHO }); y += 6; }
    y += 4;
  }
  return y;
}

export const nombrePdf = (cot, cliente) =>
  `Cotizacion-${String(cot.numero).padStart(4, '0')}${cliente.nombre ? '-' + cliente.nombre.replace(/[^\wáéíóúñÁÉÍÓÚÑ]+/g, '_') : ''}.pdf`;

export async function generarPdf(cot, cliente, t) {
  const { jsPDF } = window.jspdf;
  const cfg = getConfig();
  const neg = { ...cfg.negocio, logo: await resolverLogo(cfg.negocio.logo) };
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 15, ANCHO = W - 2 * M;
  let y = M;

  const txt = (s, x, yy, o = {}) => {
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal');
    doc.setFontSize(o.size || 10);
    doc.setTextColor(...(o.color || NEGRO));
    doc.text(String(s), x, yy, { align: o.align || 'left', maxWidth: o.maxWidth });
  };
  const saltoSiHaceFalta = (alto) => { if (y + alto > 297 - 20) { doc.addPage(); y = M; return true; } return false; };

  // ---------- Encabezado: logo + datos del electricista ----------
  const altoDatos = encabezadoNegocio(doc, txt, neg, M, y);

  // Bloque derecho: número, fecha, validez, tipo de documento
  txt('COTIZACIÓN', W - M, y + 5, { bold: true, size: 14, color: MARCA, align: 'right' });
  txt(`N° ${String(cot.numero).padStart(4, '0')}`, W - M, y + 11, { bold: true, size: 11, align: 'right' });
  txt(`Fecha: ${fecha(cot.enviada || Date.now())}`, W - M, y + 16, { size: 9, color: GRIS, align: 'right' });
  txt(`Válida por ${cot.validezDias} días`, W - M, y + 20.5, { size: 9, color: GRIS, align: 'right' });
  txt(cot.tipoDoc === 'factura' ? 'Documento: Factura' : 'Documento: Boleta de honorarios', W - M, y + 25, { size: 9, color: GRIS, align: 'right' });

  y += altoDatos;
  doc.setDrawColor(...AMBAR); doc.setLineWidth(1.2); doc.line(M, y, W - M, y); // línea ámbar del membrete
  y += 7;

  // ---------- Cliente ----------
  y = bloqueCliente(txt, cliente, M, y);

  // ---------- Tabla de ítems ----------
  const col = { desc: M, cant: M + 105, uni: M + 120, pu: M + 152, tot: W - M };
  const cabecera = () => {
    doc.setDrawColor(...NEGRO); doc.setLineWidth(0.3);
    txt('Descripción', col.desc, y, { bold: true, size: 9 });
    txt('Cant.', col.cant, y, { bold: true, size: 9, align: 'right' });
    txt('Unidad', col.uni - 12, y, { bold: true, size: 9 });
    txt('P. unitario', col.pu, y, { bold: true, size: 9, align: 'right' });
    txt('Total', col.tot, y, { bold: true, size: 9, align: 'right' });
    y += 2; doc.line(M, y, W - M, y); y += 5;
  };
  cabecera();
  doc.setLineWidth(0.15); doc.setDrawColor(...LINEA);
  for (const it of cot.items) {
    const l = totalLinea(it);
    const pu = (Number(it.precioMO) || 0) + (Number(it.precioMat) || 0);
    let nombre = it.nombre || 'Ítem';
    if (it.marca === 'desde') nombre += ' (precio desde)';
    if (it.marca === 'caso') nombre += ' (referencial, sujeto a evaluación)';
    doc.setFontSize(10);
    const lineas = doc.splitTextToSize(nombre, 98);
    const alto = lineas.length * 4.6 + 3;
    if (saltoSiHaceFalta(alto + 4)) cabecera();
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...NEGRO);
    doc.text(lineas, col.desc, y);
    txt(String(it.cantidad).replace('.', ','), col.cant, y, { align: 'right' });
    txt(it.unidad, col.uni - 12, y, { size: 9, color: GRIS });
    txt(clp(pu), col.pu, y, { align: 'right' });
    txt(clp(l.total), col.tot, y, { align: 'right' });
    y += alto - 3 + 2;
    doc.setDrawColor(...LINEA); doc.line(M, y, W - M, y);
    y += 5;
  }

  // ---------- Totales ----------
  saltoSiHaceFalta(60);
  y += 2;
  const xEt = W - M - 70;
  const filaTot = (et, val, o = {}) => {
    txt(et, xEt, y, { size: o.size || 10, bold: o.bold, color: o.color || GRIS });
    txt(val, W - M, y, { size: o.size || 10, bold: o.bold, align: 'right', color: o.color || NEGRO });
    y += o.salto || 5.5;
  };
  filaTot('Subtotal', clp(t.base));
  if (t.margen) filaTot(`Gastos generales y utilidades`, clp(t.margen));
  if (t.urgencia) filaTot(`Recargo por urgencia`, clp(t.urgencia));
  if (t.traslado) filaTot('Traslado', clp(t.traslado));
  if (t.descuento) filaTot('Descuento', '-' + clp(t.descuento));
  y += 1;
  doc.setDrawColor(...MARCA); doc.setLineWidth(0.8); doc.line(xEt, y - 3, W - M, y - 3);
  y += 4;
  filaTot('TOTAL', clp(t.total), { size: 16, bold: true, color: MARCA, salto: 7 });
  if (cot.tipoDoc === 'factura') {
    filaTot('Neto', clp(t.factura.neto), { size: 9 });
    filaTot(`IVA ${t.factura.ivaPct}%`, clp(t.factura.iva), { size: 9 });
    txt('Total con IVA incluido. Se emite factura.', W - M, y, { size: 8, color: GRIS, align: 'right' }); y += 5;
  } else {
    txt('Monto total bruto. Se emite boleta de honorarios.', W - M, y, { size: 8, color: GRIS, align: 'right' }); y += 5;
  }

  // ---------- Nota y condiciones (letra chica) ----------
  y += 6;
  const bloques = [
    cot.notaCliente && ['Observaciones', cot.notaCliente],
    ['Condiciones de pago', cot.condiciones],
    ['Garantía', cot.garantia],
    ['Validez', `Esta cotización es válida por ${cot.validezDias} días desde su fecha de emisión.`],
  ].filter((b) => b && b[1]);
  for (const [tit, cuerpo] of bloques) {
    doc.setFontSize(8.5);
    const ls = doc.splitTextToSize(cuerpo, ANCHO);
    saltoSiHaceFalta(ls.length * 3.8 + 6);
    txt(tit, M, y, { bold: true, size: 8.5, color: GRIS }); y += 4;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRIS); doc.text(ls, M, y);
    y += ls.length * 3.8 + 3;
  }

  // ---------- Anexo de fotos ----------
  if (cot.incluirFotos) {
    const fotos = await fotosDe(cot.id);
    if (fotos.length) await anexoFotos(doc, txt, fotos, M, ANCHO, 'ANEXO: FOTOS DE LA VISITA');
  }

  pieDePagina(doc, txt, `${neg.nombre || ''}  ·  Cotización N° ${String(cot.numero).padStart(4, '0')}`);
  return doc.output('blob');
}

// =====================================================================
// INFORME TÉCNICO
// =====================================================================
export const CONDICIONES_FINALES = {
  operativa: 'Instalación operativa y segura',
  observaciones: 'Operativa con observaciones',
  desconectado: 'Equipo o circuito desconectado por seguridad',
  riesgo: 'Queda con riesgo informado al cliente',
};

export const nombreInformePdf = (cot, cliente) =>
  `Informe-Tecnico-${String(cot.numero).padStart(4, '0')}${cliente.nombre ? '-' + cliente.nombre.replace(/[^\wáéíóúñÁÉÍÓÚÑ]+/g, '_') : ''}.pdf`;

/** Genera el PDF del informe técnico (cot.informe). */
export async function generarInformePdf(cot, cliente, inf) {
  const neg = { ...getConfig().negocio, logo: await resolverLogo(getConfig().negocio.logo) };
  const { doc, txt } = nuevoDoc();
  const W = 210, M = 15, ANCHO = W - 2 * M;
  let y = M;
  const salto = (alto) => { if (y + alto > 277) { doc.addPage(); y = M; } };

  const alto = encabezadoNegocio(doc, txt, neg, M, y);
  txt('INFORME TÉCNICO', W - M, y + 5, { bold: true, size: 14, color: MARCA, align: 'right' });
  txt(`N° ${String(cot.numero).padStart(4, '0')}`, W - M, y + 11, { bold: true, size: 11, align: 'right' });
  txt(`Fecha de inspección: ${fecha(inf.fecha || Date.now())}`, W - M, y + 16, { size: 9, color: GRIS, align: 'right' });
  y += alto;
  doc.setDrawColor(...AMBAR); doc.setLineWidth(1.2); doc.line(M, y, W - M, y); // línea ámbar del membrete
  y += 7;
  y = bloqueCliente(txt, cliente, M, y);

  /** Sección con título y texto (respeta saltos de línea). */
  const seccion = (titulo, cuerpo) => {
    if (!cuerpo || !String(cuerpo).trim()) return;
    doc.setFontSize(10);
    const ls = doc.splitTextToSize(String(cuerpo).trim(), ANCHO);
    salto(10 + Math.min(ls.length, 4) * 4.8);
    txt(titulo.toUpperCase(), M, y, { bold: true, size: 9, color: MARCA }); y += 5;
    for (const l of ls) { salto(5); txt(l, M, y, { size: 10 }); y += 4.8; }
    y += 4;
  };

  seccion('Motivo de la visita', inf.motivo);
  seccion('Hallazgos', inf.hallazgos);
  seccion('Trabajos ejecutados', inf.acciones);
  seccion('Recomendaciones', inf.recomendaciones);
  seccion('Normativa de referencia', inf.normativa);

  // Condición final: destacada; si queda riesgo, recuadro de advertencia.
  const cond = CONDICIONES_FINALES[inf.condicion] || CONDICIONES_FINALES.operativa;
  doc.setFontSize(10);
  const det = inf.condicionDetalle ? doc.splitTextToSize(inf.condicionDetalle.trim(), ANCHO - 8) : [];
  const altoCaja = 14 + det.length * 4.8;
  salto(altoCaja + 4);
  const fuerte = inf.condicion === 'riesgo' || inf.condicion === 'desconectado';
  doc.setDrawColor(...(fuerte ? NEGRO : MARCA)); doc.setLineWidth(fuerte ? 0.8 : 0.4);
  doc.rect(M, y - 4, ANCHO, altoCaja);
  txt(`${fuerte ? 'ADVERTENCIA · ' : ''}CONDICIÓN EN QUE QUEDA LA INSTALACIÓN`, M + 4, y + 1, { bold: true, size: 9, color: fuerte ? NEGRO : MARCA });
  txt(cond, M + 4, y + 6.5, { bold: true, size: 11 });
  det.forEach((l, i) => txt(l, M + 4, y + 12 + i * 4.8, { size: 10 }));
  y += altoCaja + 6;

  // Firmas: el cliente declara haber sido informado (respaldo ante riesgos).
  salto(30);
  y += 14;
  doc.setDrawColor(...NEGRO); doc.setLineWidth(0.3);
  doc.line(M, y, M + 75, y); doc.line(W - M - 75, y, W - M, y);
  txt(neg.representante || neg.nombre || 'Instalador', M, y + 5, { size: 9 });
  txt([neg.sec ? `Instalador SEC N° ${neg.sec}` : 'Instalador eléctrico', neg.representante && neg.nombre].filter(Boolean).join(' · '), M, y + 9.5, { size: 8, color: GRIS });
  txt('Recibí conforme e informado', W - M - 75, y + 5, { size: 9 });
  txt('Nombre, RUT y firma del cliente', W - M - 75, y + 9.5, { size: 8, color: GRIS });

  if (inf.incluirFotos) {
    const fotos = await fotosDe(cot.id);
    if (fotos.length) await anexoFotos(doc, txt, fotos, M, ANCHO, 'ANEXO: REGISTRO FOTOGRÁFICO');
  }

  pieDePagina(doc, txt, `${neg.nombre || ''}  ·  Informe técnico N° ${String(cot.numero).padStart(4, '0')}`);
  return doc.output('blob');
}
