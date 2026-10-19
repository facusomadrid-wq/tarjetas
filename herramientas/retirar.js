#!/usr/bin/env node
/*
 * Retira una tarjeta: borra su carpeta del sitio.
 *
 *   node herramientas/retirar.js <slug>
 *
 * Al publicarse el cambio, la dirección devuelve 404. En los móviles que la tenían
 * guardada, el service worker lo detecta al abrirla con conexión, borra su copia,
 * se da de baja y muestra «Esta tarjeta ya no está vigente».
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { RAIZ_REPO, plantilla, esCarpetaDeTarjeta } = require('./comun.js');

function retirar(slug, { raiz = RAIZ_REPO } = {}) {
  if (!slug) throw new Error('Uso: node herramientas/retirar.js <slug>');
  if (!plantilla.slugValido(slug)) throw new Error(`Slug no válido o reservado: «${slug}».`);
  const carpeta = path.join(raiz, slug);
  if (!fs.existsSync(carpeta)) throw new Error(`No existe la tarjeta «${slug}».`);
  if (!esCarpetaDeTarjeta(carpeta)) throw new Error(`«${slug}/» no es una carpeta de tarjeta: no se borra.`);
  fs.rmSync(carpeta, { recursive: true, force: true });
  return carpeta;
}

if (require.main === module) {
  try {
    const carpeta = retirar(process.argv[2]);
    console.log(`Tarjeta retirada: ${path.relative(RAIZ_REPO, carpeta)}/ borrada.`);
    console.log('Publica el cambio para que deje de estar disponible.');
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { retirar };
