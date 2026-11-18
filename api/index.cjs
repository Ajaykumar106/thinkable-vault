/**
 * Vercel Serverless Function Handler — Thinkable Vault
 * Bridges Vercel serverless invocations to the centralized requestHandler & Neon DB.
 */
const db = require('../db.cjs');
const handleRequest = require('../server.cjs');

let dbInitPromise = null;

module.exports = async (req, res) => {
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
      res.end(JSON.stringify({ ok: false, error: err.message || 'Internal Server Error' }));
    }
  }
};
