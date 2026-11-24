/*
 * Comportamiento compartido de las tarjetas de visita de FAC-USO Madrid.
 * Sin dependencias. Los textos se insertan siempre con textContent.
 */
(function () {
  'use strict';

  var tarjeta = document.getElementById('tarjeta');
  if (!tarjeta) return; // Página sin tarjeta (raíz del sitio): nada que hacer.

  var url = tarjeta.getAttribute('data-url') || location.href;
  var titulo = tarjeta.getAttribute('data-titulo') || document.title;
  var aviso = document.getElementById('aviso');
  var bloqueCopiar = document.getElementById('copiar');
  var campoEnlace = document.getElementById('campo-enlace');
  var pantallaQr = document.getElementById('qr-pantalla');
  var botonQr = document.getElementById('boton-qr');
  var botonCerrarQr = document.getElementById('boton-cerrar-qr');
  var botonCompartir = document.getElementById('boton-compartir');

  function mostrarAviso(texto) {
    if (aviso) aviso.textContent = texto;
  }

  // Funcionamiento sin conexión: cada tarjeta tiene su propio service worker en su carpeta.
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () {
        // Sin service worker la tarjeta sigue funcionando en línea.
      });
    });
  }

  // Guardar contacto sin conexión: algunos navegadores descargan sin pasar por el service worker,
  // así que se lee la vCard guardada en caché y se descarga desde memoria.
  var enlaceVcf = document.querySelector('a[href="contacto.vcf"]');
  if (enlaceVcf && window.fetch && window.Blob && window.URL && URL.createObjectURL) {
    enlaceVcf.addEventListener('click', function (evento) {
      if (navigator.onLine !== false) return; // Con conexión: enlace normal (lo más compatible en iPhone).
      evento.preventDefault();
      fetch('contacto.vcf')
        .then(function (respuesta) {
          if (!respuesta.ok) throw new Error('sin copia');
          return respuesta.text();
        })
        .then(function (texto) {
          var direccion = URL.createObjectURL(new Blob([texto], { type: 'text/vcard;charset=utf-8' }));
          var temporal = document.createElement('a');
          temporal.href = direccion;
          temporal.download = enlaceVcf.getAttribute('download') || 'contacto.vcf';
          document.body.appendChild(temporal);
          temporal.click();
          temporal.remove();
          setTimeout(function () { URL.revokeObjectURL(direccion); }, 10000);
        })
        .catch(function () {
          mostrarAviso('No se puede guardar el contacto sin conexión. Inténtalo cuando tengas conexión.');
        });
    });
  }

  // Compartir: Web Share API y, si no existe, copiar el enlace.
  function copiarEnlace() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(url).then(function () {
        mostrarAviso('✓ Enlace copiado. Pégalo donde quieras compartirlo.');
      }, mostrarCampoCopiar);
    }
    mostrarCampoCopiar();
    return Promise.resolve();
  }

  function mostrarCampoCopiar() {
    if (!bloqueCopiar || !campoEnlace) return;
    bloqueCopiar.hidden = false;
    campoEnlace.focus();
    campoEnlace.select();
    mostrarAviso('Copia el enlace del campo de abajo.');
  }

  if (botonCompartir) {
    botonCompartir.addEventListener('click', function () {
      mostrarAviso('');
      if (navigator.share) {
        navigator.share({ title: titulo, text: titulo, url: url }).catch(function (error) {
          if (error && error.name === 'AbortError') return; // La persona canceló.
          copiarEnlace();
        });
      } else {
        copiarEnlace();
      }
    });
  }

  // QR a pantalla completa.
  function abrirQr() {
    pantallaQr.hidden = false;
    document.body.style.overflow = 'hidden';
    botonCerrarQr.focus();
  }

  function cerrarQr() {
    pantallaQr.hidden = true;
    document.body.style.overflow = '';
    botonQr.focus();
  }

  if (botonQr && pantallaQr && botonCerrarQr) {
    botonQr.addEventListener('click', abrirQr);
    botonCerrarQr.addEventListener('click', cerrarQr);
    pantallaQr.addEventListener('click', function (evento) {
      if (evento.target === pantallaQr) cerrarQr();
    });
    document.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape' && !pantallaQr.hidden) cerrarQr();
    });
  }
})();
