// =====================================================================
// Detalle de una cotización: estado (cambiable con un toque), ítems,
// totales, fotos y acciones (reenviar, PDF, duplicar, orden, cobro).
// =====================================================================
import { pintar, ir, h, $, $$, aviso, checkOk, hoja, cerrarHoja } from '../ui.js';
import { icono } from '../icons.js';
import { clp, fecha, telBonito, formatearRut } from '../util.js';
import { cargarCotizacion, cambiarEstado, guardarCotizacion, totales, duplicar, eliminarCotizacion, ordenDe, crearOrden, cobroDe, ESTADOS } from '../cotizaciones.js';
import { totalLinea } from '../calc.js';
import { htmlTotales } from './comun.js';
import { enviarCotizacion, descargarPdf } from '../envio.js';
import { abrirWa, textoSeguimiento } from '../whatsapp.js';
import { seccionFotos } from './asistente.js';
import { copiarFotos } from '../fotos.js';

const CLASE = { borrador: 'e-enviar', enviada: 'e-segui', aceptada: 'e-listo', rechazada: 'e-neutro' };

export async function pantallaDetalle(id) {
  const datos = await cargarCotizacion(id);
  if (!datos) { aviso('No se encontró la cotización'); ir('#/'); return; }
  const { cot, cliente } = datos;
  if (cot.estado === 'borrador') { ir(`#/cot/${id}/paso/${cot.paso || 1}`); return; }
  const t = totales(cot);
  const ot = await ordenDe(cot.id);
  const cobro = cot.estado === 'aceptada' ? await cobroDe(cot) : null;

  let principal;
  if (cot.estado === 'enviada') principal = { texto: 'Enviar seguimiento por WhatsApp', icono: 'whatsapp' };
  else if (cot.estado === 'aceptada' && !ot) principal = { texto: 'Crear orden de trabajo', icono: 'calendar' };
  else if (cot.estado === 'aceptada' && ot.estado !== 'terminada') principal = { texto: 'Abrir orden de trabajo', icono: 'tool' };
  else if (cot.estado === 'aceptada') principal = { texto: cobro.saldo > 0 ? 'Registrar pago' : 'Ver cobro', icono: 'cash' };
  else principal = { texto: 'Duplicar como nueva cotización', icono: 'copy' };

  const main = pintar({
    titulo: `Cotización N° ${cot.numero}`, atras: true, principal,
    cuerpo: `
      <div class="segmentado" id="estados">${Object.entries(ESTADOS).filter(([k]) => k !== 'borrador').map(([k, v]) =>
        `<button data-e="${k}" aria-pressed="${cot.estado === k}">${v}</button>`).join('')}</div>
      <div class="panel">
        <div style="display:flex;justify-content:space-between;gap:8px"><b>${h(cliente.nombre || 'Sin nombre')}${cliente.local ? ' · ' + h(cliente.local) : ''}</b>
          <span class="etiqueta ${CLASE[cot.estado]}">${ESTADOS[cot.estado]}</span></div>
        <div class="chico">${h(telBonito(cliente.telefono))}${cliente.rut ? ' · RUT ' + h(formatearRut(cliente.rut)) : ''}</div>
        <div class="chico">${h([cliente.direccion, cliente.comuna].filter(Boolean).join(', '))}</div>
        <div class="chico">Creada ${fecha(cot.creado)}${cot.enviada ? ' · enviada ' + fecha(cot.enviada) : ''}${cot.respondida ? ' · respuesta ' + fecha(cot.respondida) : ''}</div>
        ${cot.nota ? `<div class="chico" style="margin-top:6px">Nota: ${h(cot.nota)}</div>` : ''}
      </div>
      ${cobro ? `<button class="tarjeta" data-ir="#/cobro/${cot.id}"><span class="ico-estado ${cobro.saldo ? 'e-cobrar' : 'e-listo'}">${icono('wallet')}</span>
        <span class="cuerpo"><div class="nombre">Cobro: ${cobro.saldo ? 'saldo ' + clp(cobro.saldo) : 'pagado'}</div><div class="detalle">Pagado ${clp(cobro.pagado)} de ${clp(t.total)}</div></span></button>` : ''}
      ${ot ? `<button class="tarjeta" data-ir="#/orden/${ot.id}"><span class="ico-estado ${ot.estado === 'terminada' ? 'e-listo' : 'e-segui'}">${icono('tool')}</span>
        <span class="cuerpo"><div class="nombre">Orden de trabajo</div><div class="detalle">${fecha(ot.fechaProgramada)} · ${ot.estado === 'terminada' ? 'Terminada' : ot.estado === 'en_ejecucion' ? 'En ejecución' : 'Programada'}</div></span></button>` : ''}
      <div class="seccion-titulo">Ítems</div>
      ${cot.items.map((it) => `<div class="pago-fila"><span>${it.cantidad} ${h(it.unidad)} — ${h(it.nombre)}</span><span class="monto">${clp(totalLinea(it).total)}</span></div>`).join('')}
      <div class="panel" style="margin-top:12px">${htmlTotales(cot, t)}</div>
      <div class="fila-btns">
        <button class="btn" id="b-reenviar">${icono('whatsapp')}Reenviar PDF</button>
        <button class="btn" id="b-pdf">${icono('download')}Descargar PDF</button>
        <button class="btn" id="b-editar">${icono('edit')}Editar</button>
        <button class="btn" id="b-dup">${icono('copy')}Duplicar</button>
        <button class="btn" data-ir="#/informe/${cot.id}">${icono('file')}${cot.informe ? 'Ver informe técnico' : 'Informe técnico'}</button>
      </div>
      <div class="seccion-titulo">Fotos</div>
      <div id="fotos"></div>
      <div class="fila-btns"><button class="btn btn-peligro" id="b-borrar">${icono('trash')}Eliminar cotización</button></div>`,
  });

  $$('[data-ir]', main).forEach((b) => (b.onclick = () => ir(b.dataset.ir)));
  await seccionFotos($('#fotos'), cot, () => guardarCotizacion(cot));

  $$('#estados button').forEach((b) => (b.onclick = async () => {
    if (b.dataset.e === cot.estado) return;
    await cambiarEstado(cot, b.dataset.e);
    checkOk(); aviso(`Marcada como ${ESTADOS[b.dataset.e].toLowerCase()}`);
    pantallaDetalle(id);
  }));
  $('#b-reenviar').onclick = async () => { if (await enviarCotizacion(cot, cliente, 'pdf')) pantallaDetalle(id); };
  $('#b-pdf').onclick = () => descargarPdf(cot, cliente);
  $('#b-editar').onclick = () => ir(`#/cot/${id}/paso/2`);
  const dup = async () => {
    const nueva = await duplicar(id);
    await copiarFotos(id, nueva.id);
    aviso(`Duplicada como N° ${nueva.numero}`); ir(`#/cot/${nueva.id}/paso/1`);
  };
  $('#b-dup').onclick = dup;
  $('#b-borrar').onclick = () => {
    const el = hoja(`<h2>¿Eliminar la cotización N° ${cot.numero}?</h2>
      <p>Se borran también sus fotos, orden de trabajo y pagos. No se puede deshacer.</p>
      <div class="fila-btns"><button class="btn" id="no">Conservar</button>
      <button class="btn btn-primario" id="si">${icono('trash')}Eliminar</button></div>`);
    $('#no', el).onclick = cerrarHoja;
    $('#si', el).onclick = async () => { await eliminarCotizacion(id); cerrarHoja(); aviso('Cotización eliminada'); ir('#/historial'); };
  };

  $('#btn-principal').onclick = async () => {
    if (cot.estado === 'enviada') {
      abrirWa(cliente.telefono, textoSeguimiento(cot, cliente, t));
      cot.ultimoSeguimiento = Date.now(); await guardarCotizacion(cot);
      checkOk(); aviso('Seguimiento enviado');
    } else if (cot.estado === 'aceptada' && !ot) {
      const nueva = await crearOrden(cot); ir(`#/orden/${nueva.id}`);
    } else if (cot.estado === 'aceptada' && ot.estado !== 'terminada') ir(`#/orden/${ot.id}`);
    else if (cot.estado === 'aceptada') ir(`#/cobro/${cot.id}`);
    else dup();
  };
}
