import { sveltekit } from '@sveltejs/kit/vite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import type { Plugin, ViteDevServer } from 'vite';
import { parseOuraZip } from './src/lib/oura/parse';

function openOuraVisualFixture(): Plugin {
  let summaryJson: string | null = null;

  return {
    name: 'openoura-visual-fixture',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__openoura_visual_summary', async (request, response) => {
        try {
          const host = request.headers.host ?? '';
          if (!isLoopbackHost(host)) {
            response.statusCode = 403;
            response.end('Visual fixture is only available from localhost.');
            return;
          }

          if (!summaryJson) {
            const bytes = await readFile(resolve('data.zip'));
            const summary = await parseOuraZip(bytes, { sourceName: 'data.zip' });
            summaryJson = JSON.stringify(summary);
          }

          response.setHeader('content-type', 'application/json');
          response.setHeader('cache-control', 'no-store');
          response.end(summaryJson);
        } catch (error) {
          response.statusCode = 500;
          response.end(error instanceof Error ? error.message : 'Visual fixture failed.');
        }
      });
    }
  };
}

function isLoopbackHost(host: string) {
  const normalized = host.toLowerCase();
  if (normalized.startsWith('[::1]')) return true;

  const hostname = normalized.split(':')[0];
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

export default defineConfig({
  plugins: [openOuraVisualFixture(), sveltekit()]
});
