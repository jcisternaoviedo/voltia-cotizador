// =====================================================================
// ui.js — Utilidades de interfaz: pintar pantalla, avisos, vibración,
// check animado, hoja inferior y dictado por voz.
// =====================================================================
import { icono } from './icons.js';
import { escapeHtml } from './util.js';

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
export const h = escapeHtml;

/** Hook que la pantalla actual puede definir para ejecutarse al salir. */
export const ciclo = { alSalir: null };

/**
 * Pinta una pantalla completa.
 * @param {object} o {titulo, atras (hash o true), botonesBarra (html), cuerpo (html), principal {texto, icono, id, info}}
 * @returns {HTMLElement} main
 */
export function pintar(o) {
  const app = $('#app');
  const atras = o.atras
    ? `<button class="btn-ico" id="btn-atras" aria-label="Volver">${icono('back')}</button>` : '';
  const principal = o.principal
    ? `<div class="accion-principal">
         ${o.principal.info ? `<div class="total-mini">${o.principal.info}</div>` : ''}
         <button class="btn btn-primario" id="${o.principal.id || 'btn-principal'}">${icono(o.principal.icono || 'next')}<span>${h(o.principal.texto)}</span></button>
       </div>` : '';
  // En el inicio se muestra el emblema de la marca (versión invertida, sobre la barra azul).
  const marca = o.marca ? `<img class="emblema-barra" src="icons/icon.svg" alt="" width="36" height="36">` : '';
  app.innerHTML = `
    <header class="barra">${atras}${marca}<h1>${h(o.titulo)}</h1>${o.botonesBarra || ''}</header>
    <main id="main">${o.cuerpo || ''}</main>
    ${principal}`;
  if (o.atras) $('#btn-atras').onclick = () => (typeof o.atras === 'string' ? ir(o.atras) : history.back());
  window.scrollTo(0, 0);
  return $('#main');
}

export function ir(hash) { if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = hash; }

// ---------------- Avisos ----------------
let toastTimer = null;
export function aviso(texto, ms = 2200) {
  const t = $('#toast');
  t.textContent = texto;
  t.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('visible'), ms);
}

export function vibrar(ms = 40) { try { navigator.vibrate?.(ms); } catch { /* sin soporte */ } }

export function checkOk() {
  const c = $('#check-ok');
  c.classList.remove('visible'); void c.offsetWidth; c.classList.add('visible');
  vibrar([30, 40, 60]);
}

// ---------------- Hoja inferior ----------------
/** Abre una hoja inferior con contenido; devuelve el elemento y una función para cerrar. */
export function hoja(html) {
  cerrarHoja();
  const fondo = document.createElement('div'); fondo.className = 'hoja-fondo'; fondo.id = 'hoja-fondo';
  const el = document.createElement('div'); el.className = 'hoja'; el.id = 'hoja';
  el.innerHTML = `<div class="asa"></div>${html}`;
  fondo.onclick = cerrarHoja;
  document.body.append(fondo, el);
  return el;
}
export function cerrarHoja() { $('#hoja')?.remove(); $('#hoja-fondo')?.remove(); }

// ---------------- Dictado por voz ----------------
/**
 * Conecta un botón de micrófono a un textarea/input. Usa la API de
 * reconocimiento de voz del navegador (es-CL). Si no hay soporte o
 * conexión, avisa y deja escribir.
 */
export function conectarDictado(boton, campo, alCambiar) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { boton.onclick = () => { aviso('Este navegador no permite dictar: escríbelo'); campo.focus(); }; return; }
  let rec = null;
  boton.onclick = () => {
    if (rec) { rec.stop(); return; }
    if (!navigator.onLine) { aviso('Sin señal el dictado no funciona: escríbelo'); campo.focus(); return; }
    rec = new SR();
    rec.lang = 'es-CL'; rec.interimResults = false; rec.continuous = false;
    const base = campo.value;
    boton.classList.add('dictando');
    rec.onresult = (e) => {
      const txt = [...e.results].map((r) => r[0].transcript).join(' ');
      campo.value = (base ? base.trim() + ' ' : '') + txt;
      alCambiar?.(campo.value);
    };
    rec.onerror = (e) => { if (e.error !== 'aborted') aviso('No se pudo dictar: escríbelo'); };
    rec.onend = () => { boton.classList.remove('dictando'); rec = null; };
    try { rec.start(); vibrar(); } catch { aviso('No se pudo iniciar el dictado'); }
  };
}

/** Debounce para guardado automático. */
export function demorar(fn, ms = 400) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/** Descarga un Blob como archivo. */
export function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = nombre; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function vacio(texto, sub, ico = 'shield') {
  return `<div class="vacio">${icono(ico, 56)}<p class="grande">${h(texto)}</p><p>${h(sub || '')}</p></div>`;
}
