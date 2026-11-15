/**
 * Vercel Serverless Function Handler — Thinkable Vault
 * Bridges Vercel serverless invocations to the centralized requestHandler & Neon DB.
 */
const db = require('../db.cjs');
const handleRequest = require('../server.cjs');

let dbInitPromise = null;

module.exports = async (req, res) => {
  if (!dbInitPromise) {
    dbInitPromise = db.init().catch(err => {
      console.warn('[Vercel DB Init Warning]', err);
    });
  }
  await dbInitPromise;
  return handleRequest(req, res);
};
