// =====================================================================
// whatsapp.js — Mensajes y enlaces wa.me / Web Share API.
// Nada se envía a servidores: solo se abre WhatsApp con el texto listo.
// =====================================================================
import { clp, telWa, fecha } from './util.js';
import { getConfig } from './config.js';

export function enlaceWa(telefono, texto) {
  const n = telWa(telefono);
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

export function abrirWa(telefono, texto) {
  window.open(enlaceWa(telefono, texto), '_blank', 'noopener');
}

const saludo = (cliente) => (cliente.nombre ? `Hola ${cliente.nombre.split(' ')[0]}` : 'Hola');
/** "Eduardo Hernández Silva · Voltia Service" */
const firma = () => { const n = getConfig().negocio; return [n.representante, n.nombre].filter(Boolean).join(' · '); };

export function textoCotizacion(cot, cliente, t) {
  const lineas = cot.items.map((it) => `• ${it.cantidad} ${it.unidad} — ${it.nombre}`).join('\n');
  const doc = cot.tipoDoc === 'factura' ? 'con factura (IVA incluido)' : 'con boleta de honorarios';
  return `${saludo(cliente)}, te envío la cotización N° ${cot.numero}:\n\n${lineas}\n\n` +
    `*Total: ${clp(t.total)}* ${doc}\nVálida por ${cot.validezDias} días.\n\n` +
    `Quedo atento a tus comentarios.${firma() ? `\n${firma()}` : ''}`;
}

export function textoSeguimiento(cot, cliente, t) {
  return `${saludo(cliente)}, ¿pudiste revisar la cotización N° ${cot.numero} por ${clp(t.total)} que te envié el ${fecha(cot.enviada)}? ` +
    `Si tienes dudas o quieres ajustar algo, te ayudo. Tengo disponibilidad esta semana.${firma() ? `\n${firma()}` : ''}`;
}

export function textoRecordatorioPago(cot, cliente, saldo) {
  return `${saludo(cliente)}, te escribo por el saldo pendiente de ${clp(saldo)} del trabajo (cotización N° ${cot.numero}). ` +
    `¿Me confirmas cuándo puedes hacer el pago? Muchas gracias.${firma() ? `\n${firma()}` : ''}`;
}

export function textoTurno(cot, cliente, ot) {
  const d = new Date(ot.fechaProgramada);
  return `${saludo(cliente)}, te confirmo el trabajo para el ${d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })} ` +
    `a las ${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}.${firma() ? `\n${firma()}` : ''}`;
}

/**
 * Comparte el PDF con la Web Share API si el navegador lo permite
 * (en Android Chrome abre el selector y se elige WhatsApp).
 * Devuelve true si se compartió el archivo.
 */
export async function compartirPdf(blob, nombreArchivo, texto) {
  try {
    const file = new File([blob], nombreArchivo, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: texto, title: nombreArchivo });
      return true;
    }
  } catch (e) {
    if (e.name === 'AbortError') throw e; // el usuario canceló
  }
  return false;
}
