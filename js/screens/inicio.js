// =====================================================================
// Pantalla de inicio = PENDIENTES (no un menú). Ordenado por urgencia.
// Un toque en la tarjeta retoma exactamente donde quedó.
// =====================================================================
import { pintar, ir, h, $$, aviso, checkOk, vacio } from '../ui.js';
import { icono } from '../icons.js';
import { clp, fechaCorta, telBonito } from '../util.js';
import { calcularPendientes, cargarCotizacion, cambiarEstado, guardarCotizacion, faltantes, crearOrden } from '../cotizaciones.js';
import { abrirWa, textoSeguimiento, textoRecordatorioPago } from '../whatsapp.js';
import { totales } from '../cotizaciones.js';

const ESTILO = {
  enviar: ['e-enviar', 'file'], segui: ['e-segui', 'clock'], trabajo: ['e-segui', 'tool'],
  cobrar: ['e-cobrar', 'wallet'], listo: ['e-listo', 'check'],
};

function tarjeta({ tipo, nombre, detalle, etiqueta, ruta, acciones = '', destacada = false }) {
  const [clase, ic] = ESTILO[tipo];
  return `<div class="tarjeta-wrap">
    <button class="tarjeta ${destacada ? 'destacada' : ''}" data-ir="${ruta}">
      <span class="ico-estado ${clase}">${icono(ic)}</span>
      <span class="cuerpo"><div class="nombre">${h(nombre)}</div><div class="detalle">${detalle}</div></span>
      <span class="etiqueta ${clase}">${h(etiqueta)}</span>
    </button>${acciones ? `<div class="acciones">${acciones}</div>` : ''}</div>`;
}

const nombreCli = (c) => (c.nombre ? c.nombre + (c.local ? ` · ${c.local}` : '') : telBonito(c.telefono) || 'Cliente sin nombre');

export async function pantallaInicio() {
  const p = await calcularPendientes();
  const nPend = p.borradores.length + p.seguimientos.length + p.sinOrden.length + p.trabajos.length + p.cobros.length;

  let html = `<div class="panel resumen-cobro">
      <div><div class="chico">Total por cobrar</div><div class="monto">${clp(p.porCobrar)}</div></div>
      ${icono('wallet', 32)}
    </div>`;

  if (p.respaldoVencido) {
    html += `<button class="tarjeta destacada" data-ir="#/ajustes?respaldo=1">
      <span class="ico-estado e-neutro"><span class="alerta-ico">${icono('alert')}</span></span>
      <span class="cuerpo"><div class="nombre">Haz un respaldo</div><div class="detalle">${p.ultimoRespaldo ? 'Último hace más de una semana' : 'Aún no tienes respaldo de tus datos'}</div></span>
      <span class="etiqueta e-neutro">Respaldar</span></button>`;
  }

  if (!nPend) html += vacio('Todo al día', 'No tienes cotizaciones ni cobros pendientes.', 'party');

  if (p.borradores.length) {
    html += `<div class="seccion-titulo">Por enviar (${p.borradores.length})</div>`;
    for (const b of p.borradores) {
      const falta = faltantes(b.cot, b.cliente);
      html += tarjeta({
        tipo: 'enviar', nombre: nombreCli(b.cliente), destacada: true,
        detalle: `N° ${b.cot.numero} · ${b.cot.items.length ? clp(b.total) : 'sin ítems'}${falta.length ? ' · falta ' + h(falta[0]) : ''}`,
        etiqueta: `Paso ${b.cot.paso || 1} de 5`, ruta: `#/cot/${b.cot.id}/paso/${b.cot.paso || 1}`,
      });
    }
  }
  if (p.seguimientos.length) {
    html += `<div class="seccion-titulo">Seguimiento sugerido (${p.seguimientos.length})</div>`;
    for (const s of p.seguimientos) {
      html += tarjeta({
        tipo: 'segui', nombre: nombreCli(s.cliente), ruta: `#/cot/${s.cot.id}`,
        detalle: `N° ${s.cot.numero} · ${clp(s.total)} · enviada hace ${s.dias} días`, etiqueta: 'Sin respuesta',
        acciones: `<button class="btn btn-primario" data-seguir="${s.cot.id}">${icono('whatsapp', 20)}Enviar seguimiento</button>
          <button class="btn" data-estado="aceptada" data-id="${s.cot.id}">${icono('check', 20)}Aceptada</button>
          <button class="btn" data-estado="rechazada" data-id="${s.cot.id}">${icono('x', 20)}Rechazada</button>`,
      });
    }
  }
  if (p.sinOrden.length) {
    html += `<div class="seccion-titulo">Aceptadas: programar trabajo (${p.sinOrden.length})</div>`;
    for (const s of p.sinOrden) {
      html += tarjeta({
        tipo: 'trabajo', nombre: nombreCli(s.cliente), ruta: `#/cot/${s.cot.id}`,
        detalle: `N° ${s.cot.numero} · ${clp(s.total)}`, etiqueta: 'Aceptada',
        acciones: `<button class="btn btn-primario" data-orden="${s.cot.id}">${icono('calendar', 20)}Crear orden de trabajo</button>`,
      });
    }
  }
  if (p.trabajos.length) {
    html += `<div class="seccion-titulo">Trabajos (${p.trabajos.length})</div>`;
    for (const t of p.trabajos) {
      const hechos = t.ot.checklist.filter((c) => c.hecho).length;
      html += tarjeta({
        tipo: 'trabajo', nombre: nombreCli(t.cliente), ruta: `#/orden/${t.ot.id}`,
        detalle: `${fechaCorta(t.ot.fechaProgramada)} · ${hechos}/${t.ot.checklist.length} listos`,
        etiqueta: t.ot.estado === 'en_ejecucion' ? 'En ejecución' : 'Programado',
      });
    }
  }
  if (p.cobros.length) {
    html += `<div class="seccion-titulo">Por cobrar (${p.cobros.length})</div>`;
    for (const c of p.cobros) {
      html += tarjeta({
        tipo: 'cobrar', nombre: nombreCli(c.cliente), ruta: `#/cobro/${c.cot.id}`,
        detalle: `Saldo ${clp(c.saldo)} de ${clp(c.total)}${c.ot?.estado === 'terminada' ? ' · trabajo terminado' : ''}`,
        etiqueta: c.estado === 'abonada' ? 'Abonada' : 'Pendiente',
        acciones: c.ot?.estado === 'terminada'
          ? `<button class="btn" data-recordar="${c.cot.id}">${icono('whatsapp', 20)}Recordar pago</button>` : '',
      });
    }
  }

  const main = pintar({
    titulo: 'Pendientes', marca: true,
    botonesBarra: `
      <button class="btn-ico" data-ir="#/historial" aria-label="Historial">${icono('history')}</button>
      <button class="btn-ico" data-ir="#/catalogo" aria-label="Catálogo">${icono('list')}</button>
      <button class="btn-ico" data-ir="#/ajustes" aria-label="Ajustes">${icono('settings')}</button>`,
    cuerpo: html,
    principal: { texto: 'Nueva cotización', icono: 'plus', id: 'btn-nueva' },
  });

  $$('[data-ir]').forEach((b) => (b.onclick = () => ir(b.dataset.ir)));
  document.getElementById('btn-nueva').onclick = () => ir('#/rapida');

  $$('[data-seguir]', main).forEach((b) => (b.onclick = async () => {
    const { cot, cliente } = await cargarCotizacion(b.dataset.seguir);
    abrirWa(cliente.telefono, textoSeguimiento(cot, cliente, totales(cot)));
    cot.ultimoSeguimiento = Date.now();
    await guardarCotizacion(cot);
    checkOk(); aviso('Seguimiento enviado'); pantallaInicio();
  }));
  $$('[data-estado]', main).forEach((b) => (b.onclick = async () => {
    const { cot } = await cargarCotizacion(b.dataset.id);
    await cambiarEstado(cot, b.dataset.estado);
    checkOk(); aviso(b.dataset.estado === 'aceptada' ? '¡Aceptada! Ahora programa el trabajo' : 'Marcada como rechazada');
    pantallaInicio();
  }));
  $$('[data-orden]', main).forEach((b) => (b.onclick = async () => {
    const { cot } = await cargarCotizacion(b.dataset.orden);
    const ot = await crearOrden(cot);
    ir(`#/orden/${ot.id}`);
  }));
  $$('[data-recordar]', main).forEach((b) => (b.onclick = async () => {
    const { cot, cliente } = await cargarCotizacion(b.dataset.recordar);
    const c = (await calcularPendientes()).cobros.find((x) => x.cot.id === cot.id);
    abrirWa(cliente.telefono, textoRecordatorioPago(cot, cliente, c?.saldo || 0));
    aviso('Recordatorio listo en WhatsApp');
  }));
}
