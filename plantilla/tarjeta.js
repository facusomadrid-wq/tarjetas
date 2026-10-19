/*
 * Plantilla de las tarjetas de visita digitales de FAC-USO Madrid.
 *
 * Funciones puras: no usan ninguna API de Node (ni fs, ni path, ni crypto)
 * ni del navegador. Así se pueden usar desde las herramientas de Node y,
 * en la Fase 2, desde Google Apps Script (copiando este archivo y
 * vendor/qrcode.js como archivos del proyecto de Apps Script).
 *
 * Uso principal:
 *   generarTarjeta(datos, opciones) -> {
 *     'index.html', 'contacto.vcf', 'manifest.webmanifest', 'sw.js', 'qr.svg'
 *   }
 *
 * Si los datos no son válidos lanza un Error con la propiedad `errores`
 * (lista de textos en español).
 */

/* global qrcode */
'use strict';

var ORGANIZACION = 'FAC-USO Madrid';
var URL_BASE_POR_DEFECTO = 'https://facusomadrid-wq.github.io/tarjetas/';

// Carpetas del repositorio que nunca pueden ser el slug de una tarjeta.
var SLUGS_RESERVADOS = [
  'recursos', 'plantilla', 'herramientas', 'tests', 'node_modules', 'docs',
  'github', 'index', '404', 'robots', 'vendor', 'sw', 'manifest', 'contacto', 'qr'
];

// Archivos compartidos (en /recursos/) que cada tarjeta guarda para funcionar sin conexión.
var RECURSOS_COMPARTIDOS = [
  '../recursos/tarjeta.css',
  '../recursos/tarjeta.js',
  '../recursos/logo-color.png',
  '../recursos/logo-blanco.png',
  '../recursos/icono-192.png',
  '../recursos/icono-512.png'
];

var CAMPOS_PERMITIDOS = ['nombre', 'cargo', 'organizacion', 'telefono', 'correo', 'consentimiento', 'slug'];

var CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; " +
  "manifest-src 'self'; connect-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'";

// ---------------------------------------------------------------------------
// Escapado
// ---------------------------------------------------------------------------

/** Escapa un texto para insertarlo en HTML (contenido o atributo entre comillas). */
function escaparHtml(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escapa un valor de texto de vCard 3.0 (RFC 2426): barra invertida, coma, punto y coma y saltos de línea. */
function escaparVcard(texto) {
  return String(texto)
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\r\n|\r|\n/g, '\\n');
}

// ---------------------------------------------------------------------------
// Normalización y validación
// ---------------------------------------------------------------------------

function limpiarTexto_(valor) {
  return String(valor).normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** Deriva un slug: minúsculas, sin tildes, solo letras, números y guiones. */
function generarSlug(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

function slugValido(slug) {
  return typeof slug === 'string' &&
    slug.length >= 2 && slug.length <= 60 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) &&
    SLUGS_RESERVADOS.indexOf(slug) === -1;
}

/**
 * Normaliza un teléfono español o internacional.
 * Devuelve { e164, visible } o null si no es válido.
 *   600 000 000, +34 600 000 000, 0034600000000 -> +34600000000
 *   +44 20 7946 0000, 0044... -> +442079460000
 */
function normalizarTelefono(valor) {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null;
  var bruto = String(valor).trim();
  if (bruto.length > 25) return null;
  if (!/^[+0-9 .()\-]+$/.test(bruto)) return null;
  var compacto = bruto.replace(/[ .()\-]/g, '');
  var es = /^(?:\+34|0034)?([6789]\d{8})$/.exec(compacto);
  if (es) {
    var n = es[1];
    return { e164: '+34' + n, visible: '+34 ' + n.slice(0, 3) + ' ' + n.slice(3, 6) + ' ' + n.slice(6) };
  }
  var int = /^(?:\+|00)([1-9]\d{7,14})$/.exec(compacto);
  if (int && int[1].indexOf('34') !== 0) {
    return { e164: '+' + int[1], visible: '+' + int[1] };
  }
  return null;
}

/** Valida y normaliza un correo. Devuelve el correo (dominio en minúsculas) o null. */
function normalizarCorreo(valor) {
  if (typeof valor !== 'string') return null;
  var correo = valor.trim();
  if (correo.length < 6 || correo.length > 254) return null;
  var patron = /^[A-Za-z0-9](?:[A-Za-z0-9._%+\-]{0,62}[A-Za-z0-9])?@(?:[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;
  if (!patron.test(correo) || correo.indexOf('..') !== -1) return null;
  var partes = correo.split('@');
  return partes[0] + '@' + partes[1].toLowerCase();
}

/** Comprueba que una fecha AAAA-MM-DD existe en el calendario. */
function fechaValida(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  var a = Number(texto.slice(0, 4));
  var m = Number(texto.slice(5, 7));
  var d = Number(texto.slice(8, 10));
  var f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

function hoyIso_() {
  var f = new Date();
  var mm = String(f.getMonth() + 1).padStart(2, '0');
  var dd = String(f.getDate()).padStart(2, '0');
  return f.getFullYear() + '-' + mm + '-' + dd;
}

var PATRON_NOMBRE = /^\p{L}[\p{L}\p{M}'’.\- ]*[\p{L}\p{M}.]$/u;
var PATRON_CARGO = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} .,'’()\/ºª\-]*[\p{L}\p{M}\p{N}.)]$/u;

/**
 * Valida los datos de una tarjeta.
 * Devuelve { ok, errores, datos } donde `datos` es la versión normalizada:
 *   { nombre, cargo, organizacion, telefono: {e164, visible}|null, correo|null, slug, url }
 * El consentimiento se comprueba pero no se devuelve: no aparece en la tarjeta.
 */
function validarDatos(datos, opciones) {
  opciones = opciones || {};
  var errores = [];
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    return { ok: false, errores: ['Los datos deben ser un objeto.'], datos: null };
  }

  Object.keys(datos).forEach(function (clave) {
    if (CAMPOS_PERMITIDOS.indexOf(clave) === -1) {
      errores.push('Campo no permitido: «' + clave + '». Solo se admiten datos profesionales previstos.');
    }
  });

  var nombre = typeof datos.nombre === 'string' ? limpiarTexto_(datos.nombre) : '';
  if (!nombre) errores.push('Falta el nombre.');
  else if (nombre.length < 2 || nombre.length > 80) errores.push('El nombre debe tener entre 2 y 80 caracteres.');
  else if (!PATRON_NOMBRE.test(nombre)) errores.push('El nombre solo puede contener letras, espacios, apóstrofos, puntos y guiones.');

  var cargo = typeof datos.cargo === 'string' ? limpiarTexto_(datos.cargo) : '';
  if (!cargo) errores.push('Falta el cargo.');
  else if (cargo.length < 2 || cargo.length > 100) errores.push('El cargo debe tener entre 2 y 100 caracteres.');
  else if (!PATRON_CARGO.test(cargo)) errores.push('El cargo contiene caracteres no permitidos.');

  if (datos.organizacion !== undefined && datos.organizacion !== ORGANIZACION) {
    errores.push('La organización es fija: «' + ORGANIZACION + '».');
  }

  var telefono = null;
  if (datos.telefono !== undefined && datos.telefono !== null && datos.telefono !== '') {
    telefono = normalizarTelefono(datos.telefono);
    if (!telefono) errores.push('El teléfono no tiene un formato válido (español de 9 cifras o internacional con prefijo +).');
  }

  var correo = null;
  if (datos.correo !== undefined && datos.correo !== null && datos.correo !== '') {
    correo = normalizarCorreo(datos.correo);
    if (!correo) errores.push('El correo no tiene un formato válido.');
  }

  var hoy = opciones.hoy || hoyIso_();
  if (datos.consentimiento === undefined || datos.consentimiento === null || datos.consentimiento === '') {
    errores.push('Falta la fecha de consentimiento del delegado o delegada (AAAA-MM-DD). Sin consentimiento no se emite la tarjeta.');
  } else if (!fechaValida(datos.consentimiento)) {
    errores.push('La fecha de consentimiento debe ser una fecha real con formato AAAA-MM-DD.');
  } else if (datos.consentimiento > hoy) {
    errores.push('La fecha de consentimiento no puede ser futura.');
  } else if (datos.consentimiento < '2000-01-01') {
    errores.push('La fecha de consentimiento no es plausible.');
  }

  var slug;
  if (datos.slug !== undefined && datos.slug !== null && datos.slug !== '') {
    slug = datos.slug;
    if (!slugValido(slug)) errores.push('El slug debe tener 2-60 caracteres: minúsculas sin tildes, números y guiones (y no ser un nombre reservado).');
  } else {
    slug = generarSlug(nombre);
    if (nombre && !slugValido(slug)) errores.push('No se puede derivar un slug válido del nombre; indica uno con el campo «slug».');
  }

  var urlBase = opciones.urlBase || URL_BASE_POR_DEFECTO;
  if (!/^https:\/\/[a-z0-9.\-]+(?::\d+)?\/(?:[a-z0-9._\-]+\/)*$/.test(urlBase)) {
    errores.push('La URL base debe empezar por https:// y terminar en «/».');
  }

  if (errores.length) return { ok: false, errores: errores, datos: null };
  return {
    ok: true,
    errores: [],
    datos: {
      nombre: nombre,
      cargo: cargo,
      organizacion: ORGANIZACION,
      telefono: telefono,
      correo: correo,
      slug: slug,
      url: urlBase + slug + '/'
    }
  };
}

// ---------------------------------------------------------------------------
// vCard 3.0
// ---------------------------------------------------------------------------

function longitudUtf8_(caracter) {
  var c = caracter.codePointAt(0);
  if (c < 0x80) return 1;
  if (c < 0x800) return 2;
  if (c < 0x10000) return 3;
  return 4;
}

/** Pliega una línea de vCard a 75 octetos (RFC 2425) sin partir caracteres UTF-8 ni escapes. */
function plegarLineaVcard(linea) {
  var trozos = [];
  var actual = '';
  var octetos = 0;
  var limite = 75;
  var caracteres = Array.from(linea);
  for (var i = 0; i < caracteres.length; i++) {
    var ch = caracteres[i];
    // No separar una barra invertida del carácter que escapa.
    var unidad = (ch === '\\' && i + 1 < caracteres.length) ? ch + caracteres[++i] : ch;
    var largo = Array.from(unidad).reduce(function (s, x) { return s + longitudUtf8_(x); }, 0);
    if (octetos + largo > limite) {
      trozos.push(actual);
      actual = '';
      octetos = 1; // el espacio inicial de la línea de continuación
      limite = 75;
    }
    actual += unidad;
    octetos += largo;
  }
  trozos.push(actual);
  return trozos.join('\r\n ');
}

/** Genera la vCard 3.0 (CRLF) a partir de datos ya validados. */
function generarVcard(d) {
  var palabras = d.nombre.split(' ');
  var pila = palabras[0];
  var apellidos = palabras.slice(1).join(' ');
  var lineas = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:' + escaparVcard(apellidos) + ';' + escaparVcard(pila) + ';;;',
    'FN:' + escaparVcard(d.nombre),
    'ORG:' + escaparVcard(d.organizacion),
    'TITLE:' + escaparVcard(d.cargo)
  ];
  if (d.telefono) lineas.push('TEL;TYPE=WORK,VOICE:' + d.telefono.e164);
  if (d.correo) lineas.push('EMAIL;TYPE=INTERNET,WORK:' + d.correo);
  lineas.push('URL:' + d.url);
  lineas.push('END:VCARD');
  return lineas.map(plegarLineaVcard).join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------------------
// Código QR (SVG)
// ---------------------------------------------------------------------------

function libreriaQr_() {
  if (typeof qrcode === 'function') return qrcode; // Apps Script / navegador: variable global
  if (typeof require === 'function') return require('./vendor/qrcode.js'); // Node
  throw new Error('No se encuentra la librería qrcode-generator.');
}

/** Genera un SVG (negro sobre blanco, con margen) que codifica `texto`. */
function generarQrSvg(texto) {
  var qr = libreriaQr_()(0, 'M');
  qr.addData(texto, 'Byte');
  qr.make();
  var n = qr.getModuleCount();
  var margen = 4;
  var total = n + margen * 2;
  var trazos = [];
  for (var fila = 0; fila < n; fila++) {
    var col = 0;
    while (col < n) {
      if (qr.isDark(fila, col)) {
        var inicio = col;
        while (col < n && qr.isDark(fila, col)) col++;
        trazos.push('M' + (inicio + margen) + ' ' + (fila + margen) + 'h' + (col - inicio) + 'v1h-' + (col - inicio) + 'z');
      } else {
        col++;
      }
    }
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '" ' +
    'width="' + total * 8 + '" height="' + total * 8 + '" shape-rendering="crispEdges" role="img" ' +
    'aria-label="Código QR: ' + escaparHtml(texto) + '">\n' +
    '<title>' + escaparHtml(texto) + '</title>\n' +
    '<rect width="' + total + '" height="' + total + '" fill="#ffffff"/>\n' +
    '<path fill="#000000" d="' + trazos.join('') + '"/>\n' +
    '</svg>\n';
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Hash FNV-1a de 32 bits en hexadecimal (para versionar la caché; no es criptográfico). */
function hashTexto(texto) {
  var h = 0x811c9dc5;
  for (var i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ('0000000' + h.toString(16)).slice(-8);
}

// Iconos en línea (decorativos: el texto del botón siempre acompaña).
var ICONOS = {
  guardar: '<path d="M12 3v12m0 0l-5-5m5 5l5-5M5 21h14"/>',
  llamar: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
  correo: '<path d="M3 6h18v12H3z"/><path d="M3 7l9 6 9-6"/>',
  compartir: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  qr: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14v2"/>',
  cerrar: '<path d="M6 6l12 12M18 6L6 18"/>'
};

function icono_(nombre) {
  return '<svg class="icono" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" ' +
    'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    ICONOS[nombre] + '</svg>';
}

function cabeceraHtml_() {
  return '<header class="cabecera">\n' +
    '  <picture>\n' +
    '    <source media="(prefers-color-scheme: dark)" srcset="../recursos/logo-blanco.png">\n' +
    '    <img class="logo" src="../recursos/logo-color.png" alt="FAC-USO Madrid · Federación de Atención a la Ciudadanía" width="250" height="42">\n' +
    '  </picture>\n' +
    '</header>\n';
}

function cabezaHtml_(titulo, conManifiesto) {
  return '<!doctype html>\n<html lang="es">\n<head>\n' +
    '<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
    '<meta http-equiv="Content-Security-Policy" content="' + CSP + '">\n' +
    '<meta name="robots" content="noindex,nofollow">\n' +
    '<meta name="referrer" content="no-referrer">\n' +
    '<meta name="color-scheme" content="light dark">\n' +
    '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff">\n' +
    '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#121212">\n' +
    '<title>' + escaparHtml(titulo) + '</title>\n' +
    (conManifiesto ? '<link rel="manifest" href="manifest.webmanifest">\n' : '') +
    '<link rel="icon" type="image/png" href="../recursos/icono-192.png">\n' +
    '<link rel="apple-touch-icon" href="../recursos/icono-192.png">\n' +
    '<link rel="stylesheet" href="../recursos/tarjeta.css">\n';
}

// ---------------------------------------------------------------------------
// Archivos de la tarjeta
// ---------------------------------------------------------------------------

function generarIndexHtml_(d) {
  var e = escaparHtml;
  var datosContacto = '';
  var botones = '';
  if (d.telefono) {
    datosContacto += '    <li><span class="etiqueta">Teléfono</span> <a href="tel:' + e(d.telefono.e164) + '">' + e(d.telefono.visible) + '</a></li>\n';
  }
  if (d.correo) {
    datosContacto += '    <li><span class="etiqueta">Correo</span> <a href="mailto:' + e(d.correo) + '">' + e(d.correo) + '</a></li>\n';
  }
  botones += '    <a class="boton boton-principal" href="contacto.vcf" download="' + e(d.slug) + '.vcf" type="text/vcard">' + icono_('guardar') + '<span>Guardar contacto</span></a>\n';
  if (d.telefono) botones += '    <a class="boton" href="tel:' + e(d.telefono.e164) + '">' + icono_('llamar') + '<span>Llamar</span></a>\n';
  if (d.correo) botones += '    <a class="boton" href="mailto:' + e(d.correo) + '">' + icono_('correo') + '<span>Correo</span></a>\n';
  botones += '    <button class="boton" type="button" id="boton-compartir">' + icono_('compartir') + '<span>Compartir</span></button>\n';
  botones += '    <button class="boton" type="button" id="boton-qr" aria-haspopup="dialog" aria-controls="qr-pantalla">' + icono_('qr') + '<span>Mostrar QR</span></button>\n';

  return cabezaHtml_(d.nombre + ' · ' + d.organizacion, true) +
    '<script src="../recursos/tarjeta.js" defer></script>\n' +
    '</head>\n<body>\n' +
    cabeceraHtml_() +
    '<main class="tarjeta" id="tarjeta" data-url="' + e(d.url) + '" data-titulo="' + e(d.nombre + ' · ' + d.organizacion) + '">\n' +
    '  <h1 class="nombre">' + e(d.nombre) + '</h1>\n' +
    '  <p class="cargo">' + e(d.cargo) + '</p>\n' +
    '  <p class="organizacion">' + e(d.organizacion) + '</p>\n' +
    (datosContacto ? '  <ul class="contacto">\n' + datosContacto + '  </ul>\n' : '') +
    '  <div class="acciones">\n' + botones + '  </div>\n' +
    '  <p class="aviso" id="aviso" role="status" aria-live="polite"></p>\n' +
    '  <div class="copiar" id="copiar" hidden>\n' +
    '    <label for="campo-enlace">Enlace de la tarjeta (cópialo a mano)</label>\n' +
    '    <input id="campo-enlace" type="text" readonly value="' + e(d.url) + '">\n' +
    '  </div>\n' +
    '</main>\n' +
    '<div class="qr-pantalla" id="qr-pantalla" role="dialog" aria-modal="true" aria-labelledby="qr-titulo" hidden>\n' +
    '  <h2 id="qr-titulo">Escanea para abrir la tarjeta</h2>\n' +
    '  <img class="qr-imagen" src="qr.svg" alt="Código QR con el enlace a la tarjeta de ' + e(d.nombre) + '" width="296" height="296">\n' +
    '  <p class="qr-url">' + e(d.url) + '</p>\n' +
    '  <button class="boton" type="button" id="boton-cerrar-qr">' + icono_('cerrar') + '<span>Cerrar</span></button>\n' +
    '</div>\n' +
    '<footer class="pie">Tarjeta emitida por ' + e(d.organizacion) + '</footer>\n' +
    '</body>\n</html>\n';
}

/** Página que el service worker muestra cuando la tarjeta se ha retirado (sin datos personales). */
function generarPaginaRetirada_() {
  return cabezaHtml_('Tarjeta no vigente · ' + ORGANIZACION, false) +
    '</head>\n<body>\n' +
    cabeceraHtml_() +
    '<main class="tarjeta retirada">\n' +
    '  <h1 class="nombre"><span aria-hidden="true">⊘ </span>Esta tarjeta ya no está vigente</h1>\n' +
    '  <p>La organización la ha retirado. Si necesitas el contacto, pide un enlace actualizado a quien te la dio.</p>\n' +
    '</main>\n' +
    '<footer class="pie">' + escaparHtml(ORGANIZACION) + '</footer>\n' +
    '</body>\n</html>\n';
}

function generarManifest_(d) {
  var corto = d.nombre.length <= 12 ? d.nombre : d.nombre.split(' ')[0].slice(0, 12);
  var manifiesto = {
    name: d.nombre + ' · ' + d.organizacion,
    short_name: corto,
    description: 'Tarjeta de visita digital de ' + d.organizacion,
    lang: 'es',
    dir: 'ltr',
    id: './',
    start_url: './',
    scope: './',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '../recursos/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '../recursos/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
    ]
  };
  return JSON.stringify(manifiesto, null, 2) + '\n';
}

// Cuerpo del service worker. Se serializa con toString() y recibe sus constantes delante.
function cuerpoServiceWorker_() {
  /* eslint-disable no-undef */
  var PREFIJO = 'tarjeta-' + SLUG + '-';
  var CACHE = PREFIJO + VERSION;
  var RAIZ = new URL('./', self.location).href;
  var INDEX = new URL('./index.html', self.location).href;
  var PRECACHE = ARCHIVOS.map(function (a) { return new URL(a, self.location).href; });
  var retirada = false;

  self.addEventListener('install', function (evento) {
    evento.waitUntil(
      caches.open(CACHE)
        .then(function (cache) { return cache.addAll(ARCHIVOS); })
        .then(function () { return self.skipWaiting(); })
    );
  });

  self.addEventListener('activate', function (evento) {
    evento.waitUntil(
      caches.keys()
        .then(function (claves) {
          return Promise.all(claves.filter(function (c) {
            return c.indexOf(PREFIJO) === 0 && c !== CACHE;
          }).map(function (c) { return caches.delete(c); }));
        })
        .then(function () { return self.clients.claim(); })
    );
  });

  function borrarYDesregistrar() {
    retirada = true;
    return caches.keys()
      .then(function (claves) {
        return Promise.all(claves.filter(function (c) { return c.indexOf(PREFIJO) === 0; })
          .map(function (c) { return caches.delete(c); }));
      })
      .then(function () { return self.registration.unregister(); });
  }

  function respuestaRetirada() {
    return new Response(PAGINA_RETIRADA, {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }

  function desdeCache(url) {
    return caches.open(CACHE).then(function (cache) { return cache.match(url, { ignoreSearch: true }); });
  }

  // Página de la tarjeta: primero la red (para detectar la retirada); sin conexión, la copia guardada.
  function paginaTarjeta(peticion) {
    return fetch(new Request(peticion.url, { cache: 'no-cache', credentials: 'same-origin' }))
      .then(function (respuesta) {
        if (respuesta.status === 404) {
          return borrarYDesregistrar().then(respuestaRetirada, respuestaRetirada);
        }
        if (respuesta.ok && !retirada) {
          var copia = respuesta.clone();
          caches.open(CACHE).then(function (cache) { return cache.put(RAIZ, copia); });
          return respuesta;
        }
        return desdeCache(RAIZ).then(function (r) { return r || respuesta; });
      }, function () {
        return desdeCache(RAIZ).then(function (r) { return r || Response.error(); });
      });
  }

  self.addEventListener('fetch', function (evento) {
    var peticion = evento.request;
    if (peticion.method !== 'GET') return;
    var url = new URL(peticion.url);
    if (url.origin !== self.location.origin) return;
    var sinConsulta = url.origin + url.pathname;
    if (peticion.mode === 'navigate' && (sinConsulta === RAIZ || sinConsulta === INDEX)) {
      evento.respondWith(paginaTarjeta(peticion));
      return;
    }
    // Resto de archivos: la copia guardada al momento y, en segundo plano, se actualiza desde la red
    // (así los cambios en /recursos/ llegan sin volver a emitir la tarjeta).
    evento.respondWith(
      desdeCache(peticion).then(function (guardada) {
        var red = fetch(peticion).then(function (respuesta) {
          if (respuesta.ok && !retirada && PRECACHE.indexOf(sinConsulta) !== -1) {
            var copia = respuesta.clone();
            caches.open(CACHE).then(function (cache) { return cache.put(sinConsulta, copia); });
          }
          return respuesta;
        });
        if (guardada) {
          evento.waitUntil(red.catch(function () {}));
          return guardada;
        }
        return red;
      })
    );
  });
  /* eslint-enable no-undef */
}

function generarServiceWorker_(d, version) {
  var archivos = ['./', './contacto.vcf', './qr.svg', './manifest.webmanifest'].concat(RECURSOS_COMPARTIDOS);
  var cuerpo = cuerpoServiceWorker_.toString();
  cuerpo = cuerpo.slice(cuerpo.indexOf('{') + 1, cuerpo.lastIndexOf('}'));
  return '/* Service worker de la tarjeta «' + d.slug + '» de ' + ORGANIZACION + '. Generado: no editar a mano. */\n' +
    "'use strict';\n" +
    'var SLUG = ' + JSON.stringify(d.slug) + ';\n' +
    'var VERSION = ' + JSON.stringify(version) + ';\n' +
    'var ARCHIVOS = ' + JSON.stringify(archivos, null, 2) + ';\n' +
    'var PAGINA_RETIRADA = ' + JSON.stringify(generarPaginaRetirada_()) + ';\n' +
    cuerpo.replace(/^\n+/, '').replace(/\s+$/, '') + '\n';
}

/**
 * Genera los archivos de una tarjeta.
 * @param {Object} datos { nombre, cargo, telefono?, correo?, consentimiento, slug?, organizacion? }
 * @param {Object} [opciones] { urlBase?, hoy? (AAAA-MM-DD), versionRecursos? }
 * @return {Object} mapa nombre de archivo -> contenido (texto)
 */
function generarTarjeta(datos, opciones) {
  opciones = opciones || {};
  var resultado = validarDatos(datos, opciones);
  if (!resultado.ok) {
    var error = new Error('Datos de tarjeta no válidos:\n- ' + resultado.errores.join('\n- '));
    error.errores = resultado.errores;
    throw error;
  }
  var d = resultado.datos;
  var archivos = {
    'index.html': generarIndexHtml_(d),
    'contacto.vcf': generarVcard(d),
    'manifest.webmanifest': generarManifest_(d),
    'qr.svg': generarQrSvg(d.url)
  };
  var version = hashTexto(
    archivos['index.html'] + archivos['contacto.vcf'] + archivos['manifest.webmanifest'] +
    archivos['qr.svg'] + String(opciones.versionRecursos || '')
  );
  archivos['sw.js'] = generarServiceWorker_(d, version);
  return archivos;
}

if (typeof module === 'object' && module.exports) {
  module.exports = {
    ORGANIZACION: ORGANIZACION,
    URL_BASE_POR_DEFECTO: URL_BASE_POR_DEFECTO,
    RECURSOS_COMPARTIDOS: RECURSOS_COMPARTIDOS,
    SLUGS_RESERVADOS: SLUGS_RESERVADOS,
    CSP: CSP,
    generarTarjeta: generarTarjeta,
    validarDatos: validarDatos,
    generarSlug: generarSlug,
    slugValido: slugValido,
    normalizarTelefono: normalizarTelefono,
    normalizarCorreo: normalizarCorreo,
    fechaValida: fechaValida,
    escaparHtml: escaparHtml,
    escaparVcard: escaparVcard,
    plegarLineaVcard: plegarLineaVcard,
    generarVcard: generarVcard,
    generarQrSvg: generarQrSvg,
    hashTexto: hashTexto
  };
}
