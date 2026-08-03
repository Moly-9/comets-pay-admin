import type { IncomingMessage } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleAirwallexMockRequest } from './dev/airwallexMockService';

const readJsonBody = (request: IncomingMessage) => new Promise<unknown>((resolve, reject) => {
  const chunks: Buffer[] = [];
  let size = 0;
  request.on('data', (chunk: Buffer) => {
    size += chunk.length;
    if (size > 1024 * 1024) {
      reject(new Error('请求体超过 1 MB'));
      request.destroy();
      return;
    }
    chunks.push(chunk);
  });
  request.on('end', () => {
    if (chunks.length === 0) {
      resolve({});
      return;
    }
    try {
      resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    } catch {
      reject(new Error('请求体不是有效 JSON'));
    }
  });
  request.on('error', reject);
});

const airwallexMockPlugin = (): Plugin => ({
  name: 'comets-airwallex-local-mock',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
      if (!path.startsWith('/api/integrations/airwallex/')) {
        next();
        return;
      }
      if (request.method !== 'POST') {
        response.statusCode = 405;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(JSON.stringify({ message: '本地 Airwallex 模拟接口仅接受 POST', simulated: true }));
        return;
      }

      try {
        const result = handleAirwallexMockRequest(path, await readJsonBody(request));
        if (!result) {
          next();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 180));
        response.statusCode = result.status;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('x-comets-airwallex-environment', 'mock');
        response.end(JSON.stringify(result.body));
      } catch (error) {
        response.statusCode = 400;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(JSON.stringify({
          message: error instanceof Error ? error.message : 'Airwallex 模拟接口请求失败',
          simulated: true,
        }));
      }
    });
  },
});

export default defineConfig({
  plugins: [airwallexMockPlugin(), react()],
  server: {
    hmr: {
      host: '127.0.0.1',
    },
  },
});
