'use strict';
// Pruebas de las herramientas emitir.js y retirar.js sobre un sitio temporal (nunca sobre el repositorio).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { emitir } = require('../../herramientas/emitir.js');
const { retirar } = require('../../herramientas/retirar.js');
const { RAIZ_REPO } = require('../../herramientas/comun.js');

function sitioTemporal() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'tarjetas-sitio-'));
  fs.cpSync(path.join(RAIZ_REPO, 'recursos'), path.join(raiz, 'recursos'), { recursive: true });
  return raiz;
}

function jsonTemporal(datos) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tarjetas-datos-'));
  const ruta = path.join(dir, 'persona.json');
  fs.writeFileSync(ruta, JSON.stringify(datos));
  return ruta;
}

const DATOS = {
  nombre: 'Nombre Ejemplo',
  cargo: 'Delegado sindical',
  telefono: '600 000 000',
  correo: 'ejemplo@example.org',
  consentimiento: '2026-01-01',
  slug: 'prueba-emision'
};

test('emitir: crea la carpeta con los cinco archivos', () => {
  const raiz = sitioTemporal();
  const r = emitir(jsonTemporal(DATOS), { raiz });
  assert.equal(r.slug, 'prueba-emision');
  assert.deepEqual(fs.readdirSync(path.join(raiz, 'prueba-emision')).sort(),
    ['contacto.vcf', 'index.html', 'manifest.webmanifest', 'qr.svg', 'sw.js']);
});

test('emitir: actualizar una tarjeta sobrescribe y elimina archivos sobrantes', () => {
  const raiz = sitioTemporal();
  emitir(jsonTemporal(DATOS), { raiz });
  fs.writeFileSync(path.join(raiz, 'prueba-emision', 'sobrante.txt'), 'x');
  emitir(jsonTemporal(Object.assign({}, DATOS, { cargo: 'Secretario general' })), { raiz });
  const html = fs.readFileSync(path.join(raiz, 'prueba-emision', 'index.html'), 'utf8');
  assert.ok(html.includes('Secretario general'));
  assert.ok(!fs.existsSync(path.join(raiz, 'prueba-emision', 'sobrante.txt')));
});

test('emitir: rechaza si falta el consentimiento', () => {
  const raiz = sitioTemporal();
  const datos = Object.assign({}, DATOS);
  delete datos.consentimiento;
  assert.throws(() => emitir(jsonTemporal(datos), { raiz }), /consentimiento/);
  assert.ok(!fs.existsSync(path.join(raiz, 'prueba-emision')));
});

test('emitir: rechaza datos no válidos sin escribir nada', () => {
  const raiz = sitioTemporal();
  assert.throws(() => emitir(jsonTemporal(Object.assign({}, DATOS, { nombre: '<script>' })), { raiz }), /no válidos/);
  assert.ok(!fs.existsSync(path.join(raiz, 'prueba-emision')));
});

test('emitir: rechaza un JSON dentro del repositorio', () => {
  const raiz = sitioTemporal();
  const ruta = path.join(raiz, 'persona.json');
  fs.writeFileSync(ruta, JSON.stringify(DATOS));
  assert.throws(() => emitir(ruta, { raiz }), /fuera del repositorio/);
});

test('emitir: no pisa una carpeta que no es una tarjeta', () => {
  const raiz = sitioTemporal();
  fs.mkdirSync(path.join(raiz, 'prueba-emision'));
  fs.writeFileSync(path.join(raiz, 'prueba-emision', 'importante.txt'), 'x');
  assert.throws(() => emitir(jsonTemporal(DATOS), { raiz }), /no es una tarjeta/);
  assert.ok(fs.existsSync(path.join(raiz, 'prueba-emision', 'importante.txt')));
});

test('retirar: borra la carpeta de la tarjeta', () => {
  const raiz = sitioTemporal();
  emitir(jsonTemporal(DATOS), { raiz });
  retirar('prueba-emision', { raiz });
  assert.ok(!fs.existsSync(path.join(raiz, 'prueba-emision')));
});

test('retirar: se niega con slugs no válidos, reservados o carpetas que no son tarjetas', () => {
  const raiz = sitioTemporal();
  assert.throws(() => retirar('../etc', { raiz }), /no válido/);
  assert.throws(() => retirar('recursos', { raiz }), /no válido/);
  assert.throws(() => retirar('no-existe', { raiz }), /No existe/);
  fs.mkdirSync(path.join(raiz, 'otra-cosa'));
  assert.throws(() => retirar('otra-cosa', { raiz }), /no es una carpeta de tarjeta/);
  assert.ok(fs.existsSync(path.join(raiz, 'recursos', 'tarjeta.css')));
});

test('línea de órdenes: emitir sin consentimiento termina con error', () => {
  const datos = Object.assign({}, DATOS);
  delete datos.consentimiento;
  let salida = '';
  assert.throws(() => {
    try {
      execFileSync(process.execPath, [path.join(RAIZ_REPO, 'herramientas', 'emitir.js'), jsonTemporal(datos)], { stdio: 'pipe' });
    } catch (error) {
      salida = String(error.stderr);
      throw error;
    }
  });
  assert.match(salida, /consentimiento/);
});
