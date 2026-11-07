// Pruebas de cálculo:  node tests/calc.test.mjs
import assert from 'node:assert/strict';
import { calcularCotizacion, estadoCobro, tasaRetencion } from '../js/calc.js';
import { validarRut, telWa, clp } from '../js/util.js';
import { CONFIG_DEFECTO } from '../js/config-defaults.js';

const cfg = { ...CONFIG_DEFECTO };

// Ejemplo numérico del README: 5 ítems, 10% de descuento, sin urgencia ni traslado.
const items = [
  { nombre: 'Punto de enchufe nuevo', cantidad: 3, precioMO: 25000, precioMat: 20000 }, // 135.000
  { nombre: 'Punto de luz nuevo', cantidad: 2, precioMO: 25000, precioMat: 15000 },     //  80.000
  { nombre: 'Diferencial 2x25A', cantidad: 1, precioMO: 20000, precioMat: 28000 },      //  48.000
  { nombre: 'Automático', cantidad: 2, precioMO: 18000, precioMat: 9000 },              //  54.000
  { nombre: 'Canalización', cantidad: 10, precioMO: 5000, precioMat: 3000 },            //  80.000
];
const base = { items, descuento: { tipo: 'pct', valor: 10 }, creado: new Date('2026-11-07').getTime() };

const f = calcularCotizacion({ ...base, tipoDoc: 'factura' }, cfg);
const b = calcularCotizacion({ ...base, tipoDoc: 'boleta' }, cfg);

assert.equal(f.base, 397000);
assert.equal(f.descuento, 39700);
assert.equal(f.total, 357300);
assert.equal(b.total, f.total, 'el total al cliente es idéntico con factura o boleta');
assert.equal(f.factura.neto + f.factura.iva, f.total);
assert.equal(f.factura.neto, 300252);
assert.equal(f.factura.iva, 57048);
assert.equal(b.boleta.retencion, 54488);
assert.equal(b.boleta.liquido, 302812);
assert.equal(f.recibe, 300252);
assert.equal(b.recibe, 302812);

// Urgencia (+50% sobre MO) y traslado
const u = calcularCotizacion({ items: [{ cantidad: 1, precioMO: 40000, precioMat: 10000 }], urgencia: true, traslado: true, tipoDoc: 'boleta' }, cfg);
assert.equal(u.urgencia, 20000);
assert.equal(u.traslado, 8000);
assert.equal(u.total, 78000);

// Descuento nunca mayor al subtotal
assert.equal(calcularCotizacion({ items: [{ cantidad: 1, precioMO: 1000, precioMat: 0 }], descuento: { tipo: 'monto', valor: 5000 } }, cfg).total, 0);

// Retención por año
assert.equal(tasaRetencion(cfg.retenciones, 2026), 15.25);
assert.equal(tasaRetencion(cfg.retenciones, 2027), 16);
assert.equal(tasaRetencion(cfg.retenciones, 2030), 17);

// Cobros
assert.deepEqual(estadoCobro(100000, []), { pagado: 0, saldo: 100000, estado: 'pendiente' });
assert.equal(estadoCobro(100000, [{ monto: 40000 }]).estado, 'abonada');
assert.equal(estadoCobro(100000, [{ monto: 40000 }, { monto: 60000 }]).estado, 'pagada');

// Modelo costo + 20% sobre materiales
import { precioDesdeCosto, reglasMateriales, aplicarReglas, calcularUtilidad } from '../js/calc.js';
const reglas = reglasMateriales({}, cfg);
assert.equal(reglas.margenMatPct, 20);
assert.equal(precioDesdeCosto(10000, reglas), 12000);
assert.equal(precioDesdeCosto(10000, { ...reglas, ivaCompraEnCosto: true }), 14280); // 10.000 × 1,19 × 1,2
// El catálogo precargado mantiene sus precios de referencia (costo = precio / 1,2)
for (const p of [20000, 15000, 5000, 9000, 28000, 90000, 3000, 65000]) assert.equal(precioDesdeCosto(Math.round(p / 1.2), reglas), p);

// Cotización: tablero (costo mat. 75.000) + 2 enchufes (costo 16.667 c/u), boleta
const cotU = {
  tipoDoc: 'boleta', creado: new Date('2026-11-07').getTime(), margenMatPct: 20,
  items: [
    { nombre: 'Tablero', cantidad: 1, precioMO: 120000, costoMat: 75000 },
    { nombre: 'Enchufe', cantidad: 2, precioMO: 25000, costoMat: 16667 },
  ],
};
aplicarReglas(cotU.items, reglasMateriales(cotU, cfg));
assert.equal(cotU.items[0].precioMat, 90000);
const tU = calcularCotizacion(cotU, cfg);
assert.equal(tU.total, 300000); // MO 170.000 + materiales 130.000 (90.000 + 2 × 20.000)
const uU = calcularUtilidad(cotU, tU, cfg);
assert.equal(uU.costoMateriales, 108334);
assert.equal(uU.margenMateriales, 21666);
assert.equal(uU.utilidad, tU.recibe - 108334); // líquido − costo de materiales
// Si cambia el margen de la cotización, se recalculan los precios
cotU.margenMatPct = 30; aplicarReglas(cotU.items, reglasMateriales(cotU, cfg));
assert.equal(cotU.items[0].precioMat, 97500);

// RUT y teléfono
assert.ok(validarRut('11.111.111-1'));
assert.ok(validarRut('76.086.428-5'));
assert.ok(!validarRut('12.345.678-9'));
assert.equal(telWa('9 1234 5678'), '56912345678');
assert.equal(telWa('+56 9 1234 5678'), '56912345678');
assert.equal(clp(1234567), '$1.234.567');

console.log('Factura:', { total: clp(f.total), neto: clp(f.factura.neto), iva: clp(f.factura.iva), recibe: clp(f.recibe) });
console.log('Boleta :', { total: clp(b.total), retencion: clp(b.boleta.retencion), liquido: clp(b.recibe) });
console.log('OK — todas las pruebas de cálculo pasaron');
