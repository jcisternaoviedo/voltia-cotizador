# Cotizador Eléctrico — PWA para cotizar en terreno, ejecutar y cobrar

App web instalable (PWA), HTML + CSS + JavaScript vanilla, sin backend ni compilación. Los datos viven solo en el celular (IndexedDB) y la app funciona sin señal.

## 1. Razonamiento del flujo y decisiones clave

1. La pantalla de inicio es la lista de pendientes, no un menú: borradores, seguimientos vencidos, aceptadas sin programar, trabajos y cobros. Con un toque retomas donde quedaste: nada queda escondido ni a medio hacer sin aviso.
2. Captura rápida en menos de 1 minuto (nombre o teléfono + nota escrita o dictada). Queda como borrador ámbar y la tarjeta dice qué falta ("falta teléfono").
3. Asistente de 5 pasos (Cliente → Ítems → Precio y documento → Fotos → Enviar), con guardado automático en cada cambio (350 ms). El último paso es siempre el botón grande "Enviar por WhatsApp".
4. El total al cliente nunca depende de factura o boleta: el cálculo produce el total y después lo desglosa (neto + IVA, o bruto con retención). Lo que recibes de verdad va en una vista interna que no sale en el PDF.
5. La lógica está separada en capas: `calc.js` es puro (se prueba con Node), `db.js` maneja el almacenamiento con versión de esquema y migraciones, `cotizaciones.js` tiene las reglas de negocio y `screens/` solo la interfaz.
6. El PDF se genera en el teléfono con jsPDF incluido localmente. Si el navegador lo permite se comparte con la Web Share API (Android abre el selector y eliges WhatsApp). Si no, se descarga y se abre wa.me con el texto listo.
7. Una cotización aceptada pasa a orden de trabajo y luego a cobro sin volver a escribir nada: el checklist y la lista de materiales salen de los ítems, y el saldo sale del total.

**Supuestos que tomé (todos editables en Ajustes):** materiales a costo neto + 20% y mano de obra a tarifa plana (ver sección v2). Margen general extra 0%. El recargo por urgencia se aplica sobre la mano de obra. La retención se toma según el año de creación de la cotización. Por defecto se emite boleta. Una cotización aceptada cuenta como "por cobrar" desde que se acepta.

## Versión 2 — modelo del electricista (costo + 20%) e informe técnico

Incorporado a partir de su registro de proyectos (Comercial Paumar, Local Ñuble):

- **Materiales a costo + margen.** Cada ítem guarda el **costo neto de compra** y el **proveedor**. El precio al cliente es costo × (1 + 20%). El 20% se cambia en Ajustes y también por cotización, en el paso 3. Opción: sumar el IVA de compra al costo antes del margen (apagada por defecto).
  Cada cotización guarda su propio margen, así que cambiar Ajustes no altera las cotizaciones ya hechas.
- **Catálogo precargado:** el costo se derivó como precio / 1,2, de modo que los precios al cliente del estudio de mercado no cambian. **Reemplázalos por tus costos reales de factura.**
- **Anexo interno de utilidad** (pasos 3 y 5, y el detalle; nunca en el PDF):

  ```
  Cobras al cliente
  − compra de materiales
  = ganancia antes de impuestos   (mano de obra y recargos + margen de materiales)
  − IVA o retención
  = te queda
  ```

  Incluye el % de utilidad sobre la venta.
- **Lista de compra por proveedor** en la orden de trabajo, con el costo estimado por tienda. Se copia agrupada para mandarla por WhatsApp.
- **Cliente empresa con local o sucursal** (ej. Comercial Paumar · Local Ñuble). Aparece en pendientes, en el historial, en la búsqueda y en los PDF.
- **Informe técnico en PDF** (desde el detalle o la orden de trabajo):
  - Campos dictables: motivo, hallazgos, trabajos ejecutados (se llenan solos con el checklist), recomendaciones y normativa.
  - **Condición en que queda la instalación**, obligatoria. Si no queda "operativa y segura", exige explicar por qué y el PDF la destaca en un recuadro de advertencia.
  - Firmas del instalador y "Recibí conforme e informado" del cliente, más el anexo fotográfico opcional.
- **Migración de datos v1 → v2** automática y probada: los ítems del catálogo existentes reciben su costo sin cambiar su precio. Los respaldos JSON antiguos también se migran al importarlos.

**Alternativa:** si más adelante quieres sincronizar entre varios dispositivos (por ejemplo, celular y notebook, o un ayudante), lo natural es mantener este frontend y cambiar solo `db.js` por Supabase (Postgres + autenticación + almacenamiento de fotos). Para un solo usuario en terreno, IndexedDB más respaldo JSON es más simple, gratis y funciona sin señal.

## 2. Estructura de archivos

```
index.html               Shell de la app
manifest.webmanifest     PWA (nombre, íconos, standalone)
sw.js                    Service worker: red primero, caché de respaldo sin señal
css/tokens.css           Sistema visual (colores, tipografía, tamaños) en un solo lugar
css/app.css              Componentes (usa solo los tokens)
vendor/jspdf.umd.min.js  jsPDF 2.5.1 local
icons/                   Íconos de la app
js/
  app.js                 Arranque + enrutador por hash
  config-defaults.js     Valores por defecto del negocio (tasas, precios, textos)
  config.js              Configuración en localStorage
  seed.js                Catálogo y plantillas iniciales
  db.js                  IndexedDB: esquema versionado, migraciones, respaldo JSON
  calc.js                Cálculos puros (totales, IVA, retención, cobros)
  util.js                CLP, fechas, RUT, teléfonos
  cotizaciones.js        Reglas de negocio: cotizaciones, órdenes, cobros, pendientes
  pdf.js                 Generación del PDF
  whatsapp.js            Mensajes, enlaces wa.me y Web Share API
  envio.js               Flujo "Enviar por WhatsApp" y datos del electricista
  fotos.js               Compresión (máx. 1600 px, JPEG) y almacenamiento
  icons.js               Set de íconos de línea (SVG local)
  ui.js                  Pintar pantallas, avisos, vibración, hoja inferior, dictado
  screens/               inicio, rapida, asistente, detalle, historial,
                         catalogo, orden, cobro, informe, ajustes, comun
tests/calc.test.mjs      Pruebas de cálculo (node tests/calc.test.mjs)
```

## Modelo de datos (esquema v2)

| Store | Campos |
|---|---|
| `clientes` | id, nombre, local, rut, telefono, direccion, comuna, notas, creado, actualizado |
| `catalogo` | id, nombre, categoria, unidad, modo (`unidad`/`hora`/`mat_mo`), precioMO, **costoMat** (neto de compra), precioMat (derivado), **proveedor**, marca (`''`/`desde`/`caso`), nota, activo |
| `plantillas` | id, nombre, items: [{catalogId, cantidad}] |
| `cotizaciones` | id, numero (correlativo), clienteId, estado (`borrador`/`enviada`/`aceptada`/`rechazada`), paso, nota (interna), notaCliente, items: [{id, catalogId, nombre, unidad, modo, marca, cantidad, precioMO, costoMat, precioMat, proveedor}], descuento {tipo `monto`/`pct`, valor}, urgencia, traslado, tipoDoc (`factura`/`boleta`), **margenMatPct, ivaCompraEnCosto** (reglas de precio guardadas), validezDias, condiciones, garantia, incluirFotos, **informe** {fecha, motivo, hallazgos, acciones, recomendaciones, normativa, condicion, condicionDetalle, incluirFotos, enviado}, fechaVisita, creado, actualizado, enviada, respondida, ultimoSeguimiento |
| `fotos` | id, cotizacionId, blob (JPEG), nota, ancho, alto, creado |
| `ordenes` | id, cotizacionId, fechaProgramada, estado (`programada`/`en_ejecucion`/`terminada`), checklist: [{id, texto, hecho}], materiales: [{texto, cantidad, unidad, comprado, proveedor, costoUnit}], notas, creado, actualizado |
| `pagos` | id, cotizacionId, fecha, monto, medio, nota, creado |
| `meta` | schemaVersion, correlativo, ultimoRespaldo, instalado |

El estado del cobro (`pendiente`/`abonada`/`pagada`) y el saldo no se guardan: se calculan a partir del total y los pagos, así nunca quedan desfasados. Las líneas copian el precio del catálogo, de modo que si editas el catálogo después, las cotizaciones antiguas no cambian. **Para cambiar el esquema:** sube `VERSION_ESQUEMA` en `db.js` y agrega `MIGRACIONES[2]`.

## Ejemplo numérico verificado (`node tests/calc.test.mjs`)

Cinco ítems: 3 puntos de enchufe ($135.000), 2 puntos de luz ($80.000), 1 diferencial ($48.000), 2 automáticos ($54.000) y 10 m de canalización ($80.000). Subtotal **$397.000**, descuento 10% (−$39.700).

| | Factura | Boleta de honorarios |
|---|---|---|
| **Total al cliente** | **$357.300** | **$357.300** |
| Desglose en el PDF | Neto $300.252 + IVA 19% $57.048 | Total bruto $357.300 |
| Vista interna | IVA a pagar −$57.048 | Retención 15,25% −$54.488 |
| **Recibes** | **$300.252** | **$302.812** |

El neto es round(357.300 / 1,19) = 300.252 y el IVA se calcula por diferencia, para que siempre cuadre con el total. La retención es round(357.300 × 15,25%) = 54.488. Con urgencia, el recargo es +50% de la mano de obra (ejemplo: MO $40.000 + materiales $10.000 + urgencia $20.000 + traslado $8.000 = $78.000).

## 4. Despliegue gratis con HTTPS e instalación en Android

1. Crea una cuenta en GitHub y un repositorio nuevo, por ejemplo `cotizador`.
2. Sube **todo el contenido de esta carpeta** (index.html en la raíz). Puedes arrastrar los archivos en "Add file → Upload files".
3. En el repositorio: Settings → Pages → Source: "Deploy from a branch", branch `main`, carpeta `/ (root)` → Save.
4. Espera 1 o 2 minutos. La app queda en `https://TU-USUARIO.github.io/cotizador/`.
5. Abre esa URL en **Chrome en el Android**.
6. Menú ⋮ → "Instalar app" (o "Agregar a pantalla principal").
7. Abre la app desde el ícono una vez con internet, para que quede guardada para usarla sin señal.
8. **Cuando publiques cambios:** sube `VERSION` en `sw.js` (ej. `cotizador-v2`). Los teléfonos se actualizan al abrir la app con internet.
9. Para probar en el PC: `python -m http.server 5178` en esta carpeta y abre `http://localhost:5178`. No funciona con doble clic (file://) porque usa módulos ES.
10. Netlify sirve igual: arrastra la carpeta a app.netlify.com/drop.

## 5. Checklist de prueba en el celular

**Etapa 1 — cotizar y enviar**
- [ ] "Nueva cotización" → nombre y nota dictada → "Guardar borrador y volver": aparece ámbar en Pendientes (menos de 1 minuto).
- [ ] Tocar el borrador retoma en el paso donde quedó. Agregar 5 ítems del catálogo y ver el total en vivo.
- [ ] En el paso 3, alternar Factura y Boleta: el total no cambia y la vista interna sí.
- [ ] "Enviar por WhatsApp": la primera vez pide tus datos, se genera el PDF y se abre WhatsApp con el archivo y el texto.
- [ ] Ajustes → Exportar respaldo descarga un JSON. Importarlo restaura todo.

**Etapa 2 — fotos, plantillas, historial**
- [ ] Tomar 2 fotos con nota y ver que aparecen en la galería y en el anexo del PDF.
- [ ] "Usar plantilla → Cambio de tablero" agrega 3 ítems de una vez.
- [ ] Historial: buscar por nombre, filtrar "Enviada", duplicar una cotización.
- [ ] Cerrar la app por completo, activar modo avión, abrirla: los datos siguen ahí.

**Versión 2 — costo + 20% e informe técnico**
- [ ] Catálogo → editar un ítem → cambiar el costo neto: la vista previa muestra el precio al cliente con +20%.
- [ ] En una cotización, cambiar el margen del paso 3 a 25%: los precios de materiales y el anexo de utilidad se actualizan, y el PDF no muestra costos.
- [ ] Asignar proveedores a los ítems y, en la orden de trabajo, ver la lista de compra agrupada por tienda.
- [ ] Hacer un informe técnico con la condición "desconectado por seguridad": exige el detalle y el PDF lo muestra en un recuadro.

**Etapa 3 — ejecutar y cobrar**
- [ ] Marcar una cotización como "Aceptada" → "Crear orden de trabajo": el checklist y los materiales vienen de los ítems.
- [ ] Marcar el checklist en terreno → "Marcar trabajo terminado" lleva al cobro.
- [ ] Registrar un anticipo del 50%: el saldo baja y queda "Abonada". Registrar el resto: "Pagada".
- [ ] Pendientes muestra el total por cobrar y el botón "Recordar pago" abre WhatsApp con el mensaje.

## Preguntas abiertas (no bloquean el uso)

1. **IVA en el 20%:** asumí que el 20% se aplica sobre el costo **sin IVA** (como dice "costo neto"). Si en la práctica compras con boleta y quieres recuperar ese IVA, activa "Sumar el IVA de compra al costo" en Ajustes.
2. **Datos de la empresa (precargados):** Voltia Service · representante Eduardo Hernández Silva · SEC 13722 · +56 9 8157 8573 · ehernandezsilva@hotmail.com. Logo: emblema hexagonal (propuesta B, hecho en Claude Design) en `icons/emblema.png` y `.svg`, usado en los PDF, en el ícono de la app y en la barra de inicio. Falta el RUT de la empresa, que se agrega en Ajustes → Tus datos.
3. **Tarifas pendientes:** instalación de tierra de protección (TP), atención de emergencia y búsqueda de falla oculta en entretecho. No las agregué al catálogo para no inventar precios; se crean en Catálogo → "Agregar servicio".
4. **Urgencia:** el recargo se aplica solo sobre la mano de obra. ¿Lo cobras así o sobre el total?
5. **Condiciones de pago y garantía:** confirma los textos reales en Ajustes.
