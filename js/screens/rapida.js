// =====================================================================
// Captura rápida: nombre o teléfono + nota (escrita o dictada).
// Queda como borrador en pendientes en menos de 1 minuto.
// =====================================================================
import { pintar, ir, $, aviso, conectarDictado, vibrar } from '../ui.js';
import { icono } from '../icons.js';
import { crearBorrador } from '../cotizaciones.js';
import { telWa } from '../util.js';

export function pantallaRapida() {
  pintar({
    titulo: 'Nueva cotización',
    atras: '#/',
    cuerpo: `
      <p class="chico">Lo mínimo: nombre o teléfono. Lo demás lo completas después.</p>
      <label class="campo"><span>Nombre del cliente</span><input id="r-nombre" autocomplete="off" autofocus></label>
      <label class="campo"><span>Teléfono</span><input id="r-tel" inputmode="tel" placeholder="9 1234 5678"></label>
      <label class="campo"><span>Nota de la visita</span>
        <div class="con-boton"><textarea id="r-nota" placeholder="Ej: 4 enchufes en living, tablero antiguo sin diferencial"></textarea>
        <button class="btn" id="r-mic" aria-label="Dictar nota">${icono('mic')}Dictar</button></div></label>
      <div id="r-error" class="error-campo"></div>
      <button class="btn btn-bloque" id="r-borrador">${icono('file')}Guardar borrador y volver</button>`,
    principal: { texto: 'Seguir cotizando', icono: 'next' },
  });
  conectarDictado($('#r-mic'), $('#r-nota'));

  const leer = () => ({ nombre: $('#r-nombre').value.trim(), telefono: $('#r-tel').value.trim(), nota: $('#r-nota').value.trim() });
  const validar = (d) => {
    if (!d.nombre && !d.telefono) return 'Escribe al menos el nombre o el teléfono.';
    if (d.telefono && !telWa(d.telefono)) return 'El teléfono debe tener 9 dígitos (ej: 9 1234 5678).';
    return '';
  };
  const crear = async (destino) => {
    const d = leer(); const err = validar(d);
    if (err) { $('#r-error').textContent = err; vibrar(80); return; }
    const cot = await crearBorrador(d);
    if (destino === 'pendientes') { aviso('Borrador guardado en pendientes'); vibrar(); ir('#/'); }
    else ir(`#/cot/${cot.id}/paso/1`);
  };
  $('#r-borrador').onclick = () => crear('pendientes');
  $('#btn-principal').onclick = () => crear('seguir');
}
