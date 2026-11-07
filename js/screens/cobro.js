// =====================================================================
// Cobro (Etapa 3): anticipo y pagos parciales, saldo, estado y
// recordatorio de pago por WhatsApp.
// =====================================================================
import { pintar, ir, h, $, $$, aviso, checkOk, hoja, cerrarHoja } from '../ui.js';
import { icono } from '../icons.js';
import { clp, parseCLP, fecha, fechaISO } from '../util.js';
import * as db from '../db.js';
import { cargarCotizacion, cobroDe, registrarPago, totales, ordenDe, MEDIOS_PAGO } from '../cotizaciones.js';
import { abrirWa, textoRecordatorioPago } from '../whatsapp.js';

const CLASE = { pendiente: 'e-cobrar', abonada: 'e-cobrar', pagada: 'e-listo' };
const NOMBRE = { pendiente: 'Pendiente', abonada: 'Abonada', pagada: 'Pagada' };

export async function pantallaCobro(cotId) {
  const datos = await cargarCotizacion(cotId);
  if (!datos) { aviso('No se encontró la cotización'); ir('#/'); return; }
  const { cot, cliente } = datos;
  const t = totales(cot);
  const c = await cobroDe(cot);
  const ot = await ordenDe(cot.id);

  const main = pintar({
    titulo: `Cobro · ${cliente.nombre || 'Cliente'}`, atras: true,
    principal: c.saldo > 0 ? { texto: 'Registrar pago', icono: 'cash' } : { texto: 'Volver a pendientes', icono: 'check' },
    cuerpo: `
      <div class="panel">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><div class="chico">Saldo pendiente</div><div class="monto" style="font-size:var(--f-total);font-weight:500">${clp(c.saldo)}</div></div>
          <span class="etiqueta ${CLASE[c.estado]}">${NOMBRE[c.estado]}</span></div>
        <div class="chico" style="margin-top:6px">Total ${clp(t.total)} · Pagado ${clp(c.pagado)} · Cotización N° ${cot.numero}</div>
        ${ot ? `<div class="chico">Trabajo: ${ot.estado === 'terminada' ? 'terminado' : ot.estado === 'en_ejecucion' ? 'en ejecución' : 'programado'}</div>` : ''}
      </div>
      ${c.saldo > 0 ? `<button class="btn btn-bloque" id="b-recordar">${icono('whatsapp')}Enviar recordatorio de pago</button>` : ''}
      <div class="seccion-titulo">Pagos registrados</div>
      ${c.pagos.length ? c.pagos.map((p) => `<div class="pago-fila">
        <span><b class="monto">${clp(p.monto)}</b><br><span class="chico">${fecha(p.fecha)} · ${h(p.medio)}${p.nota ? ' · ' + h(p.nota) : ''}</span></span>
        <button class="btn-ico btn-peligro" data-del="${p.id}" aria-label="Eliminar pago">${icono('trash')}</button></div>`).join('')
        : '<p class="chico">Aún no hay pagos. Registra el anticipo cuando lo recibas.</p>'}`,
  });

  if (c.saldo > 0) $('#b-recordar').onclick = () => { abrirWa(cliente.telefono, textoRecordatorioPago(cot, cliente, c.saldo)); aviso('Recordatorio listo en WhatsApp'); };
  $$('[data-del]', main).forEach((b) => (b.onclick = async () => { await db.borrar('pagos', b.dataset.del); aviso('Pago eliminado'); pantallaCobro(cotId); }));

  $('#btn-principal').onclick = () => {
    if (c.saldo <= 0) { ir('#/'); return; }
    const sugerido = c.pagado === 0 && ot?.estado !== 'terminada' ? Math.round(t.total / 2) : c.saldo;
    const el = hoja(`
      <h2>Registrar pago</h2>
      <label class="campo"><span>Monto *</span><input id="p-monto" inputmode="numeric" class="num" value="${sugerido}"></label>
      <div class="fila-btns">
        <button class="btn" data-m="${Math.round(t.total / 2)}">50% (${clp(Math.round(t.total / 2))})</button>
        <button class="btn" data-m="${c.saldo}">Saldo (${clp(c.saldo)})</button></div>
      <label class="campo"><span>Fecha</span><input id="p-fecha" type="date" value="${fechaISO()}"></label>
      <label class="campo"><span>Medio de pago</span><select id="p-medio">${MEDIOS_PAGO.map((m) => `<option>${m}</option>`).join('')}</select></label>
      <label class="campo"><span>Nota (opcional)</span><input id="p-nota"></label>
      <div id="p-error" class="error-campo"></div>
      <button class="btn btn-primario btn-bloque" id="p-guardar" style="min-height:56px">${icono('check')}Registrar pago</button>`);
    $$('[data-m]', el).forEach((b) => (b.onclick = () => { $('#p-monto', el).value = b.dataset.m; }));
    $('#p-guardar', el).onclick = async () => {
      const monto = parseCLP($('#p-monto', el).value);
      if (!(monto > 0)) { $('#p-error', el).textContent = 'El monto debe ser mayor a 0.'; return; }
      if (monto > c.saldo) { $('#p-error', el).textContent = `El monto supera el saldo (${clp(c.saldo)}).`; return; }
      await registrarPago(cot.id, {
        monto, fecha: new Date($('#p-fecha', el).value + 'T12:00').getTime(),
        medio: $('#p-medio', el).value, nota: $('#p-nota', el).value.trim(),
      });
      cerrarHoja(); checkOk();
      aviso(monto === c.saldo ? '¡Pagado completo!' : `Pago registrado. Saldo ${clp(c.saldo - monto)}`);
      pantallaCobro(cotId);
    };
  };
}
