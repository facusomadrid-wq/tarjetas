/*
 * Utilidades compartidas por las herramientas de línea de órdenes (solo Node).
 * La lógica de la tarjeta está en plantilla/tarjeta.js (pura, sin APIs de Node).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const plantilla = require('../plantilla/tarjeta.js');

const RAIZ_REPO = path.resolve(__dirname, '..');
const MARCA_SW = '/* Service worker de la tarjeta «';

/** Huella de los recursos compartidos: si cambian, cambia la versión de caché de las tarjetas emitidas. */
function versionRecursos(raiz = RAIZ_REPO) {
  const hash = crypto.createHash('sha256');
  for (const ruta of plantilla.RECURSOS_COMPARTIDOS) {
    const archivo = path.join(raiz, 'recursos', path.basename(ruta));
    hash.update(path.basename(ruta));
    hash.update(fs.readFileSync(archivo));
  }
  return hash.digest('hex').slice(0, 12);
}

/** ¿La ruta está dentro del repositorio? */
function estaDentroDelRepo(ruta, raiz = RAIZ_REPO) {
  const relativa = path.relative(fs.realpathSync(raiz), fs.realpathSync(ruta));
  return relativa === '' || (!relativa.startsWith('..') && !path.isAbsolute(relativa));
}

/** ¿Es una carpeta de tarjeta generada por la plantilla? */
function esCarpetaDeTarjeta(carpeta) {
  const sw = path.join(carpeta, 'sw.js');
  if (!fs.existsSync(sw) || !fs.existsSync(path.join(carpeta, 'contacto.vcf'))) return false;
  return fs.readFileSync(sw, 'utf8').startsWith(MARCA_SW);
}

/** Escribe los archivos de una tarjeta en <raiz>/<slug>/ y borra los que sobren. */
function escribirTarjeta(slug, archivos, raiz = RAIZ_REPO) {
  if (!plantilla.slugValido(slug)) throw new Error(`Slug no válido: ${slug}`);
  const carpeta = path.join(raiz, slug);
  if (fs.existsSync(carpeta) && fs.readdirSync(carpeta).length > 0 && !esCarpetaDeTarjeta(carpeta)) {
    throw new Error(`La carpeta «${slug}/» existe y no es una tarjeta: no se toca.`);
  }
  fs.mkdirSync(carpeta, { recursive: true });
  const nombres = Object.keys(archivos);
  for (const nombre of nombres) {
    fs.writeFileSync(path.join(carpeta, nombre), archivos[nombre], 'utf8');
  }
  for (const sobrante of fs.readdirSync(carpeta)) {
    if (!nombres.includes(sobrante)) fs.rmSync(path.join(carpeta, sobrante), { recursive: true, force: true });
  }
  return carpeta;
}

module.exports = { RAIZ_REPO, plantilla, versionRecursos, estaDentroDelRepo, esCarpetaDeTarjeta, escribirTarjeta };
