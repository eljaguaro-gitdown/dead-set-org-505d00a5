import { useNavigate, Link } from "react-router-dom";
import PageLayout from "@/components/PageLayout";
import SiteHeader from "@/components/SiteHeader";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <PageLayout minimal>
      <SiteHeader>
        <button
          onClick={() => navigate(-1)}
          className="font-display text-sm tracking-[0.15em] text-foreground/75 hover:text-primary transition-colors uppercase"
        >
          Back
        </button>
      </SiteHeader>

      <main className="flex-1 px-4 sm:px-8 py-8 sm:py-12 max-w-3xl mx-auto w-full">
        <h1 className="font-display text-3xl sm:text-4xl text-foreground mb-2 leading-tight">
          Terms of Service
        </h1>
        <p className="font-mono text-xs text-foreground/75 mb-8 tracking-wider uppercase">
          Last updated: August 7, 2026
        </p>

        <div className="space-y-8 font-body text-foreground/90 text-sm leading-relaxed">
          <section className="space-y-3">
            <h2 className="font-display text-lg text-foreground">1. The Deal</h2>
            <p>
              Dead-Set.Org ("Dead Set", "we") is a free, non-commercial service for building,
              sharing, and listening to setlists. By using it — with or without an account — you
              agree to these terms and our{" "}
              <Link
                to="/privacy"
                className="text-dead-gold underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                Privacy Policy
              </Link>
              . If you don't agree, don't use the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-foreground">2. The Music</h2>
            <p>
              Recordings stream from the Internet Archive under the artists' trade-friendly
              policies, and Dead Set seeks no commercial gain from them. The full story — including
              the Grateful Dead's digital-distribution policy, which governs this service — is
              posted on our{" "}
              <Link
                to="/about"
                className="text-dead-gold underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                About page
              </Link>
              . All participants acknowledge and respect the copyrights of the performers, writers,
              and publishers of the music.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-foreground">3. Your Account</h2>
            <p>
              Keep your credentials to yourself and give us accurate information. You're
              responsible for what happens under your account. You can delete your account at any
              time from your profile; deletion removes your personal data as described in the
              Privacy Policy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-foreground">4. Your Content</h2>
            <p>
              Setlists, notes, comments, messages, and profile details you create remain yours. By
              posting publicly on Dead Set you grant us a non-exclusive license to host and display
              that content within the service (that's what makes sharing work). We claim no
              ownership.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-foreground">5. House Rules</h2>
            <p>
              This is a community built on fifty years of strangers being generous with each other.
              Act like it. We have <strong>zero tolerance for objectionable content or abusive
              behavior</strong>, including: harassment, hate speech, threats, sexually explicit
              material, spam, impersonation, or posting anyone's private information.
            </p>
            <p>
              You can report any setlist, comment, or message in the app, and you can block any
              user. We review reports promptly, and we may remove content or suspend accounts that
              break these rules — swiftly and without ceremony.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-foreground">6. What We Don't Promise</h2>
            <p>
              Dead Set is provided as-is, free of charge, with no warranties. Recordings live on
              the Internet Archive and may change or disappear; the service may hiccup or evolve.
              To the maximum extent permitted by law, we're not liable for damages arising from
              your use of the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-foreground">7. Changes & Contact</h2>
            <p>
              We may update these terms; material changes will be posted here with a new date.
              Questions and reports: <strong>grateful_jaguaro@dead-set.org</strong>, or find us
              backstage in the app.
            </p>
          </section>
        </div>
      </main>

      <footer className="py-4 text-center border-t border-border/50">
        <p className="font-mono text-[10px] text-foreground/70 tracking-wider">
          © {new Date().getFullYear()} Dead-Set.Org — Built by Deadheads, for Deadheads
        </p>
      </footer>
    </PageLayout>
  );
};

export default Terms;
