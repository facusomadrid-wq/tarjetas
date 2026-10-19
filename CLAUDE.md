# CLAUDE.md — Normas del proyecto Tarjetas de visita FAC-USO Madrid

## Contexto
- Sitio estático para GitHub Pages en el repositorio **público** `facusomadrid-wq/tarjetas`
  (`https://facusomadrid-wq.github.io/tarjetas/<slug>/`).
- Usuario: secretario general de FAC-USO Madrid, nivel medio. Explicar las decisiones en español claro.
- Trabajar por fases y **presentar un plan y esperar aprobación antes de escribir código**.
- Interfaz, comentarios, documentación y commits en español.

## Reglas de negocio (no reabrir sin consultar)
- Las tarjetas **solo las emite el administrador**. No hay formularios ni autoservicio.
- Datos admitidos y nada más: nombre, cargo, organización fija «FAC-USO Madrid», teléfono de trabajo,
  correo de trabajo, consentimiento (fecha, obligatoria, nunca se publica) y slug.
- Sin consentimiento no se emite. Cualquier campo extra se rechaza.
- Raíz neutra: nunca listar tarjetas ni crear índices/JSON con personas en el repositorio.

## Reglas técnicas
- `plantilla/tarjeta.js` es **pura**: sin APIs de Node ni del navegador (solo `require` de la librería QR
  como alternativa cuando no hay `qrcode` global). Debe poder copiarse a Apps Script en la Fase 2.
- Validación estricta + escapado HTML de todo (`escaparHtml`). vCard 3.0 con CRLF, escapado de `,;\`
  y plegado a 75 octetos.
- Páginas sin recursos externos, con CSP en `<meta>`, `noindex,nofollow`, sin analíticas, sin `innerHTML`
  con datos, sin scripts ni estilos en línea (excepto `404.html`, con hash en la CSP).
- Logo oficial a color en `recursos/` (siempre el de color). Nunca recolorear. Filete rojo #E71615 de 3 px.
- Tarjeta siempre en claro (aprobado por el propietario), también con el sistema en oscuro: sin `prefers-color-scheme: dark`.
- Objetivos táctiles ≥ 44 px, contraste AA, el color nunca es el único indicador.
- Cada tarjeta tiene su manifest y su service worker (alcance en su carpeta). Si la página da 404 con
  conexión, el SW borra su caché, se desregistra y muestra «Esta tarjeta ya no está vigente».
- Si cambias `recursos/`, ejecuta `npm run ejemplo` (la prueba de coherencia del ejemplo lo exige).
- Publicación solo con el workflow (actions oficiales con versión fija). No publicar `herramientas/`,
  `tests/`, `plantilla/`, `node_modules/`.

## Seguridad
- Sin secretos, tokens ni datos reales en el repositorio. Los JSON de personas viven fuera del repo.
- No hacer push, ni crear repositorios, ni tocar GitHub Pages sin permiso explícito del usuario.
- Fase 2: el token de GitHub será *fine-grained*, limitado a este repositorio, y se guardará en
  Propiedades del script de Apps Script, nunca en el código.

## Pruebas
- `npm test` (node:test) para la lógica pura y las herramientas. Toda función nueva necesita prueba.
- `npm run test:navegador` (Playwright, 390 px, sistema en claro/oscuro, sin conexión, retirada). No ejecutar
  `playwright install`.
- No afirmar que algo está probado si no se ha ejecutado la prueba.
