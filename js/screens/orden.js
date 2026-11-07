// =====================================================================
// Orden de trabajo (Etapa 3): fecha programada, checklist marcable en
// terreno, materiales a comprar, notas y estado.
// =====================================================================
import { pintar, ir, h, $, $$, aviso, checkOk, vibrar, demorar, conectarDictado } from '../ui.js';
import { icono } from '../icons.js';
import * as db from '../db.js';
import { cargarCotizacion, guardarOrden, ESTADOS_OT } from '../cotizaciones.js';
import { abrirWa, textoTurno } from '../whatsapp.js';
import { uid, clp } from '../util.js';

// Materiales de la orden abierta (para saber el índice real de cada material al agrupar).
let materialesOrden = [];

/** Agrupa materiales por proveedor; i = índice en la lista completa de la orden. */
function porProveedor(materiales) {
  const g = {};
  for (const m of materiales) (g[m.proveedor || 'Sin proveedor'] ||= []).push({ m, i: materialesOrden.indexOf(m) });
  return g;
}
const costoGrupo = (lista) => lista.reduce((s, { m }) => s + (m.costoUnit || 0) * (Number(m.cantidad) || 0), 0);

const aLocal =(ts) => new Date(ts - new Date(ts).getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export async function pantallaOrden(id) {
  const ot = await db.obtener('ordenes', id);
  if (!ot) { aviso('No se encontró la orden'); ir('#/'); return; }
  const { cot, cliente } = await cargarCotizacion(ot.cotizacionId);
  const guardar = demorar(() => guardarOrden(ot), 300);
  materialesOrden = ot.materiales;

  const principal = ot.estado === 'programada' ? { texto: 'Iniciar trabajo', icono: 'tool' }
    : ot.estado === 'en_ejecucion' ? { texto: 'Marcar trabajo terminado', icono: 'check' }
    : { texto: 'Ir al cobro', icono: 'cash' };

  const main = pintar({
    titulo: `Orden · ${cliente.nombre || 'Cliente'}`, atras: true, principal,
    cuerpo: `
      <div class="segmentado" id="ot-estado">${Object.entries(ESTADOS_OT).map(([k, v]) =>
        `<button data-e="${k}" aria-pressed="${ot.estado === k}">${v}</button>`).join('')}</div>
      <div class="panel"><b>${h(cliente.nombre)}</b> · Cotización N° ${cot.numero}
        <div class="chico">${h([cliente.direccion, cliente.comuna].filter(Boolean).join(', ') || 'Sin dirección')}</div></div>
      <label class="campo"><span>Fecha y hora programada</span><input type="datetime-local" id="ot-fecha" value="${aLocal(ot.fechaProgramada)}"></label>
      <button class="btn btn-bloque" id="ot-avisar">${icono('whatsapp')}Confirmar fecha al cliente</button>
      <div class="seccion-titulo">Checklist en terreno (<span id="ot-cuenta"></span>)</div>
      <div id="ot-check">${ot.checklist.map((c) => `<label class="check-item ${c.hecho ? 'hecho' : ''}" data-id="${c.id}">
        <input type="checkbox" ${c.hecho ? 'checked' : ''}><span>${h(c.texto)}</span></label>`).join('')}</div>
      <div class="con-boton" style="margin-top:8px"><input id="ot-nuevo" placeholder="Agregar tarea"><button class="btn" id="ot-add">${icono('plus')}Agregar</button></div>
      <div class="seccion-titulo">Materiales a comprar</div>
      <div id="ot-mat">${ot.materiales.length ? Object.entries(porProveedor(ot.materiales)).map(([prov, lista]) => `
        <div class="chico" style="margin-top:10px"><b>${h(prov)}</b>${costoGrupo(lista) ? ' · costo estimado ' + clp(costoGrupo(lista)) : ''}</div>
        ${lista.map(({ m, i }) => `<label class="check-item ${m.comprado ? 'hecho' : ''}" data-i="${i}">
        <input type="checkbox" ${m.comprado ? 'checked' : ''}><span>${m.cantidad} ${h(m.unidad)} — ${h(m.texto.replace(/^Materiales: /, ''))}${m.costoUnit ? ` <span class="chico">(${clp(m.costoUnit)} c/u)</span>` : ''}</span></label>`).join('')}`).join('')
        : '<p class="chico">Esta cotización no incluye materiales.</p>'}</div>
      <button class="btn btn-bloque" id="ot-compra" style="margin-top:8px">${icono('copy')}Copiar lista de compra</button>
      <button class="btn btn-bloque" id="ot-informe" style="margin-top:16px">${icono('file')}${cot.informe ? 'Ver informe técnico' : 'Hacer informe técnico'}</button>
      <div class="seccion-titulo">Notas del trabajo</div>
      <div class="con-boton"><textarea id="ot-notas">${h(ot.notas)}</textarea><button class="btn" id="ot-mic">${icono('mic')}Dictar</button></div>`,
  });

  const cuenta = () => { $('#ot-cuenta').textContent = `${ot.checklist.filter((c) => c.hecho).length} de ${ot.checklist.length}`; };
  cuenta();
  $$('#ot-check .check-item', main).forEach((el) => {
    const c = ot.checklist.find((x) => x.id === el.dataset.id);
    $('input', el).onchange = (e) => {
      c.hecho = e.target.checked; el.classList.toggle('hecho', c.hecho); vibrar(20); cuenta();
      if (ot.estado === 'programada' && c.hecho) {
        ot.estado = 'en_ejecucion';
        $$('#ot-estado button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.e === 'en_ejecucion'));
      }
      guardar();
      if (ot.checklist.every((x) => x.hecho)) aviso('¡Checklist completo! Marca el trabajo como terminado');
    };
  });
  $$('#ot-mat .check-item', main).forEach((el) => {
    const m = ot.materiales[Number(el.dataset.i)];
    $('input', el).onchange = (e) => { m.comprado = e.target.checked; el.classList.toggle('hecho', m.comprado); vibrar(20); guardar(); };
  });
  $('#ot-add').onclick = async () => {
    const t = $('#ot-nuevo').value.trim(); if (!t) return;
    ot.checklist.push({ id: uid(), texto: t, hecho: false }); await guardarOrden(ot); pantallaOrden(id);
  };
  $('#ot-compra').onclick = async () => {
    const pendientes = ot.materiales.filter((m) => !m.comprado);
    const txt = 'Lista de compra:\n' + Object.entries(porProveedor(pendientes)).map(([prov, lista]) =>
      `\n*${prov}*\n` + lista.map(({ m }) => `• ${m.cantidad} ${m.unidad} — ${m.texto.replace(/^Materiales: /, '')}`).join('\n')).join('\n');
    try { await navigator.clipboard.writeText(txt); aviso('Lista copiada'); } catch { aviso('No se pudo copiar'); }
  };
  $('#ot-fecha').onchange = (e) => { ot.fechaProgramada = new Date(e.target.value).getTime(); guardar(); aviso('Fecha guardada'); };
  $('#ot-informe').onclick = () => ir(`#/informe/${cot.id}`);
  $('#ot-avisar').onclick =() => abrirWa(cliente.telefono, textoTurno(cot, cliente, ot));
  const notas = $('#ot-notas');
  notas.oninput = () => { ot.notas = notas.value; guardar(); };
  conectarDictado($('#ot-mic'), notas, (v) => { ot.notas = v; guardar(); });
  $$('#ot-estado button').forEach((b) => (b.onclick = async () => {
    ot.estado = b.dataset.e; await guardarOrden(ot); aviso(`Orden: ${ESTADOS_OT[ot.estado].toLowerCase()}`); pantallaOrden(id);
  }));

  $('#btn-principal').onclick = async () => {
    if (ot.estado === 'programada') { ot.estado = 'en_ejecucion'; await guardarOrden(ot); vibrar(); aviso('Trabajo en ejecución'); pantallaOrden(id); }
    else if (ot.estado === 'en_ejecucion') {
      ot.estado = 'terminada'; await guardarOrden(ot); checkOk(); aviso('Trabajo terminado: ahora a cobrar');
      setTimeout(() => ir(`#/cobro/${cot.id}`), 700);
    } else ir(`#/cobro/${cot.id}`);
  };
}
