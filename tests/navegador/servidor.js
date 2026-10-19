'use strict';
/*
 * Servidor estático mínimo para las pruebas: sirve una carpeta bajo /tarjetas/
 * (igual que GitHub Pages en https://facusomadrid-wq.github.io/tarjetas/) y
 * responde 404 con 404.html cuando un archivo no existe.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.vcf': 'text/vcard; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8'
};

function crearServidor(raiz, prefijo = '/tarjetas/') {
  return http.createServer((peticion, respuesta) => {
    const url = new URL(peticion.url, 'http://localhost');
    let ruta = decodeURIComponent(url.pathname);
    const no404 = () => {
      const pagina = path.join(raiz, '404.html');
      respuesta.writeHead(404, { 'Content-Type': TIPOS['.html'], 'Cache-Control': 'max-age=600' });
      respuesta.end(fs.existsSync(pagina) ? fs.readFileSync(pagina) : 'No encontrado');
    };
    if (ruta + '/' === prefijo) {
      respuesta.writeHead(301, { Location: prefijo });
      return respuesta.end();
    }
    if (!ruta.startsWith(prefijo)) return no404();
    ruta = ruta.slice(prefijo.length);
    let archivo = path.resolve(raiz, '.' + path.posix.sep + ruta);
    if (archivo !== raiz && !archivo.startsWith(raiz + path.sep)) return no404();
    if (fs.existsSync(archivo) && fs.statSync(archivo).isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        respuesta.writeHead(301, { Location: url.pathname + '/' });
        return respuesta.end();
      }
      archivo = path.join(archivo, 'index.html');
    }
    if (!fs.existsSync(archivo) || !fs.statSync(archivo).isFile()) return no404();
    respuesta.writeHead(200, {
      'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream',
      'Cache-Control': 'max-age=600'
    });
    respuesta.end(fs.readFileSync(archivo));
  });
}

module.exports = { crearServidor };
