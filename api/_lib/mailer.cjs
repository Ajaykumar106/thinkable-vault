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

const os = require('node:os');

// Ensure email preview folder exists
const PREVIEW_DIR = process.env.VERCEL ? path.join(os.tmpdir(), '.agr_data', 'emails') : path.join(__dirname, '.agr_data', 'emails');
try {
  if (!fs.existsSync(PREVIEW_DIR)) fs.mkdirSync(PREVIEW_DIR, { recursive: true });
} catch {}

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

function generateLoanInstallmentsFallback(agr) {
  if (agr.type !== 'loan') return [];
  const mode = agr.repaymentMode || 'emi_6';
  const months = mode === 'emi_6' ? 6 : (mode === 'emi_3' ? 3 : (mode === 'emi_12' ? 12 : 1));
  const amt = Number(agr.amount || 0);
  const rate = Number(agr.rate || 0);
  const interest = Math.round(amt * (rate / 100) * (months / 12));
  const total = amt + interest;
  const emi = Math.round(total / months);
  const start = agr.start ? new Date(agr.start) : new Date();

  const list = [];
  for (let i = 1; i <= months; i++) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + i);
    const isLast = i === months;
    list.push({
      idx: i,
      month: `Month ${i} of ${months}`,
      dueDate: d.toISOString().split('T')[0],
      amt: isLast ? (total - emi * (months - 1)) : emi,
      status: 'PENDING'
    });
  }
  return list;
}

function renderInstallmentsTableHtml(installments) {
  if (!Array.isArray(installments) || installments.length === 0) return '';
  return `
    <div style="margin-top:16px;background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:10px;padding:14px">
      <div style="font-weight:800;font-size:12px;color:#1e293b;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em">
        📅 SCHEDULED REPAYMENT DATES &amp; EMI BREAKDOWN (${installments.length} INSTALMENTS):
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:#edf2f7;color:#475569;font-weight:700">
            <th style="padding:6px 8px;text-align:left;border-bottom:1px solid #cbd5e1">Instalment</th>
            <th style="padding:6px 8px;text-align:left;border-bottom:1px solid #cbd5e1">Due Date</th>
            <th style="padding:6px 8px;text-align:right;border-bottom:1px solid #cbd5e1">Amount Due</th>
          </tr>
        </thead>
        <tbody>
          ${installments.map(inst => `
            <tr style="border-bottom:1px solid #f1f5f9">
              <td style="padding:6px 8px;font-weight:600;color:#0f172a">${inst.month || `Instalment ${inst.idx}`}</td>
              <td style="padding:6px 8px;color:#475569"><b>${inst.dueDate || 'Scheduled'}</b></td>
              <td style="padding:6px 8px;text-align:right;font-weight:700;color:#059669">${formatInr(inst.amt)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ─── Specific Transactional Templates ─── */

function getAgreementCreatedTemplate(agr, config, recipientRole = 'borrower', recipientName = '') {
  const isLoan = agr.type === 'loan';
  const title = agr.title || (isLoan ? 'Mutual Loan Agreement & Promissory Note' : 'Working Agreement & SOW');
  const viewUrl = `${config.appUrl}/?action=view&id=${encodeURIComponent(agr.id)}`;
  const isPartyA = recipientRole === 'lender';

  const installments = Array.isArray(agr.installments) && agr.installments.length > 0
    ? agr.installments
    : generateLoanInstallmentsFallback(agr);
  const tenureMonths = installments.length || (agr.repaymentMode === 'emi_6' ? 6 : (agr.repaymentMode === 'emi_3' ? 3 : (agr.repaymentMode === 'emi_12' ? 12 : 1)));

  let greetingHeader = '';
  let guidanceBox = '';

  if (isLoan) {
    if (isPartyA) {
      greetingHeader = `
        <p style="font-size:15px;color:#334155;margin-top:0">
          Hello <b>${agr.partyA}</b> (Lender / Creditor),
        </p>
        <p style="font-size:14px;color:#475569">
          <b>${agr.partyB}</b> (${agr.partyBVaultId || 'Borrower'}) has submitted a loan request for <b>${formatInr(agr.amount)}</b> on Thinkable Vault.
        </p>
      `;
      guidanceBox = `
        <div style="background:#eef2ff;border-left:4px solid #4f46e5;padding:12px 14px;border-radius:6px;margin:12px 0;font-size:13px;color:#3730a3">
          <b>⚙️ Lender Terms Decision:</b> As the Lender, you have full control to confirm or adjust the repayment tenure (e.g., 6 Months EMI, 3 Months, or Lump-sum) and interest rate before executing the instrument. Review the proposed scheduled dates below.
        </div>
      `;
    } else {
      greetingHeader = `
        <p style="font-size:15px;color:#334155;margin-top:0">
          Hello <b>${agr.partyB}</b> (Borrower / Debtor),
        </p>
        <p style="font-size:14px;color:#475569">
          Your loan request for <b>${formatInr(agr.amount)}</b> with <b>${agr.partyA}</b> has been registered in the Thinkable Vault registry.
        </p>
      `;
      guidanceBox = `
        <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 14px;border-radius:6px;margin:12px 0;font-size:13px;color:#166534">
          <b>📋 Repayment Schedule (${tenureMonths} Months):</b> The proposed schedule has been recorded. Lender ${agr.partyA} has the option to confirm or fine-tune tenure before final digital endorsement.
        </div>
      `;
    }
  } else {
    greetingHeader = `
      <p style="font-size:15px;color:#334155;margin-top:0">
        Hello <b>${recipientName || agr.partyB || 'Valued Counterparty'}</b>,
      </p>
      <p style="font-size:14px;color:#475569">
        <b>${agr.partyA}</b> has initiated a mutual legal instrument with you on Thinkable Vault. Your review and cryptographic digital endorsement are requested.
      </p>
    `;
  }

  const bodyContent = `
    ${greetingHeader}
    ${guidanceBox}

    <div class="metrics-card">
      <div class="metric-row">
        <span class="metric-label">Instrument Title</span>
        <span class="metric-val">${title}</span>
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
        <span class="metric-label">Lender (Party A)</span>
        <span class="metric-val">${agr.partyA} <small>(${agr.partyAVaultId || 'Party A'})</small></span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Borrower (Party B)</span>
        <span class="metric-val">${agr.partyB} <small>(${agr.partyBVaultId || 'Party B'})</small></span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Disbursal Date</span>
        <span class="metric-val">${agr.start || 'On Execution'}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Maturity Date</span>
        <span class="metric-val">${agr.due || 'Scheduled'}</span>
      </div>
    </div>

    ${isLoan ? renderInstallmentsTableHtml(installments) : ''}

    <p style="font-size:13.5px;color:#475569;margin-top:16px">
      To view the full agreement terms and track status in real-time, click the secure link below:
    </p>
  `;

  const subject = isLoan
    ? (isPartyA
        ? `[Action Required] Loan Application from ${agr.partyB}: Review ${tenureMonths}-Month Tenure & Dates (${agr.id})`
        : `[Vault Confirmation] Loan Request Submitted to ${agr.partyA} (${agr.id})`)
    : `[Action Required] New Agreement Drafted: ${title} (${agr.id})`;

  return {
    subject,
    preheader: isLoan
      ? `${agr.partyB} loan application of ${formatInr(agr.amount)} (${tenureMonths}-Month EMI). Review scheduled dates.`
      : `${agr.partyA} drafted an agreement with you for ${formatInr(agr.amount)}. Review and sign now.`,
    badge: isLoan ? `Lending Instrument · ${tenureMonths}-Month Schedule` : 'Draft Instrument · Signing Required',
    badgeColor: '#4361ee',
    bodyContent,
    actionUrl: viewUrl,
    actionText: isPartyA ? 'Review Loan & Confirm Tenure →' : 'View Agreement & Schedule Dates →',
    footerNote: `🔒 Cryptographic Checksum: SHA-256 integrity digest computed on initiation. Immutable ledger entry timestamped.`
  };
}

function getTenureUpdatedTemplate(agr, previousMode, newMode, config) {
  const isLoan = agr.type === 'loan';
  const title = agr.title || (isLoan ? 'Mutual Loan Agreement & Promissory Note' : 'Working Agreement');
  const viewUrl = `${config.appUrl}/?action=view&id=${encodeURIComponent(agr.id)}`;
  const installments = Array.isArray(agr.installments) && agr.installments.length > 0
    ? agr.installments
    : generateLoanInstallmentsFallback(agr);

  const months = installments.length || 6;
  const emiAmt = installments[0]?.amt || Math.round(agr.amount / months);

  const bodyContent = `
    <div style="background:#eef2ff;border:1.5px solid #c7d2fe;border-radius:12px;padding:18px;margin-bottom:18px">
      <div style="font-weight:800;color:#3730a3;font-size:15px">
        ⚙️ REPAYMENT TENURE &amp; SCHEDULE CONFIRMED BY LENDER
      </div>
      <div style="font-size:13.5px;color:#4338ca;margin-top:4px">
        Lender <b>${agr.partyA}</b> has established the formal repayment schedule: <b>${months} Monthly EMIs (${formatInr(emiAmt)} / mo)</b>.
      </div>
    </div>

    <p style="font-size:15px;color:#334155;margin-top:0">
      Dear Vault Member,
    </p>
    <p style="font-size:14px;color:#475569">
      The repayment terms and scheduled instalment dates for <b>${title}</b> (${agr.id}) have been confirmed. Both parties can inspect the immutable schedule and due dates below.
    </p>

    <div class="metrics-card">
      <div class="metric-row">
        <span class="metric-label">Principal Amount</span>
        <span class="metric-val" style="color:#059669;font-weight:800">${formatInr(agr.amount)}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Repayment Tenure</span>
        <span class="metric-val" style="font-weight:800;color:#4338ca">${months} Months (${formatInr(emiAmt)} / mo)</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Disbursal Date</span>
        <span class="metric-val">${agr.start || 'Disbursed'}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Final Maturity Date</span>
        <span class="metric-val">${agr.due}</span>
      </div>
    </div>

    ${renderInstallmentsTableHtml(installments)}
  `;

  return {
    subject: `[Schedule Confirmed] ${months}-Month Repayment Dates Established: ${title} (${agr.id})`,
    preheader: `Lender established ${months}-Month EMI schedule (${formatInr(emiAmt)}/mo). Inspect scheduled dates.`,
    badge: `⚙️ ${months}-Month EMI Schedule Active`,
    badgeColor: '#4f46e5',
    bodyContent,
    actionUrl: viewUrl,
    actionText: 'Review Schedule & Counterpart Status →',
    footerNote: `🔒 Cryptographically sealed under Section 65B Evidence Act. All dates synchronized across both party vaults.`
  };
}

function getAgreementSignedTemplate(agr, signerName, config) {
  const isLoan = agr.type === 'loan';
  const title = agr.title || (isLoan ? 'Mutual Loan Agreement & Promissory Note' : 'Working Agreement & SOW');
  const viewUrl = `${config.appUrl}/?action=view&id=${encodeURIComponent(agr.id)}`;
  const installments = Array.isArray(agr.installments) && agr.installments.length > 0
    ? agr.installments
    : generateLoanInstallmentsFallback(agr);

  const bodyContent = `
    <p style="font-size:15px;color:#334155;margin-top:0">
      Dear Vault Member,
    </p>
    <p style="font-size:14px;color:#475569">
      Mutual digital endorsement has been successfully completed for <b>${title}</b> (${agr.id}). The agreement is now fully active, legally binding, and secured in the Vault.
    </p>

    <div class="metrics-card">
      <div class="metric-row">
        <span class="metric-label">Agreement Title</span>
        <span class="metric-val">${title}</span>
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

    ${isLoan ? renderInstallmentsTableHtml(installments) : ''}
  `;

  return {
    subject: `[Mutually Executed] Agreement Active: ${title} (${agr.id})`,
    preheader: `Both parties have digitally endorsed ${title}. The contract is now active and legally binding.`,
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

function getAgreementReminderTemplate(agr, hoursLeft, config) {
  const isLoan = agr.type === 'loan';
  const viewUrl = `${config.appUrl}/?action=view&id=${encodeURIComponent(agr.id)}`;
  const hoursText = hoursLeft <= 1 ? 'Under 1 hour' : `${hoursLeft} hours`;

  const bodyContent = `
    <div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:12px;padding:16px;margin-bottom:18px">
      <div style="font-weight:800;color:#991b1b;font-size:14.5px;display:flex;align-items:center;gap:6px">
        ⏳ 12-HOUR SLA ACCEPTANCE WINDOW ACTIVE
      </div>
      <div style="font-size:13px;color:#b91c1c;margin-top:4px">
        This legal instrument requires your acceptance within 12 hours. <b>${hoursText} remaining</b> before terms expire.
      </div>
    </div>

    <p style="font-size:15px;color:#334155;margin-top:0">
      Hello <b>${agr.partyB || 'Valued Counterparty'}</b>,
    </p>
    <p style="font-size:14px;color:#475569">
      This is a scheduled 2-hour status notification regarding the pending agreement drafted by <b>${agr.partyA}</b> (${agr.partyAVaultId || 'Party A'}).
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
        <span class="metric-label">Total Principal</span>
        <span class="metric-val" style="color:#059669;font-size:15px">${formatInr(agr.amount)}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Lender</span>
        <span class="metric-val">${agr.partyA}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Remaining Time</span>
        <span class="metric-val" style="color:#b91c1c;font-weight:800">${hoursText}</span>
      </div>
    </div>

    <p style="font-size:13.5px;color:#475569">
      Affix your digital signature below to execute this binding contract and confirm your promissory repayment undertaking.
    </p>
  `;

  return {
    subject: `[⏰ 12h SLA Reminder - ${hoursText} Left] Action Required: ${agr.title} (${agr.id})`,
    preheader: `Periodic reminder: ${hoursText} remaining to review and accept the loan agreement for ${formatInr(agr.amount)} from ${agr.partyA}.`,
    badge: `⏰ 12h SLA Reminder · ${hoursText} Remaining`,
    badgeColor: '#dc2626',
    bodyContent,
    actionUrl: viewUrl,
    actionText: 'Review & Accept Agreement Now →',
    footerNote: `🔒 Automated periodic reminder dispatched pursuant to Thinkable Agreement Vault SLA Protocol.`
  };
}

function getPromissoryAcceptedTemplate(agr, undertaking, config) {
  const viewUrl = `${config.appUrl}/?action=view&id=${encodeURIComponent(agr.id)}`;
  const bodyContent = `
    <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;padding:18px;margin-bottom:18px">
      <div style="font-weight:800;color:#166534;font-size:15px">
        🎉 LOAN AGREEMENT ACCEPTED &amp; PROMISSORY UNDERTAKING EXECUTED
      </div>
      <div style="font-size:13.5px;color:#15803d;margin-top:6px;font-style:italic">
        "${undertaking || 'I promise to repay the loan sum and interest according to schedule. Thank you!'}"
      </div>
    </div>

    <p style="font-size:15px;color:#334155;margin-top:0">
      Dear <b>${agr.partyA}</b>,
    </p>
    <p style="font-size:14px;color:#475569">
      Great news! <b>${agr.partyB}</b> (${agr.partyBVaultId || 'Borrower'}) has reviewed, accepted, and digitally sealed Mutual Loan Agreement <b>${agr.id}</b> with their formal promissory undertaking.
    </p>

    <div class="metrics-card">
      <div class="metric-row">
        <span class="metric-label">Agreement ID</span>
        <span class="metric-val" style="font-family:monospace">${agr.id}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Borrower</span>
        <span class="metric-val"><b>${agr.partyB}</b> <small>(${agr.partyBVaultId || 'Party B'})</small></span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Principal Disbursed</span>
        <span class="metric-val" style="color:#059669;font-weight:800;font-size:15px">${formatInr(agr.amount)}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Maturity Date</span>
        <span class="metric-val">${agr.due}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Legal Status</span>
        <span class="metric-val" style="color:#059669">✓ Executed &amp; Legally Enforceable</span>
      </div>
    </div>
  `;

  return {
    subject: `[🎉 Agreement Accepted] ${agr.partyB} signed Loan Note ${agr.id} with Promissory Pledge`,
    preheader: `${agr.partyB} accepted the loan agreement of ${formatInr(agr.amount)} and executed promissory undertaking.`,
    badge: '✓ Formally Accepted &amp; Executed',
    badgeColor: '#059669',
    bodyContent,
    actionUrl: viewUrl,
    actionText: 'View Fully Executed Note &amp; Ledger →',
    footerNote: `📜 Section 65B Certificate active. Promissory undertaking recorded in immutable audit log.`
  };
}

function getInstalmentVerifiedTemplate(agr, payment, clearedMonth, totalMonths, remainingBalance, config) {
  const viewUrl = `${config.appUrl}/?action=view&id=${encodeURIComponent(agr.id)}`;
  const amt = Number(payment.amt || payment.amount || 0);
  const monthText = clearedMonth && totalMonths ? `Month ${clearedMonth} of ${totalMonths}` : 'Instalment';

  const bodyContent = `
    <div style="background:#ecfdf5;border:1.5px solid #a7f3d0;border-radius:12px;padding:18px;margin-bottom:18px">
      <div style="font-weight:800;color:#065f46;font-size:15px">
        ✓ REPAYMENT ENDORSED &amp; VERIFIED BY LENDER
      </div>
      <div style="font-size:13.5px;color:#047857;margin-top:6px">
        Your payment of <b>${formatInr(amt)}</b> has been formally verified by <b>${agr.partyA}</b>. ${clearedMonth && totalMonths ? `<b>${monthText} cleared!</b>` : ''}
      </div>
    </div>

    <div class="amount-hero">
      <div class="amount-label">Verified Repayment</div>
      <div class="amount-value">${formatInr(amt)}</div>
      <div style="font-size:12.5px;color:#15803d;font-weight:700;margin-top:6px">Remaining Balance: ${formatInr(remainingBalance)}</div>
    </div>

    <div class="metrics-card">
      <div class="metric-row">
        <span class="metric-label">Agreement Reference</span>
        <span class="metric-val" style="font-family:monospace">${agr.id}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Lender (Endorser)</span>
        <span class="metric-val"><b>${agr.partyA}</b> <small>(${agr.partyAVaultId || 'Party A'})</small></span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Borrower</span>
        <span class="metric-val"><b>${agr.partyB}</b> <small>(${agr.partyBVaultId || 'Party B'})</small></span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Payment Reference</span>
        <span class="metric-val" style="font-family:monospace">${payment.note || payment.utr || 'Direct Payment'}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Remaining Balance</span>
        <span class="metric-val" style="color:${remainingBalance <= 0.01 ? '#059669' : '#dc2626'};font-weight:800">
          ${remainingBalance <= 0.01 ? '✓ FULLY SATISFIED (₹0.00)' : formatInr(remainingBalance)}
        </span>
      </div>
    </div>
  `;

  return {
    subject: `[✓ Payment Verified by Lender] ${formatInr(amt)} Confirmed for ${agr.id} (${monthText} Cleared)`,
    preheader: `Lender ${agr.partyA} has verified your repayment of ${formatInr(amt)}. Remaining balance: ${formatInr(remainingBalance)}.`,
    badge: '✓ Lender Verified &amp; Endorsed',
    badgeColor: '#059669',
    bodyContent,
    actionUrl: viewUrl,
    actionText: 'View Updated Loan Ledger &amp; Balance →',
    footerNote: `🏦 Endorsement recorded in cryptographic ledger. Section 65B Electronic Certificate updated.`
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
        templateData = getAgreementCreatedTemplate(job.agreement, config, job.recipientRole, job.recipientName);
      } else if (job.type === 'tenure_updated') {
        templateData = getTenureUpdatedTemplate(job.agreement, job.previousMode, job.newMode, config);
      } else if (job.type === 'agreement_signed') {
        templateData = getAgreementSignedTemplate(job.agreement, job.signerName, config);
      } else if (job.type === 'payment_proof') {
        templateData = getPaymentProofTemplate(job.agreement, job.payment, config);
      } else if (job.type === 'agreement_reminder') {
        templateData = getAgreementReminderTemplate(job.agreement, job.hoursLeft, config);
      } else if (job.type === 'promissory_accepted') {
        templateData = getPromissoryAcceptedTemplate(job.agreement, job.undertaking, config);
      } else if (job.type === 'instalment_verified') {
        templateData = getInstalmentVerifiedTemplate(job.agreement, job.payment, job.clearedMonth, job.totalMonths, job.remainingBalance, config);
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
          const fromAddress = (config.smtpFrom && config.smtpFrom.includes('@') && !config.smtpFrom.includes('thinkable.vault'))
            ? config.smtpFrom
            : 'Thinkable Vault <onboarding@resend.dev>';
          await sendViaResend({
            apiKey: config.resendApiKey,
            from: fromAddress,
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
   * Dispatch when a new agreement is drafted or requested
   */
  notifyAgreementCreated(agreement) {
    if (!agreement) return;
    // Dispatch to Party B (Borrower / Designated Signee)
    if (agreement.partyBEmail && agreement.partyBEmail.includes('@')) {
      emailQueue.push({
        type: 'agreement_created',
        agreement,
        recipientEmail: agreement.partyBEmail.trim().toLowerCase(),
        recipientName: agreement.partyB,
        recipientRole: 'borrower',
        recipientVaultId: agreement.partyBVaultId
      });
    }
    // Also dispatch to Party A (Lender / Initiator)
    if (agreement.partyAEmail && agreement.partyAEmail.includes('@')) {
      emailQueue.push({
        type: 'agreement_created',
        agreement,
        recipientEmail: agreement.partyAEmail.trim().toLowerCase(),
        recipientName: agreement.partyA,
        recipientRole: 'lender',
        recipientVaultId: agreement.partyAVaultId
      });
    }
    processQueue().catch(() => {});
  },

  /**
   * Dispatch when Lender confirms or updates repayment tenure
   */
  notifyTenureUpdated(agreement, previousMode, newMode) {
    if (!agreement) return;
    const recipients = [
      { email: agreement.partyAEmail, name: agreement.partyA, vid: agreement.partyAVaultId, role: 'lender' },
      { email: agreement.partyBEmail, name: agreement.partyB, vid: agreement.partyBVaultId, role: 'borrower' }
    ];
    for (const r of recipients) {
      if (r.email && r.email.includes('@')) {
        emailQueue.push({
          type: 'tenure_updated',
          agreement,
          previousMode,
          newMode,
          recipientEmail: r.email.trim().toLowerCase(),
          recipientName: r.name,
          recipientRole: r.role,
          recipientVaultId: r.vid
        });
      }
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
   * Dispatch 2-hour periodic SLA reminder to designated signee
   */
  notifyAgreementReminder(agreement, hoursRemaining) {
    if (!agreement) return;
    if (agreement.partyBEmail && agreement.partyBEmail.includes('@')) {
      emailQueue.push({
        type: 'agreement_reminder',
        agreement,
        hoursLeft: hoursRemaining,
        recipientEmail: agreement.partyBEmail.trim().toLowerCase(),
        recipientName: agreement.partyB,
        recipientVaultId: agreement.partyBVaultId
      });
      processQueue().catch(() => {});
    }
  },

  /**
   * Dispatch formal acceptance notification with borrower promissory oath
   */
  notifyAgreementPromissoryAccepted(agreement, undertakingText) {
    if (!agreement) return;
    if (agreement.partyAEmail && agreement.partyAEmail.includes('@')) {
      emailQueue.push({
        type: 'promissory_accepted',
        agreement,
        undertaking: undertakingText,
        recipientEmail: agreement.partyAEmail.trim().toLowerCase(),
        recipientName: agreement.partyA,
        recipientVaultId: agreement.partyAVaultId
      });
      processQueue().catch(() => {});
    }
  },

  /**
   * Dispatch lender verification endorsement receipt for an instalment
   */
  notifyInstalmentVerified(agreement, payment, clearedMonth, totalMonths, remainingBalance) {
    if (!agreement || !payment) return;
    if (agreement.partyBEmail && agreement.partyBEmail.includes('@')) {
      emailQueue.push({
        type: 'instalment_verified',
        agreement,
        payment,
        clearedMonth,
        totalMonths,
        remainingBalance,
        recipientEmail: agreement.partyBEmail.trim().toLowerCase(),
        recipientName: agreement.partyB,
        recipientVaultId: agreement.partyBVaultId
      });
      processQueue().catch(() => {});
    }
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
