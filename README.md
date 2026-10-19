# Tarjetas de visita digitales · FAC-USO Madrid

Sitio estático (GitHub Pages) con las tarjetas de visita digitales de las delegadas y delegados de
FAC-USO Madrid. Cada tarjeta vive en su propia carpeta:

```
https://facusomadrid-wq.github.io/tarjetas/<slug>/
```

- **Solo las emite el administrador.** No hay formulario público: nadie puede crearse una tarjeta en
  nombre de la organización. Una tarjeta solo existe si el administrador la genera y la publica en este
  repositorio.
- **Aspecto profesional**: logo oficial, colores corporativos (rojo USO `#E71615`, verde FAC `#00A94E`),
  siempre en claro (aspecto de tarjeta física, también con el móvil en modo oscuro), pensado primero para móvil (Android e iPhone).
- **Funciona sin conexión** y se puede instalar en la pantalla de inicio.

Cada tarjeta ofrece: **Guardar contacto** (vCard), **Llamar**, **Correo**, **Compartir** y
**Mostrar QR** a pantalla completa.

## Estructura

| Ruta | Qué es |
|---|---|
| `index.html`, `404.html`, `robots.txt`, `.nojekyll` | Raíz neutra del sitio (sin listado de tarjetas). |
| `recursos/` | Archivos compartidos: estilos, script, logo oficial a color e iconos. |
| `<slug>/` | Una tarjeta: `index.html`, `contacto.vcf`, `manifest.webmanifest`, `sw.js`, `qr.svg`. |
| `ejemplo/` | Única tarjeta incluida, **totalmente ficticia** («Nombre Ejemplo»). |
| `plantilla/tarjeta.js` | Plantilla pura `generarTarjeta(datos, opciones)` (sin APIs de Node; reutilizable desde Apps Script). |
| `plantilla/vendor/` | Librería QR `qrcode-generator` (MIT, Kazuhiko Arase) y su licencia. |
| `herramientas/` | `emitir.js`, `retirar.js`, `ejemplo.js` (no se publican). |
| `tests/` | Pruebas unitarias y de navegador (no se publican). |
| `.github/workflows/pages.yml` | Publicación con GitHub Actions en la rama `gh-pages`. |

## Emitir una tarjeta

1. Consigue el **consentimiento** de la persona para publicar sus datos profesionales.
2. Crea un JSON **fuera del repositorio** (por ejemplo en una carpeta privada de la federación):

   ```json
   {
     "nombre": "Nombre Apellido",
     "cargo": "Delegado sindical",
     "telefono": "600 000 000",
     "correo": "trabajo@example.org",
     "consentimiento": "2026-10-19"
   }
   ```

   - `nombre` y `cargo`: obligatorios.
   - `telefono` y `correo`: opcionales, **solo de trabajo**. Teléfono español (9 cifras) o internacional con `+`.
   - `consentimiento`: fecha `AAAA-MM-DD` en que la persona dio su consentimiento. **Obligatoria**: sin
     ella no se emite la tarjeta. No se muestra ni se publica.
   - `slug` (opcional): la parte final del enlace. Si no se indica, se deriva del nombre
     (minúsculas, sin tildes, con guiones).
   - Cualquier otro campo se rechaza (mínimos datos).

3. Genera la tarjeta:

   ```bash
   node herramientas/emitir.js /ruta/privada/persona.json
   ```

   Crea o actualiza la carpeta `<slug>/`. Si el JSON está dentro del repositorio, falta el
   consentimiento o algún dato no es válido, se detiene sin escribir nada.

4. Revisa con `git status` / `git diff`, haz commit y publica (en la Fase 1, a mano; en la Fase 2,
   desde el panel de Apps Script).

Para actualizar una tarjeta, edita el JSON y vuelve a ejecutar `emitir.js`.

## Retirar una tarjeta

```bash
node herramientas/retirar.js <slug>
```

Borra la carpeta (solo si es una carpeta de tarjeta). Al publicar el cambio, el enlace devuelve 404.
En los móviles que la tenían guardada, la próxima vez que se abra **con conexión** el service worker
borra su copia, se da de baja y muestra «Esta tarjeta ya no está vigente».

## Privacidad

- En la tarjeta solo aparecen **datos profesionales**: nombre, cargo, organización (fija:
  «FAC-USO Madrid»), y teléfono y correo **de trabajo** si se indican.
- Solo se publica con el **consentimiento** de la persona. La fecha se exige al emitir pero no se
  publica; el JSON con los datos y la fecha se guarda **fuera** del repositorio como justificante.
- El repositorio es público: **nunca** se suben JSON de personas (el `.gitignore` los bloquea), ni
  listados, ni índices. La raíz del sitio no enumera tarjetas.
- Páginas con `noindex,nofollow` y `robots.txt` con `Disallow: /`: los buscadores no deben indexarlas.
- Sin analíticas, sin cookies, sin recursos externos (ni CDN ni Google Fonts) y con política CSP
  estricta. Todo se sirve desde el propio sitio.
- La persona puede pedir la retirada en cualquier momento: `retirar.js` y publicar.

## Pruebas

```bash
npm test                 # node:test: validación, escapado/inyección, slug, vCard, generación, herramientas
npm run test:navegador   # Playwright + Chromium (390 px, sistema en claro/oscuro, contraste AA, 44 px, sin conexión, retirada)
```

`test:navegador` no instala nada: usa un Playwright ya disponible (`NODE_PATH`) y el Chromium de
`PLAYWRIGHT_BROWSERS_PATH` (por defecto `/opt/pw-browsers`). Las capturas se guardan en la carpeta
indicada en `CAPTURAS`. Sirve el sitio con un servidor estático local bajo `/tarjetas/`, igual que
GitHub Pages.

## Publicación

El workflow `.github/workflows/pages.yml` (al hacer push a `main`) pasa las pruebas unitarias y
publica **solo** la raíz, `recursos/` y las carpetas de tarjeta. Nunca publica `herramientas/`,
`tests/`, `plantilla/`, `node_modules/` ni la documentación. El resultado se guarda en la rama
`gh-pages` (la genera el workflow; no se edita a mano). En el repositorio: *Settings → Pages →
Source: Deploy from a branch → `gh-pages` / `(root)`*.

## Licencias

- Código del proyecto: uso interno de FAC-USO Madrid.
- `plantilla/vendor/qrcode.js`: qrcode-generator 2.0.4, © 2009 Kazuhiko Arase, licencia MIT
  (`plantilla/vendor/LICENSE-qrcode-generator.txt`). «QR Code» es marca registrada de DENSO WAVE.
- Logo de FAC-USO Madrid: marca de la organización; no se recolorea ni se modifica.
