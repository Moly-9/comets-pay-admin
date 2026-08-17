import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const host = process.env.HOST || '0.0.0.0';
const port = Number.parseInt(process.env.PORT || '8771', 10);
const distDirectory = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const indexFile = resolve(distDirectory, 'index.html');

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.ttf', 'font/ttf'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function sendFile(request, response, filePath) {
  const metadata = statSync(filePath);
  const extension = extname(filePath).toLowerCase();
  const isIndex = filePath === indexFile;

  response.statusCode = 200;
  response.setHeader(
    'Content-Type',
    contentTypes.get(extension) || 'application/octet-stream',
  );
  response.setHeader('Content-Length', metadata.size);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'same-origin');
  response.setHeader('X-Frame-Options', 'SAMEORIGIN');
  response.setHeader(
    'Cache-Control',
    isIndex ? 'no-cache' : 'public, max-age=31536000, immutable',
  );

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  createReadStream(filePath)
    .on('error', () => {
      if (!response.headersSent) {
        response.statusCode = 500;
      }
      response.end();
    })
    .pipe(response);
}

const server = createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.statusCode = 405;
    response.setHeader('Allow', 'GET, HEAD');
    response.end('Method Not Allowed');
    return;
  }

  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

  if (url.pathname === '/health') {
    const body = JSON.stringify({
      ok: true,
      service: 'muse-pay-8771',
      host,
      port,
    });
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Length', Buffer.byteLength(body));
    response.end(request.method === 'HEAD' ? undefined : body);
    return;
  }

  let requestedPath;
  try {
    requestedPath = decodeURIComponent(url.pathname);
  } catch {
    response.statusCode = 400;
    response.end('Bad Request');
    return;
  }

  const candidate = resolve(distDirectory, `.${requestedPath}`);
  const isInsideDist =
    candidate === distDirectory || candidate.startsWith(`${distDirectory}${sep}`);

  if (!isInsideDist) {
    response.statusCode = 403;
    response.end('Forbidden');
    return;
  }

  try {
    const metadata = statSync(candidate);
    if (metadata.isFile()) {
      sendFile(request, response, candidate);
      return;
    }
  } catch {
    // Client-side routes fall back to the application shell below.
  }

  if (requestedPath.startsWith('/assets/')) {
    response.statusCode = 404;
    response.end('Not Found');
    return;
  }

  sendFile(request, response, indexFile);
});

server.on('error', (error) => {
  console.error(`[muse-pay-8771] server error: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`[muse-pay-8771] listening on http://${host}:${port}`);
});

function shutDown(signal) {
  console.log(`[muse-pay-8771] received ${signal}; shutting down`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutDown('SIGINT'));
process.on('SIGTERM', () => shutDown('SIGTERM'));
