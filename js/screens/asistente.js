// =====================================================================
// Asistente de cotización: 5 pasos, uno por pantalla, guardado
// automático en cada cambio.
//   1 Cliente · 2 Ítems · 3 Precio y documento · 4 Fotos · 5 Enviar
// =====================================================================
import { pintar, ir, h, $, $$, aviso, vibrar, hoja, cerrarHoja, conectarDictado, demorar, ciclo } from '../ui.js';
import { icono } from '../icons.js';
import { clp, parseCLP, fechaISO, validarRut, formatearRut, telWa } from '../util.js';
import * as db from '../db.js';
import { cargarCotizacion, guardarCotizacion, totales, lineaDesdeCatalogo, lineaLibre, faltantes, reglasDe } from '../cotizaciones.js';
import { totalLinea, usaCosto, precioDesdeCosto, aplicarReglas } from '../calc.js';
import { PROVEEDORES } from '../seed.js';
import { getConfig } from '../config.js';
import { htmlTotales } from './comun.js';
import { enviarCotizacion, descargarPdf } from '../envio.js';
import { agregarFoto, fotosDe } from '../fotos.js';

const PASOS = ['Cliente', 'Ítems', 'Precio y documento', 'Fotos', 'Enviar'];
const TOTAL_PASOS = PASOS.length;

let estado = null; // { cot, cliente }

const guardarYa = async () => {
  if (!estado) return;
  estado.cliente.actualizado = Date.now();
  await db.guardar('clientes', estado.cliente);
  await guardarCotizacion(estado.cot);
};
const guardarLuego = demorar(guardarYa, 350);

export async function pantallaAsistente(id, paso) {
  const datos = await cargarCotizacion(id);
  if (!datos) { aviso('No se encontró la cotización'); ir('#/'); return; }
  estado = datos;
  paso = Math.min(TOTAL_PASOS, Math.max(1, Number(paso) || 1));
  if (estado.cot.estado === 'borrador') { estado.cot.paso = paso; await guardarCotizacion(estado.cot); }

  // Al salir sin enviar: aviso breve y queda destacada en pendientes.
  ciclo.alSalir = async (rutaNueva) => {
    await guardarYa();
    const sigueAqui = rutaNueva?.startsWith(`/cot/${id}/paso/`);
    if (!sigueAqui && estado?.cot.estado === 'borrador') aviso('No se envió: quedó en pendientes como borrador');
  };

  const cabecera = `<div class="progreso">Paso ${paso} de ${TOTAL_PASOS} · ${PASOS[paso - 1]}</div>
    <div class="barra-progreso"><div style="width:${(paso / TOTAL_PASOS) * 100}%"></div></div>`;
  const titulo = `Cotización N° ${estado.cot.numero}`;
  const siguiente = paso < TOTAL_PASOS ? `Siguiente: ${PASOS[paso]}` : 'Enviar por WhatsApp';
  const pantallas = { 1: paso1, 2: paso2, 3: paso3, 4: paso4, 5: paso5 };
  const atras = paso > 1 ? `#/cot/${id}/paso/${paso - 1}` : '#/';

  pintar({
    titulo, atras, cuerpo: cabecera + '<div id="paso"></div>',
    botonesBarra: `<button class="btn-ico" id="btn-casa" aria-label="Ir a pendientes">${icono('list')}</button>`,
    principal: { texto: siguiente, icono: paso < TOTAL_PASOS ? 'next' : 'whatsapp', info: infoTotal() },
  });
  $('#btn-casa').onclick = () => ir('#/');
  const validar = await pantallas[paso]($('#paso'));
  $('#btn-principal').onclick = async () => {
    const err = validar ? validar() : '';
    if (err) { aviso(err); vibrar(80); return; }
    await guardarYa();
    if (paso < TOTAL_PASOS) ir(`#/cot/${id}/paso/${paso + 1}`);
    else {
      const ok = await enviarCotizacion(estado.cot, estado.cliente, 'pdf');
      if (ok) { ciclo.alSalir = null; estado = null; setTimeout(() => ir('#/'), 900); }
    }
  };
}

const miles = (n) => clp(n).slice(1); // 25000 → "25.000" (para inputs)

function infoTotal() {
  const t = totales(estado.cot);
  return `<span id="items-mini">${estado.cot.items.length} ítems</span><span id="total-mini" class="monto"><b>Total ${clp(t.total)}</b></span>`;
}
function refrescarTotal() {
  const el = $('#total-mini');
  if (el) el.innerHTML = `<b>Total ${clp(totales(estado.cot).total)}</b>`;
  const n = $('#items-mini');
  if (n) n.textContent = `${estado.cot.items.length} ítems`;
}

// ---------------------------------------------------------------- Paso 1
function paso1(raiz) {
  const { cot, cliente: c } = estado;
  raiz.innerHTML = `
    <label class="campo"><span>Nombre o empresa *</span><input data-c="nombre" value="${h(c.nombre)}" autocomplete="off"></label>
    <label class="campo"><span>Local / sucursal (opcional)</span><input data-c="local" value="${h(c.local)}" placeholder="Ej: Local Ñuble"></label>
    <label class="campo"><span>Teléfono (WhatsApp) *</span><input data-c="telefono" inputmode="tel" value="${h(c.telefono)}" placeholder="9 1234 5678">
      <div class="error-campo" id="e-tel"></div></label>
    <label class="campo"><span>Dirección</span><input data-c="direccion" value="${h(c.direccion)}"></label>
    <div class="dos-col">
      <label class="campo"><span>Comuna</span><input data-c="comuna" value="${h(c.comuna)}"></label>
      <label class="campo"><span>Fecha de visita</span><input type="date" id="f-visita" value="${fechaISO(cot.fechaVisita)}"></label>
    </div>
    <label class="campo"><span>RUT ${cot.tipoDoc === 'factura' ? '* (factura)' : '(necesario si emites factura)'}</span>
      <input data-c="rut" value="${h(c.rut)}" placeholder="12.345.678-9"><div class="error-campo" id="e-rut"></div></label>
    <label class="campo"><span>Nota de la visita (interna)</span>
      <div class="con-boton"><textarea id="f-nota">${h(cot.nota)}</textarea>
      <button class="btn" id="f-mic" aria-label="Dictar">${icono('mic')}Dictar</button></div></label>`;
  $$('[data-c]', raiz).forEach((inp) => (inp.oninput = () => { c[inp.dataset.c] = inp.value.trim(); guardarLuego(); }));
  const rut = $('[data-c="rut"]', raiz);
  rut.onblur = () => {
    if (!rut.value) { $('#e-rut').textContent = ''; rut.classList.remove('invalido'); return; }
    const ok = validarRut(rut.value);
    $('#e-rut').textContent = ok ? '' : 'RUT inválido: revisa el dígito verificador.';
    rut.classList.toggle('invalido', !ok);
    if (ok) { rut.value = formatearRut(rut.value); c.rut = rut.value; guardarLuego(); }
  };
  const tel = $('[data-c="telefono"]', raiz);
  tel.onblur = () => { const ok = !tel.value || telWa(tel.value); $('#e-tel').textContent = ok ? '' : 'Debe tener 9 dígitos (ej: 9 1234 5678).'; tel.classList.toggle('invalido', !ok); };
  $('#f-visita').onchange = (e) => { cot.fechaVisita = new Date(e.target.value + 'T12:00').getTime(); guardarLuego(); };
  const nota = $('#f-nota');
  nota.oninput = () => { cot.nota = nota.value; guardarLuego(); };
  conectarDictado($('#f-mic'), nota, (v) => { cot.nota = v; guardarLuego(); });

  return () => {
    if (!c.nombre && !c.telefono) return 'Escribe al menos el nombre o el teléfono';
    if (c.telefono && !telWa(c.telefono)) return 'Revisa el teléfono: debe tener 9 dígitos';
    if (c.rut && !validarRut(c.rut)) return 'El RUT no es válido';
    return '';
  };
}

// ---------------------------------------------------------------- Paso 2
async function paso2(raiz) {
  raiz.innerHTML = `
    <div class="fila-btns">
      <button class="btn btn-primario" id="b-cat">${icono('plus')}Agregar del catálogo</button>
      <button class="btn" id="b-plant">${icono('package')}Usar plantilla</button>
      <button class="btn" id="b-libre">${icono('edit')}Ítem libre</button>
    </div>
    <datalist id="lista-proveedores">${PROVEEDORES.map((p) => `<option value="${h(p)}">`).join('')}</datalist>
    <div id="lineas"></div>`;
  $('#b-cat').onclick = abrirCatalogo;
  $('#b-plant').onclick = abrirPlantillas;
  $('#b-libre').onclick = () => { estado.cot.items.push(lineaLibre()); guardarLuego(); pintarLineas(); $('#lineas .linea:last-child input')?.focus(); };
  pintarLineas();
  return () => {
    const it = estado.cot.items;
    if (!it.length) return 'Agrega al menos un ítem';
    if (it.some((l) => !l.nombre.trim())) return 'Hay un ítem libre sin descripción';
    if (it.some((l) => !(Number(l.cantidad) > 0))) return 'Todas las cantidades deben ser mayores a 0';
    return '';
  };
}

function pintarLineas() {
  const cont = $('#lineas');
  if (!cont) return;
  const items = estado.cot.items;
  if (!items.length) {
    cont.innerHTML = `<div class="vacio">${icono('bolt', 48)}<p>Agrega servicios desde el catálogo o una plantilla.</p></div>`;
    refrescarTotal(); return;
  }
  cont.innerHTML = items.map((it) => {
    const esHora = it.modo === 'hora';
    const marca = it.marca === 'desde' ? ' <span class="etiqueta e-segui">desde</span>' : it.marca === 'caso' ? ' <span class="etiqueta e-enviar">caso a caso</span>' : '';
    return `<div class="linea" data-id="${it.id}">
      <div class="cab">
        ${it.catalogId ? `<div class="nombre">${h(it.nombre)}${marca}</div>` : `<input class="nombre" data-f="nombre" value="${h(it.nombre)}" placeholder="Descripción del ítem">`}
        <button class="btn-ico btn-peligro" data-borrar aria-label="Quitar ítem">${icono('trash')}</button>
      </div>
      <div class="controles">
        <label class="cant"><span>${esHora ? 'Horas' : 'Cantidad'} (${h(it.unidad)})</span>
          <div class="stepper"><button data-menos aria-label="Menos">−</button>
          <input data-f="cantidad" inputmode="decimal" value="${it.cantidad}"><button data-mas aria-label="Más">+</button></div></label>
        <label><span>${esHora ? 'Valor hora' : 'Mano de obra c/u'}</span><input data-f="precioMO" inputmode="numeric" class="num" value="${miles(it.precioMO)}"></label>
        ${usaCosto(it)
          ? `<label><span>Costo material c/u (neto)</span><input data-f="costoMat" inputmode="numeric" class="num" value="${miles(it.costoMat)}"></label>`
          : `<label><span>Materiales c/u</span><input data-f="precioMat" inputmode="numeric" class="num" value="${miles(it.precioMat)}"></label>`}
      </div>
      ${usaCosto(it) ? `<div class="pie-linea">
        <span class="chico" data-cli>${textoCliente(it)}</span>
        <input data-f="proveedor" list="lista-proveedores" value="${h(it.proveedor || '')}" placeholder="Proveedor" aria-label="Proveedor">
      </div>` : ''}
      <div class="subt monto" data-sub>${clp(totalLinea(it).total)}</div>
    </div>`;
  }).join('');

  $$('.linea', cont).forEach((el) => {
    const it = items.find((x) => x.id === el.dataset.id);
    const actualizar = () => {
      $('[data-sub]', el).textContent = clp(totalLinea(it).total);
      const cli = $('[data-cli]', el); if (cli) cli.textContent = textoCliente(it);
      refrescarTotal(); guardarLuego();
    };
    $$('[data-f]', el).forEach((inp) => (inp.oninput = () => {
      const f = inp.dataset.f;
      if (f === 'nombre') it.nombre = inp.value;
      else if (f === 'proveedor') it.proveedor = inp.value.trim();
      else if (f === 'costoMat') { it.costoMat = Math.max(0, parseCLP(inp.value)); it.precioMat = precioDesdeCosto(it.costoMat, reglasDe(estado.cot)); }
      else if (f === 'cantidad') it.cantidad = Math.max(0, parseFloat(inp.value.replace(',', '.')) || 0);
      else it[f] = Math.max(0, parseCLP(inp.value));
      actualizar();
    }));
    const cant = $('[data-f="cantidad"]', el);
    $('[data-mas]', el).onclick = () => { it.cantidad = (Number(it.cantidad) || 0) + 1; cant.value = it.cantidad; vibrar(15); actualizar(); };
    $('[data-menos]', el).onclick = () => { it.cantidad = Math.max(1, (Number(it.cantidad) || 0) - 1); cant.value = it.cantidad; vibrar(15); actualizar(); };
    $('[data-borrar]', el).onclick = () => {
      estado.cot.items = items.filter((x) => x !== it);
      guardarLuego(); pintarLineas(); aviso('Ítem quitado');
    };
  });
  refrescarTotal();
}

/** "Al cliente: $24.000 c/u (+20%)" bajo el costo del material. */
function textoCliente(it) {
  if (!(Number(it.costoMat) > 0)) return 'Sin materiales';
  return `Al cliente: ${clp(it.precioMat)} c/u (+${String(reglasDe(estado.cot).margenMatPct).replace('.', ',')}%)`;
}

function agregarLinea(c, cantidad = 1) {
  const ya = estado.cot.items.find((x) => x.catalogId === c.id);
  if (ya) ya.cantidad = (Number(ya.cantidad) || 0) + cantidad;
  else estado.cot.items.push(lineaDesdeCatalogo(c, cantidad, estado.cot));
}

async function abrirCatalogo() {
  const catalogo = (await db.todos('catalogo')).filter((c) => c.activo !== false).sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre));
  const categorias = ['Todas', ...new Set(catalogo.map((c) => c.categoria))];
  let filtro = 'Todas', texto = '';
  const el = hoja(`
    <h2>Agregar del catálogo</h2>
    <input id="cat-buscar" type="search" placeholder="Buscar servicio…" style="margin-bottom:10px">
    <div class="chips">${categorias.map((c) => `<button class="chip" data-cat="${h(c)}" aria-pressed="${c === filtro}">${h(c)}</button>`).join('')}</div>
    <div id="cat-lista" class="lista-catalogo"></div>
    <button class="btn btn-primario btn-bloque" id="cat-listo" style="min-height:56px;position:sticky;bottom:0">${icono('check')}Listo</button>`);
  const pintarLista = () => {
    const lista = catalogo.filter((c) => (filtro === 'Todas' || c.categoria === filtro) && c.nombre.toLowerCase().includes(texto));
    $('#cat-lista', el).innerHTML = lista.map((c) => {
      const n = estado.cot.items.find((x) => x.catalogId === c.id)?.cantidad;
      return `<button class="tarjeta" data-add="${c.id}">
        <span class="ico-estado e-neutro">${icono(n ? 'check' : 'plus')}</span>
        <span class="cuerpo"><div class="nombre" style="white-space:normal">${h(c.nombre)}</div>
        <div class="detalle">${clp(c.precioMO + (c.costoMat !== undefined ? precioDesdeCosto(c.costoMat, reglasDe(estado.cot)) : c.precioMat))} / ${h(c.unidad)}${c.marca === 'desde' ? ' · desde' : c.marca === 'caso' ? ' · caso a caso' : ''}</div></span>
        ${n ? `<span class="etiqueta e-listo">${n}</span>` : ''}</button>`;
    }).join('') || '<p class="chico">Sin resultados.</p>';
    $$('[data-add]', el).forEach((b) => (b.onclick = () => {
      const c = catalogo.find((x) => x.id === b.dataset.add);
      agregarLinea(c); guardarLuego(); vibrar(20); aviso(`Agregado: ${c.nombre}`, 1200); pintarLista();
    }));
  };
  $('#cat-buscar', el).oninput = (e) => { texto = e.target.value.toLowerCase(); pintarLista(); };
  $$('[data-cat]', el).forEach((b) => (b.onclick = () => {
    filtro = b.dataset.cat; $$('[data-cat]', el).forEach((x) => x.setAttribute('aria-pressed', x === b)); pintarLista();
  }));
  $('#cat-listo', el).onclick = () => { cerrarHoja(); pintarLineas(); };
  $('#hoja-fondo').onclick = () => { cerrarHoja(); pintarLineas(); };
  pintarLista();
}

async function abrirPlantillas() {
  const [plantillas, catalogo] = await Promise.all([db.todos('plantillas'), db.todos('catalogo')]);
  const porId = Object.fromEntries(catalogo.map((c) => [c.id, c]));
  const el = hoja(`<h2>Usar plantilla</h2>
    ${plantillas.map((p) => `<button class="tarjeta" data-p="${p.id}">
      <span class="ico-estado e-neutro">${icono('package')}</span>
      <span class="cuerpo"><div class="nombre">${h(p.nombre)}</div>
      <div class="detalle">${p.items.map((i) => `${i.cantidad}× ${h(porId[i.catalogId]?.nombre || '¿?')}`).join(' · ')}</div></span></button>`).join('')
    || '<p>No hay plantillas. Créalas en Catálogo → Plantillas.</p>'}`);
  $$('[data-p]', el).forEach((b) => (b.onclick = () => {
    const p = plantillas.find((x) => x.id === b.dataset.p);
    let n = 0;
    for (const i of p.items) if (porId[i.catalogId]) { agregarLinea(porId[i.catalogId], i.cantidad); n++; }
    guardarLuego(); cerrarHoja(); pintarLineas(); vibrar(); aviso(`Plantilla agregada: ${n} ítems`);
  }));
}

// ---------------------------------------------------------------- Paso 3
function paso3(raiz) {
  const { cot } = estado;
  const cfg = getConfig();
  const seg = (grupo, opciones, actual) => `<div class="segmentado" data-g="${grupo}">${opciones.map(([v, t]) =>
    `<button data-v="${v}" aria-pressed="${v === actual}">${t}</button>`).join('')}</div>`;
  raiz.innerHTML = `
    <h3>Documento</h3>
    ${seg('tipoDoc', [['boleta', 'Boleta de honorarios'], ['factura', 'Factura']], cot.tipoDoc)}
    <h3>Descuento (opcional)</h3>
    ${seg('descTipo', [['monto', 'Monto $'], ['pct', 'Porcentaje %']], cot.descuento.tipo)}
    <label class="campo"><input id="desc-valor" inputmode="numeric" class="num" value="${cot.descuento.valor || ''}" placeholder="0"></label>
    <h3>Margen sobre materiales</h3>
    <label class="campo"><span>% sobre el costo neto de compra (solo esta cotización)</span>
      <input id="margen-mat" inputmode="decimal" class="num" value="${String(reglasDe(cot).margenMatPct).replace('.', ',')}"></label>
    <h3>Recargos</h3>
    <label class="check"><input type="checkbox" id="urg" ${cot.urgencia ? 'checked' : ''}>Urgencia (+${cfg.urgenciaPct}% mano de obra)</label>
    <label class="check"><input type="checkbox" id="tras" ${cot.traslado ? 'checked' : ''}>Traslado fuera de zona (${clp(cfg.trasladoMonto)})</label>
    <div class="panel" id="totales" style="margin-top:12px"></div>
    <label class="campo"><span>Validez (días)</span><input id="validez" inputmode="numeric" value="${cot.validezDias}"></label>
    <label class="campo"><span>Observaciones para el cliente (salen en el PDF)</span><textarea id="obs">${h(cot.notaCliente || '')}</textarea></label>
    <label class="campo"><span>Condiciones de pago</span><textarea id="cond">${h(cot.condiciones)}</textarea></label>
    <label class="campo"><span>Garantía</span><textarea id="gar">${h(cot.garantia)}</textarea></label>`;
  const pintarTotales = () => { $('#totales').innerHTML = htmlTotales(cot, totales(cot)); refrescarTotal(); };
  $$('.segmentado', raiz).forEach((g) => $$('button', g).forEach((b) => (b.onclick = () => {
    $$('button', g).forEach((x) => x.setAttribute('aria-pressed', x === b));
    if (g.dataset.g === 'tipoDoc') cot.tipoDoc = b.dataset.v; else cot.descuento.tipo = b.dataset.v;
    guardarLuego(); pintarTotales();
  })));
  $('#desc-valor').oninput = (e) => { cot.descuento.valor = Math.max(0, parseCLP(e.target.value)); guardarLuego(); pintarTotales(); };
  $('#margen-mat').oninput = (e) => {
    const v = parseFloat(e.target.value.replace(',', '.'));
    if (!(v >= 0)) return;
    cot.margenMatPct = v;
    aplicarReglas(cot.items, reglasDe(cot));
    guardarLuego(); pintarTotales();
  };
  $('#urg').onchange = (e) => { cot.urgencia = e.target.checked; guardarLuego(); pintarTotales(); };
  $('#tras').onchange = (e) => { cot.traslado = e.target.checked; guardarLuego(); pintarTotales(); };
  $('#validez').oninput = (e) => { cot.validezDias = Math.max(1, parseCLP(e.target.value) || 1); guardarLuego(); };
  $('#obs').oninput = (e) => { cot.notaCliente = e.target.value; guardarLuego(); };
  $('#cond').oninput = (e) => { cot.condiciones = e.target.value; guardarLuego(); };
  $('#gar').oninput = (e) => { cot.garantia = e.target.value; guardarLuego(); };
  pintarTotales();
  return () => {
    if (cot.descuento.tipo === 'pct' && cot.descuento.valor > 100) return 'El descuento no puede ser mayor a 100%';
    if (cot.tipoDoc === 'factura' && !estado.cliente.rut) return 'Para factura falta el RUT del cliente (paso 1)';
    return '';
  };
}

// ---------------------------------------------------------------- Paso 4
export async function seccionFotos(raiz, cot, alCambiar) {
  raiz.innerHTML = `
    <p class="chico">Opcional. Las fotos se guardan comprimidas en el celular.</p>
    <div class="fila-btns">
      <label class="btn btn-primario">${icono('camera')}Tomar foto<input type="file" accept="image/*" capture="environment" id="f-cam" hidden></label>
      <label class="btn">${icono('image')}Desde galería<input type="file" accept="image/*" multiple id="f-gal" hidden></label>
    </div>
    <label class="check"><input type="checkbox" id="f-pdf" ${cot.incluirFotos ? 'checked' : ''}>Incluir fotos como anexo en el PDF</label>
    <div class="galeria" id="galeria"></div>`;
  const urls = [];
  const pintarGaleria = async () => {
    urls.forEach(URL.revokeObjectURL); urls.length = 0;
    const fotos = await fotosDe(cot.id);
    $('#galeria', raiz).innerHTML = fotos.map((f) => {
      const u = URL.createObjectURL(f.blob); urls.push(u);
      return `<div class="foto" data-id="${f.id}"><img src="${u}" alt="Foto de la visita">
        <input data-nota placeholder="Nota corta" value="${h(f.nota)}">
        <button class="btn-ico" data-del>${icono('trash', 20)}Quitar</button></div>`;
    }).join('') || '';
    $$('.foto', raiz).forEach((el) => {
      const f = fotos.find((x) => x.id === el.dataset.id);
      $('[data-nota]', el).oninput = demorar((e) => { f.nota = e.target.value; db.guardar('fotos', f); }, 300);
      $('[data-del]', el).onclick = async () => { await db.borrar('fotos', f.id); aviso('Foto quitada'); pintarGaleria(); };
    });
  };
  const subir = async (e) => {
    const archivos = [...e.target.files];
    if (!archivos.length) return;
    aviso('Guardando foto…');
    try {
      for (const a of archivos) await agregarFoto(cot.id, a);
      if (!cot.incluirFotos) { cot.incluirFotos = true; $('#f-pdf', raiz).checked = true; alCambiar?.(); }
      vibrar(); aviso(archivos.length > 1 ? `${archivos.length} fotos guardadas` : 'Foto guardada');
    } catch (err) { console.error(err); aviso('No se pudo guardar la foto'); }
    e.target.value = '';
    pintarGaleria();
  };
  $('#f-cam', raiz).onchange = subir;
  $('#f-gal', raiz).onchange = subir;
  $('#f-pdf', raiz).onchange = (e) => { cot.incluirFotos = e.target.checked; alCambiar?.(); };
  await pintarGaleria();
}

async function paso4(raiz) {
  await seccionFotos(raiz, estado.cot, guardarLuego);
  return () => '';
}

// ---------------------------------------------------------------- Paso 5
async function paso5(raiz) {
  const { cot, cliente } = estado;
  const t = totales(cot);
  const falta = faltantes(cot, cliente);
  const nFotos = (await fotosDe(cot.id)).length;
  raiz.innerHTML = `
    ${falta.length ? `<div class="tarjeta destacada"><span class="ico-estado e-enviar"><span class="alerta-ico">${icono('alert')}</span></span>
      <span class="cuerpo"><div class="nombre">Falta completar</div><div class="detalle">${falta.map(h).join(', ')}</div></span></div>` : ''}
    <div class="panel">
      <div class="nombre"><b>${h(cliente.nombre || 'Sin nombre')}</b></div>
      <div class="chico">${h([cliente.direccion, cliente.comuna].filter(Boolean).join(', '))}</div>
      <div class="chico">${cot.items.length} ítems · ${cot.tipoDoc === 'factura' ? 'Factura' : 'Boleta de honorarios'}${nFotos ? ` · ${nFotos} fotos${cot.incluirFotos ? ' (en PDF)' : ''}` : ''}</div>
    </div>
    <div class="panel">${htmlTotales(cot, t)}</div>
    <div class="fila-btns">
      <button class="btn" id="b-pdf">${icono('download')}Descargar PDF</button>
      <button class="btn" id="b-texto">${icono('send')}Solo texto por WhatsApp</button>
    </div>`;
  $('#b-pdf').onclick = () => descargarPdf(cot, cliente);
  $('#b-texto').onclick = async () => {
    const err = validar5(); if (err) { aviso(err); return; }
    if (await enviarCotizacion(cot, cliente, 'texto')) { ciclo.alSalir = null; setTimeout(() => ir('#/'), 900); }
  };
  const validar5 = () => {
    if (!cot.items.length) return 'Agrega al menos un ítem (paso 2)';
    if (!telWa(cliente.telefono)) return 'Falta el teléfono del cliente (paso 1)';
    if (cot.tipoDoc === 'factura' && !validarRut(cliente.rut)) return 'Para factura falta un RUT válido (paso 1)';
    return '';
  };
  return validar5;
}
