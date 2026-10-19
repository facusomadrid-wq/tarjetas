'use strict';
// Pruebas de la plantilla pura (plantilla/tarjeta.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const t = require('../../plantilla/tarjeta.js');

const HOY = '2026-10-19';
const BASE = {
  nombre: 'Nombre Ejemplo',
  cargo: 'Delegado sindical',
  telefono: '600 000 000',
  correo: 'ejemplo@example.org',
  consentimiento: '2026-01-01'
};
const con = (cambios) => Object.assign({}, BASE, cambios);
const sin = (campo) => { const d = Object.assign({}, BASE); delete d[campo]; return d; };
const valida = (d) => t.validarDatos(d, { hoy: HOY });

test('slug: minúsculas, sin tildes, con guiones', () => {
  assert.equal(t.generarSlug('Nombre Ejemplo'), 'nombre-ejemplo');
  assert.equal(t.generarSlug('  José Ángel Núñez-Ibáñez  '), 'jose-angel-nunez-ibanez');
  assert.equal(t.generarSlug("María O'Donnell Çelik"), 'maria-o-donnell-celik');
  assert.equal(t.generarSlug('Ü--ü__ü'), 'u-u-u');
  assert.equal(t.generarSlug('a'.repeat(80)).length, 60);
});

test('slug: se deriva del nombre o se respeta el dado', () => {
  assert.equal(valida(BASE).datos.slug, 'nombre-ejemplo');
  assert.equal(valida(con({ slug: 'mi-tarjeta-2' })).datos.slug, 'mi-tarjeta-2');
  for (const malo of ['Mayus', 'con espacio', '-guion', 'guion-', 'a--b', 'ñandu', 'x', '../salir', 'recursos', 'herramientas']) {
    assert.equal(valida(con({ slug: malo })).ok, false, `debería rechazar el slug ${malo}`);
  }
});

test('validación: nombre y cargo obligatorios', () => {
  assert.equal(valida(sin('nombre')).ok, false);
  assert.equal(valida(sin('cargo')).ok, false);
  assert.equal(valida(con({ nombre: '   ' })).ok, false);
  assert.equal(valida(con({ nombre: 'A' })).ok, false);
  assert.equal(valida(con({ nombre: 'x'.repeat(81) })).ok, false);
  assert.equal(valida(con({ nombre: 123 })).ok, false);
  assert.equal(valida(con({ nombre: 'Ana  María   López' })).datos.nombre, 'Ana María López');
  assert.equal(valida(con({ cargo: 'Secretario de Acción Sindical (AGE), 2.º' })).ok, true);
});

test('validación: consentimiento obligatorio, fecha real y no futura', () => {
  const r = valida(sin('consentimiento'));
  assert.equal(r.ok, false);
  assert.match(r.errores.join(' '), /consentimiento/);
  assert.equal(valida(con({ consentimiento: '' })).ok, false);
  assert.equal(valida(con({ consentimiento: '01/02/2026' })).ok, false);
  assert.equal(valida(con({ consentimiento: '2026-02-30' })).ok, false);
  assert.equal(valida(con({ consentimiento: '2026-10-20' })).ok, false, 'futura');
  assert.equal(valida(con({ consentimiento: '2026-10-19' })).ok, true, 'hoy');
  assert.equal(valida(con({ consentimiento: '2024-02-29' })).ok, true, 'bisiesto');
});

test('validación: el consentimiento no aparece en ningún archivo generado', () => {
  const archivos = t.generarTarjeta(con({ consentimiento: '2025-03-14' }), { hoy: HOY });
  for (const [nombre, contenido] of Object.entries(archivos)) {
    assert.ok(!contenido.includes('2025-03-14'), `${nombre} no debe contener la fecha de consentimiento`);
    assert.ok(!/consentimiento/i.test(contenido), `${nombre} no debe mencionar el consentimiento`);
  }
});

test('validación: campos no previstos y organización fija', () => {
  assert.equal(valida(con({ dni: '00000000T' })).ok, false);
  assert.equal(valida(con({ domicilio: 'x' })).ok, false);
  assert.equal(valida(con({ organizacion: 'Otra organización' })).ok, false);
  assert.equal(valida(con({ organizacion: 'FAC-USO Madrid' })).ok, true);
  assert.equal(valida(null).ok, false);
  assert.equal(valida([]).ok, false);
});

test('teléfono: formatos español e internacional', () => {
  const casos = {
    '600 000 000': '+34600000000',
    '600000000': '+34600000000',
    '+34 600 00 00 00': '+34600000000',
    '0034-600-000-000': '+34600000000',
    '(+34) 911.234.567': '+34911234567',
    '+44 20 7946 0000': '+442079460000',
    '0033 1 23 45 67 89': '+33123456789'
  };
  for (const [entrada, e164] of Object.entries(casos)) {
    const r = t.normalizarTelefono(entrada);
    assert.ok(r, `debería aceptar ${entrada}`);
    assert.equal(r.e164, e164);
  }
  assert.equal(t.normalizarTelefono('600 000 000').visible, '+34 600 000 000');
  for (const malo of ['12345', '500 000 000', '+34 500 000 000', '6000000000', '+1', 'abc', '600-000-00a',
    '+34 600 000 000 ext 2', '600 000 000;x', '+' + '1'.repeat(16), '<600000000>']) {
    assert.equal(t.normalizarTelefono(malo), null, `debería rechazar ${malo}`);
  }
  assert.equal(valida(sin('telefono')).ok, true, 'el teléfono es opcional');
  assert.equal(valida(con({ telefono: '' })).datos.telefono, null);
  assert.equal(valida(con({ telefono: '123' })).ok, false);
});

test('correo: validación estricta y opcional', () => {
  assert.equal(t.normalizarCorreo('ejemplo@example.org'), 'ejemplo@example.org');
  assert.equal(t.normalizarCorreo('  Nombre.Apellido+uso@Example.ORG '), 'Nombre.Apellido+uso@example.org');
  for (const malo of ['ejemplo', 'a@b', 'a@b.c', 'a..b@example.org', '.a@example.org', 'a@-example.org',
    'a b@example.org', 'a@example.org>', '"a"@example.org', 'a@example.org\nBcc:x@y.org', 'a@ex_ample.org']) {
    assert.equal(t.normalizarCorreo(malo), null, `debería rechazar ${JSON.stringify(malo)}`);
  }
  assert.equal(valida(sin('correo')).ok, true, 'el correo es opcional');
  assert.equal(valida(con({ correo: 'malo' })).ok, false);
});

test('escapado HTML de todos los caracteres peligrosos', () => {
  assert.equal(t.escaparHtml(`<a href="x" onclick='y'>&</a>`),
    '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
});

test('inyección: la validación rechaza HTML y scripts en los datos', () => {
  const ataques = [
    { nombre: '<script>alert(1)</script>' },
    { nombre: 'Ana"><img src=x onerror=alert(1)>' },
    { cargo: '</p><script>fetch("//malo")</script>' },
    { cargo: 'Delegado; javascript:alert(1)' },
    { correo: 'a@example.org"><script>alert(1)</script>' },
    { correo: 'javascript:alert(1)//@example.org' },
    { telefono: '600000000"><script>' },
    { slug: '../../etc' },
    { nombre: 'Ana\u0000López' },
    { nombre: 'Ana‮López' }
  ];
  for (const ataque of ataques) {
    const r = valida(con(ataque));
    assert.equal(r.ok, false, `debería rechazar ${JSON.stringify(ataque)}`);
    assert.throws(() => t.generarTarjeta(con(ataque), { hoy: HOY }), (e) => Array.isArray(e.errores) && e.errores.length > 0);
  }
});

test('inyección: los caracteres permitidos (apóstrofo) salen escapados en el HTML', () => {
  const a = t.generarTarjeta(con({ nombre: "Ana D'Ávila", cargo: "Delegada (O'Donnell)" }), { hoy: HOY });
  const html = a['index.html'];
  assert.ok(html.includes('Ana D&#39;Ávila'));
  assert.ok(html.includes('Delegada (O&#39;Donnell)'));
  assert.ok(!html.includes("D'Ávila"));
});

test('vCard 3.0: estructura, CRLF y campos', () => {
  const vcf = t.generarTarjeta(BASE, { hoy: HOY })['contacto.vcf'];
  assert.ok(vcf.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n'));
  assert.ok(vcf.endsWith('END:VCARD\r\n'));
  assert.ok(!/[^\r]\n/.test(vcf), 'todas las líneas terminan en CRLF');
  const lineas = vcf.split('\r\n');
  assert.ok(lineas.includes('N:Ejemplo;Nombre;;;'));
  assert.ok(lineas.includes('FN:Nombre Ejemplo'));
  assert.ok(lineas.includes('ORG:FAC-USO Madrid'));
  assert.ok(lineas.includes('TITLE:Delegado sindical'));
  assert.ok(lineas.includes('TEL;TYPE=WORK,VOICE:+34600000000'));
  assert.ok(lineas.includes('EMAIL;TYPE=INTERNET,WORK:ejemplo@example.org'));
  assert.ok(lineas.includes('URL:https://facusomadrid-wq.github.io/tarjetas/nombre-ejemplo/'));
});

test('vCard: sin teléfono ni correo no aparecen esas líneas', () => {
  const vcf = t.generarTarjeta(sin('telefono'), { hoy: HOY })['contacto.vcf'];
  assert.ok(!vcf.includes('TEL'));
  const vcf2 = t.generarTarjeta(sin('correo'), { hoy: HOY })['contacto.vcf'];
  assert.ok(!vcf2.includes('EMAIL'));
});

test('vCard: escapado de coma, punto y coma, barra invertida y saltos', () => {
  assert.equal(t.escaparVcard('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
  const vcf = t.generarTarjeta(con({ cargo: 'Secretaria de Organización, Formación y Empleo' }), { hoy: HOY })['contacto.vcf'];
  assert.ok(vcf.replace(/\r\n /g, '').includes('TITLE:Secretaria de Organización\\, Formación y Empleo'));
});

test('vCard: líneas plegadas a 75 octetos sin partir caracteres', () => {
  const largo = 'Secretaria de Organización, Acción Sindical, Formación, Igualdad y Comunicación';
  const vcf = t.generarTarjeta(con({ cargo: largo }), { hoy: HOY })['contacto.vcf'];
  for (const linea of vcf.split('\r\n')) {
    assert.ok(Buffer.byteLength(linea, 'utf8') <= 75, `línea demasiado larga: ${linea}`);
    assert.ok(!linea.includes('�'));
  }
  // Al desplegar (quitar CRLF + espacio) se recupera el valor escapado completo.
  const desplegado = vcf.replace(/\r\n /g, '');
  assert.ok(desplegado.includes('TITLE:' + t.escaparVcard(largo)));
});

test('generación: devuelve exactamente los cinco archivos', () => {
  const a = t.generarTarjeta(BASE, { hoy: HOY });
  assert.deepEqual(Object.keys(a).sort(), ['contacto.vcf', 'index.html', 'manifest.webmanifest', 'qr.svg', 'sw.js']);
  for (const v of Object.values(a)) assert.equal(typeof v, 'string');
});

test('generación: es determinista (mismos datos, mismos archivos)', () => {
  assert.deepEqual(t.generarTarjeta(BASE, { hoy: HOY }), t.generarTarjeta(BASE, { hoy: HOY }));
  const v1 = t.generarTarjeta(BASE, { hoy: HOY, versionRecursos: 'a' })['sw.js'];
  const v2 = t.generarTarjeta(BASE, { hoy: HOY, versionRecursos: 'b' })['sw.js'];
  assert.notEqual(v1, v2, 'cambiar los recursos cambia la versión de caché');
});

test('página: CSP, noindex, sin recursos externos, botones y pie', () => {
  const html = t.generarTarjeta(BASE, { hoy: HOY })['index.html'];
  assert.ok(html.includes('<meta http-equiv="Content-Security-Policy" content="' + t.CSP + '">'));
  assert.ok(html.includes('<meta name="robots" content="noindex,nofollow">'));
  assert.ok(!/(src|href)="(https?:)?\/\//.test(html), 'sin recursos externos');
  assert.ok(!/<script>/.test(html), 'sin scripts en línea');
  assert.ok(!/ style="/.test(html), 'sin estilos en línea');
  assert.ok(!/analytics|gtag|googletagmanager|fonts\.googleapis/.test(html));
  for (const texto of ['Guardar contacto', 'Llamar', 'Correo', 'Compartir', 'Mostrar QR', 'Tarjeta emitida por FAC-USO Madrid']) {
    assert.ok(html.includes(texto), `falta «${texto}»`);
  }
  assert.ok(html.includes('href="contacto.vcf" download="nombre-ejemplo.vcf"'));
  assert.ok(html.includes('href="tel:+34600000000"'));
  assert.ok(html.includes('href="mailto:ejemplo@example.org"'));
  assert.ok(html.includes('srcset="../recursos/logo-blanco.png"'));
  assert.ok(html.includes('src="../recursos/logo-color.png"'));
  assert.ok(html.includes('<link rel="manifest" href="manifest.webmanifest">'));
});

test('página: sin teléfono no hay botón Llamar; sin correo no hay botón Correo', () => {
  const html = t.generarTarjeta(sin('telefono'), { hoy: HOY })['index.html'];
  assert.ok(!html.includes('Llamar') && !html.includes('tel:'));
  const html2 = t.generarTarjeta(sin('correo'), { hoy: HOY })['index.html'];
  assert.ok(!html2.includes('mailto:'));
});

test('manifest: start_url y scope en la carpeta de la tarjeta', () => {
  const m = JSON.parse(t.generarTarjeta(BASE, { hoy: HOY })['manifest.webmanifest']);
  assert.equal(m.start_url, './');
  assert.equal(m.scope, './');
  assert.equal(m.display, 'standalone');
  assert.equal(m.lang, 'es');
  assert.ok(m.icons.some((i) => i.sizes === '512x512'));
  assert.ok(m.short_name.length <= 12);
});

test('service worker: precachea sus archivos y los recursos compartidos, y gestiona la retirada', () => {
  const sw = t.generarTarjeta(BASE, { hoy: HOY })['sw.js'];
  for (const archivo of ['./', './contacto.vcf', './qr.svg', './manifest.webmanifest', ...t.RECURSOS_COMPARTIDOS]) {
    assert.ok(sw.includes(JSON.stringify(archivo)), `falta ${archivo}`);
  }
  assert.ok(sw.includes('var SLUG = "nombre-ejemplo";'));
  assert.ok(sw.includes('status === 404'));
  assert.ok(sw.includes('registration.unregister()'));
  assert.ok(sw.includes('Esta tarjeta ya no está vigente'));
  assert.ok(!sw.includes('Nombre Ejemplo'), 'el SW no contiene datos personales');
  assert.doesNotThrow(() => new Function(sw), 'el SW es JavaScript válido');
});

test('QR: SVG válido, negro sobre blanco y con el enlace', () => {
  const svg = t.generarTarjeta(BASE, { hoy: HOY })['qr.svg'];
  assert.ok(svg.startsWith('<?xml'));
  assert.match(svg, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 (\d+) \1"/);
  assert.ok(svg.includes('fill="#ffffff"') && svg.includes('fill="#000000"'));
  assert.ok(svg.includes('https://facusomadrid-wq.github.io/tarjetas/nombre-ejemplo/'));
  // Comprobación con la propia librería: tamaño = módulos + 2 × margen de 4.
  const qrcode = require('../../plantilla/vendor/qrcode.js');
  const qr = qrcode(0, 'M');
  qr.addData('https://facusomadrid-wq.github.io/tarjetas/nombre-ejemplo/', 'Byte');
  qr.make();
  const total = Number(/viewBox="0 0 (\d+)/.exec(svg)[1]);
  assert.equal(total, qr.getModuleCount() + 8);
});

test('URL base: solo https y terminada en barra', () => {
  assert.equal(t.validarDatos(BASE, { hoy: HOY, urlBase: 'http://x.org/' }).ok, false);
  assert.equal(t.validarDatos(BASE, { hoy: HOY, urlBase: 'https://x.org' }).ok, false);
  assert.equal(t.validarDatos(BASE, { hoy: HOY, urlBase: 'javascript:alert(1)//' }).ok, false);
  assert.equal(t.validarDatos(BASE, { hoy: HOY, urlBase: 'https://ejemplo.org/tarjetas/' }).datos.url,
    'https://ejemplo.org/tarjetas/nombre-ejemplo/');
});

test('plantilla sin APIs de Node (apta para Apps Script)', () => {
  const fuente = require('node:fs').readFileSync(require.resolve('../../plantilla/tarjeta.js'), 'utf8');
  const usos = fuente.match(/require\(([^)]*)\)/g) || [];
  assert.deepEqual(usos, ["require('./vendor/qrcode.js')"], 'solo se carga la librería QR');
  assert.ok(!/\b(process|Buffer|__dirname|__filename)\b/.test(fuente));
});
