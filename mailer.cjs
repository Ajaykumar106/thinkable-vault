/**
 * Thinkable Vault — Enterprise Transactional Email Engine
 * Auto Gmail / SMTP / Resend Dispatcher for Legal Instruments & Payment Proof
 * Designed for high concurrency, zero-crash resilience, and bank-grade HTML templates.
 */

const tls = require('node:tls');
const net = require('node:net');
const https = require('node:https');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// Ensure email preview folder exists
const PREVIEW_DIR = path.join(__dirname, '.agr_data', 'emails');
if (!fs.existsSync(PREVIEW_DIR)) fs.mkdirSync(PREVIEW_DIR, { recursive: true });

// Environment Configuration
function getConfig() {
  return {
    smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtpPort: parseInt(process.env.SMTP_PORT || '465', 10),
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    smtpFrom: process.env.SMTP_FROM || (process.env.SMTP_USER ? `"Thinkable Vault" <${process.env.SMTP_USER}>` : '"Thinkable Vault" <notifications@thinkable.vault>'),
    resendApiKey: process.env.RESEND_API_KEY || '',
    appUrl: process.env.APP_URL || 'http://localhost:3000'
  };
}

/* ─── Modern Bank-Grade HTML Templates ─── */

function wrapEmailHtml({ title, preheader, badge, badgeColor = '#4361ee', bodyContent, actionUrl, actionText, footerNote }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin:0; padding:0; background-color:#f4f6fb; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#1e293b; line-height:1.6; }
    table { border-collapse:collapse; }
    .wrapper { width:100%; max-width:600px; margin:24px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.06); border:1px solid #e2e8f0; }
    .header { background:linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%); padding:32px 28px; text-align:center; color:#ffffff; }
    .logo-badge { display:inline-flex; align-items:center; gap:8px; background:rgba(255,255,255,0.12); padding:6px 14px; border-radius:99px; font-size:12px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; margin-bottom:12px; }
    .title { margin:0; font-size:22px; font-weight:800; letter-spacing:-0.02em; color:#ffffff; }
    .content { padding:32px 28px; }
    .pill { display:inline-block; padding:4px 12px; border-radius:99px; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.04em; background:${badgeColor}15; color:${badgeColor}; margin-bottom:16px; border:1px solid ${badgeColor}30; }
    .metrics-card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:18px; margin:20px 0; }
    .metric-row { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #edf2f7; font-size:13.5px; }
    .metric-row:last-child { border-bottom:none; padding-bottom:0; }
    .metric-label { color:#64748b; font-weight:600; }
    .metric-val { color:#0f172a; font-weight:700; text-align:right; }
    .amount-hero { text-align:center; padding:22px; background:linear-gradient(180deg, #ecfdf5 0%, #f0fdf4 100%); border:1px solid #bbf7d0; border-radius:14px; margin:20px 0; }
    .amount-label { font-size:12px; font-weight:800; color:#15803d; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px; }
    .amount-value { font-size:32px; font-weight:900; color:#166534; letter-spacing:-0.03em; }
    .btn-action { display:inline-block; width:100%; box-sizing:border-box; background:linear-gradient(135deg, #4338ca 0%, #3730a3 100%); color:#ffffff !important; text-align:center; padding:14px 24px; border-radius:10px; font-weight:800; font-size:14px; text-decoration:none; margin:24px 0 12px; box-shadow:0 4px 14px rgba(67,56,202,0.35); }
    .audit-box { background:#f1f5f9; border-radius:8px; padding:12px 14px; font-size:11.5px; color:#475569; margin-top:20px; font-family:ui-monospace,SFMono-Regular,Consolas,monospace; line-height:1.5; }
    .footer { background:#f8fafc; padding:24px 28px; text-align:center; font-size:11.5px; color:#94a3b8; border-top:1px solid #e2e8f0; line-height:1.6; }
    .footer-links { margin-top:10px; }
    .footer-links a { color:#64748b; text-decoration:none; margin:0 8px; font-weight:600; }
  </style>
</head>
<body>
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader || title}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">
        <div class="wrapper">
          <div class="header">
            <div class="logo-badge">🛡️ Thinkable Agreement Vault</div>
            <h1 class="title">${title}</h1>
          </div>
          <div class="content">
            ${badge ? `<div class="pill">${badge}</div>` : ''}
            ${bodyContent}
            ${actionUrl ? `<a href="${actionUrl}" class="btn-action" target="_blank">${actionText || 'View Instrument in Vault →'}</a>` : ''}
            ${footerNote ? `<div class="audit-box">${footerNote}</div>` : ''}
          </div>
          <div class="footer">
            <div>This automated legal notice was cryptographically sealed by <b>Thinkable Agreement Vault</b>.</div>
            <div>Valid and legally binding under Section 65B of the Indian Evidence Act, 1872 &amp; Information Technology Act, 2000.</div>
            <div class="footer-links">
              <a href="${actionUrl || '#'}">View Instrument</a> • 
              <a href="${actionUrl || '#'}">Sec 65B Certificate</a> • 
              <a href="#">Support Desk</a>
            </div>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function formatInr(num) {
  const n = Number(num || 0);
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ─── Specific Transactional Templates ─── */

function getAgreementCreatedTemplate(agr, config) {
  const isLoan = agr.type === 'loan';
  const roleName = isLoan ? 'Borrower' : 'Contractor / Deliverer';
  const creatorRole = isLoan ? 'Lender' : 'Client / Employer';
  const viewUrl = `${config.appUrl}/?action=view&id=${encodeURIComponent(agr.id)}`;

  const bodyContent = `
    <p style="font-size:15px;color:#334155;margin-top:0">
      Hello <b>${agr.partyB || 'Valued Counterparty'}</b>,
    </p>
    <p style="font-size:14px;color:#475569">
      <b>${agr.partyA}</b> (${agr.partyAVaultId || 'Verified Vault User'}) has initiated a mutual legal instrument with you on Thinkable Vault. Your review and cryptographic digital endorsement are requested.
    </p>

    <div class="metrics-card">
      <div class="metric-row">
        <span class="metric-label">Instrument Title</span>
        <span class="metric-val">${agr.title}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Instrument ID</span>
        <span class="metric-val" style="font-family:monospace">${agr.id}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Total Principal / Value</span>
        <span class="metric-val" style="color:#059669;font-size:15px">${formatInr(agr.amount)}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Initiator (${creatorRole})</span>
        <span class="metric-val">${agr.partyA} <small>(${agr.partyAVaultId || 'Party A'})</small></span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Designated Signee (${roleName})</span>
        <span class="metric-val">${agr.partyB} <small>(${agr.partyBVaultId || 'Party B'})</small></span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Jurisdiction / City</span>
        <span class="metric-val">${agr.partyACity || agr.partyBCity || 'National Jurisdiction'}</span>
      </div>
    </div>

    <p style="font-size:13.5px;color:#475569">
      To execute this contract, click the secure link below, log in with your verified Google account or Vault ID, and apply your digital signature.
    </p>
  `;

  return {
    subject: `[Action Required] New Agreement Drafted: ${agr.title} (${agr.id})`,
    preheader: `${agr.partyA} has drafted a legal instrument with you for ${formatInr(agr.amount)}. Review and sign now.`,
    badge: 'Draft Instrument · Signing Required',
    badgeColor: '#4361ee',
    bodyContent,
    actionUrl: viewUrl,
    actionText: 'Review & Sign Legal Instrument →',
    footerNote: `🔒 Cryptographic Checksum: SHA-256 integrity digest computed on initiation. Immutable ledger entry timestamped.`
  };
}

function getAgreementSignedTemplate(agr, signerName, config) {
  const viewUrl = `${config.appUrl}/?action=view&id=${encodeURIComponent(agr.id)}`;
  const bodyContent = `
    <p style="font-size:15px;color:#334155;margin-top:0">
      Dear Vault Member,
    </p>
    <p style="font-size:14px;color:#475569">
      Mutual digital endorsement has been successfully completed for <b>${agr.title}</b> (${agr.id}). The agreement is now fully active, legally binding, and secured in the Vault.
    </p>

    <div class="metrics-card">
      <div class="metric-row">
        <span class="metric-label">Agreement Title</span>
        <span class="metric-val">${agr.title}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Agreement ID</span>
        <span class="metric-val" style="font-family:monospace">${agr.id}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Committed Principal</span>
        <span class="metric-val" style="color:#059669">${formatInr(agr.amount)}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Parties Bound</span>
        <span class="metric-val">${agr.partyA} ⇄ ${agr.partyB}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Latest Signer</span>
        <span class="metric-val">${signerName || 'Both Parties'}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Status</span>
        <span class="metric-val" style="color:#059669">✓ Mutually Executed (Active)</span>
      </div>
    </div>
  `;

  return {
    subject: `[Mutually Executed] Agreement Active: ${agr.title} (${agr.id})`,
    preheader: `Both parties have digitally endorsed ${agr.title}. The contract is now active and legally binding.`,
    badge: '✓ Mutually Executed · Legally Binding',
    badgeColor: '#059669',
    bodyContent,
    actionUrl: viewUrl,
    actionText: 'View Active Agreement & Download PDF →',
    footerNote: `📜 Section 65B Electronic Evidence Record active. Cryptographically sealed under Indian Evidence Act, 1872.`
  };
}

function getPaymentProofTemplate(agr, payment, config) {
  const viewUrl = `${config.appUrl}/?action=view&id=${encodeURIComponent(agr.id)}`;
  const amt = Number(payment.amount || 0);
  const utr = payment.utr || 'DIRECT-SETTLEMENT';
  const dateStr = payment.date || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  // Compute remaining principal
  const allPays = agr.payments || agr.repayments || [];
  const totalRepaid = allPays.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const remaining = Math.max(0, Number(agr.amount || 0) - totalRepaid);

  const bodyContent = `
    <div class="amount-hero">
      <div class="amount-label">Payment Amount Settled</div>
      <div class="amount-value">${formatInr(amt)}</div>
      <div style="font-size:12px;color:#15803d;font-weight:700;margin-top:6px">⚡ Instant UPI / Bank Settlement Confirmed</div>
    </div>

    <p style="font-size:14px;color:#475569">
      A repayment instalment has been logged against Agreement <b>${agr.id}</b> (${agr.title}) with verified bank transaction details.
    </p>

    <div class="metrics-card">
      <div class="metric-row">
        <span class="metric-label">Bank Reference / UTR</span>
        <span class="metric-val" style="font-family:monospace;color:#1e40af;font-size:14px">${utr}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Settlement Date</span>
        <span class="metric-val">${dateStr}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Payer (Borrower)</span>
        <span class="metric-val">${agr.partyB} <small>(${agr.partyBVaultId || 'Party B'})</small></span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Payee (Lender)</span>
        <span class="metric-val">${agr.partyA} <small>(${agr.partyAVaultId || 'Party A'})</small></span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Agreement Total</span>
        <span class="metric-val">${formatInr(agr.amount)}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Total Repaid to Date</span>
        <span class="metric-val" style="color:#059669">${formatInr(totalRepaid)}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Remaining Principal Balance</span>
        <span class="metric-val" style="color:#dc2626;font-size:14.5px">${formatInr(remaining)}</span>
      </div>
    </div>

    <p style="font-size:13px;color:#64748b;line-height:1.5">
      The payee can inspect the transaction in the Vault ledger and mark it as formally verified. Both parties can generate the updated Section 65B Electronic Evidence Certificate at any time.
    </p>
  `;

  return {
    subject: `[Payment Receipt] ${formatInr(amt)} Settled for ${agr.id} (Ref: ${utr})`,
    preheader: `Payment proof of ${formatInr(amt)} recorded with UTR ${utr}. View your official settlement receipt.`,
    badge: '⚡ UPI Payment Recorded',
    badgeColor: '#16a34a',
    bodyContent,
    actionUrl: viewUrl,
    actionText: 'View Cryptographic Payment Audit →',
    footerNote: `🏦 UTR: ${utr} · Timestamp: ${dateStr} · Section 65B Certificate generation enabled.`
  };
}

/* ─── Zero-Dependency Native SMTP Client (RFC 5321) ─── */

function sendViaNativeSmtp({ host, port, user, pass, from, to, subject, html }) {
  return new Promise((resolve, reject) => {
    let socket;
    const isSsl = port === 465;
    const boundary = '----=_Part_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');
    const fromClean = from.includes('<') ? from.match(/<([^>]+)>/)[1] : from;
    const toClean = to.includes('<') ? to.match(/<([^>]+)>/)[1] : to;

    const emailRaw = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      `Content-Type: text/html; charset=UTF-8`,
      'Content-Transfer-Encoding: base64',
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${Date.now()}.${crypto.randomBytes(8).toString('hex')}@${host}>`,
      '',
      Buffer.from(html).toString('base64'),
      ''
    ].join('\r\n');

    let step = 0;
    let buffer = '';

    const handleData = (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\r\n');
      buffer = lines.pop(); // keep last incomplete chunk

      for (const line of lines) {
        if (!line) continue;
        const code = parseInt(line.slice(0, 3), 10);
        const isMulti = line[3] === '-';
        if (isMulti) continue; // wait for final line of multiline response

        switch (step) {
          case 0: // Server greeting (220)
            if (code === 220) {
              step = 1;
              socket.write(`EHLO thinkable.vault\r\n`);
            } else {
              socket.end();
              return reject(new Error(`SMTP Greeting failed: ${line}`));
            }
            break;

          case 1: // EHLO response (250)
            if (code === 250) {
              if (user && pass) {
                step = 2;
                socket.write(`AUTH LOGIN\r\n`);
              } else {
                step = 5;
                socket.write(`MAIL FROM:<${fromClean}>\r\n`);
              }
            } else {
              socket.end();
              return reject(new Error(`EHLO failed: ${line}`));
            }
            break;

          case 2: // AUTH LOGIN response (334 Username)
            if (code === 334) {
              step = 3;
              socket.write(Buffer.from(user).toString('base64') + '\r\n');
            } else {
              socket.end();
              return reject(new Error(`AUTH LOGIN failed: ${line}`));
            }
            break;

          case 3: // Username accepted, expects password (334 Password)
            if (code === 334) {
              step = 4;
              socket.write(Buffer.from(pass).toString('base64') + '\r\n');
            } else {
              socket.end();
              return reject(new Error(`Username rejected: ${line}`));
            }
            break;

          case 4: // Password accepted (235)
            if (code === 235) {
              step = 5;
              socket.write(`MAIL FROM:<${fromClean}>\r\n`);
            } else {
              socket.end();
              return reject(new Error(`Authentication failed (Check Gmail App Password): ${line}`));
            }
            break;

          case 5: // MAIL FROM response (250)
            if (code === 250) {
              step = 6;
              socket.write(`RCPT TO:<${toClean}>\r\n`);
            } else {
              socket.end();
              return reject(new Error(`MAIL FROM rejected: ${line}`));
            }
            break;

          case 6: // RCPT TO response (250)
            if (code === 250) {
              step = 7;
              socket.write(`DATA\r\n`);
            } else {
              socket.end();
              return reject(new Error(`Recipient rejected (${toClean}): ${line}`));
            }
            break;

          case 7: // DATA response (354)
            if (code === 354) {
              step = 8;
              socket.write(emailRaw + '\r\n.\r\n');
            } else {
              socket.end();
              return reject(new Error(`DATA start failed: ${line}`));
            }
            break;

          case 8: // Data accepted (250)
            if (code === 250) {
              step = 9;
              socket.write(`QUIT\r\n`);
              socket.end();
              return resolve({ ok: true, messageId: line });
            } else {
              socket.end();
              return reject(new Error(`Email body rejected: ${line}`));
            }
            break;
        }
      }
    };

    const options = { host, port, rejectUnauthorized: false, timeout: 12000 };
    if (isSsl) {
      socket = tls.connect(options, () => {
        // Connected
      });
    } else {
      socket = net.connect(options, () => {
        // Plain socket, STARTTLS could be negotiated if needed
      });
    }

    socket.on('data', handleData);
    socket.on('error', (err) => reject(err));
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`SMTP Connection timeout to ${host}:${port}`));
    });
  });
}

/* ─── Resend API Transport (Alternative) ─── */
function sendViaResend({ apiKey, from, to, subject, html }) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ from, to: [to], subject, html });
    const req = https.request('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, messageId: parsed.id });
          } else {
            reject(new Error(parsed.message || `Resend API error: ${res.statusCode}`));
          }
        } catch {
          reject(new Error(`Resend API returned status ${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Resend API timeout')); });
    req.write(payload);
    req.end();
  });
}

/* ─── High-Concurrency Queue & Dispatch Engine ─── */

const emailQueue = [];
let isProcessingQueue = false;
let dbRef = null;

function setDatabaseReference(database) {
  dbRef = database;
}

async function processQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (emailQueue.length > 0) {
    const job = emailQueue.shift();
    const config = getConfig();
    const notifId = 'notif_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');

    try {
      let templateData;
      if (job.type === 'agreement_created') {
        templateData = getAgreementCreatedTemplate(job.agreement, config);
      } else if (job.type === 'agreement_signed') {
        templateData = getAgreementSignedTemplate(job.agreement, job.signerName, config);
      } else if (job.type === 'payment_proof') {
        templateData = getPaymentProofTemplate(job.agreement, job.payment, config);
      } else {
        console.warn('[Mailer] Unknown email job type:', job.type);
        continue;
      }

      const fullHtml = wrapEmailHtml(templateData);
      const subject = templateData.subject;
      const to = job.recipientEmail;
      const name = job.recipientName || '';
      const vaultId = job.recipientVaultId || '';

      // Save HTML preview file for developer inspection / instant review
      const previewFile = path.join(PREVIEW_DIR, `${notifId}.html`);
      try { fs.writeFileSync(previewFile, fullHtml, 'utf8'); } catch {}

      let status = 'logged_simulated';
      let provider = 'simulated';
      let errorMsg = null;

      // 1. Try Resend if configured
      if (config.resendApiKey) {
        try {
          await sendViaResend({
            apiKey: config.resendApiKey,
            from: config.smtpFrom,
            to,
            subject,
            html: fullHtml
          });
          status = 'sent';
          provider = 'resend';
        } catch (err) {
          console.warn('[Mailer Resend Error]', err.message);
          errorMsg = err.message;
        }
      }
      // 2. Try SMTP / Gmail if credentials configured
      else if (config.smtpUser && config.smtpPass) {
        try {
          await sendViaNativeSmtp({
            host: config.smtpHost,
            port: config.smtpPort,
            user: config.smtpUser,
            pass: config.smtpPass,
            from: config.smtpFrom,
            to,
            subject,
            html: fullHtml
          });
          status = 'sent';
          provider = config.smtpHost.includes('gmail') ? 'gmail_smtp' : 'custom_smtp';
        } catch (err) {
          console.warn('[Mailer SMTP Error]', err.message);
          errorMsg = err.message;
          status = 'failed';
        }
      } else {
        // Simulated / Zero-config mode: Logs to database and generates live preview
        status = 'logged_simulated';
        provider = 'local_vault_engine';
      }

      // Persist notification record in Neon PostgreSQL & local cache
      const record = {
        id: notifId,
        agreementId: job.agreement?.id || null,
        type: job.type,
        recipientEmail: to,
        recipientName: name,
        recipientVaultId: vaultId,
        subject,
        status,
        provider,
        errorMessage: errorMsg,
        metadata: {
          agreementTitle: job.agreement?.title,
          amount: job.agreement?.amount,
          utr: job.payment?.utr || null,
          previewUrl: `/api/emails/preview/${notifId}`
        },
        createdAt: Date.now(),
        sentAt: status === 'sent' ? Date.now() : null
      };

      if (dbRef && typeof dbRef.logEmailNotification === 'function') {
        await dbRef.logEmailNotification(record);
      }

      console.log(`[Auto Gmail Service] ${status.toUpperCase()} (${provider}) -> ${to} [${subject}]`);

    } catch (err) {
      console.error('[Mailer Queue Worker Error]', err);
    }

    // Small delay between sends to honor provider rate limits
    await new Promise(r => setTimeout(r, 80));
  }

  isProcessingQueue = false;
}

/**
 * Public Dispatch Functions (Non-blocking, High Throughput)
 */
const mailer = {
  setDatabase(database) {
    setDatabaseReference(database);
  },

  /**
   * Dispatch when a new agreement is drafted
   */
  notifyAgreementCreated(agreement) {
    if (!agreement) return;
    // Dispatch to Party B (Counterparty)
    if (agreement.partyBEmail && agreement.partyBEmail.includes('@')) {
      emailQueue.push({
        type: 'agreement_created',
        agreement,
        recipientEmail: agreement.partyBEmail.trim().toLowerCase(),
        recipientName: agreement.partyB,
        recipientVaultId: agreement.partyBVaultId
      });
    }
    // Also dispatch confirmation to Party A (Creator)
    if (agreement.partyAEmail && agreement.partyAEmail.includes('@') && agreement.partyAEmail !== agreement.partyBEmail) {
      emailQueue.push({
        type: 'agreement_created',
        agreement,
        recipientEmail: agreement.partyAEmail.trim().toLowerCase(),
        recipientName: agreement.partyA,
        recipientVaultId: agreement.partyAVaultId
      });
    }
    processQueue().catch(() => {});
  },

  /**
   * Dispatch when an agreement is signed / mutually endorsed
   */
  notifyAgreementSigned(agreement, signerName) {
    if (!agreement) return;
    const recipients = [
      { email: agreement.partyAEmail, name: agreement.partyA, vid: agreement.partyAVaultId },
      { email: agreement.partyBEmail, name: agreement.partyB, vid: agreement.partyBVaultId }
    ];

    for (const r of recipients) {
      if (r.email && r.email.includes('@')) {
        emailQueue.push({
          type: 'agreement_signed',
          agreement,
          signerName,
          recipientEmail: r.email.trim().toLowerCase(),
          recipientName: r.name,
          recipientVaultId: r.vid
        });
      }
    }
    processQueue().catch(() => {});
  },

  /**
   * Dispatch official payment proof & tax/audit settlement notice
   */
  notifyPaymentProof(agreement, payment) {
    if (!agreement || !payment) return;
    const recipients = [
      { email: agreement.partyAEmail, name: agreement.partyA, vid: agreement.partyAVaultId },
      { email: agreement.partyBEmail, name: agreement.partyB, vid: agreement.partyBVaultId }
    ];

    for (const r of recipients) {
      if (r.email && r.email.includes('@')) {
        emailQueue.push({
          type: 'payment_proof',
          agreement,
          payment,
          recipientEmail: r.email.trim().toLowerCase(),
          recipientName: r.name,
          recipientVaultId: r.vid
        });
      }
    }
    processQueue().catch(() => {});
  },

  /**
   * Retrieve preview file contents for browser display
   */
  getPreviewHtml(notifId) {
    try {
      const p = path.join(PREVIEW_DIR, `${notifId}.html`);
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
    } catch {}
    return null;
  }
};

module.exports = mailer;
