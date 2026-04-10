import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
    className={`px-3 py-1.5 rounded-full text-xs font-body transition-all duration-200 border ${
      active
        ? "bg-[#C9A84C] text-[#0D0D0D] border-[#C9A84C]"
        : "bg-transparent text-[#C9A84C] border-[#C9A84C]/50 hover:border-[#C9A84C]"
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
  headlineFont,
  sublineFont,
}: {
  icon: string;
  headline: string;
  subline: string;
  headlineFont: string;
  sublineFont: string;
}) => (
  <div className="text-center py-16 space-y-3">
    <p className={`text-xl ${headlineFont}`}>
      {icon}&ensp;{headline}
    </p>
    <p className={`text-sm ${sublineFont}`}>{subline}</p>
  </div>
);

/* ─── Section Wrapper ─── */
const Section = ({
  number,
  title,
  orientation,
  children,
}: {
  number: string;
  title: string;
  orientation: string;
  children: React.ReactNode;
}) => (
  <section className="py-16 md:py-24">
    <p className="font-mono text-[11px] text-[#C9A84C] tracking-[0.2em] uppercase mb-3">
      {number}
    </p>
    <h2 className="font-display italic text-[30px] md:text-[36px] text-white/95 mb-2">
      {title}
    </h2>
    <p className="font-body text-[#A09A8E] text-base mb-10 max-w-lg">
      {orientation}
    </p>
    {children}
  </section>
);

/* ─── Label ─── */
const FieldLabel = ({ children }: { children: string }) => (
  <label className="block font-mono text-[10px] text-[#C9A84C] tracking-[0.2em] uppercase mb-2">
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
    className="w-full bg-[#141414] border border-[#C9A84C]/20 rounded-md px-4 py-3 font-mono text-sm text-white/90 placeholder:text-[#5a564e] focus:outline-none focus:border-[#C9A84C]/60 transition-colors"
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
    className="w-full bg-[#141414] border border-[#C9A84C]/20 rounded-md px-4 py-3 font-mono text-sm text-white/90 placeholder:text-[#5a564e] focus:outline-none focus:border-[#C9A84C]/60 transition-colors resize-none"
  />
);

/* ─── Submit Button ─── */
const SubmitButton = ({
  label,
  onClick,
  loading,
  glow,
  small,
}: {
  label: string;
  onClick: () => void;
  loading: boolean;
  glow?: boolean;
  small?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading}
    className={`border border-[#C9A84C] text-[#C9A84C] bg-transparent rounded-md font-body font-semibold transition-all duration-200 disabled:opacity-50 w-full md:w-auto md:min-w-[200px] ${
      small ? "px-6 py-2.5 text-sm" : "px-8 py-3 text-base"
    } hover:bg-[#C9A84C] hover:text-[#0D0D0D] ${
      glow ? "hover:shadow-[0_0_16px_rgba(201,168,76,0.3)]" : ""
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
          LAMINATE HEADER
          ════════════════════════════════════════════ */}
      <header className="relative overflow-hidden">
        {/* Watermark — abstract concentric circles */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 600 600"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          {[...Array(8)].map((_, i) => (
            <circle
              key={i}
              cx="300"
              cy="300"
              r={60 + i * 40}
              fill="none"
              stroke="#C9A84C"
              strokeWidth="0.5"
              opacity={0.06}
            />
          ))}
        </svg>

        {/* Grain overlay */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }} />

        <div className="relative border border-[#C9A84C] m-4 md:m-8 p-8 md:p-16">
          <p className="font-mono text-[11px] text-[#C9A84C] tracking-[0.2em] uppercase mb-6">
            DEAD SET 2 &nbsp;·&nbsp; INNER CIRCLE
          </p>

          <div className="w-full h-px bg-[#C9A84C]/30 mb-8" />

          <h1 className="font-display italic text-[30px] md:text-[36px] text-white/95 leading-tight mb-6">
            You're in the room.
          </h1>

          <div className="max-w-lg space-y-0 font-body text-[#A09A8E] text-base leading-[1.8]">
            <p>This is where we build it together.</p>
            <p className="mt-4">
              A small group of people who love this music
              as much as we do — and who'll help us make
              Dead Set the place it deserves to be.
            </p>
            <p className="mt-4 text-white/85">
              Tell us what's working. Tell us what's broken.<br />
              Tell us what you dream about.
            </p>
          </div>

          <p className="font-hand text-[18px] text-[#C9A84C] mt-8">
            "Every show found its way here somehow."
          </p>
        </div>
      </header>

      {/* ════════════════════════════════════════════
          CONTENT
          ════════════════════════════════════════════ */}
      <main className="max-w-2xl mx-auto px-6">

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
              headlineFont="font-display italic text-white/95"
              subline=""Thank you. This means more than you know.""
              sublineFont="font-body text-[#A09A8E]"
            />
          ) : (
            <div className="space-y-6">
              <div>
                <FieldLabel>YOUR FAVORITE SHOW</FieldLabel>
                <TextInput
                  placeholder="e.g. Barton Hall, Cornell · May 8, 1977"
                  value={s1.show}
                  onChange={(v) => setS1({ ...s1, show: v })}
                />
                <p className="font-hand text-sm text-[#A09A8E] mt-1.5">
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

              <div className="flex justify-center pt-2">
                <SubmitButton label="Add My Voice" onClick={submitShare} loading={s1Loading} />
              </div>
            </div>
          )}
        </Section>

        <div className="w-full h-px bg-[#C9A84C]/10" />

        {/* ── SECTION 02 · Bug Log ── */}
        <Section
          number="02 ·"
          title="Bug Log"
          orientation="Something broke. Something felt wrong. Tell us directly."
        >
          {s2Done ? (
            <Confirmation
              icon="✓"
              headline="Logged."
              headlineFont="font-mono text-[#C9A84C]"
              subline=""We'll look into it.""
              sublineFont="font-body text-[#A09A8E]"
            />
          ) : (
            <div className="space-y-6">
              <div>
                <FieldLabel>WHERE DID YOU HIT IT</FieldLabel>
                <div className="flex flex-wrap gap-2">
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
                <div className="flex flex-wrap gap-2">
                  <Pill label="Yes, every time" active={s2.repeats === true} onClick={() => setS2({ ...s2, repeats: true })} />
                  <Pill label="Just once" active={s2.repeats === false} onClick={() => setS2({ ...s2, repeats: false })} />
                </div>
              </div>

              <div>
                <FieldLabel>HOW BAD IS IT</FieldLabel>
                <div className="flex flex-wrap gap-2">
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
                <div className="flex flex-wrap gap-2">
                  {["Desktop", "iPhone", "Android", "Tablet"].map((d) => (
                    <Pill key={d} label={d} active={s2.device === d.toLowerCase()} onClick={() => setS2({ ...s2, device: d.toLowerCase() })} />
                  ))}
                </div>
              </div>

              <div className="flex flex-col items-center gap-4 pt-2">
                <SubmitButton label="Log It" onClick={submitBug} loading={s2Loading} small />
                <p className="font-hand text-sm text-[#C9A84C]">
                  "We read every single one."
                </p>
              </div>
            </div>
          )}
        </Section>

        <div className="w-full h-px bg-[#C9A84C]/10" />

        {/* ── SECTION 03 · Wish List ── */}
        <Section
          number="03 ·"
          title="Wish List"
          orientation="What would make Dead Set the place you come back to every day?"
        >
          {s3Done ? (
            <Confirmation
              icon="✓"
              headline="Wish received."
              headlineFont="font-display italic text-white/95"
              subline=""Building it with you.""
              sublineFont="font-hand text-[#C9A84C]"
            />
          ) : (
            <div className="space-y-6">
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
                  placeholder="What's working? What made you say "yes, this is it"?"
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

              <div className="flex flex-col items-center gap-4 pt-2">
                <p className="font-hand text-[16px] text-[#C9A84C]">
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
      <footer className="border-t border-[#C9A84C]/20 mt-16 py-8 text-center">
        <p className="font-mono text-[10px] text-[#C9A84C]/60 tracking-[0.15em] uppercase leading-relaxed">
          DEAD SET 2 &nbsp;·&nbsp; INNER CIRCLE PREVIEW
          <br />
          dead-set.org &nbsp;·&nbsp; Not for distribution
        </p>
      </footer>
    </div>
  );
};

export default Backstage;
