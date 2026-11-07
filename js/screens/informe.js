// =====================================================================
// Informe técnico de una visita o trabajo (cot.informe).
// Campos dictables; se pre-llena con la nota de la visita y el checklist
// de la orden. La "condición en que queda la instalación" es obligatoria
// y, si no queda operativa y segura, exige explicar por qué.
// =====================================================================
import { pintar, h, $, $$, aviso, checkOk, conectarDictado, demorar, descargar } from '../ui.js';
import { icono } from '../icons.js';
import { fechaISO, telWa } from '../util.js';
import { cargarCotizacion, guardarCotizacion, ordenDe } from '../cotizaciones.js';
import { generarInformePdf, nombreInformePdf, CONDICIONES_FINALES } from '../pdf.js';
import { compartirPdf, abrirWa } from '../whatsapp.js';
import { negocioCompleto } from '../config.js';
import { pedirDatosNegocio } from '../envio.js';
import { fotosDe } from '../fotos.js';

/** Informe vacío con valores sugeridos desde la cotización y la orden. */
async function informeInicial(cot) {
  const ot = await ordenDe(cot.id);
  const hechos = ot ? ot.checklist.filter((c) => c.hecho).map((c) => `• ${c.texto}`).join('\n') : '';
  return {
    fecha: cot.fechaVisita || Date.now(), motivo: cot.nota || '', hallazgos: '', acciones: hechos,
    recomendaciones: '', normativa: '', condicion: 'operativa', condicionDetalle: '',
    incluirFotos: (await fotosDe(cot.id)).length > 0, creado: Date.now(),
  };
}

export async function pantallaInforme(cotId) {
  const datos = await cargarCotizacion(cotId);
  if (!datos) { aviso('No se encontró la cotización'); history.back(); return; }
  const { cot, cliente } = datos;
  if (!cot.informe) { cot.informe = await informeInicial(cot); await guardarCotizacion(cot); }
  const inf = cot.informe;
  // Si se abrió antes de marcar el checklist, completa "trabajos ejecutados" con lo ya hecho.
  if (!inf.acciones?.trim()) {
    const sugerido = (await informeInicial(cot)).acciones;
    if (sugerido) { inf.acciones = sugerido; await guardarCotizacion(cot); }
  }
  const guardar = demorar(() => guardarCotizacion(cot), 350);
  const nFotos = (await fotosDe(cot.id)).length;

  const area = (campo, titulo, ayuda) => `
    <label class="campo"><span>${titulo}</span>
      <div class="con-boton"><textarea data-i="${campo}" placeholder="${h(ayuda)}">${h(inf[campo])}</textarea>
      <button class="btn" data-mic="${campo}" aria-label="Dictar ${h(titulo)}">${icono('mic')}</button></div></label>`;

  pintar({
    titulo: `Informe · ${cliente.nombre || 'Cliente'}`, atras: true,
    principal: { texto: 'Enviar informe por WhatsApp', icono: 'whatsapp' },
    cuerpo: `
      <div class="panel"><b>${h(cliente.nombre)}</b>${cliente.local ? ' · ' + h(cliente.local) : ''}
        <div class="chico">${h([cliente.direccion, cliente.comuna].filter(Boolean).join(', ') || 'Sin dirección')}</div></div>
      <label class="campo"><span>Fecha de inspección</span><input type="date" id="i-fecha" value="${fechaISO(inf.fecha)}"></label>
      ${area('motivo', 'Motivo de la visita', 'Ej: Operan los diferenciales y se cortan las cajas registradoras')}
      ${area('hallazgos', 'Hallazgos', 'Ej: Enchufe de caja con neutro dañado. Falla a tierra en letrero exterior por roce de ramas.')}
      ${area('acciones', 'Trabajos ejecutados', 'Ej: Se reparó el módulo de enchufe. Se reinstaló la tierra de protección de la máquina de café.')}
      ${area('recomendaciones', 'Recomendaciones', 'Ej: Reemplazar regletas de la fachada por cajas de derivación estancas IP65.')}
      <label class="campo"><span>Normativa de referencia (verifica el número de RIC)</span>
        <input data-i="normativa" value="${h(inf.normativa)}" placeholder="Ej: Pliego Técnico RIC N° 06 (puesta a tierra)"></label>

      <div class="seccion-titulo">Condición en que queda la instalación *</div>
      ${Object.entries(CONDICIONES_FINALES).map(([k, v]) => `
        <label class="check"><input type="radio" name="cond" value="${k}" ${inf.condicion === k ? 'checked' : ''}>${v}</label>`).join('')}
      <label class="campo" id="det-wrap"><span id="det-et"></span>
        <textarea data-i="condicionDetalle" id="det">${h(inf.condicionDetalle)}</textarea></label>
      <div id="aviso-riesgo" class="tarjeta destacada oculto"><span class="ico-estado e-cobrar"><span class="alerta-ico">${icono('alert')}</span></span>
        <span class="cuerpo"><div class="nombre" style="white-space:normal">Ojo con dejar un riesgo activo</div>
        <div class="detalle">Si un equipo tiene falla a masa, lo seguro es dejarlo desconectado y rotulado, no quitarle la tierra. El informe queda como respaldo: el cliente firma que fue informado.</div></span></div>

      <label class="check"><input type="checkbox" id="i-fotos" ${inf.incluirFotos ? 'checked' : ''} ${nFotos ? '' : 'disabled'}>
        Incluir registro fotográfico (${nFotos} foto${nFotos === 1 ? '' : 's'})</label>
      <div class="fila-btns"><button class="btn" id="i-pdf">${icono('download')}Descargar PDF</button></div>`,
  });

  $$('[data-i]').forEach((el) => (el.oninput = () => { inf[el.dataset.i] = el.value; guardar(); }));
  $$('[data-mic]').forEach((b) => {
    const campo = $(`[data-i="${b.dataset.mic}"]`);
    conectarDictado(b, campo, (v) => { inf[b.dataset.mic] = v; guardar(); });
  });
  $('#i-fecha').onchange = (e) => { inf.fecha = new Date(e.target.value + 'T12:00').getTime(); guardar(); };
  $('#i-fotos').onchange = (e) => { inf.incluirFotos = e.target.checked; guardar(); };

  const pintarCondicion = () => {
    const c = inf.condicion;
    $('#det-et').textContent = c === 'operativa' ? 'Detalle (opcional)' : 'Explica qué queda pendiente y por qué *';
    $('#aviso-riesgo').classList.toggle('oculto', c !== 'riesgo');
  };
  $$('[name=cond]').forEach((r) => (r.onchange = () => { inf.condicion = r.value; pintarCondicion(); guardar(); }));
  pintarCondicion();

  const validar = () => {
    if (!inf.hallazgos?.trim() && !inf.acciones?.trim()) return 'Escribe al menos los hallazgos o los trabajos ejecutados';
    if (inf.condicion !== 'operativa' && !inf.condicionDetalle?.trim()) return 'Explica en qué condición queda la instalación';
    return '';
  };
  const generar = async () => {
    const err = validar(); if (err) { aviso(err); return null; }
    if (!negocioCompleto() && !(await pedirDatosNegocio())) return null;
    await guardarCotizacion(cot);
    return generarInformePdf(cot, cliente, inf);
  };

  $('#i-pdf').onclick = async () => {
    try { const blob = await generar(); if (blob) { descargar(blob, nombreInformePdf(cot, cliente)); aviso('Informe descargado'); } }
    catch (e) { console.error(e); aviso('No se pudo generar el informe'); }
  };
  $('#btn-principal').onclick = async () => {
    try {
      const blob = await generar(); if (!blob) return;
      const texto = `Hola${cliente.nombre ? ' ' + cliente.nombre.split(' ')[0] : ''}, te envío el informe técnico de la visita${cliente.local ? ' a ' + cliente.local : ''}.`;
      const ok = await compartirPdf(blob, nombreInformePdf(cot, cliente), texto);
      if (!ok) {
        descargar(blob, nombreInformePdf(cot, cliente));
        if (telWa(cliente.telefono)) abrirWa(cliente.telefono, texto);
        aviso('PDF descargado: adjúntalo en WhatsApp');
      }
      inf.enviado = Date.now(); await guardarCotizacion(cot); checkOk();
    } catch (e) {
      if (e.name === 'AbortError') { aviso('Envío cancelado'); return; }
      console.error(e); aviso('No se pudo generar el informe');
    }
  };
}
