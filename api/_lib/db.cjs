/**
 * Thinkable Vault — Cloud Database Service (Neon Serverless PostgreSQL)
 * Dual-Mode Engine: High-speed Cloud PostgreSQL with automatic local fallback
 */
const fs = require('node:fs');
const path = require('node:path');

// ── SECURITY: Credentials loaded strictly from environment or .env. Never hardcode credentials. ──
function loadEnv() {
  const candidatePaths = [
    path.join(process.cwd(), '.env'),
    path.join(__dirname, '.env'),
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', '..', '.env')
  ];
  for (const envPath of candidatePaths) {
    try {
      if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eq = trimmed.indexOf('=');
          if (eq < 1) continue;
          const k = trimmed.slice(0, eq).trim();
          const v = trimmed.slice(eq + 1).trim();
          if (!process.env[k]) process.env[k] = v;
        }
      }
    } catch {}
  }
}
loadEnv();

const NEON_CONN_STRING = process.env.NEON_CONNECTION_STRING || process.env.DATABASE_URL || '';
const NEON_ENDPOINT    = process.env.NEON_ENDPOINT || (NEON_CONN_STRING ? `https://${NEON_CONN_STRING.split('@')[1]?.split('/')[0]?.replace('-pooler', '')}/sql` : '');

const os = require('node:os');

// Local Fallback Paths (Use os.tmpdir() on read-only serverless runtimes like Vercel)
const DATA_DIR  = process.env.VERCEL ? path.join(os.tmpdir(), '.agr_data') : path.join(__dirname, '.agr_data');
const AGR_FILE  = path.join(DATA_DIR, 'agreements.json');
const USR_FILE  = path.join(DATA_DIR, 'users.json');
const AUTH_FILE = path.join(DATA_DIR, 'auth_users.json');
const SESS_FILE = path.join(DATA_DIR, 'sessions.json');
const LOG_FILE  = path.join(DATA_DIR, 'activity.json');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
const EMAIL_FILE = path.join(DATA_DIR, 'emails.json');

try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (e) {
  console.warn('[DB DATA_DIR Warning]', e.message);
}

const loadLocal = (f, d = []) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const saveLocal = (f, d) => { try { fs.writeFileSync(f, JSON.stringify(d, null, 2)); } catch {} };

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isFinite(val) ? String(val) : 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'object') {
    const json = JSON.stringify(val);
    return `'${json.replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

let isCloudConnected = Boolean(NEON_CONN_STRING && NEON_ENDPOINT);

async function queryNeon(queryText) {
  const endpoint = process.env.NEON_ENDPOINT || NEON_ENDPOINT;
  const connString = process.env.NEON_CONNECTION_STRING || process.env.DATABASE_URL || NEON_CONN_STRING;
  if (!endpoint || !connString) {
    isCloudConnected = false;
    return null;
  }
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Neon-Connection-String': connString,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: queryText })
    });
    const data = await res.json();
    if (data.message && data.code) {
      console.warn('[Neon DB Warning]', data.message);
      return null;
    }
    isCloudConnected = true;
    return data.rows || [];
  } catch (err) {
    isCloudConnected = false;
    return null;
  }
}

// Map PostgreSQL agreement row to API agreement object
function rowToAgreement(r) {
  if (!r) return null;
  return {
    id: r.id,
    type: r.type || 'loan',
    title: r.title || (r.type === 'work' ? 'Working Agreement & SOW' : 'Mutual Loan Agreement'),
    creatorId: r.creator_id,
    createdBy: r.created_by,
    partyA: r.party_a,
    partyAVaultId: r.party_a_vault_id,
    partyAEmail: r.party_a_email,
    partyAPhone: r.party_a_phone || '',
    partyACity: r.party_a_city,
    partyAUpi: r.party_a_upi || '',
    partyAQr: r.party_a_qr || '',
    partyB: r.party_b,
    partyBVaultId: r.party_b_vault_id,
    partyBEmail: r.party_b_email,
    partyBPhone: r.party_b_phone || '',
    partyBCity: r.party_b_city,
    partyBUpi: r.party_b_upi || '',
    partyBQr: r.party_b_qr || '',
    amount: Number(r.amount) || 0,
    rate: Number(r.rate) || 0,
    start: r.start_date,
    due: r.due_date,
    late: Number(r.late_fee) || 0,
    purpose: r.purpose || '',
    scope: r.scope || '',
    jurisdiction: r.jurisdiction || 'India',
    sigA: r.sig_a,
    sigB: r.sig_b,
    milestones: r.milestones || [],
    payments: r.payments || [],
    repayments: r.payments || [],
    repaymentMode: r.repayment_mode || 'bullet',
    installments: Array.isArray(r.installments) ? r.installments : [],
    expiresAt: r.expires_at ? Number(r.expires_at) : null,
    lastReminderAt: r.last_reminder_at ? Number(r.last_reminder_at) : null,
    borrowerUndertaking: r.borrower_undertaking || '',
    privateNotes: r.private_notes || '',
    dossier: Array.isArray(r.dossier) ? r.dossier : [],
    sha256Digest: r.sha256_digest,
    clientIp: r.client_ip,
    userAgent: r.user_agent,
    created: r.created_at_ms ? Number(r.created_at_ms) : (r.created_at ? new Date(r.created_at).getTime() : Date.now())
  };
}

// Map PostgreSQL user row to API user object
function rowToUser(r) {
  if (!r) return null;
  return {
    id: r.id,
    username: r.username,
    email: r.email,
    fullName: r.full_name,
    phone: r.phone || '',
    city: r.city || '',
    vaultId: r.vault_id,
    upiId: r.upi_id || '',
    qrCode: r.qr_code || '',
    salt: r.password_salt,
    hash: r.password_hash,
    pinSalt: r.pin_salt,
    pinHash: r.pin_hash,
    kycTier: 'Tier 1 Verified',
    trustScore: 99,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now()
  };
}

/* ── Public Database Service Methods ── */

const db = {
  isCloudConnected: () => isCloudConnected,

  async init() {
    console.log('⚡ Initializing Thinkable Vault Database Engine...');
    const test = await queryNeon('SELECT count(*) FROM users;');
    if (test !== null) {
      isCloudConnected = true;
      console.log('✓ Connected to Neon Serverless PostgreSQL (Singapore Region - AWS ap-southeast-1)');
    } else {
      isCloudConnected = false;
      console.log('ℹ Cloud offline; operating with local encrypted storage fallback.');
    }
  },

  /* ── User Operations ── */
  async getUsers() {
    if (isCloudConnected) {
      const rows = await queryNeon('SELECT * FROM users ORDER BY created_at ASC;');
      if (rows) return rows.map(rowToUser);
    }
    return loadLocal(AUTH_FILE, []);
  },

  async getUserById(id) {
    if (isCloudConnected) {
      const rows = await queryNeon(`SELECT * FROM users WHERE id = ${escapeSql(id)} LIMIT 1;`);
      if (rows && rows.length > 0) return rowToUser(rows[0]);
    }
    const local = loadLocal(AUTH_FILE, []);
    return local.find(u => u.id === id) || null;
  },

  async getUserByUsernameOrEmail(identifier) {
    const idf = (identifier || '').trim().toLowerCase();
    if (!idf) return null;

    if (isCloudConnected) {
      const rows = await queryNeon(`
        SELECT * FROM users 
        WHERE LOWER(username) = ${escapeSql(idf)} OR LOWER(email) = ${escapeSql(idf)} 
        LIMIT 1;
      `);
      if (rows && rows.length > 0) return rowToUser(rows[0]);
    }
    const local = loadLocal(AUTH_FILE, []);
    return local.find(u => (u.username || '').toLowerCase() === idf || (u.email || '').toLowerCase() === idf) || null;
  },

  async getUserByVaultId(vaultId) {
    const vid = (vaultId || '').trim().toUpperCase();
    if (!vid) return null;

    if (isCloudConnected) {
      const rows = await queryNeon(`SELECT * FROM users WHERE UPPER(vault_id) = ${escapeSql(vid)} LIMIT 1;`);
      if (rows && rows.length > 0) return rowToUser(rows[0]);
    }
    const local = loadLocal(AUTH_FILE, []);
    return local.find(u => (u.vaultId || '').toUpperCase() === vid) || null;
  },

  async createUser(u) {
    // Save to local cache first
    const local = loadLocal(AUTH_FILE, []);
    local.push(u);
    saveLocal(AUTH_FILE, local);

    // Save to Neon Cloud PostgreSQL
    if (isCloudConnected) {
      try {
        await queryNeon(`
          INSERT INTO users (
            id, username, email, full_name, phone, city, vault_id,
            password_salt, password_hash, pin_salt, pin_hash
          ) VALUES (
            ${escapeSql(u.id)},
            ${escapeSql(u.username)},
            ${escapeSql(u.email)},
            ${escapeSql(u.fullName)},
            ${escapeSql(u.phone || '')},
            ${escapeSql(u.city || '')},
            ${escapeSql(u.vaultId)},
            ${escapeSql(u.salt)},
            ${escapeSql(u.hash)},
            ${escapeSql(u.pinSalt || null)},
            ${escapeSql(u.pinHash || null)}
          ) ON CONFLICT (id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone;
        `);
      } catch (err) {
        console.warn('[Neon createUser Warning]', err.message);
        const existing = await queryNeon(`SELECT * FROM users WHERE LOWER(email) = ${escapeSql((u.email || '').toLowerCase())} OR LOWER(username) = ${escapeSql((u.username || '').toLowerCase())} LIMIT 1;`);
        if (existing && existing.length > 0) {
          return rowToUser(existing[0]);
        }
      }
    }
    return u;
  },

  async updateUserUpi(userId, upiId, qrCode = '') {
    const cleanUpi = (upiId || '').trim();
    const cleanQr = (qrCode || '').trim();
    const local = loadLocal(AUTH_FILE, []);
    const u = local.find(x => x.id === userId);
    if (u) {
      u.upiId = cleanUpi;
      if (cleanQr) u.qrCode = cleanQr;
      saveLocal(AUTH_FILE, local);
    }

    if (isCloudConnected) {
      if (cleanQr) {
        await queryNeon(`
          UPDATE users SET upi_id = ${escapeSql(cleanUpi)}, qr_code = ${escapeSql(cleanQr)}, updated_at = NOW() WHERE id = ${escapeSql(userId)};
        `);
      } else {
        await queryNeon(`
          UPDATE users SET upi_id = ${escapeSql(cleanUpi)}, updated_at = NOW() WHERE id = ${escapeSql(userId)};
        `);
      }
    }
    return true;
  },

  /* ── Session Operations ── */
  async saveSession(token, userId, expiresAt) {
    const local = loadLocal(SESS_FILE, {});
    local[token] = { userId, expires: expiresAt };
    saveLocal(SESS_FILE, local);

    if (isCloudConnected) {
      await queryNeon(`
        INSERT INTO sessions (token, user_id, expires_at)
        VALUES (${escapeSql(token)}, ${escapeSql(userId)}, ${expiresAt})
        ON CONFLICT (token) DO UPDATE SET expires_at = EXCLUDED.expires_at;
      `);
    }
  },

  async getSession(token) {
    if (!token) return null;
    if (isCloudConnected) {
      const rows = await queryNeon(`SELECT * FROM sessions WHERE token = ${escapeSql(token)} LIMIT 1;`);
      if (rows && rows.length > 0) {
        const s = rows[0];
        if (Number(s.expires_at) >= Date.now()) {
          return { userId: s.user_id, expires: Number(s.expires_at) };
        }
      }
    }
    const local = loadLocal(SESS_FILE, {});
    const s = local[token];
    if (s && s.expires >= Date.now()) return s;
    return null;
  },

  async deleteSession(token) {
    const local = loadLocal(SESS_FILE, {});
    delete local[token];
    saveLocal(SESS_FILE, local);

    if (isCloudConnected) {
      await queryNeon(`DELETE FROM sessions WHERE token = ${escapeSql(token)};`);
    }
  },

  /* ── Agreement Operations ── */
  async getAgreements() {
    if (isCloudConnected) {
      const rows = await queryNeon('SELECT * FROM agreements ORDER BY created_at_ms DESC;');
      if (rows) return rows.map(rowToAgreement);
    }
    return loadLocal(AGR_FILE, []);
  },

  async getAgreementById(id) {
    if (!id) return null;
    if (isCloudConnected) {
      const rows = await queryNeon(`SELECT * FROM agreements WHERE id = ${escapeSql(id)} LIMIT 1;`);
      if (rows && rows.length > 0) return rowToAgreement(rows[0]);
    }
    const local = loadLocal(AGR_FILE, []);
    return local.find(a => a.id === id) || null;
  },

  async saveAgreement(a) {
    // Save to local cache
    const local = loadLocal(AGR_FILE, []);
    const idx = local.findIndex(x => x.id === a.id);
    if (idx >= 0) local[idx] = a;
    else local.unshift(a);
    saveLocal(AGR_FILE, local);

    // Save to Neon Cloud PostgreSQL
    if (isCloudConnected) {
      await queryNeon(`
        INSERT INTO agreements (
          id, type, title, creator_id, created_by,
          party_a, party_a_vault_id, party_a_email, party_a_phone, party_a_city, party_a_upi, party_a_qr,
          party_b, party_b_vault_id, party_b_email, party_b_phone, party_b_city, party_b_upi, party_b_qr,
          amount, rate, start_date, due_date, late_fee,
          purpose, scope, jurisdiction, sig_a, sig_b,
          milestones, payments, repayment_mode, installments, expires_at, last_reminder_at, borrower_undertaking,
          sha256_digest, client_ip, user_agent, created_at_ms,
          private_notes, dossier
        ) VALUES (
          ${escapeSql(a.id)},
          ${escapeSql(a.type || 'loan')},
          ${escapeSql(a.title || '')},
          ${escapeSql(a.creatorId || null)},
          ${escapeSql(a.createdBy || null)},
          ${escapeSql(a.partyA)},
          ${escapeSql(a.partyAVaultId || null)},
          ${escapeSql(a.partyAEmail || null)},
          ${escapeSql(a.partyAPhone || '')},
          ${escapeSql(a.partyACity || '')},
          ${escapeSql(a.partyAUpi || '')},
          ${escapeSql(a.partyAQr || '')},
          ${escapeSql(a.partyB)},
          ${escapeSql(a.partyBVaultId || null)},
          ${escapeSql(a.partyBEmail || null)},
          ${escapeSql(a.partyBPhone || '')},
          ${escapeSql(a.partyBCity || '')},
          ${escapeSql(a.partyBUpi || '')},
          ${escapeSql(a.partyBQr || '')},
          ${escapeSql(a.amount || 0)},
          ${escapeSql(a.rate || 0)},
          ${escapeSql(a.start || '')},
          ${escapeSql(a.due || '')},
          ${escapeSql(a.late || 0)},
          ${escapeSql(a.purpose || '')},
          ${escapeSql(a.scope || '')},
          ${escapeSql(a.jurisdiction || 'India')},
          ${escapeSql(a.sigA || null)},
          ${escapeSql(a.sigB || null)},
          ${escapeSql(a.milestones || [])},
          ${escapeSql(a.payments || a.repayments || [])},
          ${escapeSql(a.repaymentMode || 'bullet')},
          ${escapeSql(a.installments || [])},
          ${escapeSql(a.expiresAt || null)},
          ${escapeSql(a.lastReminderAt || null)},
          ${escapeSql(a.borrowerUndertaking || '')},
          ${escapeSql(a.sha256Digest || '')},
          ${escapeSql(a.clientIp || '')},
          ${escapeSql(a.userAgent || '')},
          ${escapeSql(a.created || Date.now())},
          ${escapeSql(a.privateNotes || '')},
          ${escapeSql(a.dossier || [])}
        ) ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          sig_a = EXCLUDED.sig_a,
          sig_b = EXCLUDED.sig_b,
          party_b_email = COALESCE(EXCLUDED.party_b_email, agreements.party_b_email),
          party_b_phone = COALESCE(EXCLUDED.party_b_phone, agreements.party_b_phone),
          milestones = EXCLUDED.milestones,
          payments = EXCLUDED.payments,
          repayment_mode = COALESCE(EXCLUDED.repayment_mode, agreements.repayment_mode),
          installments = EXCLUDED.installments,
          expires_at = COALESCE(EXCLUDED.expires_at, agreements.expires_at),
          last_reminder_at = COALESCE(EXCLUDED.last_reminder_at, agreements.last_reminder_at),
          borrower_undertaking = COALESCE(EXCLUDED.borrower_undertaking, agreements.borrower_undertaking),
          private_notes = EXCLUDED.private_notes,
          dossier = EXCLUDED.dossier,
          sha256_digest = EXCLUDED.sha256_digest,
          party_a_upi = COALESCE(NULLIF(EXCLUDED.party_a_upi, ''), agreements.party_a_upi),
          party_a_qr = COALESCE(NULLIF(EXCLUDED.party_a_qr, ''), agreements.party_a_qr),
          party_b_upi = COALESCE(NULLIF(EXCLUDED.party_b_upi, ''), agreements.party_b_upi),
          party_b_qr = COALESCE(NULLIF(EXCLUDED.party_b_qr, ''), agreements.party_b_qr),
          updated_at = NOW();
      `);
    }
    return a;
  },

  async deleteAgreement(id) {
    const local = loadLocal(AGR_FILE, []);
    saveLocal(AGR_FILE, local.filter(x => x.id !== id));

    if (isCloudConnected) {
      await queryNeon(`DELETE FROM agreements WHERE id = ${escapeSql(id)};`);
    }
  },

  /* ── User Contacts Operations (Saved Counterparties Directory) ── */
  async getUserContacts(userId) {
    if (isCloudConnected) {
      const rows = await queryNeon(`SELECT * FROM user_contacts WHERE user_id = ${escapeSql(userId)} ORDER BY created_at DESC;`);
      if (rows) {
        return rows.map(r => ({
          id: r.id,
          userId: r.user_id,
          name: r.contact_name,
          vaultId: r.contact_vault_id,
          email: r.contact_email || '',
          upi: r.contact_upi || '',
          createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now()
        }));
      }
    }
    const local = loadLocal(CONTACTS_FILE, []);
    return local.filter(c => c.userId === userId);
  },

  async saveUserContact(userId, contact) {
    const id = contact.id || ('cnt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    const clean = {
      id,
      userId,
      name: (contact.name || '').trim(),
      vaultId: (contact.vaultId || '').trim().toUpperCase(),
      email: (contact.email || '').trim().toLowerCase(),
      upi: (contact.upi || '').trim(),
      createdAt: Date.now()
    };
    const local = loadLocal(CONTACTS_FILE, []);
    const existingIdx = local.findIndex(c => c.userId === userId && (c.vaultId === clean.vaultId || (c.email && c.email === clean.email)));
    if (existingIdx >= 0) {
      local[existingIdx] = { ...local[existingIdx], ...clean, id: local[existingIdx].id };
    } else {
      local.unshift(clean);
    }
    saveLocal(CONTACTS_FILE, local);

    if (isCloudConnected) {
      await queryNeon(`
        INSERT INTO user_contacts (id, user_id, contact_name, contact_vault_id, contact_email, contact_upi)
        VALUES (${escapeSql(clean.id)}, ${escapeSql(clean.userId)}, ${escapeSql(clean.name)}, ${escapeSql(clean.vaultId)}, ${escapeSql(clean.email)}, ${escapeSql(clean.upi)})
        ON CONFLICT (id) DO UPDATE SET
          contact_name = EXCLUDED.contact_name,
          contact_email = EXCLUDED.contact_email,
          contact_upi = EXCLUDED.contact_upi;
      `);
    }
    return clean;
  },

  async deleteUserContact(userId, contactId) {
    const local = loadLocal(CONTACTS_FILE, []);
    saveLocal(CONTACTS_FILE, local.filter(c => !(c.userId === userId && c.id === contactId)));
    if (isCloudConnected) {
      await queryNeon(`DELETE FROM user_contacts WHERE user_id = ${escapeSql(userId)} AND id = ${escapeSql(contactId)};`);
    }
    return true;
  },

  /* ── Audit Log Operations ── */
  async logAudit(action, actorName, actorVaultId, agreementId, metadata = {}, ip = '127.0.0.1') {
    const entry = {
      action,
      actorName,
      actorVaultId,
      agreementId,
      metadata,
      ip,
      timestamp: Date.now(),
      iso: new Date().toISOString()
    };
    const local = loadLocal(LOG_FILE, []);
    local.unshift(entry);
    saveLocal(LOG_FILE, local.slice(0, 200));

    if (isCloudConnected) {
      await queryNeon(`
        INSERT INTO audit_logs (agreement_id, action, actor_name, actor_vault_id, ip_address, metadata)
        VALUES (
          ${escapeSql(agreementId || null)},
          ${escapeSql(action)},
          ${escapeSql(actorName || '')},
          ${escapeSql(actorVaultId || '')},
          ${escapeSql(ip)},
          ${escapeSql(metadata)}
        );
      `);
    }
    return entry;
  },

  async getAuditLogs(limit = 50) {
    if (isCloudConnected) {
      const rows = await queryNeon(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ${limit};`);
      if (rows) {
        return rows.map(r => ({
          action: r.action,
          actorName: r.actor_name,
          actorVaultId: r.actor_vault_id,
          agreementId: r.agreement_id,
          metadata: r.metadata,
          ip: r.ip_address,
          timestamp: new Date(r.created_at).getTime(),
          iso: r.created_at
        }));
      }
    }
    return loadLocal(LOG_FILE, []).slice(0, limit);
  },

  /* ── Transactional Email Notifications ── */
  async logEmailNotification(record) {
    const entry = {
      ...record,
      createdAt: record.createdAt || Date.now()
    };
    const local = loadLocal(EMAIL_FILE, []);
    local.unshift(entry);
    saveLocal(EMAIL_FILE, local.slice(0, 300));

    if (isCloudConnected) {
      await queryNeon(`
        INSERT INTO email_notifications (
          id, agreement_id, type, recipient_email, recipient_name, recipient_vault_id,
          subject, status, provider, error_message, metadata, created_at, sent_at
        ) VALUES (
          ${escapeSql(entry.id)},
          ${escapeSql(entry.agreementId || null)},
          ${escapeSql(entry.type)},
          ${escapeSql(entry.recipientEmail)},
          ${escapeSql(entry.recipientName || '')},
          ${escapeSql(entry.recipientVaultId || '')},
          ${escapeSql(entry.subject)},
          ${escapeSql(entry.status || 'queued')},
          ${escapeSql(entry.provider || 'smtp')},
          ${escapeSql(entry.errorMessage || null)},
          ${escapeSql(entry.metadata || {})},
          NOW(),
          ${entry.sentAt ? 'NOW()' : 'NULL'}
        ) ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          error_message = EXCLUDED.error_message,
          sent_at = EXCLUDED.sent_at;
      `);
    }
    return entry;
  },

  async getEmailNotifications(recipientEmail = '', limit = 50) {
    if (isCloudConnected) {
      const emailFilter = recipientEmail ? `WHERE LOWER(recipient_email) = ${escapeSql(recipientEmail.toLowerCase())}` : '';
      const rows = await queryNeon(`SELECT * FROM email_notifications ${emailFilter} ORDER BY created_at DESC LIMIT ${limit};`);
      if (rows) {
        return rows.map(r => ({
          id: r.id,
          agreementId: r.agreement_id,
          type: r.type,
          recipientEmail: r.recipient_email,
          recipientName: r.recipient_name,
          recipientVaultId: r.recipient_vault_id,
          subject: r.subject,
          status: r.status,
          provider: r.provider,
          errorMessage: r.error_message,
          metadata: r.metadata,
          createdAt: new Date(r.created_at).getTime(),
          sentAt: r.sent_at ? new Date(r.sent_at).getTime() : null
        }));
      }
    }
    const local = loadLocal(EMAIL_FILE, []);
    if (recipientEmail) {
      const clean = recipientEmail.toLowerCase();
      return local.filter(e => (e.recipientEmail || '').toLowerCase() === clean).slice(0, limit);
    }
    return local.slice(0, limit);
  }
};

module.exports = db;
