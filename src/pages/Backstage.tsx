import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import backstagePassImg from "@/assets/backstage-pass.png";
import greenMmsImg from "@/assets/green-mms.png";
import bandStageImg from "@/assets/band-stage.jpg";

/* ─── Pill Button ─── */
const Pill = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-4 py-2 rounded-full text-sm font-body font-medium transition-all duration-200 border ${
      active
        ? "bg-primary text-[#0D0D0D] border-primary shadow-[0_0_12px_rgba(201,168,76,0.3)]"
        : "bg-transparent text-primary border-primary/50 hover:border-primary hover:bg-primary/10"
    }`}
  >
    {label}
  </button>
);

/* ─── Confirmation Block ─── */
const Confirmation = ({
  icon,
  headline,
  subline,
}: {
  icon: string;
  headline: string;
  subline: string;
}) => (
  <div className="text-center py-16 space-y-4">
    <p className="text-4xl">{icon}</p>
    <p className="text-2xl font-display italic text-white">{headline}</p>
    <p className="text-lg font-body text-primary">{subline}</p>
  </div>
);

/* ─── Section Wrapper ─── */
const Section = ({
  number,
  title,
  orientation,
  children,
  accent,
}: {
  number: string;
  title: string;
  orientation: string;
  children: React.ReactNode;
  accent?: React.ReactNode;
}) => (
  <section className="py-16 md:py-24 relative">
    {accent && <div className="absolute right-0 top-8 opacity-20 pointer-events-none hidden md:block">{accent}</div>}
    <p className="font-mono text-sm text-primary tracking-[0.2em] uppercase mb-4">
      {number}
    </p>
    <h2 className="font-display italic text-3xl md:text-4xl text-white mb-3">
      {title}
    </h2>
    <p className="font-body text-white/70 text-lg md:text-xl mb-12 max-w-xl leading-relaxed">
      {orientation}
    </p>
    {children}
  </section>
);

/* ─── Label ─── */
const FieldLabel = ({ children }: { children: string }) => (
  <label className="block font-mono text-xs text-primary tracking-[0.15em] uppercase mb-2.5 font-medium">
    {children}
  </label>
);

/* ─── Input ─── */
const TextInput = ({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (v: string) => void }) => (
  <input
    type="text"
    placeholder={placeholder}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="w-full bg-[#1a1a1a] border border-primary/25 rounded-lg px-5 py-4 font-body text-base text-white placeholder:text-white/30 focus:outline-none focus:border-primary/60 focus:shadow-[0_0_16px_rgba(201,168,76,0.1)] transition-all"
  />
);

/* ─── Textarea ─── */
const TextArea = ({
  placeholder,
  rows,
  value,
  onChange,
}: {
  placeholder: string;
  rows: number;
  value: string;
  onChange: (v: string) => void;
}) => (
  <textarea
    placeholder={placeholder}
    rows={rows}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="w-full bg-[#1a1a1a] border border-primary/25 rounded-lg px-5 py-4 font-body text-base text-white placeholder:text-white/30 focus:outline-none focus:border-primary/60 focus:shadow-[0_0_16px_rgba(201,168,76,0.1)] transition-all resize-none"
  />
);

/* ─── Submit Button ─── */
const SubmitButton = ({
  label,
  onClick,
  loading,
  glow,
}: {
  label: string;
  onClick: () => void;
  loading: boolean;
  glow?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading}
    className={`bg-gradient-to-r from-primary to-[#E8D48B] text-[#0D0D0D] rounded-lg font-body font-bold text-lg px-10 py-4 transition-all duration-300 disabled:opacity-50 w-full md:w-auto md:min-w-[240px] hover:scale-[1.02] active:scale-[0.98] ${
      glow ? "shadow-[0_0_24px_rgba(201,168,76,0.4)] hover:shadow-[0_0_32px_rgba(201,168,76,0.6)]" : "shadow-[0_0_16px_rgba(201,168,76,0.2)]"
    }`}
  >
    {loading ? "Sending…" : label}
  </button>
);

/* ═══════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════ */

const Backstage = () => {
  /* ── Section 01 state ── */
  const [s1, setS1] = useState({ show: "", songs: "", take: "", handle: "" });
  const [s1Done, setS1Done] = useState(false);
  const [s1Loading, setS1Loading] = useState(false);

  /* ── Section 02 state ── */
  const [s2, setS2] = useState({ location: "", description: "", repeats: null as boolean | null, severity: "", device: "" });
  const [s2Done, setS2Done] = useState(false);
  const [s2Loading, setS2Loading] = useState(false);

  /* ── Section 03 state ── */
  const [s3, setS3] = useState({ top: "", works: "", bigger: "" });
  const [s3Done, setS3Done] = useState(false);
  const [s3Loading, setS3Loading] = useState(false);

  const submitShare = async () => {
    setS1Loading(true);
    const { error } = await supabase.from("insider_shares" as any).insert({
      favorite_show: s1.show || null,
      favorite_songs: s1.songs || null,
      personal_take: s1.take || null,
      handle: s1.handle || null,
    } as any);
    setS1Loading(false);
    if (error) { toast.error("Something went wrong. Try again."); return; }
    setS1Done(true);
  };

  const submitBug = async () => {
    if (!s2.description.trim()) { toast.error("Please describe what happened."); return; }
    setS2Loading(true);
    const { error } = await supabase.from("insider_bugs" as any).insert({
      location: s2.location || null,
      description: s2.description,
      repeats: s2.repeats,
      severity: s2.severity || null,
      device: s2.device || null,
    } as any);
    setS2Loading(false);
    if (error) { toast.error("Something went wrong. Try again."); return; }
    setS2Done(true);
  };

  const submitWish = async () => {
    setS3Loading(true);
    const { error } = await supabase.from("insider_wishlist" as any).insert({
      top_request: s3.top || null,
      what_works: s3.works || null,
      bigger_picture: s3.bigger || null,
    } as any);
    setS3Loading(false);
    if (error) { toast.error("Something went wrong. Try again."); return; }
    setS3Done(true);
  };

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white">
      {/* ════════════════════════════════════════════
          HERO HEADER — Band photo + backstage pass
          ════════════════════════════════════════════ */}
      <header className="relative overflow-hidden min-h-[70vh] flex items-center">
        {/* Band photo background */}
        <img
          src={bandStageImg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-[#0D0D0D]" />

        {/* Gold vignette glow */}
        <div className="absolute inset-0" style={{
          backgroundImage: "radial-gradient(ellipse at 50% 30%, rgba(201,168,76,0.08) 0%, transparent 60%)",
        }} />

        <div className="relative z-10 w-full max-w-5xl mx-auto px-6 md:px-12 py-16 flex flex-col md:flex-row items-center gap-10">
          {/* Backstage pass image */}
          <div className="flex-shrink-0 w-48 md:w-64 transform -rotate-6 hover:rotate-0 transition-transform duration-500">
            <img
              src={backstagePassImg}
              alt="VIP All Access Backstage Pass"
              width={512}
              height={768}
              className="w-full h-auto drop-shadow-[0_8px_32px_rgba(201,168,76,0.4)]"
            />
          </div>

          {/* Header text */}
          <div className="text-center md:text-left flex-1">
            <p className="font-mono text-sm md:text-base text-primary tracking-[0.2em] uppercase mb-4">
              🎟️&ensp;DEAD SET &nbsp;·&nbsp; ALL ACCESS
            </p>

            <h1 className="font-display italic text-4xl md:text-5xl lg:text-6xl text-white leading-tight mb-6">
              You're backstage now.
            </h1>

            <div className="space-y-4 font-body text-white/80 text-lg md:text-xl leading-relaxed max-w-lg">
              <p>
                Welcome to the inner circle. This is where we build Dead Set together — 
                a small group of people who love this music as much as we do.
              </p>
              <p className="text-white">
                Tell us what's working. Tell us what's broken. Tell us what you dream about.
              </p>
            </div>

            <p className="font-display italic text-xl md:text-2xl text-primary mt-8">
              "Every show found its way here somehow."
            </p>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════
          GREEN M&Ms — Fun divider
          ════════════════════════════════════════════ */}
      <div className="relative flex justify-center py-6 overflow-hidden">
        <div className="flex items-center gap-6">
          <div className="h-px w-24 md:w-40 bg-gradient-to-r from-transparent to-primary/30" />
          <img
            src={greenMmsImg}
            alt="Bowl of green M&Ms — the real backstage rider"
            width={512}
            height={512}
            loading="lazy"
            className="w-20 md:w-28 h-auto drop-shadow-[0_4px_16px_rgba(0,200,0,0.2)] hover:scale-110 transition-transform duration-300"
          />
          <p className="font-body text-white/50 text-sm italic hidden sm:block">
            Only green ones backstage.
          </p>
          <div className="h-px w-24 md:w-40 bg-gradient-to-l from-transparent to-primary/30" />
        </div>
      </div>

      {/* ════════════════════════════════════════════
          CONTENT
          ════════════════════════════════════════════ */}
      <main className="max-w-3xl mx-auto px-6 md:px-8">

        {/* ── SECTION 01 · Share Your Set ── */}
        <Section
          number="01 ·"
          title="Share Your Set"
          orientation="Your favorite shows, songs, and moments. What does Dead Set help you find?"
        >
          {s1Done ? (
            <Confirmation
              icon="✓"
              headline="Your voice is in the room now."
              subline="Thank you. This means more than you know."
            />
          ) : (
            <div className="space-y-8">
              <div>
                <FieldLabel>YOUR FAVORITE SHOW</FieldLabel>
                <TextInput
                  placeholder="e.g. Barton Hall, Cornell · May 8, 1977"
                  value={s1.show}
                  onChange={(v) => setS1({ ...s1, show: v })}
                />
                <p className="font-display italic text-base text-white/50 mt-2">
                  Or the one you keep coming back to.
                </p>
              </div>

              <div>
                <FieldLabel>SONGS THAT MOVE YOU</FieldLabel>
                <TextArea
                  rows={3}
                  placeholder="List as many as you want. No wrong answers."
                  value={s1.songs}
                  onChange={(v) => setS1({ ...s1, songs: v })}
                />
              </div>

              <div>
                <FieldLabel>WHAT DOES DEAD SET DO FOR YOU</FieldLabel>
                <TextArea
                  rows={4}
                  placeholder="Tell us in your own words. Don't be brief."
                  value={s1.take}
                  onChange={(v) => setS1({ ...s1, take: v })}
                />
              </div>

              <div>
                <FieldLabel>WHO ARE YOU (OPTIONAL)</FieldLabel>
                <TextInput
                  placeholder="Or stay anonymous. Either is fine."
                  value={s1.handle}
                  onChange={(v) => setS1({ ...s1, handle: v })}
                />
              </div>

              <div className="flex justify-center pt-4">
                <SubmitButton label="Add My Voice" onClick={submitShare} loading={s1Loading} />
              </div>
            </div>
          )}
        </Section>

        <div className="w-full h-px bg-primary/15" />

        {/* ── SECTION 02 · Bug Log ── */}
        <Section
          number="02 ·"
          title="Bug Log"
          orientation="Something broke. Something felt wrong. Tell us directly — we read every single one."
        >
          {s2Done ? (
            <Confirmation
              icon="🔧"
              headline="Logged."
              subline="We'll look into it."
            />
          ) : (
            <div className="space-y-8">
              <div>
                <FieldLabel>WHERE DID YOU HIT IT</FieldLabel>
                <div className="flex flex-wrap gap-3">
                  {[
                    { label: "Landing Page", value: "landing" },
                    { label: "Builder / Setlist Generator", value: "builder" },
                    { label: "Setlist View", value: "setlist" },
                    { label: "Sharing", value: "sharing" },
                    { label: "Login / Account", value: "account" },
                    { label: "Other", value: "other" },
                  ].map((opt) => (
                    <Pill
                      key={opt.value}
                      label={opt.label}
                      active={s2.location === opt.value}
                      onClick={() => setS2({ ...s2, location: opt.value })}
                    />
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>WHAT HAPPENED</FieldLabel>
                <TextArea
                  rows={3}
                  placeholder="Just describe it plainly. No tech jargon needed."
                  value={s2.description}
                  onChange={(v) => setS2({ ...s2, description: v })}
                />
              </div>

              <div>
                <FieldLabel>DID IT REPEAT</FieldLabel>
                <div className="flex flex-wrap gap-3">
                  <Pill label="Yes, every time" active={s2.repeats === true} onClick={() => setS2({ ...s2, repeats: true })} />
                  <Pill label="Just once" active={s2.repeats === false} onClick={() => setS2({ ...s2, repeats: false })} />
                </div>
              </div>

              <div>
                <FieldLabel>HOW BAD IS IT</FieldLabel>
                <div className="flex flex-wrap gap-3">
                  {[
                    { label: "Can't use the site", value: "blocking" },
                    { label: "Annoying but workable", value: "annoying" },
                    { label: "Minor, just flagging it", value: "minor" },
                  ].map((opt) => (
                    <Pill key={opt.value} label={opt.label} active={s2.severity === opt.value} onClick={() => setS2({ ...s2, severity: opt.value })} />
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>DEVICE</FieldLabel>
                <div className="flex flex-wrap gap-3">
                  {["Desktop", "iPhone", "Android", "Tablet"].map((d) => (
                    <Pill key={d} label={d} active={s2.device === d.toLowerCase()} onClick={() => setS2({ ...s2, device: d.toLowerCase() })} />
                  ))}
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <SubmitButton label="Log It" onClick={submitBug} loading={s2Loading} />
              </div>
            </div>
          )}
        </Section>

        <div className="w-full h-px bg-primary/15" />

        {/* ── SECTION 03 · Wish List ── */}
        <Section
          number="03 ·"
          title="Wish List"
          orientation="What would make Dead Set the place you come back to every day?"
        >
          {s3Done ? (
            <Confirmation
              icon="✨"
              headline="Wish received."
              subline="Building it with you."
            />
          ) : (
            <div className="space-y-8">
              <div>
                <FieldLabel>IF YOU COULD ADD ONE THING</FieldLabel>
                <TextArea
                  rows={4}
                  placeholder="Don't filter yourself. Dream a little."
                  value={s3.top}
                  onChange={(v) => setS3({ ...s3, top: v })}
                />
              </div>

              <div>
                <FieldLabel>WHAT YOU ALREADY LOVE</FieldLabel>
                <TextArea
                  rows={3}
                  placeholder={"What\u2019s working? What made you say \u201Cyes, this is it\u201D?"}
                  value={s3.works}
                  onChange={(v) => setS3({ ...s3, works: v })}
                />
              </div>

              <div>
                <FieldLabel>THE BIGGER PICTURE</FieldLabel>
                <TextArea
                  rows={3}
                  placeholder="What should Dead Set be in five years? What does the community need?"
                  value={s3.bigger}
                  onChange={(v) => setS3({ ...s3, bigger: v })}
                />
              </div>

              <div className="flex flex-col items-center gap-5 pt-4">
                <p className="font-display italic text-xl text-primary">
                  "We're building this for you."
                </p>
                <SubmitButton label="Send My Wish" onClick={submitWish} loading={s3Loading} glow />
              </div>
            </div>
          )}
        </Section>
      </main>

      {/* ════════════════════════════════════════════
          FOOTER
          ════════════════════════════════════════════ */}
      <footer className="border-t border-primary/20 mt-16 py-10 text-center">
        <p className="font-mono text-sm text-primary/60 tracking-[0.15em] uppercase leading-relaxed">
          DEAD SET &nbsp;·&nbsp; ALL ACCESS &nbsp;·&nbsp; INNER CIRCLE
          <br />
          <span className="text-white/40">dead-set.org</span>
        </p>
      </footer>
    </div>
  );
};

export default Backstage;
