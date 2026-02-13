import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="legal-page">
      <div className="legal-card">
        <h1 className="auth-title">Privacy Policy</h1>
        <p className="legal-updated">Last updated: February 2026</p>

        <nav className="legal-nav">
          <a href="#data-collected">Data Collected</a>
          <a href="#usage">How We Use Your Data</a>
          <a href="#storage">Data Storage &amp; Security</a>
          <a href="#third-parties">Third Parties</a>
          <a href="#your-rights">Your Rights</a>
          <a href="#contact">Contact</a>
        </nav>

        <section id="data-collected">
          <h2>Data Collected</h2>
          <p>
            We collect the following categories of personal and health data when you use
            Health Analytics Dashboard:
          </p>
          <ul>
            <li><strong>Account information:</strong> name, email address, and hashed password.</li>
            <li><strong>Health data:</strong> sleep, heart rate, workout, and stress metrics
              imported from Oura Ring, CSV files, or manual entry.</li>
            <li><strong>Device tokens:</strong> hashed identifiers for NFC/RFID/BLE wristbands
              used in installation check-ins.</li>
            <li><strong>Usage data:</strong> audit logs of actions performed (login, data access,
              consent changes) for security and compliance.</li>
          </ul>
        </section>

        <section id="usage">
          <h2>How We Use Your Data</h2>
          <ul>
            <li>Display your health metrics on your personal dashboard.</li>
            <li>Enable check-in experiences at physical installations (with your consent).</li>
            <li>Share anonymized, scope-limited data with installation artists (only when you
              explicitly enable &ldquo;Allow Artist Access&rdquo;).</li>
            <li>Provide data export for your personal records (GDPR right to portability).</li>
          </ul>
        </section>

        <section id="storage">
          <h2>Data Storage &amp; Security</h2>
          <ul>
            <li>Health data is encrypted at rest using AES-256-GCM.</li>
            <li>Passwords are hashed with bcrypt (cost factor 12).</li>
            <li>Device identifiers are stored as HMAC-SHA256 hashes, never in plaintext.</li>
            <li>Sessions use JWT tokens with 24-hour expiry and secure, HTTP-only cookies.</li>
            <li>Data is stored in PostgreSQL hosted by Vercel (or your self-hosted instance).</li>
            <li>All connections use HTTPS with HSTS enforcement.</li>
          </ul>
        </section>

        <section id="third-parties">
          <h2>Third Parties</h2>
          <p>We integrate with the following third-party services:</p>
          <ul>
            <li><strong>Oura:</strong> OAuth integration to import ring data. We store your access
              token (encrypted) to fetch data on your behalf.</li>
            <li><strong>Google:</strong> Optional sign-in via Google OAuth. We receive your
              name, email, and profile picture.</li>
            <li><strong>Vercel:</strong> Hosting and database infrastructure.</li>
          </ul>
          <p>We do not sell your data to any third party.</p>
        </section>

        <section id="your-rights">
          <h2>Your Rights</h2>
          <ul>
            <li><strong>Access:</strong> Export all your data at any time from Settings.</li>
            <li><strong>Deletion:</strong> Delete your account and all associated data from Settings.
              Audit logs are retained for compliance but contain no health data.</li>
            <li><strong>Correction:</strong> Edit or re-import your health records at any time.</li>
            <li><strong>Consent withdrawal:</strong> Revoke artist/admin data access at any time
              from Settings. Changes take effect immediately.</li>
            <li><strong>Portability:</strong> Download your data as JSON via the export feature.</li>
          </ul>
        </section>

        <section id="contact">
          <h2>Contact</h2>
          <p>
            For privacy-related inquiries, please contact the project maintainer via the
            repository at{' '}
            <a href="https://github.com/Dodafilm/Personal-Data-Testing" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>.
          </p>
        </section>

        <div className="legal-footer-links">
          <Link href="/terms">Terms of Service</Link>
          <Link href="/login">Sign In</Link>
          <Link href="/">Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
