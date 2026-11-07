// =====================================================================
// config.js — Configuración liviana en localStorage.
// =====================================================================
import { CONFIG_DEFECTO } from './config-defaults.js';

const CLAVE = 'cotizador.config';
let cache = null;

function fusionar(base, extra) {
  const out = { ...base };
  for (const k of Object.keys(extra || {})) {
    const v = extra[k];
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object'
      ? { ...base[k], ...v } : v;
  }
  return out;
}

export function getConfig() {
  if (cache) return cache;
  let guardada = {};
  try { guardada = JSON.parse(localStorage.getItem(CLAVE) || '{}'); } catch { guardada = {}; }
  cache = fusionar(CONFIG_DEFECTO, guardada);
  // Sin logo propio → emblema de la marca (también para configuraciones guardadas antes de tenerlo).
  if (!cache.negocio.logo) cache.negocio.logo = CONFIG_DEFECTO.negocio.logo;
  return cache;
}

export function setConfig(cambios) {
  cache = fusionar(getConfig(), cambios);
  try { localStorage.setItem(CLAVE, JSON.stringify(cache)); } catch (e) { console.error('No se pudo guardar config', e); }
  return cache;
}

export function reemplazarConfig(cfg) {
  cache = fusionar(CONFIG_DEFECTO, cfg || {});
  localStorage.setItem(CLAVE, JSON.stringify(cache));
}

export function negocioCompleto() {
  const n = getConfig().negocio;
  return !!(n.nombre && n.telefono);
}
