# Thinkable Vault — Google Play Store Listing & Launch Kit

Everything you need to fill out Google Play Console and launch the app.

---

## 1. Store Listing Metadata

### App Title (Max 30 chars)
```text
Thinkable Vault: Peer Lending
```

### Short Description (Max 80 chars)
```text
Legally binding promissory notes & work agreements with 1-tap UPI payments.
```

### Full Description (Formatted for Play Store, Max 4000 chars)
```text
Thinkable Vault is an enterprise-grade digital agreement and peer lending instrument platform built for freelancers, contractors, and individuals seeking verifiable legal certainty.

Transform casual verbal handshakes, informal WhatsApp agreements, and unrecorded loans into court-admissible electronic contracts with cryptographic proof and statutory certification under Indian law.

⚡ KEY CAPABILITIES

• Formal Promissory Notes & Loan Agreements
Generate legally structured promissory notes with customizable repayment schedules, principal amounts, agreed annual interest rates, grace periods, and late penalty terms.

• Working Agreements & Milestone SOWs
Establish clear Statements of Work (SOW), scope definitions, milestone schedules, deliverable milestones, and intellectual property transfer clauses.

• 1-Tap UPI Deep Linking & Instant Settlements
Disburse loans and settle milestone invoices directly through Google Pay, PhonePe, Paytm, BHIM, or Scan-to-Pay QR code with automatic 12-digit UTR receipt matching.

• Court Admissibility & Section 65B Statutory Evidence
Every finalized instrument generates an immutable SHA-256 cryptographic digest, client IP and timestamp seal, and an official Certificate of Section 65B(4) Indian Evidence Act 1872 / Section 63 Bharatiya Sakshya Adhiniyam (BSA) 2023 and Section 10A Information Technology Act 2000.

• Instant Public QR Verification Portal
Counterparties, arbitrators, legal counsel, or courts can scan the dynamic QR code affixed to any agreement to inspect live cryptographic provenance without creating an account.

• Private Vault ID Identity System
Connect with counterparties seamlessly using clean, human-readable alphanumeric Vault IDs (e.g., VID-65228) while keeping your phone number and private credentials confidential.

• Real-Time Cloud Synchronization
Powered by cloud PostgreSQL infrastructure with high-availability replication, instant real-time status updates, and automatic offline caching.

• Bank-Grade Security
End-to-end PBKDF2-SHA512 password protection, bearer session tokens, zero third-party tracking, and strict role-based contract access.

LEGAL & STATUTORY COMPLIANCE:
All agreements created through Thinkable Vault are executed pursuant to Section 10A of the Information Technology Act, 2000 (validity of contracts formed through electronic means) and Section 65B of the Indian Evidence Act, 1872 / Section 63 of Bharatiya Sakshya Adhiniyam, 2023. Thinkable Vault provides evidence generation and record-keeping tools; it is not a bank or non-banking financial company (NBFC) and does not provide financial underwriting.
```

---

## 2. Store Assets (Generated & Ready)

The following assets have been automatically created and placed in `store_assets/`:

1. **High-Resolution App Icon**:
   - Location: `store_assets/store_icon_512.png`
   - Spec: 512×512 px, 32-bit PNG, indigo shield with lock icon.

2. **Feature Graphic**:
   - Location: `store_assets/feature_graphic_1024x500.png`
   - Spec: 1024×500 px, 24-bit PNG, dark theme with brand shield, gradient glow, and emerald accent band.

---

## 3. Store Categorization & Contact

- **Application Type**: App
- **Category**: Finance (or Business / Tools)
- **Tags**: Productivity, Contracts, Legal, UPI, Invoicing, Freelance
- **Target Age**: 18 and older
- **Website**: `https://thinkable-vault.onrender.com` (or your domain)
- **Privacy Policy URL**: `https://thinkable-vault.onrender.com/privacy`
- **Terms of Service URL**: `https://thinkable-vault.onrender.com/terms`

---

## 4. Google Play Data Safety Questionnaire Answers

When completing the **Data Safety** section in Google Play Console, answer as follows:

| Question | Answer | Details |
|---|---|---|
| Does your app collect or share user data? | **Yes** | User details & financial agreements |
| Is all user data encrypted in transit? | **Yes** | All network traffic uses HTTPS / TLS 1.3 |
| Do you provide a way for users to request data deletion? | **Yes** | Through in-app account modal or email |
| **Data Types Collected**: | | |
| • Personal Info -> Name | Collected | Required for agreement execution |
| • Personal Info -> Email address | Collected | Account credentials and notifications |
| • Personal Info -> Phone number | Optional | Agreement counterparty identification |
| • Financial Info -> Other financial info | Collected | Loan principal, interest rate, milestone payouts, UPI VPA |
| • App Info and Performance -> Diagnostics | Collected | Client IP and user agent stored strictly for Section 65B legal admissibility certificate |
| Is this data shared with third parties? | **No** | Data is never sold or shared with third-party advertisers |

---

## 5. Free 1-Click Cloud Deployment (Render.com)

To make your backend live on a public HTTPS URL (required by Google Play):

1. Push this repository to your GitHub account (`git push origin main`).
2. Go to [https://dashboard.render.com](https://dashboard.render.com) and click **New +** -> **Blueprint**.
3. Connect your GitHub repository. Render will automatically detect `render.yaml`.
4. Add your two Neon environment variables in the Render dashboard:
   - `NEON_CONNECTION_STRING`
   - `NEON_ENDPOINT`
5. Click **Apply**. Render will deploy your server in ~2 minutes and provide a free HTTPS URL:
   `https://thinkable-vault.onrender.com`
6. Update `SERVER_URL` in `MainActivity.java` and `capacitor.config.json` to your new HTTPS URL:
   `https://thinkable-vault.onrender.com`
