// =====================================================================
// Fragmentos de interfaz compartidos entre pantallas.
// =====================================================================
import { clp } from '../util.js';
import { getConfig } from '../config.js';
import { calcularUtilidad, reglasMateriales } from '../calc.js';

/** Tabla de totales + vista interna (lo que recibe el electricista). */
export function htmlTotales(cot, t, interno = true) {
  const cfg = getConfig();
  const fila = (et, v, cls = '') => `<tr class="${cls}"><td>${et}</td><td>${v}</td></tr>`;
  let html = `<table class="totales">
    ${fila('Materiales', clp(t.mat), 'sub')}
    ${fila('Mano de obra', clp(t.mo), 'sub')}
    ${fila('Subtotal', clp(t.base))}
    ${t.margen ? fila(`Margen ${cfg.margenPct}%`, clp(t.margen)) : ''}
    ${t.urgencia ? fila(`Urgencia +${cfg.urgenciaPct}% mano de obra`, clp(t.urgencia)) : ''}
    ${t.traslado ? fila('Traslado', clp(t.traslado)) : ''}
    ${t.descuento ? fila('Descuento', '-' + clp(t.descuento)) : ''}
    ${fila('Total al cliente', clp(t.total), 'total')}
    ${cot.tipoDoc === 'factura'
      ? fila('Neto', clp(t.factura.neto), 'sub') + fila(`IVA ${t.factura.ivaPct}%`, clp(t.factura.iva), 'sub')
      : fila('Boleta de honorarios (monto bruto)', clp(t.total), 'sub')}
  </table>`;
  if (interno) {
    const u = calcularUtilidad(cot, t, cfg);
    const r = reglasMateriales(cot, cfg);
    html += `<div class="interno">
      <p class="chico">Anexo interno: solo para ti (no sale en el PDF)</p>
      <table class="totales">
      ${fila('Cobras al cliente', clp(t.total))}
      ${fila(`− Compra de materiales${r.ivaCompraEnCosto ? ' (con IVA)' : ' (neto)'}`, '-' + clp(u.costoMateriales), 'sub')}
      ${fila('= Ganancia antes de impuestos', clp(t.total - u.costoMateriales))}
      ${fila(`· mano de obra y recargos`, clp(t.total - u.costoMateriales - u.margenMateriales), 'sub')}
      ${fila(`· margen materiales (+${String(r.margenMatPct).replace('.', ',')}%)`, clp(u.margenMateriales), 'sub')}
      ${cot.tipoDoc === 'factura'
        ? fila(`− IVA ${t.factura.ivaPct}% a pagar al SII`, '-' + clp(t.factura.iva), 'sub')
        : fila(`− Retención ${String(t.boleta.retPct).replace('.', ',')}% (se imputa en la Operación Renta)`, '-' + clp(t.boleta.retencion), 'sub')}
      ${fila('<b>= Te queda</b>', `<b>${clp(u.utilidad)}</b>`)}
      ${fila('Utilidad sobre la venta', `${String(u.margenSobreVenta).replace('.', ',')}%`, 'sub')}
      </table>
      ${u.sinCosto ? `<p class="chico">${u.sinCosto} ítem(s) sin costo registrado: se asume costo = precio.</p>` : ''}
      </div>`;
  }
  return html;
}

export const MODOS = { unidad: 'Precio fijo por unidad', hora: 'Por hora', mat_mo: 'Materiales + mano de obra' };
export const UNIDADES = ['unidad', 'punto', 'metro', 'hora', 'visita', 'tablero', 'circuito', 'trámite', 'proyecto', 'global'];
