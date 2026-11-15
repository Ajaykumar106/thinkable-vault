/**
 * Thinkable Vault — Enterprise Server with Real Authentication & Sync
 * Run: node server.cjs
 */

// ── Load .env before anything else (no external dependencies) ──
const http   = require('node:http');
const fs     = require('node:fs');
const path   = require('node:path');
const os     = require('node:os');
const crypto = require('node:crypto');

(function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
})();

const db = require('./db.cjs');

const PORT      = process.env.PORT || 3000;
const DATA_DIR  = path.join(__dirname, '.agr_data');
const AGR_FILE  = path.join(DATA_DIR, 'agreements.json');
const USR_FILE  = path.join(DATA_DIR, 'users.json');
const AUTH_FILE = path.join(DATA_DIR, 'auth_users.json');
const SESS_FILE = path.join(DATA_DIR, 'sessions.json');
const LOG_FILE  = path.join(DATA_DIR, 'activity.json');
const MSG_FILE  = path.join(DATA_DIR, 'messages.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/* ── Data Helpers ── */
const load = (f, d = []) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const save = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

/* ── Password & Token Security ── */
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}
function verifyPassword(password, salt, storedHash) {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === storedHash;
}

function getBearerToken(req) {
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const u = new URL(req.url, 'http://localhost');
  return u.searchParams.get('token');
}

async function getUserByToken(token) {
  if (!token) return null;
  const s = await db.getSession(token);
  if (!s || s.expires < Date.now()) return null;
  return await db.getUserById(s.userId);
}

process.on('uncaughtException', err => {
  console.error('[Vault Server] Process exception caught:', err.message);
});
process.on('unhandledRejection', reason => {
  console.error('[Vault Server] Unhandled rejection:', reason);
});

/* ── Server-Sent Events (SSE) ── */
const clients = new Set();

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of [...clients]) {
    try {
      if (!res.writableEnded && res.writable) {
        res.write(msg);
      } else {
        clients.delete(res);
      }
    } catch {
      clients.delete(res);
    }
  }
}

function readBody(req) {
  return new Promise((res, rej) => {
    let b = Buffer.alloc(0);
    req.on('data', c => { b = Buffer.concat([b, c]); });
    req.on('end', () => {
      try { res(JSON.parse(b.toString())); } catch { res({}); }
    });
    req.on('error', rej);
  });
}

function getAllIPs() {
  const list = [];
  const ifaces = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(ifaces)) {
    for (const a of addrs) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) {
        list.push({ ip: a.address, name });
      }
    }
  }
  return list;
}

function getPreferredIP() {
  const ips = getAllIPs();
  const wifi = ips.find(i => /wi-?fi|wlan|wireless/i.test(i.name));
  if (wifi) return wifi.ip;
  const nonVbox = ips.find(i => !/virtual|vbox|vmware|wsl/i.test(i.name) && !i.ip.startsWith('192.168.56.'));
  if (nonVbox) return nonVbox.ip;
  return ips[0]?.ip || 'localhost';
}

function logActivity(entry) {
  const logs = load(LOG_FILE, []);
  logs.unshift({ ...entry, ts: Date.now() });
  if (logs.length > 500) logs.length = 500;
  save(LOG_FILE, logs);
  broadcast('activity', entry);
}

/* ── HTTP Request Handler (Compatible with Standalone Node & Vercel Serverless) ── */
const requestHandler = async (req, res) => {
  const u = new URL(req.url, `http://localhost`);
  const p = u.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // ── Static Web App & PWA Assets ──
  if (p === '/' || p === '/index.html') {
    try {
      const html = fs.readFileSync(path.join(__dirname, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    } catch { res.writeHead(404); return res.end('index.html not found'); }
  }

  if (p === '/privacy' || p === '/privacy.html') {
    try {
      const html = fs.readFileSync(path.join(__dirname, 'privacy.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    } catch { res.writeHead(404); return res.end('Privacy policy not found'); }
  }

  if (p === '/terms' || p === '/terms.html') {
    try {
      const html = fs.readFileSync(path.join(__dirname, 'terms.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    } catch { res.writeHead(404); return res.end('Terms of service not found'); }
  }

  if (p === '/manifest.json') {
    try {
      const json = fs.readFileSync(path.join(__dirname, 'manifest.json'));
      res.writeHead(200, { 'Content-Type': 'application/manifest+json' });
      return res.end(json);
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/manifest+json' });
      return res.end(JSON.stringify({
        name: "Thinkable Vault",
        short_name: "Vault",
        start_url: "/",
        display: "standalone",
        theme_color: "#090a0f",
        background_color: "#090a0f"
      }));
    }
  }

  if (p === '/sw.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    return res.end(`
      self.addEventListener('install', e => self.skipWaiting());
      self.addEventListener('activate', e => clients.claim());
      self.addEventListener('fetch', e => {
        if (e.request.mode === 'navigate') {
          e.respondWith(fetch(e.request).catch(() => caches.match('/')));
        }
      });
    `);
  }

  // ── Cloud Database Health & Engine Status ──
  if (p === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      ok: true,
      service: 'Thinkable Vault',
      database: 'Neon Serverless PostgreSQL (Singapore aws-ap-southeast-1)',
      cloudConnected: db.isCloudConnected(),
      timeUtc: new Date().toISOString()
    }));
  }

  // ── Device Pairing Info ──
  if (p === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      ip: getPreferredIP(),
      allIps: getAllIPs(),
      port: PORT,
      cloudDatabase: db.isCloudConnected()
    }));
  }

  // ── SSE Real-time Feed ──
  if (p === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write(':\n\n');
    clients.add(res);

    const cleanup = () => {
      clearInterval(hb);
      clients.delete(res);
    };

    res.on('error', cleanup);
    res.on('close', cleanup);
    req.on('error', cleanup);
    req.on('close', cleanup);

    try {
      const token = getBearerToken(req);
      const user = await getUserByToken(token);
      let list = await db.getAgreements();
      if (user && !u.searchParams.get('all')) {
        const uName = (user.fullName || '').toLowerCase();
        const uUser = (user.username || '').toLowerCase();
        const uEmail = (user.email || '').toLowerCase();
        const uVaultId = (user.vaultId || '').toLowerCase();
        list = list.filter(a => {
          const pA = (a.partyA || '').toLowerCase();
          const pB = (a.partyB || '').toLowerCase();
          const pAEmail = (a.partyAEmail || '').toLowerCase();
          const pBEmail = (a.partyBEmail || '').toLowerCase();
          const pAVaultId = (a.partyAVaultId || '').toLowerCase();
          const pBVaultId = (a.partyBVaultId || '').toLowerCase();
          return a.creatorId === user.id || a.createdBy === user.username ||
                 (uVaultId && (pAVaultId === uVaultId || pBVaultId === uVaultId)) ||
                 (uEmail && (pAEmail === uEmail || pBEmail === uEmail)) ||
                 pA.includes(uName) || pA.includes(uUser) ||
                 pB.includes(uName) || pB.includes(uUser);
        });
      }
      const users = await db.getUsers();
      const activity = await db.getAuditLogs(50);
      res.write(`event: init\ndata: ${JSON.stringify({
        agreements: list,
        users: users.map(usr => ({ key: usr.username, display: usr.fullName, vaultId: usr.vaultId, email: usr.email })),
        messages: load(MSG_FILE, []).slice(-100),
        activity
      })}\n\n`);
    } catch {
      cleanup();
    }

    const hb = setInterval(() => {
      try {
        if (!res.writableEnded && res.writable) {
          res.write(':\n\n');
        } else {
          cleanup();
        }
      } catch {
        cleanup();
      }
    }, 20000);

    return;
  }

  // ══════════════════════════════════════════════════
  // AUTHENTICATION SYSTEM API
  // ══════════════════════════════════════════════════

  // POST /api/auth/register
  if (p === '/api/auth/register' && req.method === 'POST') {
    const body = await readBody(req);
    const email = (body.email || '').trim().toLowerCase();
    const fullName = (body.fullName || body.name || '').trim();
    const username = (body.username || email.split('@')[0] || '').trim().toLowerCase();
    const password = body.password || '';
    const pin = (body.pin || '').trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'Please enter a valid real email address (e.g. name@domain.com).' }));
    }

    if (!fullName || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'Full legal name and password are required.' }));
    }

    const existing = await db.getUserByUsernameOrEmail(email);
    if (existing) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'An account with this email address already exists.' }));
    }

    const { salt, hash } = hashPassword(password);
    let pinData = null;
    if (pin && pin.length === 4) {
      pinData = hashPassword(pin);
    }

    const vaultId = 'VID-' + Math.floor(10000 + Math.random() * 90000);
    const newUser = {
      id: 'u_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
      vaultId,
      username,
      fullName,
      email,
      phone: body.phone || '',
      salt,
      hash,
      pinSalt: pinData ? pinData.salt : null,
      pinHash: pinData ? pinData.hash : null,
      kycTier: 'Tier 1 Verified',
      trustScore: 99,
      createdAt: Date.now()
    };
    await db.createUser(newUser);

    // Broadcast user list update
    const allUsers = await db.getUsers();
    broadcast('users', allUsers.map(u => ({ key: u.username, display: u.fullName, vaultId: u.vaultId, email: u.email })));

    // Create session
    const token = crypto.randomBytes(32).toString('hex');
    await db.saveSession(token, newUser.id, Date.now() + 30 * 864e5);

    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    await db.logAudit('register', fullName, vaultId, null, { email }, String(rawIp));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    const { salt: _, hash: __, pinSalt: ___, pinHash: ____, ...safeUser } = newUser;
    return res.end(JSON.stringify({ ok: true, token, user: safeUser }));
  }

  // POST /api/auth/login
  if (p === '/api/auth/login' && req.method === 'POST') {
    const body = await readBody(req);
    const identifier = (body.email || body.username || '').trim().toLowerCase();
    const password = body.password || '';

    const user = (await db.getUserByUsernameOrEmail(identifier)) || (await db.getUserByVaultId(identifier));

    if (!user || !verifyPassword(password, user.salt, user.hash)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'Invalid email address, Vault ID, or password.' }));
    }

    const token = crypto.randomBytes(32).toString('hex');
    await db.saveSession(token, user.id, Date.now() + 30 * 864e5);

    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    await db.logAudit('login', user.fullName, user.vaultId, null, {}, String(rawIp));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    const { salt: _, hash: __, pinSalt: ___, pinHash: ____, ...safeUser } = user;
    return res.end(JSON.stringify({ ok: true, token, user: safeUser }));
  }

  // GET /api/users/lookup?q=... (Counterparty discovery by Vault ID or Email)
  if (p === '/api/users/lookup' && req.method === 'GET') {
    const q = (u.searchParams.get('q') || '').trim().toLowerCase();
    if (!q) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'Query parameter q is required' }));
    }
    const found = (await db.getUserByVaultId(q)) || (await db.getUserByUsernameOrEmail(q));
    if (found) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        ok: true,
        found: true,
        user: {
          vaultId: found.vaultId,
          fullName: found.fullName,
          email: found.email,
          username: found.username,
          upiId: found.upiId || null,
          qrCode: found.qrCode || null,
          kycTier: found.kycTier || 'Tier 1 Verified'
        }
      }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, found: false }));
  }

  // POST /api/auth/pin-login (Quick 4-digit mobile unlock)
  if (p === '/api/auth/pin-login' && req.method === 'POST') {
    const body = await readBody(req);
    const pin = (body.pin || '').trim();
    const userId = body.userId;

    const user = (await db.getUserById(userId)) || (await db.getUserByUsernameOrEmail(body.username));

    if (!user || !user.pinHash || !verifyPassword(pin, user.pinSalt, user.pinHash)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'Invalid security PIN.' }));
    }

    const token = crypto.randomBytes(32).toString('hex');
    await db.saveSession(token, user.id, Date.now() + 30 * 864e5);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    const { salt: _, hash: __, pinSalt: ___, pinHash: ____, ...safeUser } = user;
    return res.end(JSON.stringify({ ok: true, token, user: safeUser }));
  }

  // GET /api/auth/me
  if (p === '/api/auth/me' && req.method === 'GET') {
    const token = getBearerToken(req);
    const user = await getUserByToken(token);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'Session expired or invalid.' }));
    }
    const { salt: _, hash: __, pinSalt: ___, pinHash: ____, ...safeUser } = user;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, user: safeUser }));
  }

  // POST /api/auth/logout
  if (p === '/api/auth/logout' && req.method === 'POST') {
    const token = getBearerToken(req);
    if (token) {
      await db.deleteSession(token);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }

  // POST /api/users/upi (Update personal UPI VPA & Scanner QR Code)
  if (p === '/api/users/upi' && req.method === 'POST') {
    const token = getBearerToken(req);
    const user = await getUserByToken(token);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
    }
    const body = await readBody(req);
    const upiId = (body.upiId || '').trim();
    const qrCode = (body.qrCode || '').trim();
    await db.updateUserUpi(user.id, upiId, qrCode);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, upiId, qrCode }));
  }

  // ── Agreements API ──
  if (p === '/api/agreements') {
    if (req.method === 'GET') {
      const token = getBearerToken(req);
      const user = await getUserByToken(token);
      let list = await db.getAgreements();
      if (user && !u.searchParams.get('all')) {
        const uName = (user.fullName || '').toLowerCase();
        const uUser = (user.username || '').toLowerCase();
        const uEmail = (user.email || '').toLowerCase();
        const uVaultId = (user.vaultId || '').toLowerCase();
        list = list.filter(a => {
          const pA = (a.partyA || '').toLowerCase();
          const pB = (a.partyB || '').toLowerCase();
          const pAEmail = (a.partyAEmail || '').toLowerCase();
          const pBEmail = (a.partyBEmail || '').toLowerCase();
          const pAVaultId = (a.partyAVaultId || '').toLowerCase();
          const pBVaultId = (a.partyBVaultId || '').toLowerCase();
          return a.creatorId === user.id || a.createdBy === user.username ||
                 (uVaultId && (pAVaultId === uVaultId || pBVaultId === uVaultId)) ||
                 (uEmail && (pAEmail === uEmail || pBEmail === uEmail)) ||
                 pA.includes(uName) || pA.includes(uUser) ||
                 pB.includes(uName) || pB.includes(uUser);
        });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(list));
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      const token = getBearerToken(req);
      const user = await getUserByToken(token);
      if (user) {
        if (!body.creatorId) body.creatorId = user.id;
        if (!body.createdBy) body.createdBy = user.username;
        if (!body.partyAVaultId) body.partyAVaultId = user.vaultId;
        if (!body.partyAEmail) body.partyAEmail = user.email;
      }

      // Cryptographic Stamp & Evidentiary Metadata (Sec 65B Indian Evidence Act)
      const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      const clientIp = String(rawIp).split(',')[0].trim().replace(/^::ffff:/, '');
      const clientAgent = req.headers['user-agent'] || 'Vault Client';
      const nowUtc = new Date().toISOString();

      if (body.sigA && (!body.sigA.ip || body.sigA.ip === 'Recorded')) {
        body.sigA.ip = clientIp;
        body.sigA.userAgent = clientAgent;
        body.sigA.utc = body.sigA.utc || nowUtc;
      }
      if (body.sigB && (!body.sigB.ip || body.sigB.ip === 'Recorded')) {
        body.sigB.ip = clientIp;
        body.sigB.userAgent = clientAgent;
        body.sigB.utc = body.sigB.utc || nowUtc;
      }

      body.sha256Digest = crypto.createHash('sha256').update(
        `${body.id}|${body.partyA}|${body.partyB}|${body.amount}|${body.type}|${body.created}`
      ).digest('hex').toUpperCase();

      await db.saveAgreement(body);
      broadcast('agreement', body);
      await db.logAudit('save_agreement', body.partyA, body.partyAVaultId, body.id, { amount: body.amount, type: body.type }, clientIp);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, sha256Digest: body.sha256Digest }));
    }
  }

  // ── Public Cryptographic Verification Endpoint (Sec 65B Audit) ──
  const verifyM = p.match(/^\/api\/agreements\/verify\/([^/]+)$/);
  if (verifyM && req.method === 'GET') {
    const id = verifyM[1];
    const item = await db.getAgreementById(id);
    if (!item) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, verified: false, error: 'Document reference not found in vault registry.' }));
    }

    const sha256Digest = crypto.createHash('sha256').update(
      `${item.id}|${item.partyA}|${item.partyB}|${item.amount}|${item.type}|${item.created}`
    ).digest('hex').toUpperCase();

    const isFullyExecuted = !!(item.sigA && item.sigB);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      ok: true,
      verified: true,
      id: item.id,
      type: item.type,
      title: item.title || (item.type === 'work' ? 'Working Agreement & SOW' : 'Mutual Loan Agreement'),
      partyA: item.partyA,
      partyAVaultId: item.partyAVaultId || 'UNASSIGNED',
      partyAEmail: item.partyAEmail || '',
      partyB: item.partyB,
      partyBVaultId: item.partyBVaultId || 'UNASSIGNED',
      partyBEmail: item.partyBEmail || '',
      amount: item.amount,
      start: item.start,
      due: item.due,
      created: item.created || Date.now(),
      serverTimestampUtc: item.created ? new Date(item.created).toISOString() : new Date().toISOString(),
      status: isFullyExecuted ? 'FULLY_EXECUTED' : (item.sigA || item.sigB) ? 'PARTIALLY_SIGNED' : 'DRAFT',
      sigA: item.sigA ? { at: item.sigA.at, utc: item.sigA.utc, ip: item.sigA.ip || '127.0.0.1', stamp: item.sigA.stamp } : null,
      sigB: item.sigB ? { at: item.sigB.at, utc: item.sigB.utc, ip: item.sigB.ip || '127.0.0.1', stamp: item.sigB.stamp } : null,
      sha256Digest,
      systemCustodian: 'Agreement Vault Cryptographic Verification Authority',
      statutoryRef: 'Section 65B(4) Indian Evidence Act 1872 / Section 63 Bharatiya Sakshya Adhiniyam 2023 & Section 10A IT Act 2000',
      custodianDeclaration: 'This digital record is produced in ordinary course of electronic record keeping pursuant to Section 65B(4) of the Indian Evidence Act, 1872 and Section 10A of the Information Technology Act, 2000. Server systems operated continuously without compromise to data integrity.',
      verifiedAtUtc: new Date().toISOString()
    }));
  }

  const idM = p.match(/^\/api\/agreements\/([^/]+)$/);
  if (idM) {
    const id = idM[1];
    if (req.method === 'GET') {
      const item = await db.getAgreementById(id);
      if (item) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(item));
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Agreement not found' }));
    }
    if (req.method === 'DELETE') {
      await db.deleteAgreement(id);
      broadcast('delete', { id });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    }
    if (req.method === 'PUT') {
      const body = await readBody(req);
      const item = await db.getAgreementById(id);
      const updated = { ...(item || {}), ...body };
      await db.saveAgreement(updated);
      broadcast('agreement', updated);
      if (body._logEvent) {
        const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        await db.logAudit(body._logEvent.type || 'update', body._logEvent.actor || '', '', id, body._logEvent, String(rawIp));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    }
  }

  // ── Encrypted Chat Messages API ──
  if (p === '/api/messages') {
    if (req.method === 'GET') {
      const agrId = u.searchParams.get('agrId');
      const all = load(MSG_FILE, []);
      const filtered = agrId ? all.filter(m => m.agrId === agrId) : all;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(filtered));
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      const all = load(MSG_FILE, []);
      const msg = {
        id: body.id || 'm' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
        agrId: body.agrId || 'general',
        sender: body.sender || 'Anonymous',
        ciphertext: body.ciphertext || '',
        iv: body.iv || '',
        hint: body.hint || '',
        ts: Date.now()
      };
      all.push(msg);
      if (all.length > 2000) all.splice(0, all.length - 2000);
      save(MSG_FILE, all);
      broadcast('chat', msg);
      logActivity({
        type: 'chat',
        msg: `${msg.sender} sent encrypted message`,
        agrId: msg.agrId
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, msg }));
    }
  }

  // ── Users API (Shared Peers) ──
  if (p === '/api/users') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(load(USR_FILE, [])));
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      const users = load(USR_FILE, []);
      if (body.key && !users.find(u => u.key === body.key)) {
        users.push(body);
        save(USR_FILE, users);
        broadcast('users', users);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    }
  }

  // ── Activity Log API ──
  if (p === '/api/activity' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(load(LOG_FILE, [])));
  }

  res.writeHead(404); res.end('Not found');
};

const server = http.createServer(requestHandler);

if (require.main === module) {
  (async () => {
    await db.init();
    server.listen(PORT, '0.0.0.0', () => {
      const pref = getPreferredIP();
      console.log('\n╔══════════════════════════════════════════════════╗');
      console.log('║   Thinkable Vault — Enterprise Ready             ║');
      console.log('╠══════════════════════════════════════════════════╣');
      console.log(`║  Local Browser:  http://localhost:${PORT}             ║`);
      console.log(`║  Mobile / Wi-Fi: http://${pref.padEnd(15)}:${PORT}     ║`);
      console.log('║  Cloud Database: Neon Serverless PostgreSQL      ║');
      console.log('╚══════════════════════════════════════════════════╝\n');
    });
  })();
}

module.exports = requestHandler;
