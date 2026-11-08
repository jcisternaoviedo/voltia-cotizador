// =====================================================================
// Ajustes: datos del negocio, tasas, precios, seguimiento, tema y
// respaldo (exportar / importar JSON).
// =====================================================================
import { pintar, ir, h, $, $$, aviso, checkOk, hoja, cerrarHoja } from '../ui.js';
import { icono } from '../icons.js';
import { getConfig, setConfig, reemplazarConfig } from '../config.js';
import { importarTodo, getMeta } from '../db.js';
import { hacerRespaldo } from '../respaldo.js';
import { pedirDatosNegocio } from '../envio.js';
import { fecha, telBonito } from '../util.js';
import { aplicarTema } from '../app.js';

export async function pantallaAjustes(params) {
  const cfg = getConfig();
  const n = cfg.negocio;
  const ultimo = await getMeta('ultimoRespaldo');
  const num = (id, et, val, paso = '1') => `<label class="campo"><span>${et}</span><input id="${id}" type="number" min="0" step="${paso}" inputmode="decimal" class="num" value="${val}"></label>`;
  const anios = Object.keys(cfg.retenciones).sort();
  const partes = [n.representante, n.rut, telBonito(n.telefono), n.correo, n.sec ? `SEC ${n.sec}` : ''].filter(Boolean);
  const resumenNegocio = partes.length ? partes.join(' · ') : 'Se piden al generar el primer PDF';

  const main = pintar({
    titulo: 'Ajustes', atras: '#/',
    principal: { texto: 'Guardar ajustes', icono: 'check' },
    cuerpo: `
      <div class="seccion-titulo">Respaldo</div>
      <div class="panel" id="respaldo">
        <div>Último respaldo: <b>${ultimo ? fecha(ultimo) : 'nunca'}</b></div>
        <p class="chico">Un toque: se abre "Compartir" para mandarlo a tu WhatsApp, a Google Drive o al correo. Incluye fotos.</p>
        <div class="fila-btns">
          <button class="btn btn-primario" id="b-exp">${icono('send')}Respaldar ahora</button>
          <label class="btn">${icono('upload')}Importar respaldo<input type="file" accept=".txt,.json,text/plain,application/json" id="b-imp" hidden></label></div>
      </div>

      <div class="seccion-titulo">Tus datos (salen en el PDF)</div>
      <button class="tarjeta" id="b-negocio"><span class="ico-estado e-neutro">${icono('user')}</span>
        <span class="cuerpo"><div class="nombre">${h(n.nombre || 'Sin completar')}</div>
        <div class="detalle">${h(resumenNegocio)}</div></span>${icono('edit')}</button>

      <div class="seccion-titulo">Impuestos</div>
      ${num('a-iva', 'IVA factura (%)', cfg.ivaPct, '0.01')}
      <div class="dos-col">${anios.map((a) => num(`a-ret-${a}`, `Retención boleta ${a} (%)`, cfg.retenciones[a], '0.01')).join('')}</div>
      <label class="campo"><span>Documento por defecto</span><select id="a-doc">
        <option value="boleta" ${cfg.tipoDocDefecto === 'boleta' ? 'selected' : ''}>Boleta de honorarios</option>
        <option value="factura" ${cfg.tipoDocDefecto === 'factura' ? 'selected' : ''}>Factura</option></select></label>

      <div class="seccion-titulo">Precios</div>
      ${num('a-margen-mat', 'Margen sobre costo de materiales (%)', cfg.margenMatPct, '0.1')}
      <label class="check"><input type="checkbox" id="a-iva-compra" ${cfg.ivaCompraEnCosto ? 'checked' : ''}>Sumar el IVA de compra al costo antes del margen</label>
      <p class="chico">Por defecto el margen se aplica sobre el costo neto (sin IVA). Los cambios aplican a cotizaciones nuevas; las existentes conservan su margen.</p>
      <div class="dos-col">
        ${num('a-margen', 'Margen general extra (%)', cfg.margenPct, '0.1')}
        ${num('a-urg', 'Recargo urgencia (% MO)', cfg.urgenciaPct)}
        ${num('a-tras', 'Traslado fuera de zona ($)', cfg.trasladoMonto, '500')}
        ${num('a-validez', 'Validez cotización (días)', cfg.validezDias)}
      </div>
      <label class="campo"><span>Condiciones de pago (por defecto)</span><textarea id="a-cond">${h(cfg.condicionesPago)}</textarea></label>
      <label class="campo"><span>Garantía (por defecto)</span><textarea id="a-gar">${h(cfg.garantia)}</textarea></label>

      <div class="seccion-titulo">Seguimiento</div>
      <div class="dos-col">
        ${num('a-dias', 'Seguimiento tras (días)', cfg.diasSeguimiento)}
        ${num('a-resp', 'Aviso de respaldo tras (días)', cfg.diasRespaldo)}
      </div>

      <div class="seccion-titulo">Pantalla</div>
      <div class="segmentado" id="a-tema">
        <button data-t="claro" aria-pressed="${cfg.tema !== 'oscuro'}">Modo claro (sol)</button>
        <button data-t="oscuro" aria-pressed="${cfg.tema === 'oscuro'}">Modo oscuro</button></div>
      <p class="chico">Cotizador Eléctrico · datos guardados solo en este teléfono.</p>`,
  });

  if (params.get('respaldo')) $('#respaldo').scrollIntoView({ block: 'center' });

  $('#b-negocio').onclick = async () => { await pedirDatosNegocio('Estos datos aparecen en el encabezado del PDF.'); pantallaAjustes(params); };
  $$('#a-tema button').forEach((b) => (b.onclick = () => {
    setConfig({ tema: b.dataset.t }); aplicarTema();
    $$('#a-tema button').forEach((x) => x.setAttribute('aria-pressed', x === b));
  }));

  $('#b-exp').onclick = async () => {
    const b = $('#b-exp'); b.disabled = true;
    try {
      const r = await hacerRespaldo();
      if (r === 'cancelado') aviso('Respaldo cancelado');
      else { checkOk(); aviso(r === 'compartido' ? 'Respaldo enviado' : 'Respaldo descargado'); pantallaAjustes(params); }
    } catch (e) { console.error(e); aviso('No se pudo crear el respaldo'); }
    b.disabled = false;
  };
  $('#b-imp').onchange = async (e) => {
    const archivo = e.target.files[0]; if (!archivo) return;
    let json;
    try { json = JSON.parse(await archivo.text()); } catch { aviso('El archivo no es un JSON válido'); return; }
    const el = hoja(`<h2>¿Reemplazar todos los datos?</h2>
      <p>Se cargará el respaldo del ${json.exportado ? fecha(json.exportado) : '(fecha desconocida)'} y se reemplazarán las cotizaciones, clientes y catálogo actuales.</p>
      <div class="fila-btns"><button class="btn" id="no">Cancelar</button><button class="btn btn-primario" id="si">${icono('upload')}Importar respaldo</button></div>`);
    $('#no', el).onclick = cerrarHoja;
    $('#si', el).onclick = async () => {
      try {
        const cfgImp = await importarTodo(json);
        if (cfgImp) reemplazarConfig(cfgImp);
        aplicarTema(); cerrarHoja(); checkOk(); aviso('Respaldo importado'); ir('#/');
      } catch (err) { cerrarHoja(); aviso(err.message || 'No se pudo importar'); }
    };
    e.target.value = '';
  };

  $('#btn-principal').onclick = () => {
    const v = (id) => Number($(id).value);
    const valores = {
      ivaPct: v('#a-iva'), margenPct: v('#a-margen'),
      margenMatPct: v('#a-margen-mat'), ivaCompraEnCosto: $('#a-iva-compra').checked, urgenciaPct: v('#a-urg'), trasladoMonto: Math.round(v('#a-tras')),
      validezDias: Math.round(v('#a-validez')), diasSeguimiento: Math.round(v('#a-dias')), diasRespaldo: Math.round(v('#a-resp')),
      tipoDocDefecto: $('#a-doc').value, condicionesPago: $('#a-cond').value.trim(), garantia: $('#a-gar').value.trim(),
      retenciones: Object.fromEntries(anios.map((a) => [a, v(`#a-ret-${a}`)])),
    };
    const nums = [valores.ivaPct, valores.margenPct, valores.margenMatPct, valores.urgenciaPct, valores.trasladoMonto, ...Object.values(valores.retenciones)];
    if (nums.some((x) => !Number.isFinite(x) || x < 0)) { aviso('Revisa los valores: no pueden ser negativos ni vacíos'); return; }
    if (valores.validezDias < 1 || valores.diasSeguimiento < 1 || valores.diasRespaldo < 1) { aviso('Los días deben ser 1 o más'); return; }
    setConfig(valores); checkOk(); aviso('Ajustes guardados');
  };
}
