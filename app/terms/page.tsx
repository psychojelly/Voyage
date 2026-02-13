import Link from 'next/link';

export default function TermsOfServicePage() {
  return (
    <div className="legal-page">
      <div className="legal-card">
        <h1 className="auth-title">Terms of Service</h1>
        <p className="legal-updated">Last updated: February 2026</p>

        <nav className="legal-nav">
          <a href="#acceptance">Acceptance</a>
          <a href="#accounts">Accounts</a>
          <a href="#data">Data &amp; Privacy</a>
          <a href="#installations">Installations</a>
          <a href="#disclaimers">Disclaimers</a>
          <a href="#liability">Limitation of Liability</a>
          <a href="#termination">Termination</a>
        </nav>

        <section id="acceptance">
          <h2>Acceptance</h2>
          <p>
            By creating an account or using Health Analytics Dashboard, you agree to these
            Terms of Service. If you do not agree, do not use the service.
          </p>
        </section>

        <section id="accounts">
          <h2>Accounts</h2>
          <ul>
            <li>You must provide a valid email address to create an account.</li>
            <li>You are responsible for keeping your password secure. Passwords must meet our
              complexity requirements (minimum 12 characters, mixed case, digit, and special character).</li>
            <li>You may use the dashboard without an account (local-only mode), but cloud sync,
              sharing, and installation features require authentication.</li>
          </ul>
        </section>

        <section id="data">
          <h2>Data &amp; Privacy</h2>
          <ul>
            <li>You retain ownership of all health data you import or create.</li>
            <li>We process your data solely to provide the dashboard service. See our{' '}
              <Link href="/privacy">Privacy Policy</Link> for details.</li>
            <li>You may export or delete your data at any time.</li>
            <li>Health data is encrypted at rest and transmitted over HTTPS.</li>
          </ul>
        </section>

        <section id="installations">
          <h2>Installations</h2>
          <ul>
            <li>Artists and admins may create installations that collect anonymized, consent-based
              participant data during physical experiences.</li>
            <li>Participants must explicitly enable &ldquo;Allow Artist Access&rdquo; in their settings.
              This consent can be revoked at any time.</li>
            <li>Installation API keys are the responsibility of the artist. Rotate keys immediately
              if you suspect compromise.</li>
            <li>Data shared with installations is limited to the scopes configured by the artist
              and consented to by the participant.</li>
          </ul>
        </section>

        <section id="disclaimers">
          <h2>Disclaimers</h2>
          <ul>
            <li>This service is provided &ldquo;as is&rdquo; without warranty of any kind.</li>
            <li>Health data displayed is for informational purposes only and does not constitute
              medical advice. Consult a healthcare professional for medical decisions.</li>
            <li>We do not guarantee the accuracy of data imported from third-party sources
              (Oura, CSV files, etc.).</li>
          </ul>
        </section>

        <section id="liability">
          <h2>Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, the maintainers of Health Analytics Dashboard
            shall not be liable for any indirect, incidental, special, consequential, or punitive
            damages arising from your use of the service.
          </p>
        </section>

        <section id="termination">
          <h2>Termination</h2>
          <ul>
            <li>You may delete your account at any time, which permanently removes all your data
              (except audit logs retained for compliance).</li>
            <li>We reserve the right to suspend or terminate accounts that violate these terms
              or engage in abusive behavior.</li>
          </ul>
        </section>

        <div className="legal-footer-links">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/login">Sign In</Link>
          <Link href="/">Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
