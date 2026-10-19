'use strict';
// Pruebas del contenido del repositorio: raíz neutra, sin listados de personas, ejemplo coherente.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { RAIZ_REPO, plantilla, versionRecursos } = require('../../herramientas/comun.js');
const { DATOS_EJEMPLO } = require('../../herramientas/ejemplo.js');

const leer = (r) => fs.readFileSync(path.join(RAIZ_REPO, r), 'utf8');

test('raíz: index.html neutro, sin listado de tarjetas', () => {
  const html = leer('index.html');
  assert.ok(html.includes('Tarjetas de visita de FAC-USO Madrid. Para ver una tarjeta usa el enlace que te han dado.'));
  assert.ok(html.includes('<meta name="robots" content="noindex,nofollow">'));
  assert.ok(!/href="[a-z0-9-]+\/"/.test(html), 'no enlaza a ninguna tarjeta');
  assert.ok(!html.includes('ejemplo/'));
});

test('raíz: robots.txt bloquea todo, existe .nojekyll y 404.html', () => {
  assert.equal(leer('robots.txt'), 'User-agent: *\nDisallow: /\n');
  assert.ok(fs.existsSync(path.join(RAIZ_REPO, '.nojekyll')));
  const html = leer('404.html');
  assert.ok(html.includes('<meta name="robots" content="noindex,nofollow">'));
  assert.ok(html.includes('ya no está vigente'));
});

test('404.html: el hash de la CSP coincide con el estilo en línea', () => {
  const html = leer('404.html');
  const estilo = /<style>([\s\S]*?)<\/style>/.exec(html)[1];
  const hash = crypto.createHash('sha256').update(estilo, 'utf8').digest('base64');
  assert.ok(html.includes(`style-src 'sha256-${hash}'`));
});

test('repositorio: no existe ningún índice ni JSON con la lista de personas', () => {
  const encontrados = [];
  (function recorrer(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['.git', 'node_modules'].includes(e.name)) continue;
      const ruta = path.join(dir, e.name);
      if (e.isDirectory()) recorrer(ruta);
      else if (/\.json$/i.test(e.name)) encontrados.push(path.relative(RAIZ_REPO, ruta));
    }
  })(RAIZ_REPO);
  assert.deepEqual(encontrados, ['package.json']);
});

test('repositorio: la única tarjeta es la de ejemplo y coincide con la plantilla', () => {
  const tarjetas = fs.readdirSync(RAIZ_REPO, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(RAIZ_REPO, e.name, 'sw.js')))
    .map((e) => e.name);
  assert.deepEqual(tarjetas, ['ejemplo']);
  const esperado = plantilla.generarTarjeta(DATOS_EJEMPLO, { versionRecursos: versionRecursos() });
  for (const [nombre, contenido] of Object.entries(esperado)) {
    assert.equal(leer(path.join('ejemplo', nombre)), contenido, `ejemplo/${nombre} desactualizado: ejecuta «npm run ejemplo»`);
  }
});

test('ejemplo: datos totalmente ficticios', () => {
  assert.equal(DATOS_EJEMPLO.nombre, 'Nombre Ejemplo');
  assert.equal(DATOS_EJEMPLO.cargo, 'Delegado sindical');
  assert.equal(DATOS_EJEMPLO.telefono, '600 000 000');
  assert.equal(DATOS_EJEMPLO.correo, 'ejemplo@example.org');
});

test('recursos: logos oficiales sin modificar y sin dependencias externas en CSS/JS', () => {
  for (const archivo of ['logo-color.png', 'logo-blanco.png', 'icono-192.png', 'icono-512.png']) {
    const b = fs.readFileSync(path.join(RAIZ_REPO, 'recursos', archivo));
    assert.equal(b.subarray(1, 4).toString(), 'PNG');
  }
  const css = leer('recursos/tarjeta.css');
  const js = leer('recursos/tarjeta.js');
  assert.ok(!/@import|url\(\s*["']?https?:/.test(css));
  assert.ok(!/https?:\/\//.test(js));
  assert.ok(css.includes('#E71615') && css.includes('#00A94E'));
  assert.ok(css.includes('border-bottom: 3px solid var(--rojo-uso)'));
  assert.ok(!js.includes('innerHTML'));
});

test('librería QR: copiada con su licencia MIT', () => {
  assert.ok(leer('plantilla/vendor/qrcode.js').includes('Licensed under the MIT license'));
  assert.ok(leer('plantilla/vendor/LICENSE-qrcode-generator.txt').includes('Copyright (c) 2009 Kazuhiko Arase'));
});
