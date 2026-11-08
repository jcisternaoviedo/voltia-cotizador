// =====================================================================
// respaldo.js — Respaldo con un toque.
// Genera el archivo con TODOS los datos (incluidas fotos) y abre el menú
// "Compartir" del teléfono para mandarlo a WhatsApp (ej. a uno mismo),
// Google Drive o correo. Si el navegador no permite compartir archivos,
// lo descarga.
//
// Nota: Chrome en Android no deja compartir archivos .json, por eso el
// respaldo se guarda como .txt (el contenido sigue siendo JSON y la app
// lo importa igual).
// =====================================================================
import { exportarTodo, setMeta } from './db.js';
import { getConfig } from './config.js';
import { fechaISO } from './util.js';
import { descargar } from './ui.js';

/**
 * Crea el respaldo y lo comparte o descarga.
 * @returns {'compartido'|'descargado'|'cancelado'}
 */
export async function hacerRespaldo() {
  const json = await exportarTodo(getConfig());
  const nombre = `respaldo-voltia-${fechaISO()}.txt`;
  const archivo = new File([JSON.stringify(json)], nombre, { type: 'text/plain' });
  const tam = archivo.size < 1048576
    ? `${Math.max(1, Math.round(archivo.size / 1024))} KB`
    : `${(archivo.size / 1048576).toFixed(1).replace('.', ',')} MB`;

  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({
        files: [archivo],
        title: 'Respaldo Voltia',
        text: `Respaldo del cotizador Voltia (${fechaISO()}, ${tam}). Guárdalo: sirve para recuperar todo en Ajustes → Importar.`,
      });
      await setMeta('ultimoRespaldo', Date.now());
      return 'compartido';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelado';
      // Otro error al compartir: se descarga como respaldo de emergencia.
    }
  }
  descargar(archivo, nombre);
  await setMeta('ultimoRespaldo', Date.now());
  return 'descargado';
}
