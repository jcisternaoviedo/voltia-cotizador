// =====================================================================
// envio.js — Flujo "Enviar por WhatsApp": pide los datos del negocio la
// primera vez, genera el PDF, lo comparte (o abre wa.me + descarga) y
// marca la cotización como enviada.
// =====================================================================
import { getConfig, setConfig, negocioCompleto } from './config.js';
import { generarPdf, nombrePdf } from './pdf.js';
import { compartirPdf, abrirWa, textoCotizacion } from './whatsapp.js';
import { cambiarEstado, guardarCotizacion, totales } from './cotizaciones.js';
import { hoja, cerrarHoja, aviso, checkOk, descargar, $, h } from './ui.js';
import { validarRut, telWa, formatearRut } from './util.js';
import { icono } from './icons.js';
import { procesarLogo } from './fotos.js';

/** Formulario de datos del electricista. Resuelve true al guardar. */
export function pedirDatosNegocio(motivo = 'Antes del primer PDF, ingresa tus datos (una sola vez).') {
  return new Promise((resolve) => {
    const n = getConfig().negocio;
    const el = hoja(`
      <h2>Tus datos</h2>
      <p class="chico">${h(motivo)}</p>
      <label class="campo"><span>Nombre o empresa *</span><input id="n-nombre" value="${h(n.nombre)}" autocomplete="organization"></label>
      <label class="campo"><span>Representante</span><input id="n-rep" value="${h(n.representante || '')}" autocomplete="name"></label>
      <label class="campo"><span>Teléfono *</span><input id="n-tel" inputmode="tel" value="${h(n.telefono)}" placeholder="9 1234 5678"></label>
      <label class="campo"><span>RUT</span><input id="n-rut" value="${h(n.rut)}" placeholder="12.345.678-9"></label>
      <label class="campo"><span>Correo</span><input id="n-correo" type="email" value="${h(n.correo)}"></label>
      <label class="campo"><span>N° instalador SEC (opcional)</span><input id="n-sec" value="${h(n.sec)}"></label>
      <label class="campo"><span>Logo (opcional)</span>
        ${n.logo ? `<img class="logo-prev" id="n-logo-prev" src="${n.logo}" alt="Logo">` : ''}
        <input id="n-logo" type="file" accept="image/*"></label>
      <div id="n-error" class="error-campo"></div>
      <button class="btn btn-primario btn-bloque" id="n-guardar" style="min-height:56px">${icono('check')}Guardar mis datos</button>`);
    let logo = n.logo;
    $('#n-logo', el).onchange = async (e) => { if (e.target.files[0]) { logo = await procesarLogo(e.target.files[0]); aviso('Logo listo'); } };
    $('#n-guardar', el).onclick = () => {
      const datos = {
        nombre: $('#n-nombre', el).value.trim(), representante: $('#n-rep', el).value.trim(), telefono: $('#n-tel', el).value.trim(),
        rut: $('#n-rut', el).value.trim(), correo: $('#n-correo', el).value.trim(), sec: $('#n-sec', el).value.trim(), logo,
      };
      const err = !datos.nombre ? 'Falta tu nombre o el de tu empresa.'
        : !telWa(datos.telefono) ? 'El teléfono debe tener 9 dígitos (ej: 9 1234 5678).'
        : datos.rut && !validarRut(datos.rut) ? 'El RUT no es válido: revisa el dígito verificador.' : '';
      if (err) { $('#n-error', el).textContent = err; return; }
      if (datos.rut) datos.rut = formatearRut(datos.rut);
      setConfig({ negocio: datos });
      cerrarHoja(); aviso('Datos guardados');
      resolve(true);
    };
  });
}

async function asegurarNegocio() {
  if (negocioCompleto()) return true;
  return pedirDatosNegocio();
}

/** Descarga el PDF sin marcar como enviada. */
export async function descargarPdf(cot, cliente) {
  if (!(await asegurarNegocio())) return;
  try {
    const blob = await generarPdf(cot, cliente, totales(cot));
    descargar(blob, nombrePdf(cot, cliente));
    aviso('PDF descargado');
  } catch (e) { console.error(e); aviso('No se pudo generar el PDF'); }
}

/**
 * Envía la cotización. modo: 'pdf' (comparte archivo si se puede) | 'texto' (solo wa.me)
 * Devuelve true si quedó enviada.
 */
export async function enviarCotizacion(cot, cliente, modo = 'pdf') {
  if (!telWa(cliente.telefono)) { aviso('Falta un teléfono válido del cliente'); return false; }
  if (!(await asegurarNegocio())) return false;
  const t = totales(cot);
  const texto = textoCotizacion(cot, cliente, t);
  try {
    if (modo === 'pdf') {
      const blob = await generarPdf(cot, cliente, t);
      const nombre = nombrePdf(cot, cliente);
      const compartido = await compartirPdf(blob, nombre, texto);
      if (!compartido) { descargar(blob, nombre); abrirWa(cliente.telefono, texto); aviso('PDF descargado: adjúntalo en WhatsApp'); }
    } else {
      abrirWa(cliente.telefono, texto);
    }
  } catch (e) {
    if (e.name === 'AbortError') { aviso('Envío cancelado: sigue en pendientes'); return false; }
    console.error(e); aviso('No se pudo generar el PDF; se envía solo el texto');
    abrirWa(cliente.telefono, texto);
  }
  if (cot.estado === 'borrador') await cambiarEstado(cot, 'enviada');
  else { cot.ultimoSeguimiento = Date.now(); await guardarCotizacion(cot); }
  checkOk();
  aviso('Cotización enviada');
  return true;
}
