// =====================================================================
// util.js — Formatos (CLP, fechas), RUT, teléfonos e ids. Sin DOM.
// =====================================================================

/** $1.234.567 (sin decimales). */
export function clp(n) {
  const v = Math.round(Number(n) || 0);
  const s = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (v < 0 ? '-$' : '$') + s;
}

/** Convierte "12.345" o "$12.345" a número entero. */
export function parseCLP(txt) {
  const n = parseInt(String(txt ?? '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function fecha(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
export function fechaCorta(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}
/** yyyy-mm-dd para inputs type=date */
export function fechaISO(ts) {
  const d = ts ? new Date(ts) : new Date();
  const z = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
export const diasDesde = (ts) => Math.floor((Date.now() - ts) / 86400000);

// ---------------- RUT ----------------
export function limpiarRut(rut) { return String(rut || '').replace(/[^0-9kK]/g, '').toUpperCase(); }

export function dvRut(cuerpo) {
  let suma = 0, mul = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) { suma += Number(cuerpo[i]) * mul; mul = mul === 7 ? 2 : mul + 1; }
  const r = 11 - (suma % 11);
  return r === 11 ? '0' : r === 10 ? 'K' : String(r);
}

export function validarRut(rut) {
  const r = limpiarRut(rut);
  if (r.length < 2) return false;
  const cuerpo = r.slice(0, -1), dv = r.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;
  return dvRut(cuerpo) === dv;
}

export function formatearRut(rut) {
  const r = limpiarRut(rut);
  if (r.length < 2) return r;
  const cuerpo = r.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cuerpo}-${r.slice(-1)}`;
}

// ---------------- Teléfono ----------------
/** Normaliza a 569XXXXXXXX para wa.me. Devuelve '' si no es válido. */
export function telWa(tel) {
  let d = String(tel || '').replace(/\D/g, '');
  if (d.startsWith('56')) d = d.slice(2);
  if (d.length === 8) d = '9' + d;
  if (d.length !== 9) return '';
  return '56' + d;
}
/** +56 9 1234 5678 */
export function telBonito(tel) {
  const w = telWa(tel);
  if (!w) return tel || '';
  return `+56 ${w[2]} ${w.slice(3, 7)} ${w.slice(7)}`;
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
