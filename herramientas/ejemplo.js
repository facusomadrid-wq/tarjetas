#!/usr/bin/env node
/*
 * Regenera la tarjeta de ejemplo (datos totalmente ficticios) en ejemplo/.
 *   npm run ejemplo
 */
'use strict';

const { RAIZ_REPO, plantilla, versionRecursos, escribirTarjeta } = require('./comun.js');

// Datos ficticios: no corresponden a ninguna persona.
const DATOS_EJEMPLO = Object.freeze({
  nombre: 'Nombre Ejemplo',
  cargo: 'Delegado sindical',
  telefono: '600 000 000',
  correo: 'ejemplo@example.org',
  consentimiento: '2026-01-01',
  slug: 'ejemplo'
});

function generarEjemplo(raiz = RAIZ_REPO) {
  const archivos = plantilla.generarTarjeta(DATOS_EJEMPLO, { versionRecursos: versionRecursos(raiz) });
  return { archivos, carpeta: escribirTarjeta('ejemplo', archivos, raiz) };
}

if (require.main === module) {
  generarEjemplo();
  console.log('Tarjeta de ejemplo regenerada en ejemplo/.');
}

module.exports = { DATOS_EJEMPLO, generarEjemplo };
