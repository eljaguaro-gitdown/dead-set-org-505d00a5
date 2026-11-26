import { useEffect, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import PageLayout from "@/components/PageLayout";
import SiteHeader from "@/components/SiteHeader";
import { CHARLIE_ANCHOR } from "@/lib/charlieCredit";

const linkClass =
  "text-dead-gold underline underline-offset-2 hover:text-primary/80 transition-colors";

const Outbound = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
    {children}
  </a>
);

const About = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Every "*Cosmic Charlie" credit on the site links to #cosmic-charlie. The
  // router does not scroll to a hash on its own, so a reader tapping one from
  // a setlist would land at the top of the page.
  useEffect(() => {
    const id = location.hash.replace("#", "");
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash]);

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

          <section id={CHARLIE_ANCHOR} className="space-y-3 scroll-mt-24">
            <h2 className="font-display text-lg text-foreground">
              Cosmic Charlie and the liner notes
            </h2>
            <p>
              Cosmic Charlie is the voice of the liner notes on Dead Set. He isn&rsquo;t a
              person. He&rsquo;s a voice we built to write the way grateful_jaguaro, the
              Deadhead who started dead-set.org, talks about tapes. That voice is modeled on
              the people who taught a lot of us how to listen: David Lemieux, who has kept the
              vault and told its stories for decades; Dick Latvala, the tape archivist whose
              Dick&rsquo;s Picks opened the vault to the rest of us; and Steve Parish, who was
              on the stage for all of it and lived to tell it. The debt is ours. None of them
              is affiliated with Dead Set.
            </p>
            <p>
              <strong className="text-foreground">How he writes.</strong> Charlie works from
              the record: the date and the room, the setlist, the era, who was on stage, and
              how heads have voted on the night. From that he writes a line or two on what to
              listen for, like how far the jam goes, how it moves into the next song, or where
              the band was that year. His notes are a way into the music, not the record
              itself. If a note and the setlist disagree, the setlist is right. Anywhere you
              see <span className="font-ticket text-xs uppercase tracking-[0.12em]">*Cosmic Charlie</span>{" "}
              after a note, he wrote it.
            </p>
            <p>
              <strong className="text-foreground">Your words replace his.</strong> Charlie is
              keeping the seat warm. The plan is for this community to take the notes over:
              correct him, add what you heard, write your own. Rewrite one of his notes in your
              setlist and it&rsquo;s yours. His name comes off it.
            </p>

            <h3 className="font-display text-base text-foreground pt-2">Where the facts come from</h3>
            <p>
              <strong className="text-foreground">The setlists.</strong> Our first draft of
              every night comes from the tapes themselves: the setlists, track titles and
              lineage notes that tapers and transferrers wrote into each recording on the Live
              Music Archive. When a night is in question, we check it against two independent
              setlist records,{" "}
              <Outbound href="https://jerrybase.com">JerryBase</Outbound> and{" "}
              <Outbound href="https://relisten.net">Relisten</Outbound>. If those two agree
              with each other and not with us, they win. Charlie&rsquo;s picks get the same
              check before a listening guide is saved. If the band didn&rsquo;t play the song
              that night, the night doesn&rsquo;t go in the guide.
            </p>
            <p>
              <strong className="text-foreground">First played, last played.</strong> These
              get the same test. In November 2026 we checked every first- and last-played date
              in the catalog against JerryBase and Relisten and corrected 100 dates across 84
              songs. When a Songbook issue gives a play count, it names its source,{" "}
              <Outbound href="https://www.setlist.fm">setlist.fm</Outbound>, and links to the
              page.
            </p>
            <p>
              <strong className="text-foreground">The rankings.</strong> When a song&rsquo;s
              versions are ranked by vote, the votes are{" "}
              <Outbound href="https://headyversion.com">headyversion</Outbound>&rsquo;s: years
              of heads arguing it out, one night at a time. We show their counts and credit
              them by name.
            </p>
            <p>
              <strong className="text-foreground">With gratitude.</strong> To the tapers,
              transferrers and seeders, whose notes are the foundation. To the Internet
              Archive. To JerryBase, Relisten, headyversion and setlist.fm, and the volunteers
              who build them. Their work is why ours can be right. None of them is responsible
              for our mistakes, and none of them endorses Dead Set. We read their public pages
              and link back to them. If any of them would rather we didn&rsquo;t, we&rsquo;ll
              stop.
            </p>
            <p>
              <strong className="text-foreground">Found something wrong?</strong> Tell us in{" "}
              <Link to="/backstage" className={linkClass}>
                Backstage
              </Link>{" "}
              and we&rsquo;ll check it against the sources above.
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
            <h2 className="font-display text-lg text-foreground">Not affiliated with the band</h2>
            <p>
              Dead Set is an independent, non-commercial fan project. It is not affiliated with,
              endorsed by, or sponsored by the Grateful Dead, Grateful Dead Productions, Rhino
              Entertainment, or Warner Music Group. All trademarks are the property of their
              respective owners. Recordings stream from the Internet Archive&rsquo;s Live Music
              Archive and belong to the tapers and the community that has kept them alive.
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
