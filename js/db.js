// =====================================================================
// db.js — Almacenamiento en IndexedDB (funciona sin conexión).
//
// MODELO DE DATOS — esquema v2 (ver README.md para el detalle de campos)
//   clientes      {id, nombre, local, rut, telefono, direccion, comuna, notas, creado, actualizado}
//   catalogo      {id, nombre, categoria, unidad, modo, precioMO, costoMat, precioMat, proveedor,
//                  marca, nota, activo}        (precioMat = costoMat × (1 + margen), derivado)
//   plantillas    {id, nombre, items:[{catalogId, cantidad}]}
//   cotizaciones  {id, numero, clienteId, estado, paso, nota, notaCliente, items[], descuento,
//                  urgencia, traslado, tipoDoc, margenMatPct, ivaCompraEnCosto, validezDias,
//                  condiciones, garantia, incluirFotos, informe{}, fechaVisita, creado,
//                  actualizado, enviada, respondida, ultimoSeguimiento}
//   fotos         {id, cotizacionId, blob, nota, ancho, alto, creado}
//   ordenes       {id, cotizacionId, fechaProgramada, estado, checklist[], materiales[], notas, creado, actualizado}
//   pagos         {id, cotizacionId, fecha, monto, medio, nota, creado}
//   meta          {clave, valor}   (schemaVersion, correlativo, ultimoRespaldo)
//
// Para cambiar el esquema: subir VERSION_ESQUEMA y agregar una función a MIGRACIONES.
// =====================================================================
import { CATALOGO_INICIAL, PLANTILLAS_INICIALES } from './seed.js';

const NOMBRE_DB = 'cotizador-electrico';
export const VERSION_ESQUEMA = 2;
export const STORES = ['clientes', 'catalogo', 'plantillas', 'cotizaciones', 'fotos', 'ordenes', 'pagos'];

/** Migraciones de estructura (IndexedDB onupgradeneeded). Índice = versión destino. */
const MIGRACIONES = {
  1(db) {
    db.createObjectStore('clientes', { keyPath: 'id' });
    db.createObjectStore('catalogo', { keyPath: 'id' });
    db.createObjectStore('plantillas', { keyPath: 'id' });
    const cot = db.createObjectStore('cotizaciones', { keyPath: 'id' });
    cot.createIndex('estado', 'estado');
    cot.createIndex('clienteId', 'clienteId');
    const f = db.createObjectStore('fotos', { keyPath: 'id' });
    f.createIndex('cotizacionId', 'cotizacionId');
    const o = db.createObjectStore('ordenes', { keyPath: 'id' });
    o.createIndex('cotizacionId', 'cotizacionId');
    const p = db.createObjectStore('pagos', { keyPath: 'id' });
    p.createIndex('cotizacionId', 'cotizacionId');
    db.createObjectStore('meta', { keyPath: 'clave' });
  },
  // v2: modelo costo + margen. Cada ítem del catálogo pasa a guardar su
  // costo neto de compra y proveedor. Se deriva costo = precio / 1,2 para
  // no cambiar los precios al cliente. Las cotizaciones antiguas no se tocan
  // (sus líneas sin costoMat siguen usando su precio fijo).
  2(db, tx) {
    migrarRegistros(tx.objectStore('catalogo'), (c) => {
      if (c.costoMat === undefined) c.costoMat = Math.round((Number(c.precioMat) || 0) / 1.2);
      if (c.proveedor === undefined) c.proveedor = '';
      return c;
    });
  },
};

/** Recorre un store dentro de la transacción de actualización y reescribe cada registro. */
function migrarRegistros(store, fn) {
  store.openCursor().onsuccess = (e) => {
    const cur = e.target.result;
    if (!cur) return;
    cur.update(fn(cur.value));
    cur.continue();
  };
}

/** Migración de un respaldo JSON antiguo (mismas reglas que MIGRACIONES). */
function migrarRespaldo(json) {
  const v = json.schemaVersion || 1;
  if (v < 2) for (const c of json.datos.catalogo || []) {
    if (c.costoMat === undefined) c.costoMat = Math.round((Number(c.precioMat) || 0) / 1.2);
    if (c.proveedor === undefined) c.proveedor = '';
  }
}

let dbPromise = null;

export function abrirDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(NOMBRE_DB, VERSION_ESQUEMA);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      for (let v = e.oldVersion + 1; v <= VERSION_ESQUEMA; v++) MIGRACIONES[v]?.(db, req.transaction);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function promesa(req) {
  return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
}

async function tx(store, modo = 'readonly') {
  const db = await abrirDB();
  return db.transaction(store, modo).objectStore(store);
}

export async function todos(store) { return promesa((await tx(store)).getAll()); }
export async function obtener(store, id) { return id == null ? undefined : promesa((await tx(store)).get(id)); }
export async function guardar(store, obj) { await promesa((await tx(store, 'readwrite')).put(obj)); return obj; }
export async function borrar(store, id) { return promesa((await tx(store, 'readwrite')).delete(id)); }
export async function porIndice(store, indice, valor) {
  return promesa((await tx(store)).index(indice).getAll(valor));
}
export async function limpiar(store) { return promesa((await tx(store, 'readwrite')).clear()); }

export async function getMeta(clave, defecto = null) {
  const r = await obtener('meta', clave);
  return r ? r.valor : defecto;
}
export async function setMeta(clave, valor) { return guardar('meta', { clave, valor }); }

/** Número correlativo de cotización. */
export async function siguienteNumero() {
  const n = (await getMeta('correlativo', 0)) + 1;
  await setMeta('correlativo', n);
  return n;
}

/** Primera carga: precarga catálogo y plantillas. */
export async function inicializar() {
  await abrirDB();
  const version = await getMeta('schemaVersion');
  if (version == null) {
    for (const c of CATALOGO_INICIAL) await guardar('catalogo', c);
    for (const p of PLANTILLAS_INICIALES) await guardar('plantillas', p);
    await setMeta('schemaVersion', VERSION_ESQUEMA);
    await setMeta('instalado', Date.now());
  } else if (version !== VERSION_ESQUEMA) {
    await setMeta('schemaVersion', VERSION_ESQUEMA); // estructura ya migrada en onupgradeneeded
  }
}

// ---------------- Respaldo JSON ----------------
const blobADataUrl = (blob) => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob);
});
const dataUrlABlob = async (url) => (await fetch(url)).blob();

export async function exportarTodo(config) {
  const datos = {};
  for (const s of STORES) datos[s] = await todos(s);
  for (const f of datos.fotos) { f.blob = await blobADataUrl(f.blob); }
  const meta = await todos('meta');
  return { app: 'cotizador-electrico', schemaVersion: VERSION_ESQUEMA, exportado: new Date().toISOString(), config, meta, datos };
}

/** Importa un respaldo reemplazando todos los datos actuales. */
export async function importarTodo(json) {
  if (!json || json.app !== 'cotizador-electrico' || !json.datos) throw new Error('El archivo no es un respaldo de esta app.');
  if ((json.schemaVersion || 1) > VERSION_ESQUEMA) throw new Error('El respaldo es de una versión más nueva de la app. Actualízala primero.');
  migrarRespaldo(json);
  for (const s of STORES) {
    await limpiar(s);
    for (const obj of json.datos[s] || []) {
      if (s === 'fotos' && typeof obj.blob === 'string') obj.blob = await dataUrlABlob(obj.blob);
      await guardar(s, obj);
    }
  }
  await limpiar('meta');
  for (const m of json.meta || []) await guardar('meta', m);
  await setMeta('schemaVersion', VERSION_ESQUEMA);
  return json.config || null;
}
