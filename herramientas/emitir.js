#!/usr/bin/env node
/*
 * Emite (o actualiza) una tarjeta de visita.
 *
 *   node herramientas/emitir.js /ruta/fuera/del/repo/persona.json
 *
 * El JSON contiene: nombre, cargo, telefono (opcional), correo (opcional),
 * consentimiento (AAAA-MM-DD, obligatorio) y slug (opcional).
 * El archivo JSON debe estar FUERA del repositorio: es la prueba del consentimiento
 * y no se publica. Solo el administrador emite tarjetas.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { RAIZ_REPO, plantilla, versionRecursos, estaDentroDelRepo, escribirTarjeta } = require('./comun.js');

function emitir(rutaJson, { raiz = RAIZ_REPO, hoy } = {}) {
  if (!rutaJson) throw new Error('Uso: node herramientas/emitir.js <ruta-json-fuera-del-repo>');
  const ruta = path.resolve(rutaJson);
  if (!fs.existsSync(ruta)) throw new Error(`No existe el archivo: ${ruta}`);
  if (estaDentroDelRepo(ruta, raiz)) {
    throw new Error('El JSON con los datos de la persona debe estar fuera del repositorio (no se puede publicar).');
  }
  let datos;
  try {
    datos = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  } catch (error) {
    throw new Error(`El archivo no es un JSON válido: ${error.message}`);
  }
  if (!datos || typeof datos !== 'object' || !datos.consentimiento) {
    throw new Error('Falta la fecha de consentimiento («consentimiento»: "AAAA-MM-DD"). Sin consentimiento no se emite la tarjeta.');
  }
  const opciones = { versionRecursos: versionRecursos(raiz), hoy };
  const validacion = plantilla.validarDatos(datos, opciones);
  if (!validacion.ok) {
    throw new Error('Datos no válidos:\n- ' + validacion.errores.join('\n- '));
  }
  const archivos = plantilla.generarTarjeta(datos, opciones);
  const carpeta = escribirTarjeta(validacion.datos.slug, archivos, raiz);
  return { slug: validacion.datos.slug, url: validacion.datos.url, carpeta };
}

if (require.main === module) {
  try {
    const r = emitir(process.argv[2]);
    console.log(`Tarjeta emitida en ${path.relative(RAIZ_REPO, r.carpeta)}/`);
    console.log(`Enlace (cuando se publique): ${r.url}`);
    console.log('Revisa los cambios con «git status» y «git diff» antes de publicar.');
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { emitir };
