// =====================================================================
// Catálogo editable de servicios/materiales + plantillas de trabajo.
// =====================================================================
import { pintar, ir, h, $, $$, aviso, hoja, cerrarHoja, vibrar } from '../ui.js';
import { icono } from '../icons.js';
import { clp, parseCLP, uid } from '../util.js';
import * as db from '../db.js';
import { MODOS, UNIDADES } from './comun.js';
import { PROVEEDORES } from '../seed.js';
import { getConfig } from '../config.js';
import { reglasMateriales, precioDesdeCosto } from '../calc.js';

/** Precio de materiales al cliente con el margen actual (o el precio fijo si no tiene costo). */
const precioMatActual = (c) => (c.costoMat !== undefined ? precioDesdeCosto(c.costoMat, reglasMateriales(null, getConfig())) : c.precioMat);

let pestana = 'catalogo';

export async function pantallaCatalogo() {
  const [catalogo, plantillas] = await Promise.all([db.todos('catalogo'), db.todos('plantillas')]);
  catalogo.sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre));
  const porId = Object.fromEntries(catalogo.map((c) => [c.id, c]));

  let cuerpo = `<div class="segmentado" id="pest">
    <button data-p="catalogo" aria-pressed="${pestana === 'catalogo'}">Servicios (${catalogo.length})</button>
    <button data-p="plantillas" aria-pressed="${pestana === 'plantillas'}">Plantillas (${plantillas.length})</button></div>`;

  if (pestana === 'catalogo') {
    let cat = '';
    for (const c of catalogo) {
      if (c.categoria !== cat) { cat = c.categoria; cuerpo += `<div class="seccion-titulo">${h(cat)}</div>`; }
      cuerpo += `<button class="tarjeta" data-edit="${c.id}" style="${c.activo === false ? 'opacity:.55' : ''}">
        <span class="cuerpo"><div class="nombre" style="white-space:normal">${h(c.nombre)}</div>
        <div class="detalle">${clp(c.precioMO + precioMatActual(c))} / ${h(c.unidad)} · MO ${clp(c.precioMO)}${c.costoMat ? ' + costo mat. ' + clp(c.costoMat) : ''}${c.proveedor ? ' · ' + h(c.proveedor) : ''}${c.marca === 'desde' ? ' · desde' : c.marca === 'caso' ? ' · caso a caso' : ''}${c.activo === false ? ' · oculto' : ''}</div></span>
        ${icono('edit')}</button>`;
    }
  } else {
    cuerpo += plantillas.map((p) => `<button class="tarjeta" data-plant="${p.id}">
      <span class="ico-estado e-neutro">${icono('package')}</span>
      <span class="cuerpo"><div class="nombre">${h(p.nombre)}</div>
      <div class="detalle">${p.items.map((i) => `${i.cantidad}× ${h(porId[i.catalogId]?.nombre || '¿eliminado?')}`).join(' · ')}</div></span>${icono('edit')}</button>`).join('');
  }

  pintar({
    titulo: 'Catálogo', atras: '#/', cuerpo,
    principal: { texto: pestana === 'catalogo' ? 'Agregar servicio' : 'Crear plantilla', icono: 'plus' },
  });
  $$('#pest button').forEach((b) => (b.onclick = () => { pestana = b.dataset.p; pantallaCatalogo(); }));
  $$('[data-edit]').forEach((b) => (b.onclick = () => editarItem(porId[b.dataset.edit], catalogo)));
  $$('[data-plant]').forEach((b) => (b.onclick = () => editarPlantilla(plantillas.find((p) => p.id === b.dataset.plant), catalogo)));
  $('#btn-principal').onclick = () => (pestana === 'catalogo' ? editarItem(null, catalogo) : editarPlantilla(null, catalogo));
}

function editarItem(item, catalogo) {
  const nuevo = !item;
  const c = item ? { ...item } : { id: uid(), nombre: '', categoria: 'Otros', unidad: 'unidad', modo: 'mat_mo', precioMO: 0, precioMat: 0, marca: '', nota: '', activo: true };
  const categorias = [...new Set(catalogo.map((x) => x.categoria))];
  const el = hoja(`
    <h2>${nuevo ? 'Nuevo servicio' : 'Editar servicio'}</h2>
    <label class="campo"><span>Nombre *</span><input id="i-nombre" value="${h(c.nombre)}"></label>
    <label class="campo"><span>Categoría</span><input id="i-cat" list="i-cats" value="${h(c.categoria)}">
      <datalist id="i-cats">${categorias.map((x) => `<option value="${h(x)}">`).join('')}</datalist></label>
    <div class="dos-col">
      <label class="campo"><span>Unidad</span><select id="i-uni">${UNIDADES.map((u) => `<option ${u === c.unidad ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
      <label class="campo"><span>Modo de cobro</span><select id="i-modo">${Object.entries(MODOS).map(([k, v]) => `<option value="${k}" ${k === c.modo ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="campo"><span id="i-mo-et">Mano de obra $</span><input id="i-mo" inputmode="numeric" class="num" value="${c.precioMO}"></label>
      <label class="campo"><span>Costo materiales neto $</span><input id="i-costo" inputmode="numeric" class="num" value="${c.costoMat ?? Math.round((c.precioMat || 0) / 1.2)}"></label>
    </div>
    <label class="campo"><span>Proveedor habitual</span><input id="i-prov" list="i-provs" value="${h(c.proveedor || '')}" placeholder="Ej: Gobantes">
      <datalist id="i-provs">${PROVEEDORES.map((p) => `<option value="${h(p)}">`).join('')}</datalist></label>
    <div class="panel chico" id="i-prev"></div>
    <label class="campo"><span>Marca de precio</span><select id="i-marca">
      <option value="" ${!c.marca ? 'selected' : ''}>Precio normal</option>
      <option value="desde" ${c.marca === 'desde' ? 'selected' : ''}>"Desde" (precio mínimo)</option>
      <option value="caso" ${c.marca === 'caso' ? 'selected' : ''}>Cotizar caso a caso</option></select></label>
    <label class="campo"><span>Nota interna</span><input id="i-nota" value="${h(c.nota)}"></label>
    <label class="check"><input type="checkbox" id="i-activo" ${c.activo !== false ? 'checked' : ''}>Mostrar al cotizar</label>
    <div id="i-error" class="error-campo"></div>
    <div class="fila-btns">
      ${nuevo ? '' : `<button class="btn btn-peligro" id="i-borrar">${icono('trash')}Eliminar</button>`}
      <button class="btn btn-primario" id="i-guardar" style="min-height:56px">${icono('check')}Guardar servicio</button></div>`);
  const etMO = () => { $('#i-mo-et', el).textContent = $('#i-modo', el).value === 'hora' ? 'Valor hora $' : 'Mano de obra $'; };
  $('#i-modo', el).onchange = etMO; etMO();
  const reglas = reglasMateriales(null, getConfig());
  const previa = () => {
    const mo = parseCLP($('#i-mo', el).value), mat = precioDesdeCosto(parseCLP($('#i-costo', el).value), reglas);
    $('#i-prev', el).innerHTML = `Precio al cliente: <b class="monto">${clp(mo + mat)}</b> / ${h($('#i-uni', el).value)}<br>
      Mano de obra ${clp(mo)} + materiales ${clp(mat)} (costo +${reglas.margenMatPct}%)`;
  };
  ['#i-mo', '#i-costo'].forEach((s) => ($(s, el).oninput = previa));
  $('#i-uni', el).onchange = previa;
  previa();
  $('#i-guardar', el).onclick = async () => {
    const mo = parseCLP($('#i-mo', el).value), costo = parseCLP($('#i-costo', el).value);
    const mat = precioDesdeCosto(costo, reglas);
    Object.assign(c, {
      nombre: $('#i-nombre', el).value.trim(), categoria: $('#i-cat', el).value.trim() || 'Otros',
      unidad: $('#i-uni', el).value, modo: $('#i-modo', el).value, precioMO: mo, costoMat: costo, precioMat: mat,
      proveedor: $('#i-prov', el).value.trim(),
      marca: $('#i-marca', el).value, nota: $('#i-nota', el).value.trim(), activo: $('#i-activo', el).checked,
    });
    if (!c.nombre) { $('#i-error', el).textContent = 'Falta el nombre.'; return; }
    if (mo < 0 || costo < 0) { $('#i-error', el).textContent = 'Los precios no pueden ser negativos.'; return; }
    await db.guardar('catalogo', c);
    cerrarHoja(); vibrar(); aviso('Servicio guardado'); pantallaCatalogo();
  };
  if (!nuevo) $('#i-borrar', el).onclick = async () => {
    await db.borrar('catalogo', c.id); cerrarHoja(); aviso('Servicio eliminado (las cotizaciones existentes no cambian)'); pantallaCatalogo();
  };
}

function editarPlantilla(plant, catalogo) {
  const nuevo = !plant;
  const p = plant ? structuredClone(plant) : { id: uid(), nombre: '', items: [] };
  const activos = catalogo.filter((c) => c.activo !== false);
  const el = hoja(`
    <h2>${nuevo ? 'Nueva plantilla' : 'Editar plantilla'}</h2>
    <label class="campo"><span>Nombre *</span><input id="p-nombre" value="${h(p.nombre)}" placeholder="Ej: Instalación de 5 enchufes"></label>
    <p class="chico">Indica la cantidad de cada servicio (0 = no se incluye).</p>
    ${activos.map((c) => {
      const n = p.items.find((i) => i.catalogId === c.id)?.cantidad || 0;
      return `<div class="pago-fila"><span style="flex:1;padding-right:8px">${h(c.nombre)}</span>
        <input data-cat="${c.id}" inputmode="decimal" value="${n || ''}" placeholder="0" style="width:80px;text-align:center"></div>`;
    }).join('')}
    <div id="p-error" class="error-campo"></div>
    <div class="fila-btns">
      ${nuevo ? '' : `<button class="btn btn-peligro" id="p-borrar">${icono('trash')}Eliminar</button>`}
      <button class="btn btn-primario" id="p-guardar" style="min-height:56px">${icono('check')}Guardar plantilla</button></div>`);
  $('#p-guardar', el).onclick = async () => {
    p.nombre = $('#p-nombre', el).value.trim();
    p.items = $$('[data-cat]', el).map((i) => ({ catalogId: i.dataset.cat, cantidad: parseFloat(i.value.replace(',', '.')) || 0 })).filter((i) => i.cantidad > 0);
    if (!p.nombre) { $('#p-error', el).textContent = 'Falta el nombre.'; return; }
    if (!p.items.length) { $('#p-error', el).textContent = 'Agrega al menos un servicio con cantidad.'; return; }
    await db.guardar('plantillas', p);
    cerrarHoja(); vibrar(); aviso('Plantilla guardada'); pantallaCatalogo();
  };
  if (!nuevo) $('#p-borrar', el).onclick = async () => { await db.borrar('plantillas', p.id); cerrarHoja(); aviso('Plantilla eliminada'); pantallaCatalogo(); };
}
