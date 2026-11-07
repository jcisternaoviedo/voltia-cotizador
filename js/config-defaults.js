// =====================================================================
// config-defaults.js — Valores por defecto del negocio. TODO es editable
// desde Ajustes; aquí solo están los valores iniciales.
// =====================================================================

export const CONFIG_DEFECTO = {
  // Impuestos
  ivaPct: 19,
  retenciones: { 2026: 15.25, 2027: 16, 2028: 17 }, // boleta de honorarios, por año
  tipoDocDefecto: 'boleta',

  // Precios
  margenMatPct: 20,         // margen sobre el costo neto de compra de materiales
  ivaCompraEnCosto: false,  // true = suma el IVA de compra al costo antes del margen
  margenPct: 0,             // margen general extra sobre todo (normalmente 0)
  urgenciaPct: 50,       // sobre la mano de obra
  trasladoMonto: 8000,   // fuera de zona

  // Seguimiento y respaldo
  diasSeguimiento: 3,
  diasRespaldo: 7,

  // Documento
  validezDias: 15,
  condicionesPago: '50% de anticipo para iniciar y 50% al término. Transferencia o efectivo.',
  garantia: 'Garantía de 6 meses en mano de obra. Materiales según garantía del fabricante.',

  // Datos de la empresa (precargados; editables en Ajustes → Tus datos)
  negocio: {
    nombre: 'Voltia Service',
    representante: 'Eduardo Hernández Silva',
    rut: '',
    telefono: '981578573',
    correo: 'ehernandezsilva@hotmail.com',
    sec: '13722',
    logo: 'icons/emblema.png', // emblema propuesta B (Claude Design); se reemplaza en Ajustes
  },

  tema: 'claro',
};
