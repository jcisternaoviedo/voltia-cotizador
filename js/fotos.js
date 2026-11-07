// =====================================================================
// fotos.js — Captura, compresión (máx. 1600 px, JPEG) y almacenamiento.
// =====================================================================
import * as db from './db.js';
import { uid } from './util.js';

const MAX_LADO = 1600;
const CALIDAD = 0.75;

/** Comprime un archivo de imagen a JPEG de máximo 1600 px por lado. */
export async function comprimir(archivo) {
  const bmp = await createImageBitmap(archivo, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(archivo));
  const escala = Math.min(1, MAX_LADO / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * escala), h = Math.round(bmp.height * escala);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', CALIDAD));
  return { blob, ancho: w, alto: h };
}

export async function agregarFoto(cotizacionId, archivo) {
  const { blob, ancho, alto } = await comprimir(archivo);
  return db.guardar('fotos', { id: uid(), cotizacionId, blob, nota: '', ancho, alto, creado: Date.now() });
}

export async function fotosDe(cotizacionId) {
  return (await db.porIndice('fotos', 'cotizacionId', cotizacionId)).sort((a, b) => a.creado - b.creado);
}

export async function copiarFotos(desdeId, haciaId) {
  for (const f of await fotosDe(desdeId)) await db.guardar('fotos', { ...f, id: uid(), cotizacionId: haciaId });
}

/** Blob → dataURL (para el PDF). */
export function aDataUrl(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
}

/** Redimensiona un logo a máx. 400 px y lo devuelve como dataURL PNG (va en la configuración). */
export async function procesarLogo(archivo) {
  const bmp = await createImageBitmap(archivo);
  const escala = Math.min(1, 400 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * escala); canvas.height = Math.round(bmp.height * escala);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}
