import dotenv from 'dotenv';
dotenv.config();

import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { handleChatRequest, handleCorrectionRequest, handleGrammarBreakdown, handleWordLookup } from './src/server/geminiService.ts';

function apiPlugin(): Plugin {
  return {
    name: 'api-server-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        // Allow cross-origin requests from iframes and client fetch
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          return next();
        }

        const pathname = req.url.split('?')[0];

        let bodyStr = '';
        req.on('data', chunk => {
          bodyStr += chunk;
        });

        req.on('error', (err) => {
          console.error(`[API Stream Error] ${pathname}:`, err);
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Request stream error' }));
        });

        req.on('end', async () => {
          try {
            const body = bodyStr ? JSON.parse(bodyStr) : {};

            if (pathname === '/api/chat') {
              const { language, persona, history, userInput, tone, difficulty } = body;
              const result = await handleChatRequest(language, persona, history, userInput, { tone, difficulty });
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify(result));
              return;
            }

            if (pathname === '/api/correction') {
              const { language, text } = body;
              const result = await handleCorrectionRequest(language, text);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify(result));
              return;
            }

            if (pathname === '/api/grammar-breakdown') {
              const { language, sentence, persona } = body;
              const result = await handleGrammarBreakdown(language, sentence, persona);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify(result));
              return;
            }

            if (pathname === '/api/word-lookup') {
              const { language, word, contextSentence } = body;
              const result = await handleWordLookup(language, word, contextSentence);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify(result));
              return;
            }

            next();
          } catch (error: any) {
            console.error(`[API Error] ${pathname}:`, error);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ error: error?.message || 'Internal server error' }));
          }
        });
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [tailwindcss(), apiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
