/* Service worker de la tarjeta «ejemplo» de FAC-USO Madrid. Generado: no editar a mano. */
'use strict';
var SLUG = "ejemplo";
var VERSION = "b62a059f";
var ARCHIVOS = [
  "./",
  "./contacto.vcf",
  "./qr.svg",
  "./manifest.webmanifest",
  "../recursos/tarjeta.css",
  "../recursos/tarjeta.js",
  "../recursos/logo-color.png",
  "../recursos/icono-192.png",
  "../recursos/icono-512.png"
];
var PAGINA_RETIRADA = "<!doctype html>\n<html lang=\"es\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; manifest-src 'self'; connect-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'\">\n<meta name=\"robots\" content=\"noindex,nofollow\">\n<meta name=\"referrer\" content=\"no-referrer\">\n<meta name=\"color-scheme\" content=\"light\">\n<meta name=\"theme-color\" content=\"#f3f4f6\">\n<title>Tarjeta no vigente · FAC-USO Madrid</title>\n<link rel=\"icon\" type=\"image/png\" href=\"../recursos/icono-192.png\">\n<link rel=\"apple-touch-icon\" href=\"../recursos/icono-192.png\">\n<link rel=\"stylesheet\" href=\"../recursos/tarjeta.css\">\n</head>\n<body>\n<div class=\"recuadro\">\n<header class=\"cabecera\">\n  <img class=\"logo\" src=\"../recursos/logo-color.png\" alt=\"FAC-USO Madrid · Federación de Atención a la Ciudadanía\" width=\"250\" height=\"42\">\n</header>\n<main class=\"tarjeta retirada\">\n  <h1 class=\"nombre\"><span aria-hidden=\"true\">⊘ </span>Esta tarjeta ya no está vigente</h1>\n  <p>La organización la ha retirado. Si necesitas el contacto, pide un enlace actualizado a quien te la dio.</p>\n</main>\n<footer class=\"pie\">FAC-USO Madrid</footer>\n</div>\n</body>\n</html>\n";
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
