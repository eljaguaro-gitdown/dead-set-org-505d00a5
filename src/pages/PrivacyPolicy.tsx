import { useNavigate } from "react-router-dom";
import PageLayout from "@/components/PageLayout";
import SiteHeader from "@/components/SiteHeader";
import AdSenseLoader from "@/components/AdSenseLoader";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <PageLayout minimal>
      <AdSenseLoader />
      <SiteHeader>
        <button
          onClick={() => navigate(-1)}
          className="font-display text-sm tracking-[0.15em] text-muted-foreground hover:text-primary transition-colors uppercase"
        >
          Back
        </button>
      </SiteHeader>

      <main className="flex-1 px-4 sm:px-8 py-8 sm:py-12 max-w-3xl mx-auto w-full">
        <h1 className="font-display text-3xl sm:text-4xl text-foreground mb-2 leading-tight">
          Privacy Policy
        </h1>
        <p className="font-hand text-sm text-muted-foreground mb-8">
          Last updated: March 20, 2026
        </p>

        <div className="space-y-8 font-body text-foreground/90 text-sm leading-relaxed">
          <section className="space-y-3">
            <h2 className="font-display text-lg text-foreground">1. Information We Collect</h2>
            <p>
              When you create an account on Dead Set, we collect your email address and any profile
              information you choose to provide (such as a display name or avatar). We also collect
              data you create through the app, including setlists, chat messages, and upvotes.
            </p>
            <p>
              We automatically collect certain technical information when you visit our site,
              including your IP address, browser type, device information, and pages visited.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-foreground">2. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>To provide and maintain the Dead Set service</li>
              <li>To enable collaborative setlist building and sharing</li>
              <li>To communicate with you about your account</li>
              <li>To improve and personalize your experience</li>
              <li>To display relevant advertisements (desktop only)</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-foreground">3. Google AdSense & Advertising</h2>
            <p>
              We use Google AdSense to display advertisements on the desktop version of our site.
              Google AdSense uses cookies and similar technologies to serve ads based on your prior
              visits to this and other websites. Google's use of advertising cookies enables it and
              its partners to serve ads based on your browsing history.
            </p>
            <p>
              You may opt out of personalized advertising by visiting{" "}
              <a
                href="https://www.google.com/settings/ads"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                Google Ads Settings
              </a>
              . Alternatively, you can opt out of third-party vendor cookies at{" "}
              <a
                href="https://www.aboutads.info/choices/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                www.aboutads.info
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-foreground">4. Cookies & Tracking</h2>
            <p>
              We use cookies and similar tracking technologies for the following purposes:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><strong>Essential cookies:</strong> Required for authentication and core functionality</li>
              <li><strong>Advertising cookies:</strong> Used by Google AdSense to serve relevant ads</li>
              <li><strong>Analytics cookies:</strong> Help us understand how visitors use our site</li>
            </ul>
            <p>
              You can control cookies through your browser settings. Disabling certain cookies may
              limit your ability to use some features of our service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-foreground">5. Third-Party Services</h2>
            <p>We use the following third-party services:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>
                <strong>Internet Archive (archive.org):</strong> Live recordings are sourced and
                streamed from the Internet Archive's collection of live music recordings.
              </li>
              <li>
                <strong>Google AdSense:</strong> Advertising on desktop viewports.
              </li>
            </ul>
            <p>
              Each of these services has its own privacy policy governing data collection and usage.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-foreground">6. Data Security</h2>
            <p>
              We take reasonable measures to protect your personal information. Your data is stored
              securely and access is restricted to authorized personnel. However, no method of
              transmission or storage is 100% secure.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-foreground">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and associated data</li>
              <li>Opt out of personalized advertising</li>
              <li>Withdraw consent for data processing where applicable</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-foreground">8. Children's Privacy</h2>
            <p>
              Dead Set is not intended for children under 13. We do not knowingly collect personal
              information from children under 13. If you believe we have collected such information,
              please contact us so we can remove it.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-foreground">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any
              material changes by posting the new policy on this page with an updated revision date.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-foreground">10. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, please reach out through the app or
              contact us at the email address associated with your account.
            </p>
          </section>
        </div>
      </main>

      <footer className="py-4 text-center border-t border-border/50">
        <p className="font-hand text-xs text-muted-foreground/70">
          © {new Date().getFullYear()} Dead Set — Built by Deadheads, for Deadheads
        </p>
      </footer>
    </PageLayout>
  );
};

export default PrivacyPolicy;
