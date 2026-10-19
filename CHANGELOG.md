# Cambios

Formato basado en «Keep a Changelog». Fechas en AAAA-MM-DD.

## [0.1.0] - 2026-10-19 — Fase 1

### Añadido
- Plantilla pura `generarTarjeta(datos, opciones)` que genera `index.html`, `contacto.vcf` (vCard 3.0),
  `manifest.webmanifest`, `sw.js` y `qr.svg`, con validación estricta y escapado de todos los datos.
- Librería QR `qrcode-generator` 2.0.4 (MIT) copiada en `plantilla/vendor/` con su licencia.
- Recursos compartidos: estilos, script de la tarjeta, logo oficial (color y blanco) e iconos.
- Página de tarjeta mobile first con modo claro y oscuro, botones Guardar contacto, Llamar, Correo,
  Compartir y Mostrar QR, CSP y `noindex,nofollow`.
- Funcionamiento sin conexión con service worker por tarjeta y retirada automática al detectar 404.
- Raíz neutra, `robots.txt` con `Disallow: /`, `404.html` y `.nojekyll`.
- Herramientas `emitir.js`, `retirar.js` y `ejemplo.js`.
- Tarjeta de ejemplo ficticia en `ejemplo/`.
- Workflow de GitHub Pages con actions oficiales de versión fija.
- Pruebas unitarias (`npm test`) y de navegador con Playwright (`npm run test:navegador`).
