import { useNavigate } from "react-router-dom";
import PageLayout from "@/components/PageLayout";
import SiteHeader from "@/components/SiteHeader";

const About = () => {
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
          About Dead-Set.Org
        </h1>
        <p className="font-mono text-xs text-foreground/75 mb-8 tracking-wider uppercase">
          Free. Non-commercial. Built by Deadheads, for Deadheads.
        </p>

        <div className="space-y-8 font-body text-foreground/90 text-sm leading-relaxed">
          <section className="space-y-3">
            <p>
              Dead Set is a place to reconstruct the nights that mattered — build a setlist,
              press play, and hear the show through recordings that circulate freely, the way
              they always have.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-foreground">Where the music comes from</h2>
            <p>
              Every recording on Dead Set streams from the{" "}
              <a
                href="https://archive.org/details/GratefulDead"
                target="_blank"
                rel="noopener noreferrer"
                className="text-dead-gold underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                Internet Archive's Live Music Archive
              </a>
              . None of it lives on our servers, and none of it would exist without the tapers
              who stood in the crowd with microphones, the transferrers and uploaders who kept
              the tapes alive, and the traders who passed them hand to hand for fifty years.
              This whole thing is theirs. We just help you find your way around it, in
              accordance with{" "}
              <a
                href="https://archive.org/post/261115/hotlinking-allowed"
                target="_blank"
                rel="noopener noreferrer"
                className="text-dead-gold underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                Archive.org's streaming policy
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-foreground">Non-commercial, full stop</h2>
            <p>
              Dead Set carries no advertising, sells nothing, and seeks no commercial gain from
              the music. If you feel moved to support something, send it to the people doing the
              heavy lifting:{" "}
              <a
                href="https://archive.org/donate/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-dead-gold underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                donate to the Internet Archive
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-foreground">
              The Grateful Dead's policy on digital distribution
            </h2>
            <p>The band's long-standing notice, posted here as it asks to be:</p>
            <blockquote className="italic border-l-2 border-dead-gold/60 pl-4 text-foreground/80">
              The Grateful Dead and our managing organizations have long encouraged the purely
              non-commercial exchange of music taped at our concerts and those of our individual
              members. That a new medium of distribution has arisen &mdash; digital audio files being
              traded over the Internet &mdash; does not change our policy in this regard. Our
              stipulations regarding digital distribution are merely extensions of those
              long-standing principles and they are as follow: No commercial gain may be sought
              by websites offering digital files of our music, whether through advertising,
              exploiting databases compiled from their traffic, or any other means. All
              participants in such digital exchange acknowledge and respect the copyrights of
              the performers, writers and publishers of the music. This notice should be clearly
              posted on all sites engaged in this activity. We reserve the ability to withdraw
              our sanction of non-commercial digital music should circumstances arise that
              compromise our ability to protect and steward the integrity of our work.
            </blockquote>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-foreground">Free &amp; open source</h2>
            <p>
              The whole platform is open source under the{" "}
              <a
                href="https://github.com/eljaguaro-gitdown/dead-set-org-505d00a5/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="text-dead-gold underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                AGPL-3.0 license
              </a>{" "}
              — the same license our friends at Relisten chose. Browse the code, open an issue,
              or send a fix at{" "}
              <a
                href="https://github.com/eljaguaro-gitdown/dead-set-org-505d00a5"
                target="_blank"
                rel="noopener noreferrer"
                className="text-dead-gold underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                GitHub
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-foreground">Good neighbors</h2>
            <p>
              Dead Set stands alongside the projects that raised us:{" "}
              <a
                href="https://relisten.net"
                target="_blank"
                rel="noopener noreferrer"
                className="text-dead-gold underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                Relisten
              </a>
              ,{" "}
              <a
                href="https://headyversion.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-dead-gold underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                headyversion
              </a>
              , and the Archive itself. Go use them. They're wonderful.
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

export default About;
