import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const db = require('./_lib/db.cjs');
const handleRequest = require('./_lib/server.cjs');

let dbInitPromise = null;

export default async function handler(req, res) {
  try {
    if (!dbInitPromise) {
      dbInitPromise = db.init().catch(err => {
        console.warn('[Vercel DB Init Warning]', err?.message || err);
      });
    }
    await dbInitPromise;
    return await handleRequest(req, res);
  } catch (err) {
    console.error('[Vercel Serverless Error]', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err?.message || 'Internal Server Error' }));
    }
  }
}
