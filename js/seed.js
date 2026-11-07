// =====================================================================
// seed.js — Catálogo y plantillas precargadas (estudio de mercado
// Santiago, nov. 2026). Solo se usan la PRIMERA vez; luego todo se edita
// desde la app y vive en IndexedDB.
//
// modo de cobro:
//   'unidad'  → precio fijo por punto/unidad (MO + materiales como paquete)
//   'hora'    → valor hora × horas (cantidad = horas)
//   'mat_mo'  → materiales + mano de obra por separado
// marca: '' | 'desde' | 'caso' (cotizar caso a caso)
// =====================================================================

export const CATALOGO_INICIAL = [
  { id: 'c-visita', nombre: 'Visita técnica y diagnóstico', categoria: 'Revisión y fallas', unidad: 'visita', modo: 'unidad', precioMO: 25000, precioMat: 0, nota: 'Se descuenta si el cliente acepta la cotización.' },
  { id: 'c-hora', nombre: 'Hora de trabajo', categoria: 'Revisión y fallas', unidad: 'hora', modo: 'hora', precioMO: 40000, precioMat: 0 },
  { id: 'c-cambio-enchufe', nombre: 'Cambio de enchufe o interruptor existente', categoria: 'Enchufes e interruptores', unidad: 'unidad', modo: 'mat_mo', precioMO: 15000, precioMat: 5000 },
  { id: 'c-punto-enchufe', nombre: 'Punto de enchufe nuevo, a la vista, hasta 5 m', categoria: 'Enchufes e interruptores', unidad: 'punto', modo: 'unidad', precioMO: 25000, precioMat: 20000 },
  { id: 'c-punto-luz', nombre: 'Punto de luz nuevo con interruptor, hasta 5 m', categoria: 'Iluminación', unidad: 'punto', modo: 'unidad', precioMO: 25000, precioMat: 15000 },
  { id: 'c-lampara', nombre: 'Instalar lámpara o luminaria del cliente', categoria: 'Iluminación', unidad: 'unidad', modo: 'unidad', precioMO: 20000, precioMat: 0 },
  { id: 'c-automatico', nombre: 'Instalar o cambiar automático', categoria: 'Protecciones', unidad: 'unidad', modo: 'mat_mo', precioMO: 18000, precioMat: 9000 },
  { id: 'c-diferencial', nombre: 'Instalar o cambiar diferencial 2x25A 30mA', categoria: 'Protecciones', unidad: 'unidad', modo: 'mat_mo', precioMO: 20000, precioMat: 28000 },
  { id: 'c-tablero', nombre: 'Cambio de tablero residencial 12 módulos', categoria: 'Tableros', unidad: 'tablero', modo: 'mat_mo', precioMO: 120000, precioMat: 90000 },
  { id: 'c-canalizacion', nombre: 'Canalización y cableado', categoria: 'Canalización', unidad: 'metro', modo: 'mat_mo', precioMO: 5000, precioMat: 3000 },
  { id: 'c-circuito', nombre: 'Circuito dedicado hasta 15 m', categoria: 'Circuitos dedicados', unidad: 'circuito', modo: 'mat_mo', precioMO: 80000, precioMat: 65000 },
  { id: 'c-sec', nombre: 'Certificación SEC TE1', categoria: 'Certificación SEC', unidad: 'trámite', modo: 'unidad', precioMO: 160000, precioMat: 0 },
  { id: 'c-empalme', nombre: 'Aumento de capacidad o empalme', categoria: 'Empalme', unidad: 'proyecto', modo: 'unidad', precioMO: 950000, precioMat: 0, marca: 'caso' },
  { id: 'c-cargador', nombre: 'Instalación de cargador de auto eléctrico, sin equipo', categoria: 'Circuitos dedicados', unidad: 'proyecto', modo: 'unidad', precioMO: 550000, precioMat: 0, marca: 'desde' },
].map((c) => ({
  marca: '', nota: '', activo: true, proveedor: '',
  // Modelo costo + 20%: el costo neto se deriva del precio de referencia
  // (costo = precio / 1,2) para que el precio al cliente no cambie.
  costoMat: Math.round((c.precioMat || 0) / 1.2),
  ...c,
}));

/** Proveedores habituales del electricista (sugerencias en los formularios). */
export const PROVEEDORES = ['Sodimac', 'Easy', 'Gobantes', 'Dartel', 'Electricidad Guzmán', 'Ferretería DAB', 'Dimaco'];

export const PLANTILLAS_INICIALES = [
  { id: 'p-5-enchufes', nombre: 'Instalación de 5 enchufes', items: [{ catalogId: 'c-punto-enchufe', cantidad: 5 }, { catalogId: 'c-automatico', cantidad: 1 }] },
  { id: 'p-tablero', nombre: 'Cambio de tablero residencial', items: [
    { catalogId: 'c-tablero', cantidad: 1 }, { catalogId: 'c-diferencial', cantidad: 2 }, { catalogId: 'c-automatico', cantidad: 4 }] },
  { id: 'p-cargador', nombre: 'Cargador de auto + certificación', items: [
    { catalogId: 'c-cargador', cantidad: 1 }, { catalogId: 'c-circuito', cantidad: 1 }, { catalogId: 'c-sec', cantidad: 1 }] },
  { id: 'p-falla', nombre: 'Revisión de falla (2 horas)', items: [{ catalogId: 'c-visita', cantidad: 1 }, { catalogId: 'c-hora', cantidad: 2 }] },
];
