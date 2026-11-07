// =====================================================================
// app.js — Arranque, enrutador por hash y service worker.
//
// Rutas:
//   #/                     Pendientes (inicio)
//   #/rapida               Captura rápida
//   #/cot/:id/paso/:n      Asistente de cotización (pasos 1–5)
//   #/cot/:id              Detalle de cotización
//   #/historial            Historial
//   #/catalogo             Catálogo y plantillas
//   #/ajustes              Ajustes y respaldo
//   #/orden/:id            Orden de trabajo
//   #/cobro/:cotId         Cobro
//   #/informe/:cotId       Informe técnico
// =====================================================================
import { inicializar } from './db.js';
import { getConfig } from './config.js';
import { ciclo, aviso } from './ui.js';
import { pantallaInicio } from './screens/inicio.js';
import { pantallaRapida } from './screens/rapida.js';
import { pantallaAsistente } from './screens/asistente.js';
import { pantallaDetalle } from './screens/detalle.js';
import { pantallaHistorial } from './screens/historial.js';
import { pantallaCatalogo } from './screens/catalogo.js';
import { pantallaAjustes } from './screens/ajustes.js';
import { pantallaOrden } from './screens/orden.js';
import { pantallaCobro } from './screens/cobro.js';
import { pantallaInforme } from './screens/informe.js';

export function aplicarTema() {
  document.documentElement.dataset.theme = getConfig().tema === 'oscuro' ? 'oscuro' : 'claro';
}

const RUTAS = [
  [/^\/$/, () => pantallaInicio()],
  [/^\/rapida$/, () => pantallaRapida()],
  [/^\/cot\/([\w-]+)\/paso\/(\d)$/, (m) => pantallaAsistente(m[1], m[2])],
  [/^\/cot\/([\w-]+)$/, (m) => pantallaDetalle(m[1])],
  [/^\/historial$/, () => pantallaHistorial()],
  [/^\/catalogo$/, () => pantallaCatalogo()],
  [/^\/ajustes$/, (m, q) => pantallaAjustes(q)],
  [/^\/orden\/([\w-]+)$/, (m) => pantallaOrden(m[1])],
  [/^\/cobro\/([\w-]+)$/, (m) => pantallaCobro(m[1])],
  [/^\/informe\/([\w-]+)$/, (m) => pantallaInforme(m[1])],
];

async function enrutar() {
  // Hook de salida de la pantalla anterior (ej.: borrador sin enviar)
  const [ruta, query = ''] = (location.hash.slice(1) || '/').split('?');
  if (ciclo.alSalir) { const f = ciclo.alSalir; ciclo.alSalir = null; try { await f(ruta); } catch (e) { console.error(e); } }
  document.getElementById('hoja')?.remove(); document.getElementById('hoja-fondo')?.remove();
  const params = new URLSearchParams(query);
  for (const [re, fn] of RUTAS) {
    const m = ruta.match(re);
    if (m) {
      try { await fn(m, params); } catch (e) { console.error(e); aviso('Ocurrió un error al abrir la pantalla'); }
      return;
    }
  }
  location.hash = '#/';
}

async function arrancar() {
  aplicarTema();
  try { await inicializar(); } catch (e) {
    console.error(e);
    document.getElementById('app').innerHTML = '<main><h2>No se pudo abrir la base de datos</h2><p>Revisa que el navegador no esté en modo incógnito.</p></main>';
    return;
  }
  window.addEventListener('hashchange', enrutar);
  await enrutar();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW no registrado', e));
  }
  // Pide almacenamiento persistente para que Android no borre los datos
  navigator.storage?.persist?.().catch(() => {});
}

arrancar();
