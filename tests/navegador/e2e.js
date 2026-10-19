'use strict';
/*
 * Pruebas en navegador (Chromium con Playwright) de la tarjeta de ejemplo.
 *
 * Requisitos (no se instala nada desde aquí; no se ejecuta «playwright install»):
 *   NODE_PATH=<carpeta con node_modules/playwright>   (por defecto, la del entorno de pruebas)
 *   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers          (Chromium ya instalado)
 *   CAPTURAS=<carpeta donde guardar las capturas>      (opcional)
 *
 *   npm run test:navegador
 *
 * Qué comprueba: 390 px en claro y oscuro, objetivos táctiles ≥ 44 px, sin scroll horizontal,
 * sin errores de consola, logo correcto por modo, filete rojo, QR a pantalla completa,
 * compartir (alternativa de copiar enlace), descarga del .vcf, funcionamiento sin conexión
 * (con el servidor apagado) y retirada (404 → «Esta tarjeta ya no está vigente»).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { crearServidor } = require('./servidor.js');

const ENTORNO_PRUEBAS = '/tmp/claude-0/-home-user/f5c89f95-9428-5653-b1b0-cd6853f3ef0f/scratchpad';
if (!process.env.NODE_PATH) process.env.NODE_PATH = path.join(ENTORNO_PRUEBAS, 'ui', 'node_modules');
Module._initPaths();
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/pw-browsers';
const { chromium } = require('playwright');

const RAIZ_REPO = path.resolve(__dirname, '..', '..');
const CAPTURAS = process.env.CAPTURAS || path.join(ENTORNO_PRUEBAS, 'tarjetas-capturas');
const ANCHO = 390;
const ALTO = 844;

let fallos = 0;
let pasadas = 0;
function comprobar(condicion, descripcion, detalle) {
  if (condicion) {
    pasadas++;
    console.log(`  ok - ${descripcion}`);
  } else {
    fallos++;
    console.log(`  FALLO - ${descripcion}${detalle !== undefined ? ' :: ' + JSON.stringify(detalle) : ''}`);
  }
}

/** Copia solo lo que publica el workflow de Pages (misma regla que .github/workflows/pages.yml). */
function construirSitio() {
  const destino = fs.mkdtempSync(path.join(os.tmpdir(), 'tarjetas-site-'));
  for (const f of ['index.html', '404.html', 'robots.txt', '.nojekyll']) {
    fs.copyFileSync(path.join(RAIZ_REPO, f), path.join(destino, f));
  }
  fs.cpSync(path.join(RAIZ_REPO, 'recursos'), path.join(destino, 'recursos'), { recursive: true });
  const excluidas = ['herramientas', 'tests', 'plantilla', 'node_modules', 'recursos', 'docs', '_site'];
  for (const e of fs.readdirSync(RAIZ_REPO, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith('.') || excluidas.includes(e.name)) continue;
    const c = path.join(RAIZ_REPO, e.name);
    if (['sw.js', 'contacto.vcf', 'index.html'].every((f) => fs.existsSync(path.join(c, f)))) {
      fs.mkdirSync(path.join(destino, e.name));
      for (const f of ['index.html', 'contacto.vcf', 'manifest.webmanifest', 'sw.js', 'qr.svg']) {
        fs.copyFileSync(path.join(c, f), path.join(destino, e.name, f));
      }
    }
  }
  return destino;
}

function escuchar(servidor, puerto) {
  return new Promise((resolver) => servidor.listen(puerto, '127.0.0.1', () => resolver(servidor.address().port)));
}

function apagar(servidor) {
  return new Promise((resolver) => {
    servidor.closeAllConnections();
    servidor.close(() => resolver());
  });
}

function vigilarConsola(pagina, errores) {
  pagina.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  pagina.on('pageerror', (e) => errores.push(String(e)));
}

async function comprobarDiseno(pagina, etiqueta) {
  const medidas = await pagina.evaluate(() => {
    const doc = document.documentElement;
    const pequenos = [];
    for (const el of document.querySelectorAll('a, button, input')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue; // oculto
      if (r.height < 44 || r.width < 44) pequenos.push({ texto: el.textContent.trim(), ancho: r.width, alto: r.height });
    }
    const sinTexto = [...document.querySelectorAll('.boton')].filter((b) => !b.textContent.trim()).length;
    const cabecera = getComputedStyle(document.querySelector('.cabecera'));
    const logo = document.querySelector('.logo');
    return {
      scrollAncho: doc.scrollWidth,
      anchoVisible: doc.clientWidth,
      pequenos,
      sinTexto,
      filete: cabecera.borderBottomWidth + ' ' + cabecera.borderBottomStyle + ' ' + cabecera.borderBottomColor,
      logo: logo.currentSrc,
      logoCargado: logo.complete && logo.naturalWidth > 0,
      fondo: getComputedStyle(document.body).backgroundColor
    };
  });
  comprobar(medidas.scrollAncho <= medidas.anchoVisible, `${etiqueta}: sin scroll horizontal`, medidas);
  comprobar(medidas.pequenos.length === 0, `${etiqueta}: objetivos táctiles ≥ 44 px`, medidas.pequenos);
  comprobar(medidas.sinTexto === 0, `${etiqueta}: todos los botones tienen texto (no solo icono/color)`);
  comprobar(medidas.filete === '3px solid rgb(231, 22, 21)', `${etiqueta}: filete rojo de 3 px en la cabecera`, medidas.filete);
  comprobar(medidas.logoCargado, `${etiqueta}: logo cargado`);
  return medidas;
}

async function main() {
  fs.mkdirSync(CAPTURAS, { recursive: true });
  const sitio = construirSitio();
  let servidor = crearServidor(sitio);
  const puerto = await escuchar(servidor, 0);
  const base = `http://localhost:${puerto}/tarjetas/`;
  const urlTarjeta = base + 'ejemplo/';
  console.log(`Sitio de prueba en ${sitio}, servido en ${base}`);

  const navegador = await chromium.launch();
  try {
    // ---------------------------------------------------------------- claro y oscuro
    for (const esquema of ['light', 'dark']) {
      const nombre = esquema === 'light' ? 'claro' : 'oscuro';
      console.log(`\n# Tarjeta en modo ${nombre} (${ANCHO} px)`);
      const contexto = await navegador.newContext({
        viewport: { width: ANCHO, height: ALTO },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        colorScheme: esquema,
        acceptDownloads: true,
        locale: 'es-ES',
        serviceWorkers: 'block' // aquí se prueba la página; el SW se prueba aparte
      });
      await contexto.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://localhost:${puerto}` });
      const pagina = await contexto.newPage();
      const errores = [];
      vigilarConsola(pagina, errores);
      const r = await pagina.goto(urlTarjeta, { waitUntil: 'networkidle' });
      comprobar(r.status() === 200, `${nombre}: la tarjeta responde 200`);
      comprobar((await pagina.textContent('h1')).trim() === 'Nombre Ejemplo', `${nombre}: muestra el nombre`);
      comprobar((await pagina.textContent('.pie')).trim() === 'Tarjeta emitida por FAC-USO Madrid', `${nombre}: pie correcto`);
      const robots = await pagina.getAttribute('meta[name="robots"]', 'content');
      comprobar(robots === 'noindex,nofollow', `${nombre}: noindex,nofollow`);
      const medidas = await comprobarDiseno(pagina, nombre);
      const logoEsperado = esquema === 'dark' ? 'logo-blanco.png' : 'logo-color.png';
      comprobar(medidas.logo.endsWith(logoEsperado), `${nombre}: usa ${logoEsperado}`, medidas.logo);
      await pagina.screenshot({ path: path.join(CAPTURAS, `tarjeta-${nombre}.png`), fullPage: true });

      // Mostrar QR a pantalla completa
      await pagina.click('#boton-qr');
      const qr = await pagina.evaluate(() => {
        const capa = document.getElementById('qr-pantalla');
        const r = capa.getBoundingClientRect();
        const img = capa.querySelector('img');
        return {
          visible: !capa.hidden, ancho: r.width, alto: r.height,
          imagen: img.complete && img.naturalWidth > 0,
          foco: document.activeElement && document.activeElement.id
        };
      });
      comprobar(qr.visible && qr.ancho === ANCHO && qr.alto === ALTO, `${nombre}: QR a pantalla completa`, qr);
      comprobar(qr.imagen, `${nombre}: la imagen del QR carga`);
      comprobar(qr.foco === 'boton-cerrar-qr', `${nombre}: el foco va al botón Cerrar`);
      await comprobarDiseno(pagina, `${nombre} (QR abierto)`);
      await pagina.screenshot({ path: path.join(CAPTURAS, `qr-${nombre}.png`) });
      await pagina.keyboard.press('Escape');
      comprobar(await pagina.evaluate(() => document.getElementById('qr-pantalla').hidden), `${nombre}: Escape cierra el QR`);
      await pagina.click('#boton-qr');
      await pagina.click('#boton-cerrar-qr');
      comprobar(await pagina.evaluate(() => document.getElementById('qr-pantalla').hidden), `${nombre}: el botón Cerrar cierra el QR`);

      // Compartir (en Chromium de escritorio no hay Web Share API: se copia el enlace)
      const tieneShare = await pagina.evaluate(() => typeof navigator.share === 'function');
      if (!tieneShare) {
        await pagina.click('#boton-compartir');
        await pagina.waitForFunction(() => document.getElementById('aviso').textContent.length > 0);
        const aviso = await pagina.textContent('#aviso');
        const portapapeles = await pagina.evaluate(() => navigator.clipboard.readText());
        comprobar(/Enlace copiado/.test(aviso), `${nombre}: Compartir copia el enlace y lo avisa con texto`, aviso);
        comprobar(portapapeles === 'https://facusomadrid-wq.github.io/tarjetas/ejemplo/', `${nombre}: enlace copiado correcto`, portapapeles);
      } else {
        console.log('  (Web Share API disponible: no se prueba la alternativa de copiar)');
      }

      // Descarga del contacto
      const [descarga] = await Promise.all([pagina.waitForEvent('download'), pagina.click('text=Guardar contacto')]);
      const rutaVcf = await descarga.path();
      const vcf = fs.readFileSync(rutaVcf, 'utf8');
      comprobar(descarga.suggestedFilename() === 'ejemplo.vcf', `${nombre}: nombre del archivo descargado`, descarga.suggestedFilename());
      comprobar(vcf.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n') && vcf.includes('FN:Nombre Ejemplo\r\n') &&
        vcf.includes('TEL;TYPE=WORK,VOICE:+34600000000\r\n') && vcf.endsWith('END:VCARD\r\n'),
      `${nombre}: el .vcf descargado es una vCard 3.0 con CRLF`);

      comprobar(errores.length === 0, `${nombre}: sin errores de consola`, errores);
      await contexto.close();
    }

    // ---------------------------------------------------------------- raíz y 404
    console.log('\n# Raíz del sitio y página 404');
    {
      const contexto = await navegador.newContext({ viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: 2, isMobile: true });
      const pagina = await contexto.newPage();
      const errores = [];
      vigilarConsola(pagina, errores);
      await pagina.goto(base, { waitUntil: 'networkidle' });
      const texto = await pagina.textContent('main');
      comprobar(texto.includes('Para ver una tarjeta usa el enlace que te han dado.'), 'raíz: texto neutro');
      comprobar((await pagina.$$('main a')).length === 0, 'raíz: sin enlaces a tarjetas');
      await comprobarDiseno(pagina, 'raíz');
      comprobar(errores.length === 0, 'raíz: sin errores de consola', errores);
      await pagina.screenshot({ path: path.join(CAPTURAS, 'raiz.png'), fullPage: true });
      const r404 = await pagina.goto(base + 'no-existe/');
      comprobar(r404.status() === 404, '404: estado 404');
      comprobar((await pagina.textContent('h1')).includes('Página no encontrada'), '404: texto neutro');
      await pagina.screenshot({ path: path.join(CAPTURAS, 'pagina-404.png') });
      const robots = await (await pagina.goto(base + 'robots.txt')).text();
      comprobar(robots.includes('Disallow: /'), 'robots.txt: Disallow: /');
      await contexto.close();
    }

    // ---------------------------------------------------------------- sin conexión y retirada
    console.log('\n# Sin conexión (service worker) y retirada');
    {
      const contexto = await navegador.newContext({
        viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: 2, isMobile: true, colorScheme: 'light'
      });
      const pagina = await contexto.newPage();
      const errores = [];
      vigilarConsola(pagina, errores);
      await pagina.goto(urlTarjeta, { waitUntil: 'networkidle' });
      await pagina.evaluate(() => navigator.serviceWorker.ready);
      await pagina.waitForFunction(async () => {
        const claves = await caches.keys();
        const clave = claves.find((c) => c.startsWith('tarjeta-ejemplo-'));
        if (!clave) return false;
        return (await (await caches.open(clave)).keys()).length >= 10;
      }, null, { timeout: 15000 });
      if (!(await pagina.evaluate(() => !!navigator.serviceWorker.controller))) {
        await pagina.reload({ waitUntil: 'networkidle' });
      }
      const estadoSw = await pagina.evaluate(async () => ({
        controlado: !!navigator.serviceWorker.controller,
        alcance: (await navigator.serviceWorker.getRegistration()).scope,
        caches: await caches.keys()
      }));
      comprobar(estadoSw.controlado, 'SW: controla la página', estadoSw);
      comprobar(estadoSw.alcance === urlTarjeta, 'SW: alcance limitado a la carpeta de la tarjeta', estadoSw.alcance);
      const manifiesto = await pagina.evaluate(async () => {
        const enlace = document.querySelector('link[rel="manifest"]').href;
        return (await fetch(enlace)).json();
      });
      comprobar(manifiesto.start_url === './' && manifiesto.scope === './', 'manifest: start_url y scope en la carpeta');

      // Sin conexión: red cortada en el navegador Y servidor apagado.
      await contexto.setOffline(true);
      await apagar(servidor);
      await pagina.reload({ waitUntil: 'load' });
      await pagina.waitForTimeout(500);
      const nombreOffline = (await pagina.textContent('h1')).trim();
      comprobar(nombreOffline === 'Nombre Ejemplo', 'sin conexión: la tarjeta se sigue viendo', nombreOffline);
      const offline = await pagina.evaluate(() => ({
        logo: document.querySelector('.logo').naturalWidth > 0,
        css: getComputedStyle(document.querySelector('.cabecera')).borderBottomWidth
      }));
      comprobar(offline.logo && offline.css === '3px', 'sin conexión: estilos y logo desde la caché', offline);
      await pagina.click('#boton-qr');
      comprobar(await pagina.evaluate(() => document.querySelector('.qr-imagen').naturalWidth > 0), 'sin conexión: el QR se muestra');
      await pagina.click('#boton-cerrar-qr');
      const [descarga] = await Promise.all([pagina.waitForEvent('download'), pagina.click('text=Guardar contacto')]);
      comprobar(fs.readFileSync(await descarga.path(), 'utf8').includes('FN:Nombre Ejemplo'), 'sin conexión: se descarga el .vcf');
      await pagina.screenshot({ path: path.join(CAPTURAS, 'sin-conexion.png'), fullPage: true });
      const erroresAntesDeRetirar = errores.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource|net::/.test(e));
      comprobar(erroresAntesDeRetirar.length === 0, 'sin conexión: sin errores de consola (salvo avisos de red)', errores);

      // Retirada: se borra la carpeta y se vuelve a abrir con conexión.
      fs.rmSync(path.join(sitio, 'ejemplo'), { recursive: true, force: true });
      servidor = crearServidor(sitio);
      await escuchar(servidor, puerto);
      await contexto.setOffline(false);
      errores.length = 0;
      const respuesta = await pagina.reload({ waitUntil: 'networkidle' });
      const titulo = (await pagina.textContent('h1')).trim();
      comprobar(respuesta.status() === 404, 'retirada: la página responde 404', respuesta.status());
      comprobar(titulo.includes('Esta tarjeta ya no está vigente'), 'retirada: muestra «Esta tarjeta ya no está vigente»', titulo);
      comprobar(!(await pagina.content()).includes('Nombre Ejemplo'), 'retirada: ya no aparece ningún dato de la persona');
      await pagina.screenshot({ path: path.join(CAPTURAS, 'retirada.png'), fullPage: true });
      const tras = await pagina.evaluate(async () => ({
        caches: await caches.keys(),
        registros: (await navigator.serviceWorker.getRegistrations()).length
      }));
      comprobar(tras.caches.filter((c) => c.startsWith('tarjeta-ejemplo-')).length === 0, 'retirada: la caché se ha borrado', tras.caches);
      comprobar(tras.registros === 0, 'retirada: el service worker se ha desregistrado', tras.registros);
      const inesperados = errores.filter((e) => !/status of 404/.test(e));
      comprobar(inesperados.length === 0, 'retirada: sin errores de consola (salvo el propio 404)', errores);

      // Tras la retirada, sin conexión ya no queda copia de la tarjeta.
      await contexto.setOffline(true);
      let sigueVisible = false;
      try {
        await pagina.reload({ waitUntil: 'load', timeout: 5000 });
        sigueVisible = (await pagina.content()).includes('Nombre Ejemplo');
      } catch (_) {
        sigueVisible = false;
      }
      comprobar(!sigueVisible, 'retirada: sin conexión ya no se puede ver la tarjeta antigua');
      await contexto.close();
    }
  } finally {
    await navegador.close();
    await apagar(servidor).catch(() => {});
    fs.rmSync(sitio, { recursive: true, force: true });
  }

  console.log(`\nResultado: ${pasadas} comprobaciones correctas, ${fallos} fallos.`);
  console.log(`Capturas en ${CAPTURAS}`);
  if (fallos) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
