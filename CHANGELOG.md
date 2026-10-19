# Cambios

Formato basado en «Keep a Changelog». Fechas en AAAA-MM-DD.

## [0.2.0] - 2026-10-19 — Rediseño claro

### Cambiado
- La tarjeta se ve **siempre en claro**, también si el móvil está en modo oscuro: sin reglas
  `prefers-color-scheme: dark` (tarjeta, raíz, 404 y página de retirada), `color-scheme: light` y
  `theme-color` claro (`#f3f4f6`, también en el manifest).
- Aspecto de tarjeta física: fondo gris muy claro y recuadro blanco centrado (máx. 440 px) con esquinas
  redondeadas y sombra suave; logo a color arriba con el filete rojo de 3 px; nombre grande en gris muy
  oscuro; cargo en verde de la familia FAC (`#007A3D`, 5,4:1; el `#00A94E` puro solo da 3,1:1 como texto);
  «FAC-USO Madrid» discreto con marca verde; teléfono y correo en lista con icono, etiqueta y valor.
- Botones: «Guardar contacto» principal en rojo `#E71615` con texto blanco (4,6:1) y Llamar / Correo /
  Compartir / Mostrar QR en rejilla 2x2 con borde fino, todos ≥ 44 px. El pie va dentro del recuadro.
- La pantalla del QR tiene siempre fondo blanco.

### Eliminado
- `recursos/logo-blanco.png` y su variante `<picture>`: el logo es siempre el de color.

### Pruebas
- Unitarias: sin modo oscuro en CSS/raíz/404, contraste AA de los colores de texto del diseño.
- Navegador: con el sistema en oscuro la tarjeta, el QR, la raíz y la 404 siguen claros y con el logo a
  color; contraste AA medido sobre los estilos calculados; recuadro, botón principal y pie.

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
