// =====================================================================
// Historial: búsqueda por cliente, filtro por estado y duplicar.
// =====================================================================
import { pintar, ir, h, $, $$, aviso, vacio } from '../ui.js';
import { icono } from '../icons.js';
import { clp, fecha, telBonito } from '../util.js';
import * as db from '../db.js';
import { totales, duplicar, ESTADOS } from '../cotizaciones.js';
import { copiarFotos } from '../fotos.js';

const CLASE = { borrador: 'e-enviar', enviada: 'e-segui', aceptada: 'e-listo', rechazada: 'e-neutro' };
const ICO = { borrador: 'file', enviada: 'send', aceptada: 'check', rechazada: 'x' };
let filtro = 'todas', busqueda = '';

export async function pantallaHistorial() {
  const [cots, clientes] = await Promise.all([db.todos('cotizaciones'), db.todos('clientes')]);
  const cli = Object.fromEntries(clientes.map((c) => [c.id, c]));
  cots.sort((a, b) => b.creado - a.creado);

  const main = pintar({
    titulo: 'Historial', atras: '#/',
    cuerpo: `
      <input type="search" id="h-buscar" placeholder="Buscar por cliente, teléfono o N°" value="${h(busqueda)}" style="margin-bottom:10px">
      <div class="chips">${[['todas', 'Todas'], ...Object.entries(ESTADOS)].map(([k, v]) =>
        `<button class="chip" data-f="${k}" aria-pressed="${filtro === k}">${v}</button>`).join('')}</div>
      <div id="h-lista"></div>`,
    principal: { texto: 'Nueva cotización', icono: 'plus' },
  });
  $('#btn-principal').onclick = () => ir('#/rapida');

  const pintarLista = () => {
    const q = busqueda.toLowerCase().trim();
    const lista = cots.filter((c) => {
      if (filtro !== 'todas' && c.estado !== filtro) return false;
      if (!q) return true;
      const cl = cli[c.clienteId] || {};
      return [cl.nombre, cl.local, cl.telefono, cl.comuna, cl.direccion, String(c.numero)].some((x) => (x || '').toLowerCase().includes(q));
    });
    $('#h-lista').innerHTML = lista.map((c) => {
      const cl = cli[c.clienteId] || {};
      return `<div class="tarjeta-wrap"><button class="tarjeta" data-id="${c.id}">
        <span class="ico-estado ${CLASE[c.estado]}">${icono(ICO[c.estado])}</span>
        <span class="cuerpo"><div class="nombre">${h(cl.nombre ? cl.nombre + (cl.local ? ' · ' + cl.local : '') : telBonito(cl.telefono) || 'Sin nombre')}</div>
        <div class="detalle">N° ${c.numero} · ${fecha(c.creado)} · ${clp(totales(c).total)}</div></span>
        <span class="etiqueta ${CLASE[c.estado]}">${ESTADOS[c.estado]}</span></button>
        <div class="acciones"><button class="btn" data-dup="${c.id}">${icono('copy', 20)}Duplicar</button></div></div>`;
    }).join('') || vacio(cots.length ? 'Sin resultados' : 'Aún no hay cotizaciones', cots.length ? 'Prueba con otro nombre o filtro.' : 'Crea la primera con el botón de abajo.', 'search');
    $$('[data-id]', main).forEach((b) => (b.onclick = () => ir(`#/cot/${b.dataset.id}`)));
    $$('[data-dup]', main).forEach((b) => (b.onclick = async () => {
      const n = await duplicar(b.dataset.dup);
      await copiarFotos(b.dataset.dup, n.id);
      aviso(`Duplicada como N° ${n.numero}`); ir(`#/cot/${n.id}/paso/1`);
    }));
  };
  $('#h-buscar').oninput = (e) => { busqueda = e.target.value; pintarLista(); };
  $$('[data-f]', main).forEach((b) => (b.onclick = () => {
    filtro = b.dataset.f; $$('[data-f]', main).forEach((x) => x.setAttribute('aria-pressed', x === b)); pintarLista();
  }));
  pintarLista();
}
